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

  it("should return analytics data from PostHog", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    // Track call order to return different responses
    let callIndex = 0;
    const responses = [
      // 1. Total pageviews
      { results: [[1234]] },
      // 2. Unique visitors
      { results: [[567]] },
      // 3. Top pages
      { results: [["https://paisaxe.com/", 500], ["https://paisaxe.com/immersive", 300]] },
      // 4. Top referrers
      { results: [["https://google.com", 200], ["https://twitter.com", 50]] },
      // 5. Countries
      { results: [["Spain", 400], ["United States", 100]] },
      // 6. Devices
      { results: [["Desktop", 600], ["Mobile", 400]] },
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
    expect(data.data.summary.totalPageviews).toBe(1234);
    expect(data.data.summary.uniqueVisitors).toBe(567);
    expect(data.data.topPages).toHaveLength(2);
    expect(data.data.topPages[0].url).toBe("https://paisaxe.com/");
    expect(data.data.topReferrers).toHaveLength(2);
    expect(data.data.countries).toHaveLength(2);
    expect(data.data.devices).toHaveLength(2);
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
    expect(data.data.summary.totalPageviews).toBe(0);
    expect(data.data.summary.uniqueVisitors).toBe(0);
    expect(data.data.topPages).toEqual([]);
    expect(data.data.topReferrers).toEqual([]);
    expect(data.data.countries).toEqual([]);
    expect(data.data.devices).toEqual([]);
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
    expect(data.data.summary.totalPageviews).toBe(0);
    expect(data.data.summary.uniqueVisitors).toBe(0);
    expect(data.data.topPages).toEqual([]);
    expect(data.data.topReferrers).toEqual([]);
    expect(data.data.countries).toEqual([]);
    expect(data.data.devices).toEqual([]);
  });
});
