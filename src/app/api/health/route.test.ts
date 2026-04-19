import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, _clearProbeCacheForTests } from "./route";
import packageJson from "../../../../package.json";

// Mock the supabase client
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

// Mock global fetch for external service probes
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createChainMock(resolveValue: unknown) {
  const mock = {
    select: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
  };
  mock.select.mockReturnValue(mock);
  mock.limit.mockReturnValue(Promise.resolve(resolveValue));
  mock.eq.mockReturnValue(mock);
  // Terminal: when the chain ends without limit (stories uses head:true)
  // The select with head:true returns a promise-like object
  return mock;
}

function mockSupabaseSuccess() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const mock = createChainMock({ data: [{ id: "1" }], error: null });
      // For stories, select() with head:true returns the chain which resolves via .eq()
      const lastEq = vi.fn().mockResolvedValue({ data: [{ id: "1" }], error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
      mock.select.mockReturnValue({ eq: firstEq });
      return mock as never;
    }
    // chunks: from("chunks").select("id").limit(1)
    return createChainMock({ error: null }) as never;
  });
}

function mockSupabaseError(message: string) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const lastEq = vi.fn().mockResolvedValue({ data: null, error: { message } });
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
      const mock = { select: vi.fn().mockReturnValue({ eq: firstEq }) };
      return mock as never;
    }
    return createChainMock({ error: { message } }) as never;
  });
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
    _clearProbeCacheForTests();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    vi.stubEnv("VOYAGE_API_KEY", "test-voyage-key");
    vi.stubEnv("STRIPE_SECRET_KEY", "test-stripe-key");
    vi.stubEnv("ELEVENLABS_API_KEY", "test-elevenlabs-key");
    // Default: fetch resolves successfully (Stripe probe)
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
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

  // --- Stories health check tests ---

  it("should include stories status in healthy response", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services.stories).toBeDefined();
    expect(data.services.stories.status).toBe("ok");
  });

  it('should return degraded when stories check fails (permission denied)', async () => {
    // Supabase connectivity works, but stories specifically fails
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "permission denied for table stories" },
        });
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.stories.status).toBe("fallback");
    expect(data.services.stories.error).toContain("permission denied");
  });

  it('should return degraded when stories returns zero approved rows', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockResolvedValue({ data: [], error: null });
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.stories.status).toBe("fallback");
    expect(data.services.stories.count).toBe(0);
  });

  it("should handle stories query returning null data without error (line 75 ?? fallback)", async () => {
    // When stories query returns data: null but no error, the ?? 0 fallback triggers
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockResolvedValue({ data: null, error: null });
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.stories.status).toBe("fallback");
    expect(data.services.stories.count).toBe(0);
  });

  it("should handle checkStories throwing a non-Error exception (line 85)", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        // Make the chain throw a non-Error value
        const lastEq = vi.fn().mockRejectedValue("stories query crashed");
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.stories.status).toBe("fallback");
    expect(data.services.stories.error).toBe("Unknown error");
  });

  it("should handle checkStories throwing an Error exception (line 85 true branch)", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockRejectedValue(new Error("stories table missing"));
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.stories.status).toBe("fallback");
    expect(data.services.stories.error).toBe("stories table missing");
  });

  // --- External service probe tests ---

  it("should include external services in health response", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services.anthropic).toBeDefined();
    expect(data.services.voyage).toBeDefined();
    expect(data.services.stripe).toBeDefined();
    expect(data.services.elevenlabs).toBeDefined();
  });

  it("should report anthropic as ok when env key is configured", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services.anthropic.status).toBe("ok");
  });

  it("should report anthropic as not_configured when ANTHROPIC_API_KEY is missing", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const response = await GET();
    const data = await response.json();

    expect(data.services.anthropic.status).toBe("not_configured");
  });

  it("should report voyage as ok when env key is configured", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services.voyage.status).toBe("ok");
  });

  it("should report voyage as not_configured when VOYAGE_API_KEY is missing", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    vi.stubEnv("VOYAGE_API_KEY", "");

    const response = await GET();
    const data = await response.json();

    expect(data.services.voyage.status).toBe("not_configured");
  });

  it("should report elevenlabs as ok when env key is configured", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);

    const response = await GET();
    const data = await response.json();

    expect(data.services.elevenlabs.status).toBe("ok");
  });

  it("should report elevenlabs as not_configured when ELEVENLABS_API_KEY is missing", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    const response = await GET();
    const data = await response.json();

    expect(data.services.elevenlabs.status).toBe("not_configured");
  });

  it("should report stripe as ok when fetch succeeds", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const response = await GET();
    const data = await response.json();

    expect(data.services.stripe.status).toBe("ok");
  });

  it("should report stripe as not_configured when STRIPE_SECRET_KEY is missing", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const response = await GET();
    const data = await response.json();

    expect(data.services.stripe.status).toBe("not_configured");
  });

  it("should report stripe as degraded when fetch fails", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    mockFetch.mockRejectedValue(new Error("Network error"));

    const response = await GET();
    const data = await response.json();

    expect(data.services.stripe.status).toBe("degraded");
  });

  it("should report stripe as degraded when fetch returns non-ok status", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    const response = await GET();
    const data = await response.json();

    expect(data.services.stripe.status).toBe("degraded");
  });

  it("should report stripe as degraded when fetch times out", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    // Simulate a timeout by having fetch never resolve within our race window
    mockFetch.mockImplementation(
      () => new Promise<Response>((resolve) => setTimeout(() => resolve({ ok: true, status: 200 } as Response), 60000))
    );

    const response = await GET();
    const data = await response.json();

    expect(data.services.stripe.status).toBe("degraded");
  }, 10000);

  it("should NOT fail overall health when external service probes are degraded", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    // Stripe fails
    mockFetch.mockRejectedValue(new Error("Stripe down"));
    // But anthropic/voyage/elevenlabs are configured (env vars set in beforeEach)

    const response = await GET();
    const data = await response.json();

    // External probe failures do NOT degrade the overall status
    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.services.stripe.status).toBe("degraded");
  });

  it("should run probes in parallel and respond quickly", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const start = Date.now();
    const response = await GET();
    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    // Total response time should be well under 5s even with parallel probes
    expect(elapsed).toBeLessThan(5000);
  });

  it("should include probe latency_ms in stripe status", async () => {
    mockSupabaseSuccess();
    mockDatabaseSize(DB_SIZE_BYTES);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const response = await GET();
    const data = await response.json();

    expect(typeof data.services.stripe.latency_ms).toBe("number");
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
