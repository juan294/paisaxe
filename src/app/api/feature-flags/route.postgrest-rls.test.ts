/**
 * SE-H1 / BE-M9 (#841, #790): feature_flags.config must not be readable by anon
 * via a direct PostgREST call, even though src/app/api/feature-flags/route.ts
 * already scrubs whitelisted_emails/agent_id at the app layer. Before migration
 * 101, any client could bypass that scrub entirely by querying PostgREST
 * directly with the public anon key (e.g. `feature_flags?select=flag_key,config`).
 *
 * These tests exercise the real local Supabase HTTP adapter. Ordinary developer
 * runs may skip without a local stack. The required database-contract runner
 * prepares an isolated fresh stack and rejects skipped suites; CI uses that lane.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  LOCAL_ANON_KEY as ANON_KEY,
  LOCAL_REST_URL as REST_URL,
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

vi.setConfig({testTimeout:20_000,hookTimeout:20_000});

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

    it("defaults visitor voice config to empty through feature_flags_public", async () => {
      const res = await fetch(
        `${REST_URL}/feature_flags_public?select=flag_key,config&flag_key=eq.${TEST_FLAG_KEY}&environment=eq.${TEST_ENVIRONMENT}`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].config).not.toHaveProperty("whitelisted_emails");
      expect(body[0].config).not.toHaveProperty("agent_id");
      // Newly added keys require privileged approval; the public default is empty.
      expect(body[0].config).toEqual({});
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
      const base = JSON.parse(baseConfigJson);
      expect(viewBody[0].config).toEqual(Object.fromEntries(
        Object.entries(base).filter(([key]) => ["title", "message", "show_tagline"].includes(key))
      ));
    });

    it("never exposes new secret keys from any known flag or an unknown flag", async () => {
      const originals = JSON.parse(psql("SELECT jsonb_agg(jsonb_build_object('id',id,'config',config,'config_is_null',config IS NULL))::text FROM public.feature_flags;"));
      const marker = "phase3-secret-canary";
      try {
        psql(`UPDATE public.feature_flags SET config=COALESCE(config,'{}'::jsonb)||jsonb_build_object('new_private_key','${marker}'); INSERT INTO public.feature_flags(flag_key,label,environment,config) VALUES('phase3-new-flag','Contract','development',jsonb_build_object('private_prompt','${marker}'));`);
        const res=await fetch(`${REST_URL}/feature_flags_public?select=*`,{headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`}});
        expect(res.status).toBe(200); const text=await res.text(); expect(text).not.toContain(marker); expect(text).not.toContain("new_private_key");
      } finally {
        const restore=JSON.stringify(originals).replaceAll("'","''");
        psql(`DELETE FROM public.feature_flags WHERE flag_key='phase3-new-flag'; UPDATE public.feature_flags f SET config=CASE WHEN r.config_is_null THEN NULL ELSE COALESCE(r.config,'null'::jsonb) END FROM jsonb_to_recordset('${restore}'::jsonb) AS r(id uuid,config jsonb,config_is_null boolean) WHERE f.id=r.id;`);
      }
    });
    it("missing approval is empty and a privileged approved key restores projection from canonical config", async () => {
      try {
        psql(`UPDATE public.feature_flags SET config='{"display_copy":"approved copy","private_prompt":"never public"}'::jsonb WHERE flag_key='${TEST_FLAG_KEY}' AND environment='${TEST_ENVIRONMENT}';`);
        const read=()=>fetch(`${REST_URL}/feature_flags_public?select=config&flag_key=eq.${TEST_FLAG_KEY}&environment=eq.${TEST_ENVIRONMENT}`,{headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`}});
        expect((await (await read()).json())[0].config).toEqual({});
        const denied=await fetch(`${REST_URL}/feature_flag_public_config_keys`,{method:'POST',headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({flag_key:TEST_FLAG_KEY,config_key:'private_prompt'})});
        expect(denied.status).toBe(401);expect((await denied.json()).code).toBe('42501');
        psql(`INSERT INTO public.feature_flag_public_config_keys(flag_key,config_key) VALUES('${TEST_FLAG_KEY}','display_copy');`);
        expect((await (await read()).json())[0].config).toEqual({display_copy:'approved copy'});
        psql(`UPDATE public.feature_flags SET config=config||'{"display_copy":"updated canonical"}'::jsonb WHERE flag_key='${TEST_FLAG_KEY}' AND environment='${TEST_ENVIRONMENT}';`);
        expect((await (await read()).json())[0].config).toEqual({display_copy:'updated canonical'});
      } finally {
        psql(`DELETE FROM public.feature_flag_public_config_keys WHERE flag_key='${TEST_FLAG_KEY}' AND config_key='display_copy'; UPDATE public.feature_flags SET config='{}'::jsonb WHERE flag_key='${TEST_FLAG_KEY}' AND environment='${TEST_ENVIRONMENT}';`);
      }
    });
  }
);
