import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true }),
}));

describe("Lemon Squeezy Analytics API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEMONSQUEEZY_API_KEY", "test-api-key");
    vi.stubEnv("LEMONSQUEEZY_STORE_ID", "12345");
  });

  it("returns warning when API key is missing", async () => {
    vi.stubEnv("LEMONSQUEEZY_API_KEY", "");

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.warning).toBe("Lemon Squeezy API key not configured");
    expect(data.data.summary.totalOrders).toBe(0);
  });

  it("returns empty data structure on API error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe("Failed to fetch Lemon Squeezy data");
    expect(data.data.summary.totalOrders).toBe(0);
    expect(data.data.recentOrders).toEqual([]);
  });

  it("parses date range from query params", async () => {
    const capturedUrls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 10000,
                  thirty_day_revenue: 5000,
                  total_sales: 10,
                  thirty_day_sales: 5,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });

    const from = "2024-01-01T00:00:00.000Z";
    const to = "2024-01-31T23:59:59.000Z";
    const request = new NextRequest(
      `http://localhost/api/admin/lemonsqueezy-analytics?from=${from}&to=${to}`
    );
    await GET(request);

    const ordersUrl = capturedUrls.find((u) => u.includes("/orders"));
    // URL params are encoded, so we decode to check
    const decodedUrl = decodeURIComponent(ordersUrl || "");
    expect(decodedUrl).toContain("filter[created_at_gte]=2024-01-01");
    expect(decodedUrl).toContain("filter[created_at_lte]=2024-01-31");
  });

  it("aggregates orders by product", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 15000,
                  thirty_day_revenue: 15000,
                  total_sales: 3,
                  thirty_day_sales: 3,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "order1",
                attributes: {
                  store_id: 12345,
                  user_email: "user1@example.com",
                  user_name: "User One",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T10:00:00.000Z",
                  first_order_item: {
                    product_name: "Voice Credits",
                    variant_name: null,
                    product_id: 100,
                  },
                },
              },
              {
                id: "order2",
                attributes: {
                  store_id: 12345,
                  user_email: "user2@example.com",
                  user_name: "User Two",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-16T10:00:00.000Z",
                  first_order_item: {
                    product_name: "Voice Credits",
                    variant_name: null,
                    product_id: 100,
                  },
                },
              },
              {
                id: "order3",
                attributes: {
                  store_id: 12345,
                  user_email: "user3@example.com",
                  user_name: "User Three",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-17T10:00:00.000Z",
                  first_order_item: {
                    product_name: "Premium Plan",
                    variant_name: null,
                    product_id: 200,
                  },
                },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.productBreakdown).toHaveLength(2);
    expect(data.data.productBreakdown[0].productName).toBe("Voice Credits");
    expect(data.data.productBreakdown[0].orderCount).toBe(2);
    expect(data.data.productBreakdown[0].revenue).toBe(100); // $100 = 10000 cents / 100
  });

  it("calculates summary statistics from store data", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 50000, // $500 in cents
                  thirty_day_revenue: 20000, // $200 in cents
                  total_sales: 10,
                  thirty_day_sales: 4,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "order1",
                attributes: {
                  store_id: 12345,
                  user_email: "user1@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalRevenue).toBe(50000);
    expect(data.data.summary.thirtyDayRevenue).toBe(20000);
    expect(data.data.summary.totalOrders).toBe(10);
    expect(data.data.summary.thirtyDayOrders).toBe(4);
  });

  it("calculates revenue by day", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 15000,
                  thirty_day_revenue: 15000,
                  total_sales: 3,
                  thirty_day_sales: 3,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "order1",
                attributes: {
                  store_id: 12345,
                  user_email: "user1@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
              {
                id: "order2",
                attributes: {
                  store_id: 12345,
                  user_email: "user2@example.com",
                  total: 10000,
                  total_formatted: "$100.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T14:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
            ],
          }),
      });
    });

    const request = new NextRequest(
      "http://localhost/api/admin/lemonsqueezy-analytics?from=2024-01-15&to=2024-01-15"
    );
    const response = await GET(request);
    const data = await response.json();

    const dayData = data.data.revenueByDay.find(
      (d: { date: string }) => d.date === "2024-01-15"
    );
    expect(dayData).toBeDefined();
    expect(dayData.revenue).toBe(150); // $50 + $100 = $150
    expect(dayData.orders).toBe(2);
  });

  it("returns recent orders sorted by date", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 15000,
                  thirty_day_revenue: 15000,
                  total_sales: 3,
                  thirty_day_sales: 3,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "order3",
                attributes: {
                  store_id: 12345,
                  user_email: "user3@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-17T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
              {
                id: "order1",
                attributes: {
                  store_id: 12345,
                  user_email: "user1@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
              {
                id: "order2",
                attributes: {
                  store_id: 12345,
                  user_email: "user2@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-16T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    // Orders are sorted by the API query (sorted by -created_at)
    // so the first order should be the most recent
    expect(data.data.recentOrders[0].id).toBe("order3");
  });

  it("handles orders without first_order_item gracefully", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 5000,
                  thirty_day_revenue: 5000,
                  total_sales: 1,
                  thirty_day_sales: 1,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "order1",
                attributes: {
                  store_id: 12345,
                  user_email: "user1@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T10:00:00.000Z",
                  first_order_item: null,
                },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.recentOrders[0].productName).toBe("Unknown Product");
  });

  it("excludes refunded orders from revenue calculations", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stores/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "12345",
                attributes: {
                  name: "Test Store",
                  total_revenue: 10000,
                  thirty_day_revenue: 10000,
                  total_sales: 2,
                  thirty_day_sales: 2,
                  currency: "USD",
                  currency_rate: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "order1",
                attributes: {
                  store_id: 12345,
                  user_email: "user1@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "paid",
                  created_at: "2024-01-15T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
              {
                id: "order2",
                attributes: {
                  store_id: 12345,
                  user_email: "user2@example.com",
                  total: 5000,
                  total_formatted: "$50.00",
                  currency: "USD",
                  status: "refunded",
                  created_at: "2024-01-16T10:00:00.000Z",
                  first_order_item: { product_name: "Test", product_id: 1 },
                },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/lemonsqueezy-analytics");
    const response = await GET(request);
    const data = await response.json();

    // Product breakdown should only include paid orders
    expect(data.data.productBreakdown[0].orderCount).toBe(1);
    expect(data.data.productBreakdown[0].revenue).toBe(50); // Only the paid order
  });
});
