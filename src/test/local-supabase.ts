import { execFileSync, spawn } from "node:child_process";
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
 * These suites use a real local Docker stack. Ordinary developer runs may
 * self-skip when it is absent. The required database-contract runner prepares
 * an isolated stack and rejects missing or skipped suites; CI uses that lane.
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
 * Runs SQL as the postgres superuser against the local stack and returns
 * trimmed stdout. The required runner can opt into native psql with its
 * validated task endpoint and database marker; ordinary runs use Docker.
 * Used only for test fixture
 * setup/teardown and as an independent ground truth — never for the actual
 * security assertions, which go through PostgREST with the real anon key
 * exactly as a client would.
 *
 * Historical local stacks exposed a service-role grant gap (#913). Fresh-reset
 * parity and actual service-role DML are now verified by the required contract
 * matrix. Individual suites may use SQL fixtures or actual service-role DML;
 * client authorization assertions always use the real HTTP adapter.
 */
function nativePsqlCommand() {
  const dbUrl = process.env.SUPABASE_LOCAL_DB_URL;
  const marker = process.env.SUPABASE_LOCAL_DB_MARKER;
  if (dbUrl !== undefined || marker !== undefined) {
    if (!dbUrl || !marker) throw new Error("Native SQL requires both endpoint and marker");
    if (!/^supabase_db_paisaxe-contracts-[a-f0-9]{12}$/.test(LOCAL_DB_CONTAINER) ||
        !/^paisaxe-contracts:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}:[a-f0-9]{64}$/.test(marker)) {
      throw new Error("Invalid task-owned SQL identity");
    }
    let db: URL;
    try { db = new URL(dbUrl); } catch { throw new Error("Invalid task-owned SQL target"); }
    if (db.protocol !== "postgresql:" || db.hostname !== "127.0.0.1" ||
        !/^\d+$/.test(db.port) || Number(db.port) < 1024 || Number(db.port) > 65535 || [54321, 54322].includes(Number(db.port)) ||
        db.username !== "postgres" || db.pathname !== "/postgres" || db.search || db.hash) {
      throw new Error("Invalid task-owned SQL target");
    }
    let password: string;
    try { password = decodeURIComponent(db.password); } catch { throw new Error("Invalid task-owned SQL target"); }
    // Set the test child's mode explicitly; do not inherit libpq service files,
    // host redirects, options, psqlrc or arbitrary parent environment variables.
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ...Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SYSTEMROOT"]
      .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]])) };
    const guard = `DO $$ BEGIN IF (SELECT pg_catalog.shobj_description(oid, 'pg_database') FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()) IS DISTINCT FROM '${marker}' THEN RAISE EXCEPTION 'local_database_marker_mismatch'; END IF; END $$;`;
    return { args: ["-X", "-w", "-h", "127.0.0.1", "-p", db.port,
      "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", guard],
    env: { ...env, PGPASSWORD: password, PGCONNECT_TIMEOUT: "5" } };
  }
}

export function psql(sql: string): string {
  const native = nativePsqlCommand();
  if (native) {
    const output = execFileSync("psql", [...native.args, "-c", sql],
      { encoding: "utf8", timeout: 15000, env: native.env });
    // Strip exactly the successful guard's command tag, preserving caller tags.
    if (!/^DO\r?\n/.test(output)) throw new Error("Native SQL guard acknowledgement missing");
    return output.replace(/^DO\r?\n/, "").trim();
  }
  return execFileSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-t", "-A", "-c", sql],
    { encoding: "utf8" }
  ).trim();
}

/** Starts a separate fixture session; omitted SQL reads stdin after its marker guard. */
export function spawnLocalPsql(sql?: string) {
  const native = nativePsqlCommand();
  if (native) {
    return spawn("psql", [...native.args, ...(sql === undefined ? ["-f", "-"] : ["-c", sql])],
      { env: native.env, timeout: 15000 });
  }
  return spawn("docker", ["exec", ...(sql === undefined ? ["-i"] : []), LOCAL_DB_CONTAINER,
    "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", ...(sql === undefined ? [] : ["-c", sql])],
  { timeout: 15000 });
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
