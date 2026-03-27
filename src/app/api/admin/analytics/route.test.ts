import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { validateAdminAuth } from "@/lib/admin-auth";

describe("GET /api/admin/analytics (PostHog)", () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    process.env = {
      ...originalEnv,
      POSTHOG_PROJECT_ID: "12345",
      POSTHOG_PERSONAL_API_KEY: "phx_test_key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return 500 when PostHog env vars are missing", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    delete process.env.POSTHOG_PROJECT_ID;

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Analytics configuration missing");
  });

  it("should return comprehensive analytics data from PostHog", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    // Track call order to return different responses for all 17 queries
    let callIndex = 0;
    const responses = [
      // 1. Total pageviews
      { results: [[1234]] },
      // 2. Unique visitors
      { results: [[567]] },
      // 3. Total sessions
      { results: [[89]] },
      // 4. Avg pages per session (pageviews / sessions)
      { results: [[1234, 89]] },
      // 5. Bounce rate (single-page sessions)
      { results: [[40, 89]] },
      // 6. Time series
      { results: [["2025-01-28", 400, 150], ["2025-01-29", 450, 180], ["2025-01-30", 384, 237]] },
      // 7. Top pages
      { results: [["https://paisaxe.es/", 500], ["https://paisaxe.es/immersive", 300]] },
      // 8. Top referrers
      { results: [["https://google.com", 200], ["https://twitter.com", 50]] },
      // 9. Countries
      { results: [["Spain", 400], ["United States", 100]] },
      // 10. Cities
      { results: [["Madrid", "Spain", 150], ["Barcelona", "Spain", 80]] },
      // 11. Devices
      { results: [["Desktop", 600], ["Mobile", 400]] },
      // 12. Browsers
      { results: [["Chrome", 450], ["Safari", 300], ["Firefox", 100]] },
      // 13. Operating systems
      { results: [["Windows", 300], ["macOS", 250], ["iOS", 200]] },
      // 14. Screen sizes
      { results: [[1920, 1080, 200], [1440, 900, 150], [375, 667, 100]] },
      // 15. Entry pages
      { results: [["/immersive", 400], ["/", 200]] },
      // 16. Exit pages
      { results: [["/immersive", 350], ["/", 150]] },
      // 17. UTM campaigns
      { results: [["google", "cpc", "spring2025", 150], ["twitter", "social", "launch", 50]] },
      // 18. New vs returning
      { results: [[400, 167]] },
    ];

    mockFetch.mockImplementation(() => {
      const response = responses[callIndex] || { results: [] };
      callIndex++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    // Summary stats
    expect(data.data.summary.totalPageviews).toBe(1234);
    expect(data.data.summary.uniqueVisitors).toBe(567);
    expect(data.data.summary.totalSessions).toBe(89);
    expect(data.data.summary.avgPagesPerSession).toBeCloseTo(13.87, 1);
    expect(data.data.summary.bounceRate).toBeCloseTo(44.94, 1);

    // Time series
    expect(data.data.timeSeries).toHaveLength(3);
    expect(data.data.timeSeries[0]).toEqual({ date: "2025-01-28", pageviews: 400, visitors: 150 });

    // Existing breakdowns
    expect(data.data.topPages).toHaveLength(2);
    expect(data.data.topPages[0].url).toBe("https://paisaxe.es/");
    expect(data.data.topReferrers).toHaveLength(2);
    expect(data.data.countries).toHaveLength(2);
    expect(data.data.devices).toHaveLength(2);

    // New breakdowns: cities
    expect(data.data.cities).toHaveLength(2);
    expect(data.data.cities[0]).toEqual({ city: "Madrid", country: "Spain", count: 150 });

    // Browsers
    expect(data.data.browsers).toHaveLength(3);
    expect(data.data.browsers[0]).toEqual({ browser: "Chrome", count: 450 });

    // Operating systems
    expect(data.data.operatingSystems).toHaveLength(3);
    expect(data.data.operatingSystems[0]).toEqual({ os: "Windows", count: 300 });

    // Screen sizes
    expect(data.data.screenSizes).toHaveLength(3);
    expect(data.data.screenSizes[0]).toEqual({ width: 1920, height: 1080, count: 200 });

    // Entry pages
    expect(data.data.entryPages).toHaveLength(2);
    expect(data.data.entryPages[0]).toEqual({ page: "/immersive", count: 400 });

    // Exit pages
    expect(data.data.exitPages).toHaveLength(2);
    expect(data.data.exitPages[0]).toEqual({ page: "/immersive", count: 350 });

    // UTM campaigns
    expect(data.data.utmCampaigns).toHaveLength(2);
    expect(data.data.utmCampaigns[0]).toEqual({
      source: "google",
      medium: "cpc",
      campaign: "spring2025",
      count: 150,
    });

    // New vs returning
    expect(data.data.newVsReturning).toEqual({ newVisitors: 400, returningVisitors: 167 });

    expect(data.data.dateRange).toBeDefined();
  });

  it("should accept from/to query params", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const fromDate = "2025-01-01T00:00:00Z";
    const toDate = "2025-01-31T23:59:59Z";
    // HogQL queries use formatted dates: 'YYYY-MM-DD HH:MM:SS' (no T, no Z)
    const formattedFrom = "2025-01-01 00:00:00";
    const formattedTo = "2025-01-31 23:59:59";

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [[0]] }),
    });

    const request = new NextRequest(
      `http://localhost:3000/api/admin/analytics?from=${fromDate}&to=${toDate}`
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.dateRange.from).toBe(fromDate);
    expect(data.data.dateRange.to).toBe(toDate);

    // Verify queries were called with correctly formatted date range
    expect(mockFetch).toHaveBeenCalled();
    const calls = mockFetch.mock.calls;
    expect(calls.some((call: unknown[]) => {
      const body = JSON.parse((call[1] as { body: string })?.body || "{}");
      return body.query?.query?.includes(formattedFrom) && body.query?.query?.includes(formattedTo);
    })).toBe(true);
  });

  it("should return empty data when PostHog API fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Summary with new fields
    expect(data.data.summary.totalPageviews).toBe(0);
    expect(data.data.summary.uniqueVisitors).toBe(0);
    expect(data.data.summary.totalSessions).toBe(0);
    expect(data.data.summary.avgPagesPerSession).toBe(0);
    expect(data.data.summary.bounceRate).toBe(0);

    // Existing arrays
    expect(data.data.topPages).toEqual([]);
    expect(data.data.topReferrers).toEqual([]);
    expect(data.data.countries).toEqual([]);
    expect(data.data.devices).toEqual([]);

    // New arrays
    expect(data.data.timeSeries).toEqual([]);
    expect(data.data.cities).toEqual([]);
    expect(data.data.browsers).toEqual([]);
    expect(data.data.operatingSystems).toEqual([]);
    expect(data.data.screenSizes).toEqual([]);
    expect(data.data.entryPages).toEqual([]);
    expect(data.data.exitPages).toEqual([]);
    expect(data.data.utmCampaigns).toEqual([]);
    expect(data.data.newVsReturning).toEqual({ newVisitors: 0, returningVisitors: 0 });
  });

  it("should handle empty results gracefully", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Summary with new fields
    expect(data.data.summary.totalPageviews).toBe(0);
    expect(data.data.summary.uniqueVisitors).toBe(0);
    expect(data.data.summary.totalSessions).toBe(0);
    expect(data.data.summary.avgPagesPerSession).toBe(0);
    expect(data.data.summary.bounceRate).toBe(0);

    // Existing arrays
    expect(data.data.topPages).toEqual([]);
    expect(data.data.topReferrers).toEqual([]);
    expect(data.data.countries).toEqual([]);
    expect(data.data.devices).toEqual([]);

    // New arrays
    expect(data.data.timeSeries).toEqual([]);
    expect(data.data.cities).toEqual([]);
    expect(data.data.browsers).toEqual([]);
    expect(data.data.operatingSystems).toEqual([]);
    expect(data.data.screenSizes).toEqual([]);
    expect(data.data.entryPages).toEqual([]);
    expect(data.data.exitPages).toEqual([]);
    expect(data.data.utmCampaigns).toEqual([]);
    expect(data.data.newVsReturning).toEqual({ newVisitors: 0, returningVisitors: 0 });
  });

  it("should handle non-Error thrown values in catch block (line 404 else branch)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    // Throw a non-Error value (string) to trigger the "Unknown error" fallback
    mockFetch.mockImplementation(() => {
      throw "unexpected string error";
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    // Should return 200 with empty data (graceful fallback)
    expect(response.status).toBe(200);
    expect(data.data.summary.totalPageviews).toBe(0);
    expect(data.data.summary.uniqueVisitors).toBe(0);
  });

  it("should handle null UTM values gracefully", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    let callIndex = 0;
    const responses = [
      { results: [[100]] }, // pageviews
      { results: [[50]] }, // visitors
      { results: [[10]] }, // sessions
      { results: [[100, 10]] }, // avg pages
      { results: [[2, 10]] }, // bounce rate
      { results: [] }, // time series
      { results: [] }, // pages
      { results: [] }, // referrers
      { results: [] }, // countries
      { results: [] }, // cities
      { results: [] }, // devices
      { results: [] }, // browsers
      { results: [] }, // os
      { results: [] }, // screens
      { results: [] }, // entry
      { results: [] }, // exit
      // UTM with null values
      { results: [[null, "social", "campaign1", 50], ["google", null, null, 30]] },
      { results: [[30, 20]] }, // new vs returning
    ];

    mockFetch.mockImplementation(() => {
      const response = responses[callIndex] || { results: [] };
      callIndex++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.utmCampaigns).toHaveLength(2);
    expect(data.data.utmCampaigns[0].source).toBe("(direct)");
    expect(data.data.utmCampaigns[0].medium).toBe("social");
    expect(data.data.utmCampaigns[1].medium).toBe("(none)");
    expect(data.data.utmCampaigns[1].campaign).toBe("(none)");
  });
});
