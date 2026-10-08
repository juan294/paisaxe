// @vitest-environment node
import { execFileSync, spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const execFileSync = vi.fn();
  const spawn = vi.fn();
  return { ...actual, execFileSync, spawn, default: { ...actual, execFileSync, spawn } };
});

const url = "postgresql://postgres:private%3Apassword@127.0.0.1:55432/postgres";
const marker = `paisaxe-contracts:12345678-1234-1234-1234-123456789abc:${"a".repeat(64)}`;
const container = "supabase_db_paisaxe-contracts-0123456789ab";
const execute = vi.mocked(execFileSync);
const startSession = vi.mocked(spawn);

async function helper() { return (await import("./local-supabase")).psql; }

describe("task-owned native SQL fixtures", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    startSession.mockReset();
    vi.stubEnv("SUPABASE_LOCAL_DB_CONTAINER", container);
    vi.stubEnv("SUPABASE_LOCAL_DB_URL", url);
    vi.stubEnv("SUPABASE_LOCAL_DB_MARKER", marker);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("guards the marker in the caller connection and preserves SQL command tags", async () => {
    execute.mockReturnValue("DO\nINSERT 0 1\n");
    expect((await helper())("INSERT INTO fixture VALUES (1);")).toBe("INSERT 0 1");
    expect(execute).toHaveBeenCalledTimes(1);
    const [binary, args, options] = execute.mock.calls[0];
    expect(binary).toBe("psql");
    expect(args).toEqual(expect.arrayContaining(["-X", "-w", "ON_ERROR_STOP=1", "127.0.0.1", "55432", "postgres"]));
    const commands = (args as string[]).flatMap((arg, index, all) => arg === "-c" ? [all[index + 1]] : []);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toContain("IS DISTINCT FROM");
    expect(commands[0]).toContain(marker);
    expect(commands[0]).toContain("RAISE EXCEPTION 'local_database_marker_mismatch'");
    expect(commands[1]).toBe("INSERT INTO fixture VALUES (1);");
    expect(JSON.stringify(args)).not.toContain("private");
    expect(options).toMatchObject({ timeout: 15000, encoding: "utf8", env: { PGPASSWORD: "private:password", PGCONNECT_TIMEOUT: "5" } });
  });

  it("removes only the guard tag, retaining a caller's DO tag and trimmed result", async () => {
    execute.mockReturnValue("DO\nDO\n  answer  \n");
    expect((await helper())("DO $$ BEGIN END $$; SELECT '  answer  '; ")).toBe("DO\n  answer");
  });

  it.each([undefined, "SELECT 'session-result';"])("guards async SQL before %s in the same connection", async (sql) => {
    const session = {} as ReturnType<typeof spawn>;
    startSession.mockReturnValue(session);
    vi.stubEnv("PGHOSTADDR", "remote-canary");
    vi.stubEnv("PSQLRC", "remote-canary");
    const { spawnLocalPsql } = await import("./local-supabase");
    expect(spawnLocalPsql(sql)).toBe(session);
    expect(startSession).toHaveBeenCalledTimes(1);
    const [binary, args, options] = startSession.mock.calls[0];
    expect(binary).toBe("psql");
    expect(args).toEqual(expect.arrayContaining(["-X", "-w", "ON_ERROR_STOP=1"]));
    const commands = (args as string[]).flatMap((arg, index, all) => arg === "-c" ? [all[index + 1]] : []);
    expect(commands[0]).toContain(marker);
    expect(commands[0]).toContain("RAISE EXCEPTION 'local_database_marker_mismatch'");
    expect((args as string[]).slice(-2)).toEqual(sql === undefined ? ["-f", "-"] : ["-c", sql]);
    expect(commands).toHaveLength(sql === undefined ? 1 : 2);
    expect(JSON.stringify(args)).not.toContain("private");
    expect(options).toMatchObject({ timeout: 15000, env: { PGPASSWORD: "private:password", PGCONNECT_TIMEOUT: "5" } });
    expect(Object.values((options as { env: Record<string, string> }).env)).not.toContain("remote-canary");
  });

  it("preserves Docker async sessions without native opt-in", async () => {
    vi.stubEnv("SUPABASE_LOCAL_DB_URL", undefined);
    vi.stubEnv("SUPABASE_LOCAL_DB_MARKER", undefined);
    const { spawnLocalPsql } = await import("./local-supabase");
    spawnLocalPsql();
    expect(startSession.mock.calls[0][0]).toBe("docker");
    expect(startSession.mock.calls[0][1]).toEqual(expect.arrayContaining(["exec", "-i", container, "psql", "ON_ERROR_STOP=1"]));
  });

  it.each([
    "postgresql://postgres:pw@example.com:55432/postgres",
    "postgresql://postgres:pw@localhost:55432/postgres",
    "postgresql://postgres:pw@[::1]:55432/postgres",
    "postgresql://postgres:pw@127.0.0.1:54322/postgres",
    "postgresql://postgres:pw@127.0.0.1:54321/postgres",
    "postgresql://postgres:pw@127.0.0.1:543/postgres",
    "postgresql://other:pw@127.0.0.1:55432/postgres",
    "postgresql://postgres:pw@127.0.0.1:55432/other",
    "postgresql://postgres:pw@127.0.0.1:55432/postgres?host=remote",
    "postgresql://postgres:pw@127.0.0.1:55432/postgres#fragment",
    "http://postgres:pw@127.0.0.1:55432/postgres",
  ])("rejects unsafe native target %s before launching a process", async (unsafe) => {
    vi.stubEnv("SUPABASE_LOCAL_DB_URL", unsafe);
    const psql = await helper();
    expect(() => psql("SELECT 1;")).toThrow("Invalid task-owned SQL target");
    const { spawnLocalPsql } = await import("./local-supabase");
    expect(() => spawnLocalPsql("SELECT 1;")).toThrow("Invalid task-owned SQL target");
    expect(execute).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });

  it.each(["SUPABASE_LOCAL_DB_URL", "SUPABASE_LOCAL_DB_MARKER"])("rejects incomplete opt-in missing %s", async (name) => {
    vi.stubEnv(name, undefined);
    const psql = await helper();
    expect(() => psql("SELECT 1;")).toThrow("Native SQL requires both");
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ["SUPABASE_LOCAL_DB_CONTAINER", "supabase_db_paisaxe"],
    ["SUPABASE_LOCAL_DB_MARKER", "paisaxe-contracts:invalid"],
  ])("rejects missing task identity in %s", async (name, value) => {
    vi.stubEnv(name, value);
    const psql = await helper();
    expect(() => psql("SELECT 1;")).toThrow("Invalid task-owned SQL identity");
    expect(execute).not.toHaveBeenCalled();
  });

  it("closes inherited libpq and psql configuration redirects", async () => {
    for (const name of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS", "PGPASSFILE", "PSQLRC", "PGDATABASE", "PGPORT", "PGUSER"]) vi.stubEnv(name, "remote-canary");
    execute.mockReturnValue("DO\n1\n");
    expect((await helper())("SELECT 1;")).toBe("1");
    const options = execute.mock.calls[0][2] as { env: Record<string, string> };
    expect(Object.values(options.env)).not.toContain("remote-canary");
  });

  it("rejects missing guard acknowledgement instead of returning unverified output", async () => {
    execute.mockReturnValue("unexpected output\n");
    const psql = await helper();
    expect(() => psql("SELECT 1;")).toThrow("Native SQL guard acknowledgement missing");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(["local_database_marker_mismatch", "connection refused", "SQL failed", "ETIMEDOUT", "ENOENT"])("propagates %s without retry or Docker fallback", async (message) => {
    const failure = new Error(message);
    execute.mockImplementation(() => { throw failure; });
    const psql = await helper();
    expect(() => psql("SELECT 'caller-sql';")).toThrow(failure);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBe("psql");
  });

  it("keeps the existing Docker path when native SQL is not opted in", async () => {
    vi.stubEnv("SUPABASE_LOCAL_DB_URL", undefined);
    vi.stubEnv("SUPABASE_LOCAL_DB_MARKER", undefined);
    execute.mockReturnValue("  result\n");
    expect((await helper())("SELECT 1;")).toBe("result");
    expect(execute).toHaveBeenCalledWith("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-c", "SELECT 1;"], { encoding: "utf8" });
  });
});
