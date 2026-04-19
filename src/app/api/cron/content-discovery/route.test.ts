import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// vi.hoisted runs before vi.mock hoisting, so mockAuthError and mockRpc are available in factories
const { mockAuthError, mockRpc } = vi.hoisted(() => {
  // Cannot use NextResponse here (not imported yet), so use a plain sentinel object
  const mockAuthError = new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  }) as unknown as import("next/server").NextResponse;
  const mockRpc = vi.fn();
  return { mockAuthError, mockRpc };
});

// Mock dependencies before importing route
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({
    valid: false,
    error: mockAuthError,
  }),
}));

vi.mock("@/lib/content-discovery", () => ({
  runDiscovery: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn(), rpc: mockRpc })),
}));

import { GET, POST } from "./route";
import { runDiscovery } from "@/lib/content-discovery";
import { validateAdminAuth } from "@/lib/admin-auth";

function makeRequest(headers: Record<string, string> = {}, method = "POST") {
  return new Request("http://localhost:3000/api/cron/content-discovery", {
    method,
    headers,
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/cron/content-discovery", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      WEBHOOK_SECRET: "test-secret",
      CRON_SECRET: "test-cron-secret",
      GOOGLE_PLACES_API_KEY: "test-google-key",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    // Default: advisory lock succeeds
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects requests without auth", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns auth.error from validateAdminAuth (not a manual response)", async () => {
    const res = await POST(makeRequest());
    // The route should return the exact auth.error object from validateAdminAuth,
    // not construct a new NextResponse.json({ error: "Unauthorized" }, { status: 401 }).
    expect(res).toBe(mockAuthError);
  });

  it("rejects requests with wrong secret", async () => {
    const res = await POST(makeRequest({ "x-webhook-secret": "wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when GOOGLE_PLACES_API_KEY is missing", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("GOOGLE_PLACES_API_KEY");
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("ANTHROPIC_API_KEY");
  });

  it("runs discovery pipeline and returns results", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 3,
      created: 2,
      skippedDuplicates: 1,
      errors: [],
      stories: [
        { id: "uuid-1", title: "Place 1", slug: "place-1", category: "nature" },
        { id: "uuid-2", title: "Place 2", slug: "place-2", category: "food" },
      ],
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(2);
    expect(body.discovered).toBe(3);
    expect(body.skippedDuplicates).toBe(1);
    expect(body.stories).toHaveLength(2);
  });

  it("returns 200 with empty results when no places found", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 0,
      created: 0,
      skippedDuplicates: 0,
      errors: [],
      stories: [],
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(0);
  });

  it("runs discovery when admin auth succeeds (no webhook secret)", async () => {
    (validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      valid: true,
    });
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 1,
      created: 1,
      skippedDuplicates: 0,
      errors: [],
      stories: [{ id: "uuid-1", title: "Place 1", slug: "place-1", category: "nature" }],
    });

    // No webhook secret — falls through to admin auth which is valid
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 with error details when runDiscovery throws an Error", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Google Places API rate limit exceeded")
    );

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Discovery failed");
    expect(body.details).toBe("Google Places API rate limit exceeded");
  });

  it("returns 500 with 'Unknown error' when runDiscovery throws a non-Error", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      "unexpected string error"
    );

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Discovery failed");
    expect(body.details).toBe("Unknown error");
  });
});

describe("GET /api/cron/content-discovery (Vercel Cron)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      WEBHOOK_SECRET: "test-secret",
      CRON_SECRET: "test-cron-secret",
      GOOGLE_PLACES_API_KEY: "test-google-key",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    // Default: advisory lock succeeds
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects GET without Authorization header", async () => {
    const res = await GET(makeRequest({}, "GET"));
    expect(res.status).toBe(401);
  });

  it("rejects GET with wrong CRON_SECRET", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer wrong-secret" }, "GET"));
    expect(res.status).toBe(401);
  });

  it("accepts GET with valid CRON_SECRET and runs discovery", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 1,
      created: 1,
      skippedDuplicates: 0,
      errors: [],
      stories: [{ id: "uuid-1", title: "Place 1", slug: "place-1", category: "nature" }],
    });

    const res = await GET(
      makeRequest({ authorization: "Bearer test-cron-secret" }, "GET")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(1);
  });
});

describe("Advisory lock (DO-M2) — content-discovery", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      WEBHOOK_SECRET: "test-secret",
      CRON_SECRET: "test-cron-secret",
      GOOGLE_PLACES_API_KEY: "test-google-key",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 409 when advisory lock is already held (concurrent run)", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("skipped");
    expect(body.reason).toMatch(/concurrent/);
  });

  it("returns 409 when pg_try_advisory_lock returns an error", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock")
        return Promise.resolve({ data: null, error: { message: "DB error" } });
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(409);
  });

  it("executes discovery and calls pg_advisory_unlock when lock is acquired", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 1,
      created: 1,
      skippedDuplicates: 0,
      errors: [],
      stories: [],
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(200);

    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "pg_advisory_unlock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("calls pg_advisory_unlock in finally block even when discovery throws", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    (runDiscovery as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Discovery service unavailable")
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);

    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "pg_advisory_unlock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);

    consoleSpy.mockRestore();
  });
});
