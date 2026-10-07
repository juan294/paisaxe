import { spawn, type ChildProcess } from "node:child_process";
import { expect, vi } from "vitest";
import { LOCAL_DB_CONTAINER, psql } from "./local-supabase";

/**
 * Row-lock helpers for live-database concurrency tests: hold a lock from a
 * separate psql session so concurrent RPCs queue on it, then release it.
 * Test-only (imports vitest); scripts use ./local-supabase.
 */

/** Waits until exactly `count` backends match the pg_stat_activity condition. */
export function waitForBackendCount(condition: string, count: number): Promise<void> {
  return vi.waitFor(
    () => expect(psql(`SELECT count(*) FROM pg_stat_activity WHERE ${condition};`)).toBe(String(count)),
    { timeout: 10_000, interval: 50 }
  );
}

/**
 * Holds a row lock (`SELECT … FOR UPDATE`) from a separate psql session, so
 * concurrent RPCs queue on it and a test can force an interleaving. Resolves
 * once the lock is held; end it with releaseRowLock.
 */
export async function lockRow(table: string, id: string, appName: string): Promise<ChildProcess> {
  const locker = spawn("docker", [
    "exec",
    "-i",
    LOCAL_DB_CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-c",
    `SET application_name = '${appName}'; BEGIN; SELECT 1 FROM public.${table} WHERE id = '${id}' FOR UPDATE; SELECT pg_sleep(60); COMMIT;`,
  ]);
  await waitForBackendCount(`application_name = '${appName}' AND wait_event = 'PgSleep'`, 1);
  return locker;
}

/** Ends the lock-holding session, even when the test failed before releasing it. */
export function releaseRowLock(locker: ChildProcess, appName: string): void {
  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = '${appName}';`);
  locker.kill();
}
