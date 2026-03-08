import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

const { mockExec, mockSpawn } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockSpawn: vi.fn(),
}));

vi.mock("child_process", () => ({
  default: { exec: mockExec, spawn: mockSpawn, ChildProcess: class {} },
  exec: mockExec,
  spawn: mockSpawn,
  ChildProcess: class {},
}));

vi.mock("util", () => ({
  default: { promisify: (fn: unknown) => fn },
  promisify: (fn: unknown) => fn,
}));

import { validateAdminAuth } from "@/lib/admin-auth";
import { GET, POST, DELETE } from "./route";

describe("GET /api/admin/tunnel", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "development" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 403 in production", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Tunnel control is only available in development");
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return tunnel status when running", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockResolvedValue({ stdout: "12345\n" });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.running).toBe(true);
    expect(data.url).toBe("https://paisaxe.tunnelfor.me");
  });

  it("should return tunnel status when not running", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockResolvedValue({ stdout: "" });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.running).toBe(false);
    expect(data.url).toBeNull();
  });

  it("should return not running when pgrep throws an error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockRejectedValue(new Error("pgrep command failed"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.running).toBe(false);
    expect(data.url).toBeNull();
  });
});

describe("POST /api/admin/tunnel", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "development", HOME: "/home/test" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 403 in production", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Tunnel control is only available in development");
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return already running if tunnel is active", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockResolvedValue({ stdout: "12345\n" });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.running).toBe(true);
    expect(data.message).toBe("Tunnel is already running");
  });

  it("should start tunnel and return success", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    let callCount = 0;
    mockExec.mockImplementation(async () => {
      callCount++;
      // First call: isTunnelRunning check (not running)
      // Second call: isTunnelRunning after start (running)
      return { stdout: callCount === 1 ? "" : "12345\n" };
    });

    const mockProcess = { unref: vi.fn() };
    mockSpawn.mockReturnValue(mockProcess);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.running).toBe(true);
    expect(data.url).toBe("https://paisaxe.tunnelfor.me");
    expect(data.message).toBe("Tunnel started successfully");
    expect(mockSpawn).toHaveBeenCalledWith(
      "cloudflared",
      ["tunnel", "--config", "/home/test/.cloudflared/config-paisaxe.yml", "run", "paisaxe"],
      expect.objectContaining({ detached: true, stdio: "ignore" })
    );
    expect(mockProcess.unref).toHaveBeenCalled();
  });

  it("should return 500 when spawn throws an error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockResolvedValue({ stdout: "" }); // not running
    mockSpawn.mockImplementation(() => {
      throw new Error("cloudflared not found");
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to start tunnel");
    expect(data.error).toContain("cloudflared not found");
  });
});

describe("DELETE /api/admin/tunnel", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "development" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 403 in production", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Tunnel control is only available in development");
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should stop the tunnel successfully", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockResolvedValue({ stdout: "" });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.running).toBe(false);
    expect(data.url).toBeNull();
    expect(data.message).toBe("Tunnel stopped successfully");
  });

  it("should return 500 when pkill throws an unexpected error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockExec.mockRejectedValue(new Error("Permission denied"));

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to stop tunnel");
  });
});
