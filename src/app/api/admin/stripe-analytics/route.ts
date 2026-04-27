import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import type {
  StripeAnalyticsSummary,
  StripeOrder,
  StripeRevenueByDay,
  StripeProductBreakdown,
} from "@/types/stripe-analytics";
import type Stripe from "stripe";
import { logger } from "@/lib/logger";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function emptySummary(): StripeAnalyticsSummary {
  return {
    totalRevenue: 0,
    totalRevenueFormatted: "€0.00",
    totalRefunds: 0,
    totalRefundsFormatted: "€0.00",
    netRevenue: 0,
    netRevenueFormatted: "€0.00",
    thirtyDayRevenue: 0,
    thirtyDayRevenueFormatted: "€0.00",
    thirtyDayRefunds: 0,
    thirtyDayRefundsFormatted: "€0.00",
    thirtyDayNetRevenue: 0,
    thirtyDayNetRevenueFormatted: "€0.00",
    totalOrders: 0,
    thirtyDayOrders: 0,
    averageOrderValue: 0,
    averageOrderValueFormatted: "€0.00",
    currency: "EUR",
  };
}

interface ChargeRefundInfo {
  refunded: boolean;
  amount_refunded: number;
}

function getChargeRefundInfo(
  paymentIntent: Stripe.PaymentIntent
): ChargeRefundInfo {
  const charge = paymentIntent.latest_charge;
  if (charge && typeof charge === "object" && "amount_refunded" in charge) {
    return {
      refunded: Boolean(charge.refunded),
      amount_refunded: (charge as { amount_refunded: number }).amount_refunded,
    };
  }
  return { refunded: false, amount_refunded: 0 };
}

function getPaymentStatus(
  paymentIntent: Stripe.PaymentIntent
): StripeOrder["status"] {
  if (paymentIntent.status === "succeeded") {
    const { refunded, amount_refunded } = getChargeRefundInfo(paymentIntent);
    if (refunded) return "refunded";
    if (amount_refunded > 0) return "partially_refunded";
    return "succeeded";
  }
  if (paymentIntent.status === "requires_payment_method" ||
      paymentIntent.status === "requires_confirmation" ||
      paymentIntent.status === "processing") {
    return "pending";
  }
  if (paymentIntent.status === "canceled") {
    return "failed";
  }
  return "pending";
}

