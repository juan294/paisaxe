import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import EventEmitter from "events";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/agents/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/admin/agents/run");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, { method: "GET" });
}

function makeDeleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/agents/run", {
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
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // Allow agent runs in test
    process.env.ALLOW_AGENT_RUN = "true";
  });

  afterEach(() => {
    delete process.env.ALLOW_AGENT_RUN;
    Object.defineProperty(process, "env", {
      value: { ...process.env, NODE_ENV: originalEnv },
    });
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
      "http://localhost:3000/api/admin/agents/run",
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

    const response = await POST(
      makeRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to start agent process");
  });

  it("returns 403 when not in development and ALLOW_AGENT_RUN is not set", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    delete process.env.ALLOW_AGENT_RUN;
    // NODE_ENV is 'test' in vitest, which is != 'development', so this should trigger the 403

    const response = await POST(
      makeRequest({ agentKey: "qa_agent_enabled" })
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("only allowed in development");
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
});

describe("GET /api/admin/agents/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_AGENT_RUN = "true";
  });

  afterEach(() => {
    delete process.env.ALLOW_AGENT_RUN;
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
});

describe("DELETE /api/admin/agents/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/admin/agents/run",
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
});
