import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { getFunctionHeader, normalizeSql, validateMigrations } from "./check-migrations";

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

  it("fails when pending_bookings (created without a public. prefix, like migration 053) lacks full service-role-only posture", () => {
    const root = createMigrationFixture({
      "001_pending_bookings.sql": `
        CREATE TABLE pending_bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          venue_phone TEXT NOT NULL,
          special_requests TEXT
        );

        ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "Sensitive table public.pending_bookings must revoke privileges from anon"
    );
    expect(result.errors).toContain(
      "Sensitive table public.pending_bookings must revoke privileges from authenticated"
    );
    expect(result.errors).toContain(
      "Sensitive table public.pending_bookings must grant service_role access explicitly"
    );
    expect(result.errors).toContain(
      "Sensitive table public.pending_bookings must define a service_role RLS policy"
    );
  });

  it("passes when pending_bookings (created without a public. prefix) is explicitly service-role-only", () => {
    const root = createMigrationFixture({
      "001_pending_bookings.sql": `
        CREATE TABLE pending_bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          venue_phone TEXT NOT NULL,
          special_requests TEXT
        );

        ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE public.pending_bookings FROM anon;
        REVOKE ALL ON TABLE public.pending_bookings FROM authenticated;
        GRANT ALL ON TABLE public.pending_bookings TO service_role;
        CREATE POLICY "Service role can manage pending_bookings"
          ON public.pending_bookings
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

  it.each([
    "SET search_path=''",
    "SET search_path = ''",
    "SET search_path TO ''",
    "SET search_path='' STABLE",
    `SET "search_path"=''`,
    "SET search_path=public SET search_path=''",
  ])("accepts an empty search_path declaration: %s", (declaration) => {
    const root = createMigrationFixture({
      "001_function.sql": `CREATE FUNCTION public.checked_function() RETURNS void
        LANGUAGE plpgsql SECURITY DEFINER ${declaration}
        AS $$ BEGIN NULL; END; $$;`,
    });

    expect(validateMigrations({ root }).errors).toEqual([]);
  });

  it.each([
    "SET search_path = '', public",
    "SET search_path = '' , public",
    "SET search_path = '''public'''",
    String.raw`SET search_path = E'\'public\''`,
    "SET search_path = '' SET search_path=public",
    `SET search_path = '' SET "search_path"=public`,
    "SET search_path = '' SET search_path FROM CURRENT",
    `SET application_name = 'set search_path = '''''`,
    `SET search_path=public SET application_name = 'set search_path = '''''`,
    "SET application_name = $q$set search_path='' LANGUAGE $q$",
  ])("rejects a nonempty or missing search_path declaration: %s", (declaration) => {
    const root = createMigrationFixture({
      "001_function.sql": `CREATE FUNCTION public.checked_function() RETURNS void
        LANGUAGE plpgsql SECURITY DEFINER ${declaration}
        AS $$ BEGIN NULL; END; $$;`,
    });

    expect(validateMigrations({ root }).errors).toContain(
      "SECURITY DEFINER function public.checked_function must use SET search_path = ''"
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
      "SECURITY DEFINER function public.fail_stale_story_translations must use SET search_path = ''"
    );
  });

  it("fails when a SECURITY DEFINER function with a name outside the old 3-name allowlist lacks SET search_path (#876)", () => {
    // Regression test for QA-M5: the old checkTranslationFunctionSearchPaths only
    // checked TRANSLATION_SECURITY_DEFINER_FUNCTIONS (3 hard-coded names). Any other
    // SECURITY DEFINER function -- like this arbitrary one -- must now be caught too.
    const root = createMigrationFixture({
      "001_arbitrary_function.sql": `
        CREATE OR REPLACE FUNCTION public.totally_unrelated_admin_helper(
          p_id uuid
        ) RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "SECURITY DEFINER function public.totally_unrelated_admin_helper must use SET search_path = ''"
    );
  });

  it("does not flag a SECURITY INVOKER (non-DEFINER) function for missing search_path", () => {
    const root = createMigrationFixture({
      "001_invoker_function.sql": `
        CREATE OR REPLACE FUNCTION public.harmless_invoker_helper()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toEqual([]);
  });

  it("judges a SECURITY DEFINER function on its latest redefinition, not an earlier non-compliant one", () => {
    const root = createMigrationFixture({
      "001_create_bad.sql": `
        CREATE OR REPLACE FUNCTION public.evolving_function()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
      "002_fix_search_path.sql": `
        CREATE OR REPLACE FUNCTION public.evolving_function()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
    });

    const result = validateMigrations({ root });

    expect(
      result.errors.some((error) => error.includes("evolving_function"))
    ).toBe(false);
  });

  it("does not fire on a DROP FUNCTION statement for a SECURITY DEFINER function name", () => {
    // A DROP FUNCTION IF EXISTS statement (e.g. dropping an old overload before
    // recreating with a new signature) must not be mistaken for a function header.
    const root = createMigrationFixture({
      "001_create.sql": `
        CREATE OR REPLACE FUNCTION public.replaced_function(p_a text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
      "002_drop_and_recreate.sql": `
        DROP FUNCTION IF EXISTS public.replaced_function(text);

        CREATE OR REPLACE FUNCTION public.replaced_function(p_a text, p_b text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
    });

    const result = validateMigrations({ root });

    expect(
      result.errors.some((error) => error.includes("replaced_function"))
    ).toBe(false);
  });

  it("stops tracking a SECURITY DEFINER function once it is dropped without a later recreation", () => {
    // Regression guard for the altitude gap identified in #876's /simplify pass:
    // a stale cached header for a permanently-dropped function must not cause a
    // false-positive error, even if that stale header was non-compliant.
    const root = createMigrationFixture({
      "001_create_noncompliant.sql": `
        CREATE OR REPLACE FUNCTION public.retired_function()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          NULL;
        END;
        $$;
      `,
      "002_drop_for_good.sql": `
        DROP FUNCTION IF EXISTS public.retired_function();
      `,
    });

    const result = validateMigrations({ root });

    expect(
      result.errors.some((error) => error.includes("retired_function"))
    ).toBe(false);
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

  it("fails when a public table is created without RLS and no revoke exception", () => {
    const root = createMigrationFixture({
      "001_no_rls_table.sql": `
        CREATE TABLE IF NOT EXISTS public.newsletter_signups (
          id uuid PRIMARY KEY,
          email text NOT NULL
        );
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "Table public.newsletter_signups has no RLS enabled and no documented anon/authenticated revoke exception -- enable RLS or add explicit REVOKE ... FROM anon, authenticated with a comment explaining why"
    );
  });

  it("passes when a public table enables RLS", () => {
    const root = createMigrationFixture({
      "001_rls_table.sql": `
        CREATE TABLE IF NOT EXISTS public.newsletter_signups (
          id uuid PRIMARY KEY,
          email text NOT NULL
        );

        ALTER TABLE public.newsletter_signups ENABLE ROW LEVEL SECURITY;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).not.toContain(
      "Table public.newsletter_signups has no RLS enabled and no documented anon/authenticated revoke exception -- enable RLS or add explicit REVOKE ... FROM anon, authenticated with a comment explaining why"
    );
  });

  it("passes when a public table without RLS has an explicit documented revoke exception (admin_audit_log pattern)", () => {
    const root = createMigrationFixture({
      "001_audit_log.sql": `
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id uuid PRIMARY KEY,
          action text NOT NULL
        );

        -- Only admins (service role) should access this table.
        -- Disable RLS so service-key client can write freely; the table itself is not
        -- exposed to the anon or authenticated roles.
        ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY;

        -- Ensure authenticated/anon roles cannot select from this table.
        REVOKE ALL ON admin_audit_log FROM anon, authenticated;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toEqual([]);
  });

  it("tracks RLS posture across a table rename", () => {
    const root = createMigrationFixture({
      "001_create.sql": `
        CREATE TABLE IF NOT EXISTS public.old_name (
          id uuid PRIMARY KEY
        );
      `,
      "002_rename_and_secure.sql": `
        ALTER TABLE public.old_name RENAME TO new_name;
        ALTER TABLE public.new_name ENABLE ROW LEVEL SECURITY;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toEqual([]);
  });

  it("fails when a renamed table still lacks RLS under its new name", () => {
    const root = createMigrationFixture({
      "001_create.sql": `
        CREATE TABLE IF NOT EXISTS public.old_name (
          id uuid PRIMARY KEY
        );
      `,
      "002_rename.sql": `
        ALTER TABLE public.old_name RENAME TO new_name;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toContain(
      "Table public.new_name has no RLS enabled and no documented anon/authenticated revoke exception -- enable RLS or add explicit REVOKE ... FROM anon, authenticated with a comment explaining why"
    );
  });

  it("ignores tables that were dropped by a later migration", () => {
    const root = createMigrationFixture({
      "001_create.sql": `
        CREATE TABLE IF NOT EXISTS public.analytics_events (
          id uuid PRIMARY KEY
        );
        ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
      `,
      "002_drop.sql": `
        DROP TABLE IF EXISTS public.analytics_events CASCADE;
      `,
    });

    const result = validateMigrations({ root });

    expect(result.errors).toEqual([]);
  });

  it("keeps notify_webhook's SECURITY DEFINER search_path locked to '' (BE-M2, #783)", () => {
    // Migration 015 originally fixed public.notify_webhook() to
    // `SECURITY DEFINER ... SET search_path = ''`. Migration 025 later
    // redefined the same function (to read config from webhook_config
    // instead of app.* settings) and silently reverted the search_path to
    // `public, extensions` — this is exactly the regression BE-M2 fixes.
    //
    // This test reads the real repo migrations directly, reusing the same
    // normalizeSql/getFunctionHeader helpers the general validateMigrations()
    // guard uses for its 3-name translation function allowlist (see QA-M5,
    // out of scope here — this test does not extend that allowlist).
    const migrationsDir = "supabase/migrations";
    const migrationFiles = readdirSync(migrationsDir)
      .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
      .sort();

    let latestHeader: string | null = null;
    for (const name of migrationFiles) {
      const sql = normalizeSql(readFileSync(join(migrationsDir, name), "utf8"));
      const header = getFunctionHeader(sql, "notify_webhook");
      if (header) latestHeader = header;
    }

    expect(latestHeader, "no migration defines public.notify_webhook()").not.toBeNull();
    expect(latestHeader!).toContain("security definer");
    expect(latestHeader!).toContain("set search_path = ''");
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
