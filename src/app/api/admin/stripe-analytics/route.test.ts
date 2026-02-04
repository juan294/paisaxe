import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock Stripe library
const mockPaymentIntentsList = vi.fn();
const mockBalanceTransactionsList = vi.fn();

vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: vi.fn(() => true),
  getStripeClient: vi.fn(() => ({
    paymentIntents: {
      list: mockPaymentIntentsList,
    },
    balanceTransactions: {
      list: mockBalanceTransactionsList,
    },
  })),
}));

import { isStripeConfigured } from "@/lib/stripe";

describe("Stripe Analytics API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  });

  it("returns warning when Stripe is not configured", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.warning).toBe("Stripe API key not configured");
    expect(data.data.summary.totalOrders).toBe(0);
  });

  it("returns empty data structure on API error", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);
    mockPaymentIntentsList.mockRejectedValue(new Error("Stripe API error"));

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe("Failed to fetch Stripe data");
    expect(data.data.summary.totalOrders).toBe(0);
    expect(data.data.recentOrders).toEqual([]);
  });

  it("calculates summary statistics correctly", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_1",
          amount: 199,
          currency: "eur",
          status: "succeeded",
          created: now - 86400, // 1 day ago
          receipt_email: "user1@example.com",
          metadata: {},
        },
        {
          id: "pi_2",
          amount: 199,
          currency: "eur",
          status: "succeeded",
          created: now - 172800, // 2 days ago
          receipt_email: "user2@example.com",
          metadata: {},
        },
      ],
    });

    mockBalanceTransactionsList.mockResolvedValue({
      data: [
        {
          id: "txn_1",
          amount: 199,
          status: "available",
          created: now - 86400,
        },
        {
          id: "txn_2",
          amount: 199,
          status: "available",
          created: now - 172800,
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.thirtyDayOrders).toBe(2);
    expect(data.data.recentOrders).toHaveLength(2);
    expect(data.data.productBreakdown).toHaveLength(1);
    expect(data.data.productBreakdown[0].orderCount).toBe(2);
  });

  it("filters by date range from query params", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    mockPaymentIntentsList.mockResolvedValue({ data: [] });
    mockBalanceTransactionsList.mockResolvedValue({ data: [] });

    const from = "2024-01-01T00:00:00.000Z";
    const to = "2024-01-31T23:59:59.000Z";
    const request = new NextRequest(
      `http://localhost/api/admin/stripe-analytics?from=${from}&to=${to}`
    );
    await GET(request);

    expect(mockPaymentIntentsList).toHaveBeenCalledWith(
      expect.objectContaining({
        created: {
          gte: Math.floor(new Date(from).getTime() / 1000),
          lte: Math.floor(new Date(to).getTime() / 1000),
        },
      })
    );
  });

  it("excludes failed payments from revenue calculations", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_1",
          amount: 199,
          currency: "eur",
          status: "succeeded",
          created: now,
          receipt_email: "user1@example.com",
          metadata: {},
        },
        {
          id: "pi_2",
          amount: 199,
          currency: "eur",
          status: "canceled",
          created: now,
          receipt_email: "user2@example.com",
          metadata: {},
        },
      ],
    });

    mockBalanceTransactionsList.mockResolvedValue({
      data: [
        {
          id: "txn_1",
          amount: 199,
          status: "available",
          created: now,
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    // Product breakdown should only include succeeded payment
    expect(data.data.productBreakdown[0].orderCount).toBe(1);
    expect(data.data.productBreakdown[0].revenue).toBe(1.99);
  });

  it("maps payment status correctly", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_succeeded",
          amount: 199,
          currency: "eur",
          status: "succeeded",
          created: now,
          receipt_email: "user@example.com",
          metadata: {},
        },
        {
          id: "pi_pending",
          amount: 199,
          currency: "eur",
          status: "processing",
          created: now,
          receipt_email: "user@example.com",
          metadata: {},
        },
        {
          id: "pi_failed",
          amount: 199,
          currency: "eur",
          status: "canceled",
          created: now,
          receipt_email: "user@example.com",
          metadata: {},
        },
      ],
    });

    mockBalanceTransactionsList.mockResolvedValue({ data: [] });

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    const orders = data.data.recentOrders;
    expect(orders.find((o: { id: string }) => o.id === "pi_succeeded").status).toBe("succeeded");
    expect(orders.find((o: { id: string }) => o.id === "pi_pending").status).toBe("pending");
    expect(orders.find((o: { id: string }) => o.id === "pi_failed").status).toBe("failed");
  });
});
