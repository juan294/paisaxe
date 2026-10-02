/**
 * Privilege posture of SECURITY DEFINER functions in `public` (migration 110).
 *
 * Migrations 091/092 revoked EXECUTE from anon/authenticated for the RPCs that
 * existed then. Every function created or recreated afterwards (093 patch_story_
 * translation_metadata, 094 create_story_from_suggestion, 096 get_marketing_post_
 * stats, 099 grant_day_pass_idempotent) was `REVOKE ALL ... FROM PUBLIC` only,
 * which does not remove the explicit anon/authenticated grants Supabase's
 * schema-level default privileges add. Production exposed all four to the
 * public anon key (found 2026-10-02) because nothing asserted it against a real
 * database: the existing assertion in route.postgrest-integration.test.ts only
 * runs with a local stack up and was silently skipped.
 *
 * Needs the local Supabase Docker stack (`supabase start`) and is skipped when
 * it is not reachable, like the other *.postgrest-rls tests.
 */
import { describe, expect, it } from "vitest";
import {
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("definer-function-privileges.postgrest-rls.test.ts");
}

const PROBE_FN = "zz_definer_privilege_probe";

describe.skipIf(!dbReachable)(
  "SECURITY DEFINER function privileges (live local Supabase)",
  () => {
    it("no SECURITY DEFINER function in public is executable by anon or authenticated", () => {
      const exposed = psql(
        `select p.oid::regprocedure::text from pg_proc p ` +
          `join pg_namespace n on n.oid = p.pronamespace ` +
          `where n.nspname = 'public' and p.prosecdef ` +
          `and (has_function_privilege('anon', p.oid, 'EXECUTE') ` +
          `or has_function_privilege('authenticated', p.oid, 'EXECUTE')) order by 1;`
      );

      expect(exposed).toBe("");
    });

    it("a new function that follows the repo's REVOKE-FROM-PUBLIC pattern is not left callable by anon or authenticated", () => {
      try {
        psql(
          `create or replace function public.${PROBE_FN}() returns int ` +
            `language sql security definer set search_path = '' as $$ select 1 $$; ` +
            `revoke all on function public.${PROBE_FN}() from public; ` +
            `grant execute on function public.${PROBE_FN}() to service_role;`
        );

        const callable = psql(
          `select has_function_privilege('anon', 'public.${PROBE_FN}()', 'EXECUTE') ` +
            `or has_function_privilege('authenticated', 'public.${PROBE_FN}()', 'EXECUTE');`
        );

        expect(callable).toBe("f");
      } finally {
        psql(`drop function if exists public.${PROBE_FN}();`);
      }
    });
  }
);