export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  if (!isStripeConfigured()) {
    // Return empty data if not configured (graceful degradation)
    return NextResponse.json({
      data: {
        summary: emptySummary(),
        recentOrders: [],
        revenueByDay: [],
        productBreakdown: [],
        dateRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        },
      },
      warning: "Stripe API key not configured",
    });
  }

  try {
    const url = new URL(request.url);
    const fromParam =
      url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toParam = url.searchParams.get("to") || new Date().toISOString();

    const stripe = getStripeClient();
    const fromTimestamp = Math.floor(new Date(fromParam).getTime() / 1000);
    const toTimestamp = Math.floor(new Date(toParam).getTime() / 1000);

    // Fetch payment intents in date range with charge data for refund detection
    const paymentIntents = await stripe.paymentIntents.list({
      created: {
        gte: fromTimestamp,
        lte: toTimestamp,
      },
      expand: ["data.latest_charge"],
      limit: 100,
    });

    const currency = "EUR"; // Default currency for this project

    // Map payment intents to orders
    const recentOrders: StripeOrder[] = paymentIntents.data
      .slice(0, 20)
      .map((pi) => {
        const { amount_refunded } = getChargeRefundInfo(pi);
        return {
          id: pi.id,
          customerEmail: pi.receipt_email || pi.metadata?.user_email || "Unknown",
          customerName: pi.metadata?.user_name || null,
          total: pi.amount,
          totalFormatted: formatCurrency(pi.amount, pi.currency),
          currency: pi.currency.toUpperCase(),
          status: getPaymentStatus(pi),
          createdAt: new Date(pi.created * 1000).toISOString(),
          productName: "Voice Pass - 24h",
          refundedAmount: amount_refunded,
          refundedAmountFormatted: formatCurrency(amount_refunded, pi.currency),
        };
      });

    // Calculate revenue by day
    const revenueByDayMap = new Map<string, { revenue: number; orders: number }>();

    // Initialize all days in range with zero
    const startDate = new Date(fromParam);
    const endDate = new Date(toParam);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      revenueByDayMap.set(dateKey, { revenue: 0, orders: 0 });
    }

    // Sum up payments by day
    for (const pi of paymentIntents.data) {
      if (pi.status === "succeeded") {
        const dateKey = new Date(pi.created * 1000).toISOString().split("T")[0];
        const existing = revenueByDayMap.get(dateKey) || { revenue: 0, orders: 0 };
        revenueByDayMap.set(dateKey, {
          revenue: existing.revenue + pi.amount,
          orders: existing.orders + 1,
        });
      }
    }

    const revenueByDay: StripeRevenueByDay[] = Array.from(revenueByDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: data.revenue / 100, // Convert cents to euros
        orders: data.orders,
      }));

    // Calculate product breakdown (single product for now)
    const succeededPayments = paymentIntents.data.filter(
      (pi) => pi.status === "succeeded"
    );
    const totalRevenue = succeededPayments.reduce((sum, pi) => sum + pi.amount, 0);
    const orderCount = succeededPayments.length;

    const productBreakdown: StripeProductBreakdown[] =
      orderCount > 0
        ? [
            {
              productId: "voice-pass-24h",
              productName: "Voice Pass - 24h",
              orderCount,
              revenue: totalRevenue / 100,
              revenueFormatted: formatCurrency(totalRevenue, currency),
            },
          ]
        : [];

    // Fetch all-time stats using balance transactions
    let allTimeRevenue = 0;
    let allTimeOrders = 0;
    let thirtyDayRevenue = 0;
    let thirtyDayOrders = 0;
    let allTimeRefunds = 0;
    let thirtyDayRefunds = 0;

    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );

    // Get charge and refund balance transactions in parallel
    const [chargeTransactions, refundTransactions] = await Promise.all([
      stripe.balanceTransactions.list({ type: "charge", limit: 100 }),
      stripe.balanceTransactions.list({ type: "refund", limit: 100 }),
    ]);

    for (const tx of chargeTransactions.data) {
      if (tx.status === "available") {
        allTimeRevenue += tx.amount;
        allTimeOrders++;
        if (tx.created >= thirtyDaysAgo) {
          thirtyDayRevenue += tx.amount;
          thirtyDayOrders++;
        }
      }
    }

    for (const tx of refundTransactions.data) {
      if (tx.status === "available") {
        const absAmount = Math.abs(tx.amount);
        allTimeRefunds += absAmount;
        if (tx.created >= thirtyDaysAgo) {
          thirtyDayRefunds += absAmount;
        }
      }
    }

    const netRevenue = allTimeRevenue - allTimeRefunds;
    const thirtyDayNetRevenue = thirtyDayRevenue - thirtyDayRefunds;

    const summary: StripeAnalyticsSummary = {
      totalRevenue: allTimeRevenue,
      totalRevenueFormatted: formatCurrency(allTimeRevenue, currency),
      totalRefunds: allTimeRefunds,
      totalRefundsFormatted: formatCurrency(allTimeRefunds, currency),
      netRevenue,
      netRevenueFormatted: formatCurrency(netRevenue, currency),
      thirtyDayRevenue,
      thirtyDayRevenueFormatted: formatCurrency(thirtyDayRevenue, currency),
      thirtyDayRefunds,
      thirtyDayRefundsFormatted: formatCurrency(thirtyDayRefunds, currency),
      thirtyDayNetRevenue,
      thirtyDayNetRevenueFormatted: formatCurrency(thirtyDayNetRevenue, currency),
      totalOrders: allTimeOrders,
      thirtyDayOrders,
      averageOrderValue:
        orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
      averageOrderValueFormatted: formatCurrency(
        orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
        currency
      ),
      currency,
    };

    return NextResponse.json({
      data: {
        summary,
        recentOrders,
        revenueByDay,
        productBreakdown,
        dateRange: { from: fromParam, to: toParam },
      },
    }, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    logger.error("Stripe analytics API error:", { error: error instanceof Error ? error.message : String(error) });

    // Return empty data on error
    const url = new URL(request.url);
    const fromFallback =
      url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toFallback = url.searchParams.get("to") || new Date().toISOString();

    return NextResponse.json({
      data: {
        summary: emptySummary(),
        recentOrders: [],
        revenueByDay: [],
        productBreakdown: [],
        dateRange: { from: fromFallback, to: toFallback },
      },
      error: "Failed to fetch Stripe data",
    });
  }
}
