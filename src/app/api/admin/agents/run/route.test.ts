import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import EventEmitter from "events";

const { logger } = vi.hoisted(() => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger,
}));

// Mock child_process.spawn
const mockSpawn = vi.fn();
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    default: { ...actual, spawn: (...args: unknown[]) => mockSpawn(...args) },
    spawn: (...args: unknown[]) => mockSpawn(...args),
  };
});

import { validateAdminAuth } from "@/lib/admin-auth";
import { POST, GET, DELETE } from "./route";
import { resetRunningAgentsForTests } from "./state";

const LEGACY_RUNNER_OVERRIDE = ["ALLOW", "AGENT", "RUN"].join("_");
const originalVercelEnv = process.env.VERCEL_ENV;
const originalLegacyOverride = process.env[LEGACY_RUNNER_OVERRIDE];

function restoreAgentRunnerEnv() {
  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnv;
  }

  if (originalLegacyOverride === undefined) {
    delete process.env[LEGACY_RUNNER_OVERRIDE];
  } else {
    process.env[LEGACY_RUNNER_OVERRIDE] = originalLegacyOverride;
  }
}

function resetToLocalRuntime() {
  restoreAgentRunnerEnv();
  delete process.env.VERCEL_ENV;
  delete process.env[LEGACY_RUNNER_OVERRIDE];
  resetRunningAgentsForTests();
  vi.useRealTimers();
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3006/api/admin/agents/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3006/api/admin/agents/run");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, { method: "GET" });
}

function makeDeleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3006/api/admin/agents/run", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Create a fake ChildProcess-like EventEmitter with stdout/stderr. */
function createMockChild(pid: number) {
  const child = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  Object.assign(child, {
    pid,
    stdout,
    stderr,
    unref: vi.fn(),
  });
  return child;
}

