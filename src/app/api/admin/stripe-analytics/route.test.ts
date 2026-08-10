import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest, NextResponse } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

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
import { validateAdminAuth } from "@/lib/admin-auth";

describe("Stripe Analytics API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-1" });
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  });

  it("returns auth error when admin auth fails", async () => {
    const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: false, error: errorResponse });

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
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

  it("falls back to EUR when payment intent has empty currency (line 15 fallback)", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_no_currency",
          amount: 199,
          currency: "", // empty currency triggers the || "EUR" fallback
          status: "succeeded",
          created: now - 86400,
          receipt_email: "user@example.com",
          metadata: {},
          latest_charge: null,
        },
      ],
    });

    mockBalanceTransactionsList
      .mockResolvedValueOnce({
        data: [{ id: "txn_1", amount: 199, status: "available", created: now - 86400 }],
      })
      .mockResolvedValueOnce({ data: [] });

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // The formatted amount should use EUR as fallback
    const order = data.data.recentOrders[0];
    expect(order.totalFormatted).toContain("€");
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

  it("should use logger.error (not console.error) on API error", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);
    mockPaymentIntentsList.mockRejectedValue(new Error("Stripe API error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    await GET(request);
    consoleSpy.mockRestore();

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("stringifies a non-Error thrown value in the catch block", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);
    // Reject with a non-Error value to exercise the String(error) fallback branch
    mockPaymentIntentsList.mockRejectedValue("rate limited");

    const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe("Failed to fetch Stripe data");
    expect(logger.error).toHaveBeenCalledWith(
      "Stripe analytics API error:",
      { error: "rate limited" },
    );
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

  it("maps requires_payment_method status to pending", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_requires_pm",
          amount: 199,
          currency: "eur",
          status: "requires_payment_method",
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

    expect(data.data.recentOrders[0].status).toBe("pending");
  });

  it("maps requires_confirmation status to pending", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_requires_confirm",
          amount: 199,
          currency: "eur",
          status: "requires_confirmation",
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

    expect(data.data.recentOrders[0].status).toBe("pending");
  });

  it("maps unknown payment status to pending as fallback", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);

    const now = Math.floor(Date.now() / 1000);

    mockPaymentIntentsList.mockResolvedValue({
      data: [
        {
          id: "pi_requires_action",
          amount: 199,
          currency: "eur",
          status: "requires_action",
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

    expect(data.data.recentOrders[0].status).toBe("pending");
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

    it("skips non-available charge transactions (line 216 branch)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const now = Math.floor(Date.now() / 1000);

      mockPaymentIntentsList.mockResolvedValue({ data: [] });

      mockBalanceTransactionsList
        .mockResolvedValueOnce({
          data: [
            { id: "txn_available", amount: 199, status: "available", created: now },
            { id: "txn_pending", amount: 199, status: "pending", created: now }, // should be skipped
          ],
        })
        .mockResolvedValueOnce({ data: [] });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      // Only the available transaction should count
      expect(data.data.summary.totalRevenue).toBe(199);
      expect(data.data.summary.totalOrders).toBe(1);
    });

    it("skips non-available refund transactions (line 227 branch)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const now = Math.floor(Date.now() / 1000);

      mockPaymentIntentsList.mockResolvedValue({ data: [] });

      mockBalanceTransactionsList
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [
            { id: "txn_r1", amount: -100, status: "available", created: now },
            { id: "txn_r2", amount: -50, status: "pending", created: now }, // should be skipped
          ],
        });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      // Only the available refund should count
      expect(data.data.summary.totalRefunds).toBe(100);
    });

    it("handles succeeded payment with date outside initialized range (line 161 || fallback)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const now = Math.floor(Date.now() / 1000);
      // Payment at a date that's far from the query range
      const farFuture = now + 365 * 24 * 60 * 60; // 1 year from now

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_future",
            amount: 199,
            currency: "eur",
            status: "succeeded",
            created: farFuture,
            receipt_email: "user@example.com",
            metadata: {},
            latest_charge: null,
          },
        ],
      });

      mockBalanceTransactionsList.mockResolvedValue({ data: [] });

      const from = "2024-01-01T00:00:00.000Z";
      const to = "2024-01-02T00:00:00.000Z";
      const request = new NextRequest(
        `http://localhost/api/admin/stripe-analytics?from=${from}&to=${to}`
      );
      const response = await GET(request);

      // The payment date falls outside the initialized range, so it hits the || fallback
      expect(response.status).toBe(200);
    });

    it("uses customer metadata when receipt_email is null (line 133 || fallback)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const now = Math.floor(Date.now() / 1000);

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_meta",
            amount: 199,
            currency: "eur",
            status: "succeeded",
            created: now,
            receipt_email: null,
            metadata: { user_email: "meta@example.com", user_name: "Meta User" },
            latest_charge: null,
          },
        ],
      });

      mockBalanceTransactionsList.mockResolvedValue({ data: [] });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.recentOrders[0].customerEmail).toBe("meta@example.com");
      expect(data.data.recentOrders[0].customerName).toBe("Meta User");
    });

    it("uses 'Unknown' when neither receipt_email nor metadata email exists (line 133)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const now = Math.floor(Date.now() / 1000);

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_no_email",
            amount: 199,
            currency: "eur",
            status: "succeeded",
            created: now,
            receipt_email: null,
            metadata: {},
            latest_charge: null,
          },
        ],
      });

      mockBalanceTransactionsList.mockResolvedValue({ data: [] });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.recentOrders[0].customerEmail).toBe("Unknown");
      expect(data.data.recentOrders[0].customerName).toBeNull();
    });

    it("returns empty productBreakdown when no succeeded payments (line 185 ternary)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      const now = Math.floor(Date.now() / 1000);

      mockPaymentIntentsList.mockResolvedValue({
        data: [
          {
            id: "pi_cancelled",
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

      expect(data.data.productBreakdown).toEqual([]);
      expect(data.data.summary.averageOrderValue).toBe(0);
    });

    it("uses fallback date range in error handler when query params are present", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);
      mockPaymentIntentsList.mockRejectedValue(new Error("API error"));

      const from = "2024-06-01T00:00:00.000Z";
      const to = "2024-06-30T00:00:00.000Z";
      const request = new NextRequest(
        `http://localhost/api/admin/stripe-analytics?from=${from}&to=${to}`
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.error).toBe("Failed to fetch Stripe data");
      expect(data.data.dateRange.from).toBe(from);
      expect(data.data.dateRange.to).toBe(to);
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

    /**
     * PE-L1: charge and refund balance transaction queries must be fetched
     * in parallel (Promise.all), not sequentially (#307).
     *
     * Structural verification: we record the call-invocation timestamps and
     * confirm both calls are initiated before either resolves (only possible
     * with Promise.all, not sequential await).
     */
    it("PE-L1: fetches charge and refund balance transactions concurrently (#307)", async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(true);

      mockPaymentIntentsList.mockResolvedValue({ data: [] });

      const callTimes: number[] = [];
      const resolveFns: Array<(v: { data: unknown[] }) => void> = [];

      mockBalanceTransactionsList.mockImplementation(() => {
        callTimes.push(Date.now());
        return new Promise<{ data: unknown[] }>((resolve) => {
          resolveFns.push(resolve);
          // Resolve all pending promises once both have been initiated.
          if (resolveFns.length === 2) {
            for (const fn of resolveFns) fn({ data: [] });
          }
        });
      });

      const request = new NextRequest("http://localhost/api/admin/stripe-analytics");
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Ensure both calls were made (charges + refunds).
      expect(mockBalanceTransactionsList).toHaveBeenCalledTimes(2);
      // Both calls initiated (array has 2 entries means both were started).
      expect(callTimes).toHaveLength(2);
    });
  });
});
