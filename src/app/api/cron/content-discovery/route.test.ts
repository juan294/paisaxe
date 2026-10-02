import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

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
  MAX_DISCOVERIES_PER_RUN: 5,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn(), rpc: mockRpc })),
}));

import { GET, POST, maxDuration } from "./route";
import { runDiscovery, MAX_DISCOVERIES_PER_RUN } from "@/lib/content-discovery";
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
    // Default: durable cron lease succeeds
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
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

  it("runs discovery when admin auth succeeds with valid CSRF token + Origin (no webhook secret)", async () => {
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

    // No webhook secret — falls through to admin auth which is valid, and
    // carries a matching Origin + CSRF token (the admin dashboard's shape).
    const res = await POST(
      makeRequest({
        origin: "https://paisaxe.es",
        "x-csrf-token": "test-csrf-token",
        cookie: "__csrf=test-csrf-token",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // BE-H5/SE-M1: the admin-cookie fallback is exactly the CSRF attack
  // surface — a hostile cross-site page riding a logged-in admin's session
  // cookie must NOT be able to trigger discovery without a valid CSRF token
  // and Origin.
  it("BE-H5/SE-M1: rejects admin-session fallback requests with no CSRF token or Origin", async () => {
    (validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      valid: true,
    });

    // No webhook secret, no Origin, no CSRF token — simulates a cross-site
    // POST riding the victim admin's session cookie.
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/csrf/i);
    expect(runDiscovery).not.toHaveBeenCalled();
  });

  it("BE-H5/SE-M1: rejects admin-session fallback requests with a disallowed Origin", async () => {
    (validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      valid: true,
    });

    const res = await POST(
      makeRequest({
        origin: "https://evil.example",
        "x-csrf-token": "test-csrf-token",
        cookie: "__csrf=test-csrf-token",
      })
    );
    expect(res.status).toBe(403);
    expect(runDiscovery).not.toHaveBeenCalled();
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
    // Default: durable cron lease succeeds
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
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

describe("Cron lease (DO-M2) — content-discovery", () => {
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

  it("returns 409 when durable cron lease is already held (concurrent run)", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("skipped");
    expect(body.reason).toMatch(/concurrent/);
  });

  it("returns 409 when try_acquire_cron_job_lease returns an error", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock")
        return Promise.resolve({ data: null, error: { message: "DB error" } });
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(409);
  });

  it("executes discovery and calls release_cron_job_lock when lease is acquired", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
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
      (args: unknown[]) => args[0] === "release_cron_job_lock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("#440 QA-H2: uses durable cron lease RPCs instead of session durable cron lease RPCs", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock")
        return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock")
        return Promise.resolve({ data: true, error: null });
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

    const rpcNames = mockRpc.mock.calls.map((args: unknown[]) => args[0]);
    expect(rpcNames).toContain("try_acquire_cron_job_lock");
    expect(rpcNames).toContain("release_cron_job_lock");
    expect(rpcNames).not.toContain("pg_try_advisory_lock");
    expect(rpcNames).not.toContain("pg_advisory_unlock");
  });

  it("calls release_cron_job_lock in finally block even when discovery throws", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    (runDiscovery as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Discovery service unavailable")
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);

    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "release_cron_job_lock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);

    consoleSpy.mockRestore();
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("logs CONTENT_DISCOVERY_LOCK_RELEASE_FAILED when releaseCronJobLease throws in finally (line 86)", async () => {
    // releaseCronJobLease throws when the RPC returns an error
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: null, error: { message: "lock release failed" } });
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
    // Discovery succeeded — should still return 200 despite lock release failure
    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      "[CONTENT_DISCOVERY_LOCK_RELEASE_FAILED]",
      expect.objectContaining({ error: expect.anything() })
    );
  });
});

describe("CRON_SUCCESS/CRON_FAILURE telemetry — content-discovery", () => {
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
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("emits [CRON_SUCCESS] with job name and duration_ms on successful discovery", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 2,
      created: 2,
      skippedDuplicates: 0,
      errors: [],
      stories: [],
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(200);

    expect(logger.info).toHaveBeenCalledWith(
      "[CRON_SUCCESS]",
      expect.objectContaining({
        job: "content-discovery",
        duration_ms: expect.any(Number),
      })
    );
  });

  it("emits [CRON_FAILURE] with job name and error message when discovery throws", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Google Places API rate limit exceeded")
    );

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);

    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_FAILURE]",
      expect.objectContaining({
        job: "content-discovery",
        error: expect.stringContaining("Google Places API rate limit exceeded"),
      })
    );
  });
});

// DO-M6 (#833): explicit ceiling, replacing Vercel's implicit platform
// default, kept strictly above the worst-case network budget the discovery
// pipeline can run up: one Google Places search
// (AbortSignal.timeout(8_000) — src/lib/content-discovery.ts:219) plus up to
// MAX_DISCOVERIES_PER_RUN sequential Claude description calls
// (AbortSignal.timeout(8_000) each — src/lib/content-discovery.ts:273).
describe("DO-M6: maxDuration (#833)", () => {
  it("declares an explicit numeric maxDuration", () => {
    expect(typeof maxDuration).toBe("number");
    expect(Number.isFinite(maxDuration)).toBe(true);
  });

  it("keeps maxDuration strictly greater than the worst-case network budget", () => {
    const PLACES_SEARCH_TIMEOUT_SECONDS = 8;
    const DESCRIPTION_TIMEOUT_SECONDS = 8;
    const worstCaseNetworkSeconds =
      PLACES_SEARCH_TIMEOUT_SECONDS +
      MAX_DISCOVERIES_PER_RUN * DESCRIPTION_TIMEOUT_SECONDS;

    expect(maxDuration).toBeGreaterThan(worstCaseNetworkSeconds);
  });
});
