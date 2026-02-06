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

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function getPaymentStatus(
  paymentIntent: Stripe.PaymentIntent
): StripeOrder["status"] {
  if (paymentIntent.status === "succeeded") {
    // Check for refunds
    const refundedAmount = paymentIntent.amount_received - (paymentIntent.amount || 0);
    if (refundedAmount > 0 && refundedAmount < paymentIntent.amount_received) {
      return "partially_refunded";
    }
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
        summary: {
          totalRevenue: 0,
          totalRevenueFormatted: "€0.00",
          thirtyDayRevenue: 0,
          thirtyDayRevenueFormatted: "€0.00",
          totalOrders: 0,
          thirtyDayOrders: 0,
          averageOrderValue: 0,
          averageOrderValueFormatted: "€0.00",
          currency: "EUR",
        },
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

    // Fetch payment intents in date range
    const paymentIntents = await stripe.paymentIntents.list({
      created: {
        gte: fromTimestamp,
        lte: toTimestamp,
      },
      limit: 100,
    });

    const currency = "EUR"; // Default currency for this project

    // Map payment intents to orders
    const recentOrders: StripeOrder[] = paymentIntents.data
      .slice(0, 20)
      .map((pi) => ({
        id: pi.id,
        customerEmail: pi.receipt_email || pi.metadata?.user_email || "Unknown",
        customerName: pi.metadata?.user_name || null,
        total: pi.amount,
        totalFormatted: formatCurrency(pi.amount, pi.currency),
        currency: pi.currency.toUpperCase(),
        status: getPaymentStatus(pi),
        createdAt: new Date(pi.created * 1000).toISOString(),
        productName: "Voice Pass - 24h",
      }));

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

    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );

    // Get balance transactions for totals
    const balanceTransactions = await stripe.balanceTransactions.list({
      type: "charge",
      limit: 100,
    });

    for (const tx of balanceTransactions.data) {
      if (tx.status === "available") {
        allTimeRevenue += tx.amount;
        allTimeOrders++;
        if (tx.created >= thirtyDaysAgo) {
          thirtyDayRevenue += tx.amount;
          thirtyDayOrders++;
        }
      }
    }

    const summary: StripeAnalyticsSummary = {
      totalRevenue: allTimeRevenue,
      totalRevenueFormatted: formatCurrency(allTimeRevenue, currency),
      thirtyDayRevenue,
      thirtyDayRevenueFormatted: formatCurrency(thirtyDayRevenue, currency),
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
    console.error("Stripe analytics API error:", error);

    // Return empty data on error
    const url = new URL(request.url);
    const fromFallback =
      url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toFallback = url.searchParams.get("to") || new Date().toISOString();

    return NextResponse.json({
      data: {
        summary: {
          totalRevenue: 0,
          totalRevenueFormatted: "€0.00",
          thirtyDayRevenue: 0,
          thirtyDayRevenueFormatted: "€0.00",
          totalOrders: 0,
          thirtyDayOrders: 0,
          averageOrderValue: 0,
          averageOrderValueFormatted: "€0.00",
          currency: "EUR",
        },
        recentOrders: [],
        revenueByDay: [],
        productBreakdown: [],
        dateRange: { from: fromFallback, to: toFallback },
      },
      error: "Failed to fetch Stripe data",
    });
  }
}
