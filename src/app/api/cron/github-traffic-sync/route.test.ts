import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock next/server
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    headers: Map<string, string>;
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.headers = new Map(Object.entries(init?.headers || {}));
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}));

// Mock admin auth (fallback path) — always reject so webhook secret is tested
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: () => Promise.resolve({ valid: false, error: { status: 401 } }),
}));

// Mock Supabase client
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockLte = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "github_traffic_daily") {
    return { upsert: mockUpsert };
  }
  if (table === "github_traffic_referrers" || table === "github_traffic_paths") {
    return {
      insert: mockInsert,
      delete: () => ({ lte: mockLte }),
    };
  }
  return { upsert: mockUpsert, insert: mockInsert };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

// Mock fetch for GitHub API
const mockFetch = vi.fn();

describe("POST /api/cron/github-traffic-sync", () => {
  const originalEnv = process.env;
  const WEBHOOK_SECRET = "test-webhook-secret-123";
  const CRON_SECRET = "test-cron-secret-456";
  const GITHUB_TOKEN = "ghp_test_token_123";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET,
      CRON_SECRET,
      GITHUB_TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    global.fetch = mockFetch;
    mockFetch.mockReset();
    mockUpsert.mockClear();
    mockInsert.mockClear();
    mockFrom.mockClear();
    mockRpc.mockReset();
    logger.info.mockClear();
    logger.error.mockClear();
    logger.warn.mockClear();
    // Default: durable cron lease succeeds (lock acquired, unlock succeeds)
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects requests without webhook secret and no admin session", async () => {
    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: {} }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it("rejects requests with wrong webhook secret", async () => {
    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": "wrong-secret-value" } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it("returns 500 when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(500);
    expect(response.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("GITHUB_TOKEN"),
    }));
  });

  it("fetches all 4 GitHub traffic endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    await POST(request as never);

    // Should call GitHub API 4 times: views, clones, referrers, paths
    expect(mockFetch).toHaveBeenCalledTimes(4);

    const urls = mockFetch.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(urls.some(u => u.includes("/traffic/views"))).toBe(true);
    expect(urls.some(u => u.includes("/traffic/clones"))).toBe(true);
    expect(urls.some(u => u.includes("/traffic/popular/referrers"))).toBe(true);
    expect(urls.some(u => u.includes("/traffic/popular/paths"))).toBe(true);
  });

  it("upserts daily traffic data from views and clones", async () => {
    const viewsResponse = {
      count: 100,
      uniques: 10,
      views: [
        { timestamp: "2026-02-01T00:00:00Z", count: 50, uniques: 5 },
        { timestamp: "2026-02-02T00:00:00Z", count: 50, uniques: 5 },
      ],
    };
    const clonesResponse = {
      count: 20,
      uniques: 4,
      clones: [
        { timestamp: "2026-02-01T00:00:00Z", count: 10, uniques: 2 },
        { timestamp: "2026-02-02T00:00:00Z", count: 10, uniques: 2 },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => viewsResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => clonesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("returns success with sync stats", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      synced: true,
    }));
  });

  it("inserts referrer and path data and returns correct counts", async () => {
    const viewsResponse = {
      count: 50,
      uniques: 5,
      views: [{ timestamp: "2026-03-01T00:00:00Z", count: 50, uniques: 5 }],
    };
    const clonesResponse = {
      count: 10,
      uniques: 2,
      clones: [{ timestamp: "2026-03-01T00:00:00Z", count: 10, uniques: 2 }],
    };
    const referrersResponse = [
      { referrer: "google.com", count: 30, uniques: 20 },
      { referrer: "github.com", count: 10, uniques: 5 },
    ];
    const pathsResponse = [
      { path: "/juan294/paisaxe", title: "paisaxe", count: 40, uniques: 15 },
    ];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => viewsResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => clonesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => referrersResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => pathsResponse });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      synced: true,
      daily: 1,
      referrers: 2,
      paths: 1,
    }));

    // Verify insert was called for referrers and paths
    expect(mockInsert).toHaveBeenCalled();
    // Verify upsert was called for daily traffic
    expect(mockUpsert).toHaveBeenCalled();
    // Verify cleanup deletes were triggered (from mockFrom)
    expect(mockLte).toHaveBeenCalled();
  });

  it("merges clones into existing view dates in dailyMap", async () => {
    // Views and clones share the same date — should merge into one daily row
    const viewsResponse = {
      count: 100,
      uniques: 10,
      views: [{ timestamp: "2026-03-05T00:00:00Z", count: 100, uniques: 10 }],
    };
    const clonesResponse = {
      count: 20,
      uniques: 4,
      clones: [{ timestamp: "2026-03-05T00:00:00Z", count: 20, uniques: 4 }],
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => viewsResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => clonesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, number> };
    expect(response.status).toBe(200);
    // Only one daily row since both views and clones are on the same date
    expect(response.body.daily).toBe(1);

    // Verify the upserted row has both views and clones data
    const upsertedRows = mockUpsert.mock.calls[0][0];
    expect(upsertedRows).toHaveLength(1);
    expect(upsertedRows[0]).toEqual(expect.objectContaining({
      date: "2026-03-05",
      views: 100,
      views_unique: 10,
      clones: 20,
      clones_unique: 4,
    }));
  });

  it("handles clone-only dates not present in views", async () => {
    // Clone date that has no matching view date — should create a new dailyMap entry
    const viewsResponse = {
      count: 50,
      uniques: 5,
      views: [{ timestamp: "2026-03-01T00:00:00Z", count: 50, uniques: 5 }],
    };
    const clonesResponse = {
      count: 10,
      uniques: 2,
      clones: [{ timestamp: "2026-03-02T00:00:00Z", count: 10, uniques: 2 }],
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => viewsResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => clonesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, number> };
    expect(response.status).toBe(200);
    // Two daily rows: one from views (Mar 1), one from clones (Mar 2)
    expect(response.body.daily).toBe(2);

    const upsertedRows = mockUpsert.mock.calls[0][0];
    expect(upsertedRows).toHaveLength(2);
    // The clone-only row should have zero views
    const cloneOnlyRow = upsertedRows.find((r: { date: string }) => r.date === "2026-03-02");
    expect(cloneOnlyRow).toEqual(expect.objectContaining({
      views: 0,
      views_unique: 0,
      clones: 10,
      clones_unique: 2,
    }));
  });

  it("handles daily upsert error gracefully", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "DB connection failed" } });

    const viewsResponse = {
      count: 10,
      uniques: 1,
      views: [{ timestamp: "2026-03-01T00:00:00Z", count: 10, uniques: 1 }],
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => viewsResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, number> };
    // Still returns 200 — error is logged but sync continues
    expect(response.status).toBe(200);
    // dailyCount stays at 0 because upsert errored
    expect(response.body.daily).toBe(0);
  });

  it("handles referrer insert error gracefully", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "Referrer insert failed" } });

    const referrersResponse = [{ referrer: "google.com", count: 10, uniques: 5 }];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => referrersResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, number> };
    expect(response.status).toBe(200);
    expect(response.body.referrers).toBe(0);
  });

  it("handles path insert error gracefully", async () => {
    // First insert call (referrers) succeeds, second (paths) fails
    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "Path insert failed" } });

    const referrersResponse = [{ referrer: "github.com", count: 5, uniques: 3 }];
    const pathsResponse = [{ path: "/repo", title: "repo", count: 10, uniques: 8 }];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => referrersResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => pathsResponse });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, number> };
    expect(response.status).toBe(200);
    // Referrers succeeded
    expect(response.body.referrers).toBe(1);
    // Paths failed — count stays 0
    expect(response.body.paths).toBe(0);
  });

  it("returns 500 when GitHub API throws an error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, string> };
    expect(response.status).toBe(500);
    expect(response.body).toEqual(expect.objectContaining({
      error: "Sync failed",
      details: "Network timeout",
    }));
  });

  it("returns 500 with 'Unknown error' for non-Error throws", async () => {
    mockFetch.mockRejectedValueOnce("string error");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, string> };
    expect(response.status).toBe(500);
    expect(response.body).toEqual(expect.objectContaining({
      error: "Sync failed",
      details: "Unknown error",
    }));

    consoleSpy.mockRestore();
  });

  it("handles GitHub API returning non-ok response", async () => {
    // All 4 fetches fire in parallel via Promise.all, so we must mock all of them.
    // The first one (views) returns 403 which causes fetchGitHub to throw,
    // but the other 3 fetches still execute so they need valid mock responses.
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Rate limit exceeded",
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never) as unknown as { status: number; body: Record<string, string> };
    expect(response.status).toBe(500);
    expect(response.body.details).toContain("GitHub API 403");
    expect(response.body.details).toContain("Rate limit exceeded");

    consoleSpy.mockRestore();
  });

  it("handles null/undefined views and clones arrays gracefully", async () => {
    // GitHub API might return null/undefined for views/clones arrays
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0 }) }) // no views key
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0 }) }) // no clones key
      .mockResolvedValueOnce({ ok: true, json: async () => null }) // null referrers
      .mockResolvedValueOnce({ ok: true, json: async () => null }); // null paths

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      synced: true,
      daily: 0,
      referrers: 0,
      paths: 0,
    }));
  });

  it("accepts POST with valid admin session when webhook secret is missing", async () => {
    // Override the admin auth mock to return valid for this test
    const adminAuth = await import("@/lib/admin-auth");
    vi.spyOn(adminAuth, "validateAdminAuth").mockResolvedValueOnce({ valid: true } as never);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: {} } // no webhook secret
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      synced: true,
    }));
  });
});

