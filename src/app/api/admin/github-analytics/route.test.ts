import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock admin auth
const mockValidateAdminAuth = vi.fn();
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: () => mockValidateAdminAuth(),
}));

// Mock NextResponse to return plain objects for easy testing
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status || 200,
      _headers: init?.headers || {},
    }),
  },
}));

// Mock Supabase — chain-style query builder
const mockDailyData = [
  { date: "2026-02-01", views: 50, views_unique: 5, clones: 10, clones_unique: 2 },
  { date: "2026-02-02", views: 60, views_unique: 6, clones: 12, clones_unique: 3 },
];

const mockReferrerData = [
  { referrer: "google.com", count: 30, uniques: 10, fetched_at: "2026-02-06T03:00:00Z" },
  { referrer: "github.com", count: 15, uniques: 5, fetched_at: "2026-02-06T03:00:00Z" },
];

const mockPathData = [
  { path: "/juan294/paisaxe", title: "paisaxe", count: 40, uniques: 12, fetched_at: "2026-02-06T03:00:00Z" },
];

const mockLastSync = [
  { fetched_at: "2026-02-06T03:00:00Z" },
];

function buildChain(data: unknown[]) {
  return {
    select: () => ({
      gte: () => ({
        lte: () => ({
          order: () => ({
            order: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
      order: () => ({
        order: () => ({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

const mockFrom = vi.fn((table: string) => {
  if (table === "github_traffic_daily") {
    // Two uses: daily query (with gte/lte) and lastSync query (with order/limit)
    return {
      select: (cols: string) => {
        if (cols === "fetched_at") {
          // lastSync query
          return {
            order: () => ({
              limit: vi.fn().mockResolvedValue({ data: mockLastSync, error: null }),
            }),
          };
        }
        // daily query
        return {
          gte: () => ({
            lte: () => ({
              order: vi.fn().mockResolvedValue({ data: mockDailyData, error: null }),
            }),
          }),
        };
      },
    };
  }
  if (table === "github_traffic_referrers") {
    return {
      select: () => ({
        order: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({ data: mockReferrerData, error: null }),
          }),
        }),
      }),
    };
  }
  if (table === "github_traffic_paths") {
    return {
      select: () => ({
        order: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({ data: mockPathData, error: null }),
          }),
        }),
      }),
    };
  }
  return buildChain([]);
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

describe("GET /api/admin/github-analytics", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    mockValidateAdminAuth.mockReset();
  });

  it("rejects unauthenticated requests", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: false,
      error: { status: 401 },
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("returns analytics data for authenticated admins", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: true,
      userId: "test-user-id",
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("summary");
    expect(response.body.data).toHaveProperty("daily");
    expect(response.body.data).toHaveProperty("referrers");
    expect(response.body.data).toHaveProperty("popularPaths");
    expect(response.body.data).toHaveProperty("lastSyncedAt");
    expect(response.body.data).toHaveProperty("dateRange");
  });

  it("calculates summary totals correctly", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: true,
      userId: "test-user-id",
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    const summary = response.body.data.summary;

    // 50 + 60 = 110 views, 5 + 6 = 11 unique views
    expect(summary.totalViews).toBe(110);
    expect(summary.totalUniqueViews).toBe(11);
    // 10 + 12 = 22 clones, 2 + 3 = 5 unique clones
    expect(summary.totalClones).toBe(22);
    expect(summary.totalUniqueClones).toBe(5);
    expect(summary.dataPointCount).toBe(2);
  });

  it("includes cache-control headers", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: true,
      userId: "test-user-id",
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response._headers["Cache-Control"]).toBe(
      "private, max-age=120, stale-while-revalidate=300"
    );
  });
});
