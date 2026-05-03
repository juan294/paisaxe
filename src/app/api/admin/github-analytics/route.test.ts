import { describe, it, expect, vi, beforeEach } from "vitest";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock withAdminRead — SE-M3: GET routes use cookie-scoped client
const mockWithAdminRead = vi.fn();
vi.mock("@/lib/admin-auth", () => ({
  withAdminRead: (...args: unknown[]) => mockWithAdminRead(...args),
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

describe("GET /api/admin/github-analytics", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
    mockWithAdminRead.mockReset();
    // Default: authorized — call handler with mock supabase client
    mockWithAdminRead.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (handler: (client: any) => Promise<unknown>) =>
        handler({ from: mockFrom })
    );
  });

  it("rejects unauthenticated requests", async () => {
    mockWithAdminRead.mockResolvedValue({ status: 401 });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("returns analytics data for authenticated admins", async () => {
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

  it("logs error when daily query fails but continues", async () => {

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Route uses pino logger.error, not console.error;

    // Override the daily query to return an error
    const originalFrom = mockFrom.getMockImplementation();
    mockFrom.mockImplementation((table: string) => {
      if (table === "github_traffic_daily") {
        return {
          select: (cols: string) => {
            if (cols === "fetched_at") {
              return {
                order: () => ({
                  limit: vi.fn().mockResolvedValue({ data: mockLastSync, error: null }),
                }),
              };
            }
            // daily query returns error
            return {
              gte: () => ({
                lte: () => ({
                  order: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Table not found" },
                  }),
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

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response.status).toBe(200);
    // Daily data should be empty since query failed
    expect(response.body.data.daily).toEqual([]);
    expect(response.body.data.summary.totalViews).toBe(0);

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch daily traffic:", expect.anything());

    consoleSpy.mockRestore();
    if (originalFrom) {
      mockFrom.mockImplementation(originalFrom);
    }
  });

  it("returns empty data on unexpected exception", async () => {

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Save original implementation and make the from function throw
    const originalImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation(() => {
      throw new Error("Connection lost");
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response.status).toBe(200);
    expect(response.body.data.summary.totalViews).toBe(0);
    expect(response.body.data.daily).toEqual([]);
    expect(response.body.data.referrers).toEqual([]);
    expect(response.body.data.popularPaths).toEqual([]);
    expect(response.body.data.lastSyncedAt).toBeNull();

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("GitHub analytics API error:", expect.anything());

    consoleSpy.mockRestore();
    // Restore original mock implementation
    if (originalImpl) mockFrom.mockImplementation(originalImpl);
  });

  it("uses default date range when from/to params are missing", async () => {

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response.status).toBe(200);

    const { dateRange } = response.body.data;
    // `from` should default to ~30 days ago in YYYY-MM-DD format
    expect(dateRange.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // `to` should default to today in YYYY-MM-DD format
    expect(dateRange.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // `to` should be today
    const today = new Date().toISOString().split("T")[0];
    expect(dateRange.to).toBe(today);
    // `from` should be approximately 30 days before today
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it("handles null referrer, path, and lastSync data gracefully", async () => {

    // Override all queries to return null data arrays
    const originalImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation((table: string) => {
      if (table === "github_traffic_daily") {
        return {
          select: (cols: string) => {
            if (cols === "fetched_at") {
              // lastSync query returns null data
              return {
                order: () => ({
                  limit: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              };
            }
            // daily query returns null data
            return {
              gte: () => ({
                lte: () => ({
                  order: vi.fn().mockResolvedValue({ data: null, error: null }),
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
                limit: vi.fn().mockResolvedValue({ data: null, error: null }),
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
                limit: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return buildChain([]);
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response.status).toBe(200);
    expect(response.body.data.daily).toEqual([]);
    expect(response.body.data.referrers).toEqual([]);
    expect(response.body.data.popularPaths).toEqual([]);
    expect(response.body.data.lastSyncedAt).toBeNull();
    expect(response.body.data.summary.totalViews).toBe(0);
    expect(response.body.data.summary.dataPointCount).toBe(0);

    if (originalImpl) mockFrom.mockImplementation(originalImpl);
  });

  it("catch block falls back to empty strings when URL has no from/to params", async () => {

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Make supabase throw to trigger the catch block
    const originalImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation(() => {
      throw new Error("Connection lost");
    });

    const { GET } = await import("./route");
    // No from/to params — catch block should fall back to empty strings
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    expect(response.status).toBe(200);
    expect(response.body.data.dateRange.from).toBe("");
    expect(response.body.data.dateRange.to).toBe("");
    expect(response.body.data.summary.totalViews).toBe(0);
    expect(response.body.data.daily).toEqual([]);

    consoleSpy.mockRestore();
    if (originalImpl) mockFrom.mockImplementation(originalImpl);
  });

  it("includes cache-control headers", async () => {

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

  /**
   * PE-L1: The four Supabase queries (daily, referrers, paths, lastSync)
   * must be dispatched concurrently via Promise.all, not sequentially.
   *
   * Strategy: track overlapping in-flight query promises instead of relying
   * on wall-clock timing, which can be noisy on loaded machines.
   */
  it("PE-L1: fetches all four Supabase tables concurrently (#307)", async () => {
    const DELAY_MS = 40;
    let activeQueries = 0;
    let maxActiveQueries = 0;

    function delayedResolve<T>(data: T) {
      activeQueries += 1;
      maxActiveQueries = Math.max(maxActiveQueries, activeQueries);

      return new Promise<{ data: T; error: null }>((resolve) => {
        setTimeout(() => {
          activeQueries -= 1;
          resolve({ data, error: null });
        }, DELAY_MS);
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockImplementation((table: string): any => {
      if (table === "github_traffic_daily") {
        return {
          select: (cols: string) => {
            if (cols === "fetched_at") {
              return {
                order: () => ({
                  limit: () => delayedResolve(mockLastSync),
                }),
              };
            }
            return {
              gte: () => ({
                lte: () => ({
                  order: () => delayedResolve(mockDailyData),
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
                limit: () => delayedResolve(mockReferrerData),
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
                limit: () => delayedResolve(mockPathData),
              }),
            }),
          }),
        };
      }
      return buildChain([]);
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;

    expect(response.status).toBe(200);
    expect(maxActiveQueries).toBe(4);
    expect(response.body.data.summary.totalViews).toBe(110);
  });

  // -----------------------------------------------------------------------
  // SE-M3 / DO-H3: logger migration — uses structured logger, not console
  // -----------------------------------------------------------------------

  it("should use logger.error (not console.error) when supabase query fails", async () => {
    // beforeEach sets mockWithAdminRead to authorized by default

    // Make mockFrom throw to trigger catch block
    const originalImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation(() => {
      throw new Error("DB connection lost");
    });

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/admin/github-analytics?from=2026-02-01&to=2026-02-07"
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as never) as any;
    consoleSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("GitHub analytics API error:", expect.anything());

    if (originalImpl) mockFrom.mockImplementation(originalImpl);
  });
});
