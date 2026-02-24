import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import packageJson from "../../../../package.json";

// Mock the supabase client
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

function mockSupabaseSuccess() {
  const mockLimit = vi.fn().mockResolvedValue({ error: null });
  const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  vi.mocked(supabase.from).mockImplementation(mockFrom);
}

function mockSupabaseError(message: string) {
  const mockLimit = vi.fn().mockResolvedValue({ error: { message } });
  const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  vi.mocked(supabase.from).mockImplementation(mockFrom);
}

// Database size in bytes: 123.4 MB = 129,394,278 bytes
const DB_SIZE_BYTES = 129394278;
const DB_SIZE_MB = 123.4;

function mockDatabaseSize(sizeBytes: number) {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: sizeBytes,
    error: null,
  } as never);
}

function mockDatabaseSizeError(message: string) {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: { message },
  } as never);
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  });

  it("should return 200 status", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('should include status: "healthy" field', async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("healthy");
  });

  it("should include timestamp field as ISO string", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    // Verify it's a valid ISO date string
    const parsed = new Date(data.timestamp);
    expect(parsed.toISOString()).toBe(data.timestamp);
  });

  it("should include version field from package.json", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe(packageJson.version);
  });

  it("should include services.supabase field with status", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services).toBeDefined();
    expect(data.services.supabase).toBeDefined();
    expect(data.services.supabase.status).toBe("connected");
    expect(typeof data.services.supabase.latency_ms).toBe("number");
  });

  it("should set Cache-Control: no-store header", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("should include uptime field as a number", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(typeof data.uptime).toBe("number");
  });

  it('should return 503 with status "degraded" when supabase check fails', async () => {
    mockSupabaseError("Connection refused");
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
    expect(data.services.supabase.error).toBe("Connection refused");
  });

  it("should return 503 when supabase throws an exception", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
  });

  // --- Database size monitoring tests ---

  it("should include database size info in healthy response", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services.database).toBeDefined();
    expect(data.services.database.size_mb).toBe(DB_SIZE_MB);
    expect(data.services.database.limit_mb).toBe(8192); // Supabase Pro tier: 8 GB
    expect(data.services.database.usage_percent).toBeCloseTo(1.5, 1); // 123.4 / 8192 * 100
  });

  it("should gracefully handle database size RPC error without breaking health check", async () => {
    mockSupabaseSuccess();
    mockDatabaseSizeError("permission denied for function get_database_size");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // Health check should still work; database info reports error
    expect(data.services.database).toBeDefined();
    expect(data.services.database.error).toBe(
      "permission denied for function get_database_size"
    );
  });

  it('should return status "degraded" when database usage exceeds 80%', async () => {
    mockSupabaseSuccess();
    // 80% of 8192 MB (Pro tier) = 6553.6 MB = 6,871,954,637 bytes
    const highUsageBytes = 6871954637;
    mockDatabaseSize(highUsageBytes);

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("degraded");
    expect(data.services.database.size_mb).toBe(6553.6);
    expect(data.services.database.usage_percent).toBe(80);
  });

  it("should call supabase.rpc with get_database_size", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    await GET();

    expect(supabase.rpc).toHaveBeenCalledWith("get_database_size");
  });

  it("should not use readFileSync to read package.json at runtime", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routeSource = fs.readFileSync(
      path.resolve(__dirname, "route.ts"),
      "utf-8"
    );
    expect(routeSource).not.toContain("readFileSync");
  });

  // --- Coverage for checkDatabaseSize() catch branch (line 80) ---

  it("should handle non-Error exception from database size RPC", async () => {
    mockSupabaseSuccess();
    // Throw a non-Error value (string) to cover the `err instanceof Error` false branch
    vi.mocked(supabase.rpc).mockRejectedValue("something went wrong");

    const response = await GET();
    const data = await response.json();

    // Database error should surface as "Unknown error" since it's not an Error instance
    expect(data.services.database).toBeDefined();
    expect(data.services.database.error).toBe("Unknown error");
    // Supabase is fine, and database error alone (without usage_percent) doesn't trigger degraded
    expect(response.status).toBe(200);
  });

  it("should handle Error exception from database size RPC catch branch", async () => {
    mockSupabaseSuccess();
    vi.mocked(supabase.rpc).mockRejectedValue(new Error("RPC network failure"));

    const response = await GET();
    const data = await response.json();

    expect(data.services.database.error).toBe("RPC network failure");
    expect(response.status).toBe(200);
  });

  // --- Coverage for outer GET() catch block (lines 122-139) ---

  it("should return 503 with degraded status when outer try block throws (Error)", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    // Make process.uptime() throw only on first call (inside try block) to trigger
    // the outer catch block (lines 122-139). On second call (inside catch block)
    // it returns normally so the catch can build the response.
    const originalUptime = process.uptime;
    let callCount = 0;
    process.uptime = () => {
      callCount++;
      if (callCount === 1) throw new Error("Catastrophic failure");
      return originalUptime.call(process);
    };

    const response = await GET();
    const data = await response.json();

    process.uptime = originalUptime;

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
    expect(data.services.supabase.latency_ms).toBe(0);
    expect(data.services.supabase.error).toBe("Catastrophic failure");
    expect(data.services.database.error).toBe("Catastrophic failure");
    expect(data.version).toBe(packageJson.version);
    expect(typeof data.uptime).toBe("number");
    expect(data.timestamp).toBeDefined();
    // Verify Cache-Control header on 503 path
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("should handle non-Error exception in outer GET() catch block", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    // Throw a non-Error value on first call to cover the `err instanceof Error` false branch
    const originalUptime = process.uptime;
    let callCount = 0;
    process.uptime = () => {
      callCount++;
      if (callCount === 1) throw "string error";
      return originalUptime.call(process);
    };

    const response = await GET();
    const data = await response.json();

    process.uptime = originalUptime;

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.error).toBe("Unknown error");
    expect(data.services.database.error).toBe("Unknown error");
  });

  // --- Coverage for checkSupabase() non-Error exception (line 51) ---

  it("should handle non-Error exception from supabase check", async () => {
    // Make from() return an object whose select().limit() rejects with a non-Error
    const mockLimit = vi.fn().mockRejectedValue(42);
    const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
    expect(data.services.supabase.error).toBe("Unknown error");
  });
});