describe("POST /api/admin/agents/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToLocalRuntime();
  });

  afterEach(() => {
    restoreAgentRunnerEnv();
    vi.useRealTimers();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await POST(makeRequest({ agentKey: "qa_agent_enabled" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const request = new NextRequest(
      "http://localhost:3006/api/admin/agents/run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 for missing agentKey", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown agent key");
  });

  it("returns 400 for unknown agentKey", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const response = await POST(makeRequest({ agentKey: "nonexistent_agent" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown agent key: nonexistent_agent");
  });

  it("returns 200 with successful execution", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(12345);
    mockSpawn.mockReturnValue(mockChild);

    const response = await POST(
      makeRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.started).toBe(true);
    expect(data.agentKey).toBe("qa_agent_enabled");
    expect(data.startedAt).toBeDefined();
  });

  it("returns 500 when spawn fails (no pid)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(0);
    // pid 0 is falsy
    Object.assign(mockChild, { pid: undefined });
    mockSpawn.mockReturnValue(mockChild);

    // Use a different agentKey to avoid 409 from the in-memory runningAgents Map
    // (previous test registered qa_agent_enabled and the Map persists across tests)
    const response = await POST(
      makeRequest({ agentKey: "coverage_agent_enabled" })
    );
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to start agent process");
  });

  it("returns 403 when VERCEL_ENV is set for a preview deployment", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    process.env.VERCEL_ENV = "preview";

    const response = await POST(
      makeRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("only allowed in local development");
    expect(logger.warn).toHaveBeenCalledWith(
      "[AGENT_RUNNER]",
      expect.objectContaining({ vercelEnv: "preview" })
    );
  });

  it("returns 403 when VERCEL_ENV is set for production", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    process.env.VERCEL_ENV = "production";

    const response = await POST(
      makeRequest({ agentKey: "coverage_agent_enabled" })
    );
    expect(response.status).toBe(403);
  });

  it("ignores the legacy runner override in deployed environments", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    process.env.VERCEL_ENV = "production";
    process.env[LEGACY_RUNNER_OVERRIDE] = "1";

    const response = await POST(
      makeRequest({ agentKey: "documentation_agent_enabled" })
    );
    expect(response.status).toBe(403);
  });

  it("allows agent runs when VERCEL_ENV is unset", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    delete process.env.VERCEL_ENV;

    const mockChild = createMockChild(12000);
    mockSpawn.mockReturnValue(mockChild);

    const response = await POST(
      makeRequest({ agentKey: "performance_agent_enabled" })
    );

    expect(response.status).toBe(200);
  });

  it("has correct response structure on success", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(99999);
    mockSpawn.mockReturnValue(mockChild);

    const response = await POST(
      makeRequest({ agentKey: "coverage_agent_enabled" })
    );
    const data = await response.json();

    expect(data).toEqual({
      started: true,
      agentKey: "coverage_agent_enabled",
      startedAt: expect.any(String),
    });
    // Verify startedAt is a valid ISO date
    expect(new Date(data.startedAt).toISOString()).toBe(data.startedAt);
  });

  // --- Coverage: stdout/stderr data handlers and exit event (lines 125-151) ---

  it("captures stdout lines in agent logs", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(11111);
    mockSpawn.mockReturnValue(mockChild);

    // Start the agent
    await POST(makeRequest({ agentKey: "security_agent_enabled" }));

    // Simulate stdout output
    const stdout = (mockChild as EventEmitter & { stdout: EventEmitter }).stdout;
    stdout.emit("data", Buffer.from("Running security scan...\nFound 0 issues\n"));

    // Fetch logs
    const response = await GET(
      makeGetRequest({ agentKey: "security_agent_enabled" })
    );
    const data = await response.json();

    expect(data.logs.length).toBeGreaterThanOrEqual(2);
    expect(data.logs[0].text).toBe("Running security scan...");
    expect(data.logs[1].text).toBe("Found 0 issues");
    expect(data.finished).toBe(false);
  });

  it("captures stderr lines with [stderr] prefix in agent logs", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(22222);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "documentation_agent_enabled" }));

    // Simulate stderr output
    const stderr = (mockChild as EventEmitter & { stderr: EventEmitter }).stderr;
    stderr.emit("data", Buffer.from("Warning: deprecated API\n"));

    const response = await GET(
      makeGetRequest({ agentKey: "documentation_agent_enabled" })
    );
    const data = await response.json();

    expect(data.logs.length).toBeGreaterThanOrEqual(1);
    expect(data.logs[0].text).toBe("[stderr] Warning: deprecated API");
  });

  it("skips empty lines in stdout and stderr output", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(33000);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "performance_agent_enabled" }));

    const stdout = (mockChild as EventEmitter & { stdout: EventEmitter }).stdout;
    const stderr = (mockChild as EventEmitter & { stderr: EventEmitter }).stderr;

    // Emit lines with empty lines interspersed
    stdout.emit("data", Buffer.from("real line\n\n   \nanother line\n"));
    stderr.emit("data", Buffer.from("err line\n\n   \n"));

    const response = await GET(
      makeGetRequest({ agentKey: "performance_agent_enabled" })
    );
    const data = await response.json();

    // Only non-empty trimmed lines should appear
    const texts = data.logs.map((l: { text: string }) => l.text);
    expect(texts).toContain("real line");
    expect(texts).toContain("another line");
    expect(texts).toContain("[stderr] err line");
    // Empty or whitespace-only lines should NOT appear
    expect(texts).not.toContain("");
    expect(texts).not.toContain("   ");
    expect(texts).not.toContain("[stderr] ");
    expect(texts).not.toContain("[stderr]    ");
  });

  it("strips ANSI escape codes from log output", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(33333);
    mockSpawn.mockReturnValue(mockChild);

    // Use cost_analyst_agent_enabled — not shared with any other test in this describe block
    await POST(makeRequest({ agentKey: "cost_analyst_agent_enabled" }));

    const stdout = (mockChild as EventEmitter & { stdout: EventEmitter }).stdout;
    // Emit text with ANSI color codes
    stdout.emit("data", Buffer.from("\x1b[32mSuccess\x1b[0m: all tests passed\n"));

    const response = await GET(
      makeGetRequest({ agentKey: "cost_analyst_agent_enabled" })
    );
    const data = await response.json();

    expect(data.logs[0].text).toBe("Success: all tests passed");
  });

  it("handles exit event and flushes remaining buffers", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(44444);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "localization_agent_enabled" }));

    // Emit partial line without trailing newline (remains in buffer)
    const stdout = (mockChild as EventEmitter & { stdout: EventEmitter }).stdout;
    stdout.emit("data", Buffer.from("final output"));

    const stderr = (mockChild as EventEmitter & { stderr: EventEmitter }).stderr;
    stderr.emit("data", Buffer.from("final error"));

    // Trigger exit event
    (mockChild as EventEmitter).emit("exit", 0);

    const response = await GET(
      makeGetRequest({ agentKey: "localization_agent_enabled" })
    );
    const data = await response.json();

    expect(data.finished).toBe(true);
    expect(data.exitCode).toBe(0);
    // Should have flushed the remaining stdout buffer, stderr buffer, and exit message
    const texts = data.logs.map((l: { text: string }) => l.text);
    expect(texts).toContain("final output");
    expect(texts).toContain("[stderr] final error");
    expect(texts).toContain("Process exited with code 0");
  });

  it("handles exit event with null exit code", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(55555);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "cost_analyst_agent_enabled" }));

    // Trigger exit with null code (e.g., killed by signal)
    (mockChild as EventEmitter).emit("exit", null);

    const response = await GET(
      makeGetRequest({ agentKey: "cost_analyst_agent_enabled" })
    );
    const data = await response.json();

    expect(data.finished).toBe(true);
    expect(data.exitCode).toBeNull();
    const texts = data.logs.map((l: { text: string }) => l.text);
    expect(texts).toContain("Process exited with code unknown");
  });

  // --- Coverage: ring buffer overflow (line 41) ---

  it("trims log buffer when it exceeds MAX_LOG_LINES (500)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(99000);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "coverage_agent_enabled" }));

    // Emit more than 500 lines to trigger the ring buffer splice
    const stdout = (mockChild as EventEmitter & { stdout: EventEmitter }).stdout;
    const lines = Array.from({ length: 510 }, (_, i) => `line-${i}`).join("\n") + "\n";
    stdout.emit("data", Buffer.from(lines));

    const response = await GET(
      makeGetRequest({ agentKey: "coverage_agent_enabled" })
    );
    const data = await response.json();

    // Should be capped at 500
    expect(data.logs.length).toBe(500);
    // The first lines should have been trimmed — the oldest lines are removed
    expect(data.logs[0].text).toBe("line-10");
    expect(data.logs[499].text).toBe("line-509");
  });

  // --- Coverage: already-running conflict (409) and stale detection (lines 76-88) ---

  it("returns 409 when agent is already running", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(66666);
    mockSpawn.mockReturnValue(mockChild);

    // Start the agent first time
    await POST(makeRequest({ agentKey: "qa_agent_enabled" }));

    // Mock process.kill to simulate the process is still alive (signal 0 check)
    const originalKill = process.kill;
    process.kill = vi.fn() as typeof process.kill;

    // Try to start the same agent again
    const response = await POST(
      makeRequest({ agentKey: "qa_agent_enabled" })
    );

    process.kill = originalKill;

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Agent is already running");
    expect(data.startedAt).toBeDefined();
  });

  it("allows restart when previous process died (stale detection)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild1 = createMockChild(77777);
    mockSpawn.mockReturnValueOnce(mockChild1);

    // Start the agent
    await POST(makeRequest({ agentKey: "coverage_agent_enabled" }));

    // Mock process.kill to throw (process is dead)
    const originalKill = process.kill;
    process.kill = vi.fn().mockImplementation(() => {
      throw new Error("ESRCH: No such process");
    }) as typeof process.kill;

    // Now create a new mock child for the restart
    const mockChild2 = createMockChild(88888);
    mockSpawn.mockReturnValueOnce(mockChild2);

    // Try to start the same agent — should succeed because stale detection kicks in
    const response = await POST(
      makeRequest({ agentKey: "coverage_agent_enabled" })
    );

    process.kill = originalKill;

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.started).toBe(true);
  });

  it("purges finished agent entries older than one hour on exit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T10:00:00Z"));
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const staleChild = createMockChild(99101);
    const freshChild = createMockChild(99102);
    mockSpawn.mockReturnValueOnce(staleChild).mockReturnValueOnce(freshChild);

    await POST(makeRequest({ agentKey: "coverage_agent_enabled" }));
    (staleChild as EventEmitter).emit("exit", 0);

    vi.setSystemTime(new Date("2026-04-22T11:01:00Z"));

    await POST(makeRequest({ agentKey: "security_agent_enabled" }));
    (freshChild as EventEmitter).emit("exit", 0);

    const staleResponse = await GET(
      makeGetRequest({ agentKey: "coverage_agent_enabled" })
    );
    const staleData = await staleResponse.json();

    const freshResponse = await GET(
      makeGetRequest({ agentKey: "security_agent_enabled" })
    );
    const freshData = await freshResponse.json();

    expect(staleData.offset).toBe(0);
    expect(staleData.logs).toEqual([]);
    expect(freshData.offset).toBe(1);
    expect(freshData.logs[0].text).toBe("Process exited with code 0");
  });
});

