/**
 * SE-H1 / BE-M9 (#841, #790): feature_flags.config must not be readable by anon
 * via a direct PostgREST call, even though src/app/api/feature-flags/route.ts
 * already scrubs whitelisted_emails/agent_id at the app layer. Before migration
 * 101, any client could bypass that scrub entirely by querying PostgREST
 * directly with the public anon key (e.g. `feature_flags?select=flag_key,config`).
 *
 * These tests exercise the REAL local Supabase stack over HTTP (not a mock) so
 * the RLS/grant posture is actually verified, not assumed. They require a local
 * Supabase Docker stack (`supabase start`) and are skipped automatically when
 * one isn't reachable — CI does not run a local Supabase stack for these tests,
 * consistent with the rest of the migration-safety workflow (see
 * .claude/rules/supabase.md), so this suite is a local/manual verification gate,
 * not a CI gate.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOCAL_ANON_KEY as ANON_KEY,
  LOCAL_REST_URL as REST_URL,
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const TEST_FLAG_KEY = "visitor_voice_agent";
const TEST_ENVIRONMENT = "development";
const SENSITIVE_CONFIG = {
  whitelisted_emails: ["secret-se-h1@example.com"],
  agent_id: "agent_super_secret_id",
  other_key: "keep_me",
};

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("route.postgrest-rls.test.ts");
}

describe.skipIf(!dbReachable)(
  "SE-H1/BE-M9: feature_flags anon PostgREST access (live local Supabase)",
  () => {
    beforeAll(() => {
      // Seed a known sensitive config as the postgres superuser so the
      // assertions below don't depend on whatever happens to be seeded already.
      const configJson = JSON.stringify(SENSITIVE_CONFIG).replace(/'/g, "''");
      psql(
        `UPDATE public.feature_flags SET config = '${configJson}'::jsonb ` +
          `WHERE flag_key = '${TEST_FLAG_KEY}' AND environment = '${TEST_ENVIRONMENT}';`
      );
    });

    afterAll(() => {
      // Restore to an empty config so this test doesn't leave secrets behind
      // in the local dev database.
      psql(
        `UPDATE public.feature_flags SET config = '{}'::jsonb ` +
          `WHERE flag_key = '${TEST_FLAG_KEY}' AND environment = '${TEST_ENVIRONMENT}';`
      );
    });

    it("denies anon SELECT of feature_flags.config on the base table", async () => {
      const res = await fetch(`${REST_URL}/feature_flags?select=flag_key,config&limit=1`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      });

      // PostgREST returns a permission error (not a 200 with data) once the
      // anon role loses column-level SELECT on `config`.
      expect(res.ok).toBe(false);
      const body = await res.json();
      expect(body.message ?? "").toMatch(/permission denied/i);
    });

    it("still allows anon SELECT of non-sensitive columns on the base table", async () => {
      const res = await fetch(
        `${REST_URL}/feature_flags?select=flag_key,enabled,label,description,environment&limit=1`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("strips whitelisted_emails/agent_id from visitor_voice_agent via feature_flags_public", async () => {
      const res = await fetch(
        `${REST_URL}/feature_flags_public?select=flag_key,config&flag_key=eq.${TEST_FLAG_KEY}&environment=eq.${TEST_ENVIRONMENT}`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].config).not.toHaveProperty("whitelisted_emails");
      expect(body[0].config).not.toHaveProperty("agent_id");
      // Non-sensitive keys on the same flag survive the mask unchanged.
      expect(body[0].config.other_key).toBe("keep_me");
    });

    it("passes maintenance_mode config through feature_flags_public unmodified", async () => {
      // Ground truth read directly from the base table (postgres superuser),
      // independent of the anon-facing PostgREST path under test.
      const baseConfigJson = psql(
        `SELECT config::text FROM public.feature_flags ` +
          `WHERE flag_key = 'maintenance_mode' AND environment = '${TEST_ENVIRONMENT}';`
      );

      const viewRes = await fetch(
        `${REST_URL}/feature_flags_public?select=config&flag_key=eq.maintenance_mode&environment=eq.${TEST_ENVIRONMENT}`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      );

      expect(viewRes.ok).toBe(true);
      const viewBody = await viewRes.json();
      // coming-soon/page.tsx relies on this: maintenance_mode's config is not
      // sensitive, so the view must not mask it.
      expect(viewBody[0].config).toEqual(JSON.parse(baseConfigJson));
    });
  }
);
