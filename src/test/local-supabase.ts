import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared helpers for tests that exercise a REAL local Supabase Docker stack
 * over HTTP/psql instead of mocking `fetch`/the Supabase client.
 *
 * Used by SE-H1/BE-M9 (#841, #790) regression suites:
 * - src/app/api/feature-flags/route.postgrest-rls.test.ts
 * - src/lib/proxy/maintenance.postgrest-integration.test.ts
 *
 * Also used by SE-H2 (#842):
 * - supabase/migrations/102_tighten_stories_rls.postgrest-rls.test.ts
 *
 * Also used by QA-H4 (#871):
 * - src/app/api/webhooks/stripe/route.postgrest-integration.test.ts
 *
 * These suites require `supabase start` (local Docker) and self-skip when the
 * stack isn't reachable — CI does not run a local Supabase stack, consistent
 * with the rest of the migration-safety workflow (see .claude/rules/supabase.md).
 */

/** Base API URL of the local Supabase stack (see `supabase status`). */
export const LOCAL_API_URL = process.env.SUPABASE_LOCAL_API_URL ?? "http://127.0.0.1:54321";

/** REST endpoint of the local Supabase stack (see `supabase status`). */
export const LOCAL_REST_URL = process.env.SUPABASE_LOCAL_REST_URL ?? `${LOCAL_API_URL}/rest/v1`;

/**
 * Well-known local-dev anon key baked into the Supabase CLI's demo JWT secret
 * — not a secret, identical for every local `supabase start` unless
 * `config.toml` overrides it.
 */
export const LOCAL_ANON_KEY =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/**
 * Well-known local-dev service_role key baked into the Supabase CLI's demo
 * JWT secret — not a secret, identical for every local `supabase start`
 * unless `config.toml` overrides it. Used by QA-H4 (#871) to exercise
 * service-role-only RPCs (e.g. grant_day_pass_idempotent) exactly as
 * createAdminClient() does, and to prove anon/authenticated truly lack access.
 */
export const LOCAL_SERVICE_ROLE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Local Supabase Docker container name — matches `supabase_db_<project_id>`
 * from supabase/config.toml (project_id = "paisaxe").
 */
export const LOCAL_DB_CONTAINER = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_paisaxe";

/**
 * Runs SQL as the postgres superuser directly against the local Docker
 * container and returns trimmed stdout. Used only for test fixture
 * setup/teardown and as an independent ground truth — never for the actual
 * security assertions, which go through PostgREST with the real anon key
 * exactly as a client would.
 *
 * (Deliberately avoids the service_role PostgREST path for fixture setup: the
 * local CLI-provisioned `service_role` Postgres role lacks table-level
 * SELECT/INSERT/UPDATE grants in this sandbox — a pre-existing local-stack gap
 * unrelated to SE-H1/BE-M9; see #913.)
 */
export function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-t", "-A", "-c", sql],
    { encoding: "utf8" }
  ).trim();
}

/** True once PostgREST answers (even a 404 on the REST root counts). */
export async function isLocalSupabaseReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_REST_URL}/`, {
      headers: { apikey: LOCAL_ANON_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

/** Logs the standard skip notice when a suite can't reach the local stack. */
export function warnLocalSupabaseUnreachable(testFile: string): void {
  console.warn(
    `[${testFile}] Local Supabase stack not reachable at ${LOCAL_REST_URL} — ` +
      "skipping live verification. Run `supabase start` to enable it."
  );
}

/** A service-role client for the local stack (what createAdminClient() does in the app). */
export function localServiceClient(): SupabaseClient {
  return createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** `'a', 'b'` for a SQL IN list of fixed test ids. */
export function sqlList(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(", ");
}
