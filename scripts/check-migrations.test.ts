import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { validateMigrations } from "./check-migrations";

function createMigrationFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "paisaxe-migrations-"));
  const migrationsDir = join(root, "supabase", "migrations");
  mkdirSync(migrationsDir, { recursive: true });

  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(join(migrationsDir, name), sql);
  }

  return root;
}

describe("validateMigrations", () => {
  it("fails when a sensitive operational table lacks service-role-only posture", () => {
    const root = createMigrationFixture({
      "001_sensitive_table.sql": `
        CREATE TABLE IF NOT EXISTS public.booking_sms_jobs (
          id uuid PRIMARY KEY,
          to_phone text NOT NULL,
          message text NOT NULL
        );
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "Sensitive table public.booking_sms_jobs must enable RLS"
    );
    expect(result.errors).toContain(
      "Sensitive table public.booking_sms_jobs must revoke privileges from anon"
    );
    expect(result.errors).toContain(
      "Sensitive table public.booking_sms_jobs must revoke privileges from authenticated"
    );
  });

  it("passes when a sensitive operational table is explicitly service-role-only", () => {
    const root = createMigrationFixture({
      "001_sensitive_table.sql": `
        CREATE TABLE IF NOT EXISTS public.booking_sms_jobs (
          id uuid PRIMARY KEY,
          to_phone text NOT NULL,
          message text NOT NULL
        );

        ALTER TABLE public.booking_sms_jobs ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE public.booking_sms_jobs FROM anon;
        REVOKE ALL ON TABLE public.booking_sms_jobs FROM authenticated;
        GRANT ALL ON TABLE public.booking_sms_jobs TO service_role;
        CREATE POLICY "Service role can manage booking_sms_jobs"
          ON public.booking_sms_jobs
          FOR ALL
          TO service_role
          USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toEqual([]);
  });

  it("fails when SMS completion revokes reference the dropped two-argument signature", () => {
    const root = createMigrationFixture({
      "001_create_complete_booking_sms_job.sql": `
        CREATE OR REPLACE FUNCTION public.complete_booking_sms_job(
          p_event_key text,
          p_provider_sid text DEFAULT NULL,
          p_outcome_message text DEFAULT NULL
        ) RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $$
        BEGIN
          RETURN true;
        END;
        $$;
      `,
      "002_revoke_internal_function_access.sql": `
        REVOKE ALL ON FUNCTION public.complete_booking_sms_job(
          p_event_key text,
          p_provider_sid text
        ) FROM PUBLIC;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "Internal function revokes must target public.complete_booking_sms_job(text, text, text), not the dropped two-argument signature"
    );
  });

  it("fails when SECURITY DEFINER translation functions keep public in search_path", () => {
    const root = createMigrationFixture({
      "001_translation_function.sql": `
        CREATE OR REPLACE FUNCTION public.fail_stale_story_translations(
          p_cutoff timestamptz
        ) RETURNS integer
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, extensions
        AS $$
        BEGIN
          RETURN 0;
        END;
        $$;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "SECURITY DEFINER translation function public.fail_stale_story_translations must use SET search_path = ''"
    );
  });

  it("validates repository migrations including sensitive table and credential checks", () => {
    const result = validateMigrations({ root: process.cwd() });

    expect(result.errors).toEqual([]);
  });

  it("rejects a timestamp-prefixed migration filename fast instead of scanning an astronomical gap range (#828)", () => {
    // Simulates docs/operations/rollback.md's old `$(date +%Y%m%d%H%M%S)` example:
    // a 14-digit timestamp still parses as a migration number (~2e13). The pre-fix
    // gap scanner looped `for (let i = min; i <= max; i++)`, which for this fixture
    // would iterate roughly twenty trillion times — a hang/OOM in check-migrations.
    const root = createMigrationFixture({
      "001_init.sql": "-- noop",
      "002_add_thing.sql": "-- noop",
      "20260818120000_revert_bad.sql": "-- noop",
    });

    const start = performance.now();
    const result = validateMigrations({ root });
    const elapsedMs = performance.now() - start;

    // Must fail fast (milliseconds, not hours) rather than iterating the full range.
    expect(elapsedMs).toBeLessThan(2000);
    expect(
      result.errors.some((error) => /implausib/i.test(error) && error.includes("20260818120000"))
    ).toBe(true);
  });

  it("still detects a real undocumented gap without regressing on the pairwise rewrite", () => {
    const root = createMigrationFixture({
      "001_a.sql": "-- noop",
      "002_b.sql": "-- noop",
      // 003 is missing and NOT in KNOWN_GAPS — must still be flagged.
      "004_c.sql": "-- noop",
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "Unexpected migration gap: missing 003 (not in KNOWN_GAPS)"
    );
  });

  it("does not flag the project's documented historical gaps (5, 23, 24)", () => {
    const files: Record<string, string> = {};
    for (let n = 1; n <= 26; n++) {
      if (n === 5 || n === 23 || n === 24) continue; // documented KNOWN_GAPS
      files[`${String(n).padStart(3, "0")}_migration.sql`] = "-- noop";
    }
    const root = createMigrationFixture(files);

    const result = validateMigrations({ root });

    expect(result.errors.filter((error) => error.includes("Unexpected migration gap"))).toEqual(
      []
    );
  });

  it("keeps the Stripe webhook route aligned with the stripe_webhook_events schema", () => {
    const schema = readFileSync(
      "supabase/migrations/077_stripe_webhook_events.sql",
      "utf8"
    );
    const rpc = readFileSync(
      "supabase/migrations/084_fix_grant_day_pass_atomicity.sql",
      "utf8"
    );
    const route = readFileSync("src/app/api/webhooks/stripe/route.ts", "utf8");

    expect(schema).toMatch(/event_id\s+TEXT\s+UNIQUE\s+NOT\s+NULL/i);
    expect(schema).not.toMatch(/\bstripe_event_id\b/i);
    expect(schema).not.toMatch(/\bevent_type\b/i);
    expect(schema).not.toMatch(/\bpayload\b/i);
    expect(rpc).toMatch(/INSERT\s+INTO\s+public\.stripe_webhook_events\s*\(\s*event_id\s*\)/i);
    expect(route).not.toMatch(/\bstripe_event_id\b/);
    expect(route).not.toMatch(/\bevent_type\b/);
    expect(route).not.toMatch(/\bpayload\b/);
  });
});
