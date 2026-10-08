// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// These are third-party boundaries. The owned auth and CSRF helpers run unchanged.
const authFixture = vi.hoisted(() => ({ authenticated: true, role: "admin" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: authFixture.authenticated ? { id: "fixture-admin" } : null }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: authFixture.role }, error: null }) }) }) }),
}) }));
import { POST, GET, DELETE } from "@/app/api/admin/agents/run/route";
import { POST as startTunnel, GET as tunnelStatus, DELETE as stopTunnel } from "@/app/api/admin/tunnel/route";
import { runningAgents, resetRunningAgentsForTests } from "@/app/api/admin/agents/run/state";
import { invalidateRoleCache } from "@/lib/admin-auth";

let fixtureRoot: string;
function request(method: string, csrf = true) {
  return new NextRequest("http://localhost:3006/api/admin/agents/run", {
    method, headers: { origin: "http://localhost:3006", ...(csrf ? { cookie: "__csrf=fixture", "x-csrf-token": "fixture" } : {}) },
    ...(method === "GET" ? {} : { body: JSON.stringify({ agentKey: "qa_agent_enabled" }) }),
  });
}
async function eventually(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(check()).toBe(true);
}

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon-key");
  authFixture.authenticated = true; authFixture.role = "admin"; invalidateRoleCache("fixture-admin");
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "paisaxe-agent-fixture-"));
  await mkdir(path.join(fixtureRoot, "scripts"));
  // Only an owned, offline fixture is launched. No repository agent/provider scripts.
  await writeFile(path.join(fixtureRoot, "scripts/qa-agent.sh"), "printf 'fixture-ready\\n'\nwhile true; do sleep 0.1; done\n");
  vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);
});
afterEach(async () => {
  const children = [...runningAgents.values()].map((agent) => agent.process);
  for (const child of children) { try { process.kill(-child.pid!, "SIGTERM"); } catch { /* owned fixture already exited */ } }
  await eventually(() => children.every((child) => child.exitCode !== null || child.signalCode !== null));
  resetRunningAgentsForTests(); vi.restoreAllMocks(); vi.unstubAllEnvs();
  try {
    const tunnelPid = Number(await readFile(path.join(fixtureRoot, "tunnel.pid"), "utf8"));
    if (tunnelPid > 0) { try { process.kill(-tunnelPid, "SIGTERM"); } catch { /* fixture exited */ } }
  } catch { /* no fixture tunnel */ }
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe("local route lifecycle with real authorization", () => {
  it("denies authentication, role and CSRF with no process, then permits start/status/logs/stop", async () => {
    authFixture.authenticated = false;
    expect((await POST(request("POST"))).status).toBe(401);
    authFixture.authenticated = true; authFixture.role = "user";
    expect((await POST(request("POST"))).status).toBe(403);
    authFixture.role = "admin";
    expect((await POST(request("POST", false))).status).toBe(403);
    expect(runningAgents.size).toBe(0);
    expect((await POST(request("POST"))).status).toBe(200);
    await eventually(() => runningAgents.get("qa_agent_enabled")!.logs.some((line) => line.text === "fixture-ready"));
    const status = await (await GET(request("GET"))).json();
    expect(status.running.qa_agent_enabled.startedAt).toEqual(expect.any(String));
    const logs = await (await GET(new NextRequest("http://localhost:3006/api/admin/agents/run?agentKey=qa_agent_enabled"))).json();
    expect(logs.finished).toBe(false); expect(logs.logs[0].text).toBe("fixture-ready");
    expect((await DELETE(request("DELETE", false))).status).toBe(403);
    expect((await DELETE(request("DELETE"))).status).toBe(200);
    expect(runningAgents.get("qa_agent_enabled")!.stoppedByUser).toBe(true);
    await eventually(() => runningAgents.get("qa_agent_enabled")!.process.signalCode !== null);
    expect((await POST(request("POST"))).status).toBe(200);
  });
  it("runs the tunnel lifecycle against owned disposable executables", async () => {
    const bin = path.join(fixtureRoot, "bin");
    const pidFile = path.join(fixtureRoot, "tunnel.pid");
    await mkdir(bin);
    await writeFile(path.join(bin, "cloudflared"), `#!/bin/sh\nprintf '%s' "$$" > '${pidFile}'\nexec /bin/sleep 60\n`, { mode: 0o755 });
    await writeFile(path.join(bin, "pgrep"), `#!/bin/sh\nif test -f '${pidFile}'; then pid=$(cat '${pidFile}'); kill -0 "$pid" 2>/dev/null && printf '%s' "$pid"; fi\n`, { mode: 0o755 });
    await writeFile(path.join(bin, "pkill"), `#!/bin/sh\nif test -f '${pidFile}'; then kill $(cat '${pidFile}') 2>/dev/null || true; rm -f '${pidFile}'; fi\n`, { mode: 0o755 });
    vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
    const initial = await (await tunnelStatus()).json(); expect(initial.running).toBe(false);
    const started = await (await startTunnel(request("POST"))).json(); expect(started.running).toBe(true);
    const stopped = await (await stopTunnel(request("DELETE"))).json(); expect(stopped.running).toBe(false);
    expect((await startTunnel(request("POST", false))).status).toBe(403);
    expect((await startTunnel(request("POST"))).status).toBe(200);
  }, 10_000);
  it("handles missing bash asynchronously and starts the owned agent after PATH recovery", async () => {
    const originalPath = process.env.PATH;
    const bin = path.join(fixtureRoot, "empty-bin");
    await mkdir(bin); vi.stubEnv("PATH", bin);
    const denied = await POST(request("POST"));
    expect(denied.status).toBe(500);
    expect((await denied.json()).error).toBe("Failed to start agent process");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(runningAgents.size).toBe(0);
    vi.stubEnv("PATH", originalPath);
    expect((await POST(request("POST"))).status).toBe(200);
    await eventually(() => runningAgents.get("qa_agent_enabled")!.logs.some((line) => line.text === "fixture-ready"));
    expect((await DELETE(request("DELETE"))).status).toBe(200);
  });
  it("reports a missing tunnel executable without an unhandled error and starts on a corrected retry", async () => {
    const bin = path.join(fixtureRoot, "missing-bin");
    const pidFile = path.join(fixtureRoot, "tunnel.pid");
    await mkdir(bin);
    await writeFile(path.join(bin, "pgrep"), `#!/bin/sh\nif test -f '${pidFile}'; then pid=$(/bin/cat '${pidFile}'); kill -0 "$pid" 2>/dev/null && printf '%s' "$pid"; fi\n`, { mode: 0o755 });
    await writeFile(path.join(bin, "pkill"), `#!/bin/sh\nif test -f '${pidFile}'; then kill $(/bin/cat '${pidFile}') 2>/dev/null || true; /bin/rm -f '${pidFile}'; fi\n`, { mode: 0o755 });
    vi.stubEnv("PATH", bin);
    const denied = await startTunnel(request("POST"));
    expect(denied.status).toBe(500);
    expect((await denied.json()).error).toContain("Failed to start tunnel");
    await writeFile(path.join(bin, "cloudflared"), `#!/bin/sh\nprintf '%s' "$$" > '${pidFile}'\nexec /bin/sleep 60\n`, { mode: 0o755 });
    const retry = await startTunnel(request("POST"));
    expect(retry.status).toBe(200);
    expect((await retry.json()).running).toBe(true);
    expect((await stopTunnel(request("DELETE"))).status).toBe(200);
  }, 10_000);
  it("blocks tunnel mutation without CSRF before reaching process execution", async () => {
    expect((await startTunnel(request("POST", false))).status).toBe(403);
  });
});
