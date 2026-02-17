import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  createClient: () => ({ from: mockFrom }),
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
