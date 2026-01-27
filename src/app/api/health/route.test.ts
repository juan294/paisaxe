import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

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

    expect(data.version).toBe("0.1.0");
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

  it('should return status "degraded" when supabase check fails', async () => {
    mockSupabaseError("Connection refused");
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
    expect(data.services.supabase.error).toBe("Connection refused");
  });

  it("should still return 200 even when supabase throws an exception", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
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
    expect(data.services.database.limit_mb).toBe(500);
    expect(data.services.database.usage_percent).toBeCloseTo(24.7, 1);
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
    // 80% of 500 MB = 400 MB = 419,430,400 bytes
    const highUsageBytes = 419430400;
    mockDatabaseSize(highUsageBytes);

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("degraded");
    expect(data.services.database.size_mb).toBe(400);
    expect(data.services.database.usage_percent).toBe(80);
  });

  it("should call supabase.rpc with get_database_size", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    await GET();

    expect(supabase.rpc).toHaveBeenCalledWith("get_database_size");
  });
});