describe("GET /api/cron/github-traffic-sync (Vercel Cron)", () => {
  const originalEnv = process.env;
  const CRON_SECRET = "test-cron-secret-456";
  const GITHUB_TOKEN = "ghp_test_token_123";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      CRON_SECRET,
      GITHUB_TOKEN,
      WEBHOOK_SECRET: "test-webhook-secret-123",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    global.fetch = mockFetch;
    mockFetch.mockReset();
    mockUpsert.mockClear();
    mockInsert.mockClear();
    mockFrom.mockClear();
    mockRpc.mockReset();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects GET without Authorization header", async () => {
    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: {} }
    );

    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("rejects GET with wrong CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { authorization: "Bearer wrong-secret" } }
    );

    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("accepts GET with valid CRON_SECRET and runs sync", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { authorization: `Bearer ${CRON_SECRET}` } }
    );

    const response = await GET(request as never);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      synced: true,
    }));
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe("Cron lease (DO-M2) — github-traffic-sync", () => {
  const originalEnv = process.env;
  const WEBHOOK_SECRET = "test-webhook-secret-123";
  const GITHUB_TOKEN = "ghp_test_token_123";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET,
      CRON_SECRET: "test-cron-secret-456",
      GITHUB_TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    global.fetch = mockFetch;
    mockFetch.mockReset();
    mockRpc.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 409 when durable cron lease is already held (concurrent run)", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({ status: "skipped", reason: expect.stringContaining("concurrent") })
    );
  });

  it("returns 409 when try_acquire_cron_job_lease returns an error", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock")
        return Promise.resolve({ data: null, error: { message: "DB error" } });
      return Promise.resolve({ data: null, error: null });
    });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(409);
  });

  it("executes sync and calls release_cron_job_lock when lease is acquired", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "release_cron_job_lock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("#439 QA-H1: uses durable cron lease RPCs instead of session durable cron lease RPCs", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock")
        return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock")
        return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const rpcNames = mockRpc.mock.calls.map((args: unknown[]) => args[0]);
    expect(rpcNames).toContain("try_acquire_cron_job_lock");
    expect(rpcNames).toContain("release_cron_job_lock");
    expect(rpcNames).not.toContain("pg_try_advisory_lock");
    expect(rpcNames).not.toContain("pg_advisory_unlock");
  });

  it("calls release_cron_job_lock in finally block even when sync throws", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    // Even though sync failed, it should return 500 from the catch block inside the try
    expect(response.status).toBe(500);

    // release_cron_job_lock must have been called in the finally block
    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "release_cron_job_lock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);

    consoleSpy.mockRestore();
  });
});

