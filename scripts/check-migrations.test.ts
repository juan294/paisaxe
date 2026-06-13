import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
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
});