describe("GET /api/admin/agents/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToLocalRuntime();
  });

  afterEach(() => {
    restoreAgentRunnerEnv();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it("returns 403 when running outside local development", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    process.env.VERCEL_ENV = "preview";

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(403);
  });

  it("returns running status when authenticated", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("running");
    expect(typeof data.running).toBe("object");
  });

  it("returns empty logs for unknown agent key", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const response = await GET(
      makeGetRequest({ agentKey: "nonexistent_agent" })
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.logs).toEqual([]);
    expect(data.offset).toBe(0);
    expect(data.finished).toBe(true);
  });

  it("returns logs with since offset for a running agent", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(10001);
    mockSpawn.mockReturnValue(mockChild);

    // Start an agent
    await POST(makeRequest({ agentKey: "security_agent_enabled" }));

    // Emit several stdout lines
    const stdout = (mockChild as EventEmitter & { stdout: EventEmitter }).stdout;
    stdout.emit("data", Buffer.from("line1\nline2\nline3\n"));

    // Fetch all logs first
    const response1 = await GET(
      makeGetRequest({ agentKey: "security_agent_enabled" })
    );
    const data1 = await response1.json();
    expect(data1.logs.length).toBe(3);
    expect(data1.offset).toBe(3);

    // Fetch with since=2 (should get only the 3rd log)
    const response2 = await GET(
      makeGetRequest({ agentKey: "security_agent_enabled", since: "2" })
    );
    const data2 = await response2.json();
    expect(data2.logs.length).toBe(1);
    expect(data2.logs[0].text).toBe("line3");
  });

  it("marks stale agents as finished in GET running status", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(10002);
    mockSpawn.mockReturnValue(mockChild);

    // Start an agent
    await POST(makeRequest({ agentKey: "documentation_agent_enabled" }));

    // Mock process.kill to throw (process died)
    const originalKill = process.kill;
    process.kill = vi.fn().mockImplementation(() => {
      throw new Error("ESRCH: No such process");
    }) as typeof process.kill;

    // GET the running agents — should detect stale and not include it
    const response = await GET(makeGetRequest());
    const data = await response.json();

    process.kill = originalKill;

    // The stale agent should NOT appear in running list
    expect(data.running).not.toHaveProperty("documentation_agent_enabled");
  });

  it("includes alive agents in GET running status", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(10003);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "performance_agent_enabled" }));

    // Mock process.kill to succeed (process is alive)
    const originalKill = process.kill;
    process.kill = vi.fn() as typeof process.kill;

    const response = await GET(makeGetRequest());
    const data = await response.json();

    process.kill = originalKill;

    expect(data.running).toHaveProperty("performance_agent_enabled");
    expect(data.running.performance_agent_enabled.startedAt).toBeDefined();
  });
});