describe("CRON_SUCCESS/CRON_FAILURE telemetry — github-traffic-sync", () => {
  const originalEnv = process.env;
  const WEBHOOK_SECRET = "test-webhook-secret-123";
  const GITHUB_TOKEN = "ghp_test_token_123";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET,
      CRON_SECRET: "test-cron-secret-456",
      GITHUB_TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    global.fetch = mockFetch;
    mockFetch.mockReset();
    mockRpc.mockReset();
    logger.info.mockClear();
    logger.error.mockClear();
    logger.warn.mockClear();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "try_acquire_cron_job_lock") return Promise.resolve({ data: "lease-token-123", error: null });
      if (fn === "release_cron_job_lock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("emits [CRON_SUCCESS] with job name and duration_ms on successful sync", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, views: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0, uniques: 0, clones: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    expect(logger.info).toHaveBeenCalledWith(
      "[CRON_SUCCESS]",
      expect.objectContaining({
        job: "github-traffic-sync",
        duration_ms: expect.any(Number),
      })
    );
  });

  it("emits [CRON_FAILURE] with job name and error message when sync throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/github-traffic-sync",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(500);

    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_FAILURE]",
      expect.objectContaining({
        job: "github-traffic-sync",
        error: expect.stringContaining("Network timeout"),
      })
    );
  });
});
