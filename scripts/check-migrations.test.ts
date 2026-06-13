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

  it("validates repository migrations including sensitive table and credential checks", () => {
    const result = validateMigrations({ root: process.cwd() });

    expect(result.errors).toEqual([]);
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