describe("DELETE /api/admin/agents/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToLocalRuntime();
  });

  afterEach(() => {
    restoreAgentRunnerEnv();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 when running outside local development", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    process.env.VERCEL_ENV = "production";

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const request = new NextRequest(
      "http://localhost:3006/api/admin/agents/run",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }
    );

    const response = await DELETE(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 for missing agentKey", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const response = await DELETE(makeDeleteRequest({}));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("agentKey is required");
  });

  it("returns 404 when agent is not running", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Agent is not running");
  });

  it("successfully stops a running agent", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(20001);
    mockSpawn.mockReturnValue(mockChild);

    // Start the agent
    await POST(makeRequest({ agentKey: "localization_agent_enabled" }));

    // Mock process.kill for the delete operation (kill process group)
    const originalKill = process.kill;
    process.kill = vi.fn() as typeof process.kill;

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "localization_agent_enabled" })
    );

    process.kill = originalKill;

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.stopped).toBe(true);
    expect(data.agentKey).toBe("localization_agent_enabled");

    // Verify agent is marked as stopped
    const logsResponse = await GET(
      makeGetRequest({ agentKey: "localization_agent_enabled" })
    );
    const logsData = await logsResponse.json();
    expect(logsData.finished).toBe(true);
    expect(logsData.stoppedByUser).toBe(true);
    // Should have "Process stopped by user" in logs
    const texts = logsData.logs.map((l: { text: string }) => l.text);
    expect(texts).toContain("Process stopped by user");
  });

  it("falls back to direct kill when process group kill fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(20002);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "cost_analyst_agent_enabled" }));

    // Mock process.kill: first call (negative PID group kill) throws, second call succeeds
    const originalKill = process.kill;
    let killCallCount = 0;
    process.kill = vi.fn().mockImplementation(() => {
      killCallCount++;
      if (killCallCount === 1) throw new Error("EPERM");
      // second call (direct PID kill) succeeds
    }) as typeof process.kill;

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "cost_analyst_agent_enabled" })
    );

    process.kill = originalKill;

    expect(response.status).toBe(200);
    expect(killCallCount).toBe(2);
  });

  it("handles both group and direct kill failing (process already dead)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(20003);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "qa_agent_enabled" }));

    // Mock process.kill: both calls throw (process already dead)
    const originalKill = process.kill;
    process.kill = vi.fn().mockImplementation(() => {
      throw new Error("ESRCH");
    }) as typeof process.kill;

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "qa_agent_enabled" })
    );

    process.kill = originalKill;

    // Should still succeed — agent is marked as stopped
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.stopped).toBe(true);
  });

  it("returns 404 when trying to stop an already-finished agent", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockChild = createMockChild(20004);
    mockSpawn.mockReturnValue(mockChild);

    await POST(makeRequest({ agentKey: "security_agent_enabled" }));

    // Simulate exit event so agent is marked as finished
    (mockChild as EventEmitter).emit("exit", 0);

    const response = await DELETE(
      makeDeleteRequest({ agentKey: "security_agent_enabled" })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Agent is not running");
  });
});
