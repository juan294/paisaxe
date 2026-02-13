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
          latest_charge: null,
        },
        {
          id: "pi_2",
          amount: 199,
          currency: "eur",
          status: "succeeded",
          created: now - 172800, // 2 days ago
          receipt_email: "user2@example.com",
          metadata: {},
          latest_charge: null,
        },
      ],
    });

    mockBalanceTransactionsList
      .mockResolvedValueOnce({
        data: [
          { id: "txn_1", amount: 199, status: "available", created: now - 86400 },
          { id: "txn_2", amount: 199, status: "available", created: now - 172800 },
        ],
      })
      .mockResolvedValueOnce({ data: [] }); // no refunds

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
          latest_charge: null,
        },
        {
          id: "pi_2",
          amount: 199,
          currency: "eur",
          status: "canceled",
          created: now,
          receipt_email: "user2@example.com",
          metadata: {},
          latest_charge: null,
        },
      ],
    });

    mockBalanceTransactionsList
      .mockResolvedValueOnce({
        data: [
          { id: "txn_1", amount: 199, status: "available", created: now },
        ],
      })
      .mockResolvedValueOnce({ data: [] }); // no refunds

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
          latest_charge: null,
        },
        {
          id: "pi_pending",
          amount: 199,
          currency: "eur",
          status: "processing",
          created: now,
          receipt_email: "user@example.com",
          metadata: {},
          latest_charge: null,
        },
        {
          id: "pi_failed",
          amount: 199,
          currency: "eur",
          status: "canceled",
          created: now,
          receipt_email: "user@example.com",
          metadata: {},
          latest_charge: null,
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

  describe("Refund detection", () => {
    const now = Math.floor(Date.now() / 1000);

    it("detects full refund from latest_charge", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_refunded",
            amount: 199,
            amount_received: 199,
            currency: "eur",
            status: "succeeded",
            created: now,
            receipt_email: "user@example.com",
            metadata: {},
            latest_charge: {
              id: "ch_1",
              refunded: true,
              amount_refunded: 199,
            },
          },
        ],
      });

      mockBalanceTransactionsList.mockResolvedValue({ data: [] });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      const order = data.data.recentOrders[0];
      expect(order.status).toBe("refunded");
      expect(order.refundedAmount).toBe(199);
      expect(order.refundedAmountFormatted).toContain("1.99");
    });

    it("detects partial refund from latest_charge", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_partial",
            amount: 199,
            amount_received: 199,
            currency: "eur",
            status: "succeeded",
            created: now,
            receipt_email: "user@example.com",
            metadata: {},
            latest_charge: {
              id: "ch_2",
              refunded: false,
              amount_refunded: 100,
            },
          },
        ],
      });

      mockBalanceTransactionsList.mockResolvedValue({ data: [] });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      const order = data.data.recentOrders[0];
      expect(order.status).toBe("partially_refunded");
      expect(order.refundedAmount).toBe(100);
    });

    it("computes refund totals from refund balance transactions", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      mockPaymentIntentsList.mockResolvedValue({ data: [] });

      // mockBalanceTransactionsList is called twice: first for charges, then for refunds
      mockBalanceTransactionsList
        .mockResolvedValueOnce({
          // charge transactions
          data: [
            { id: "txn_charge_1", amount: 199, status: "available", created: now - 86400 },
            { id: "txn_charge_2", amount: 199, status: "available", created: now - 172800 },
          ],
        })
        .mockResolvedValueOnce({
          // refund transactions (negative amounts in Stripe)
          data: [
            { id: "txn_refund_1", amount: -199, status: "available", created: now - 43200 },
          ],
        });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary.totalRevenue).toBe(398); // gross in cents
      expect(data.data.summary.totalRefunds).toBe(199); // refunds in cents (absolute)
      expect(data.data.summary.netRevenue).toBe(199);   // net = gross - refunds
    });

    it("computes 30-day refund totals separately", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const sixtyDaysAgo = now - 60 * 24 * 60 * 60;

      mockPaymentIntentsList.mockResolvedValue({ data: [] });

      mockBalanceTransactionsList
        .mockResolvedValueOnce({
          data: [
            { id: "txn_c1", amount: 500, status: "available", created: now - 86400 },
            { id: "txn_c2", amount: 500, status: "available", created: sixtyDaysAgo },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            { id: "txn_r1", amount: -200, status: "available", created: now - 43200 },       // within 30 days
            { id: "txn_r2", amount: -100, status: "available", created: sixtyDaysAgo + 100 }, // outside 30 days
          ],
        });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary.totalRefunds).toBe(300);        // 200 + 100
      expect(data.data.summary.thirtyDayRefunds).toBe(200);    // only the recent one
      expect(data.data.summary.thirtyDayNetRevenue).toBe(300);  // 500 - 200
    });

    it("sets refundedAmount to 0 for non-refunded orders", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_normal",
            amount: 199,
            amount_received: 199,
            currency: "eur",
            status: "succeeded",
            created: now,
            receipt_email: "user@example.com",
            metadata: {},
            latest_charge: {
              id: "ch_3",
              refunded: false,
              amount_refunded: 0,
            },
          },
        ],
      });

      mockBalanceTransactionsList.mockResolvedValue({ data: [] });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      const order = data.data.recentOrders[0];
      expect(order.status).toBe("succeeded");
      expect(order.refundedAmount).toBe(0);
      expect(order.refundedAmountFormatted).toContain("0.00");
    });

    it("includes net revenue fields in summary", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      mockPaymentIntentsList.mockResolvedValue({ data: [] });

      mockBalanceTransactionsList
        .mockResolvedValueOnce({
          data: [
            { id: "txn_c1", amount: 1000, status: "available", created: now },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            { id: "txn_r1", amount: -300, status: "available", created: now },
          ],
        });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      const summary = data.data.summary;
      expect(summary.netRevenue).toBe(700);
      expect(summary.netRevenueFormatted).toBeDefined();
      expect(summary.totalRefundsFormatted).toBeDefined();
      expect(summary.thirtyDayNetRevenue).toBe(700);
      expect(summary.thirtyDayNetRevenueFormatted).toBeDefined();
    });
  });
});
