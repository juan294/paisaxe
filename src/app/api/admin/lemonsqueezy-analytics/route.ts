import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import type {
  LemonSqueezyAnalyticsSummary,
  LemonSqueezyOrder,
  LemonSqueezyRevenueByDay,
  LemonSqueezyProductBreakdown,
} from "@/types/lemonsqueezy-analytics";

const LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1";

interface LemonSqueezyStoreResponse {
  data: {
    id: string;
    attributes: {
      name: string;
      total_revenue: number;
      thirty_day_revenue: number;
      total_sales: number;
      thirty_day_sales: number;
      currency: string;
      currency_rate: number;
    };
  };
}

interface LemonSqueezyOrdersResponse {
  data: Array<{
    id: string;
    attributes: {
      store_id: number;
      user_email: string;
      user_name: string | null;
      total: number;
      total_formatted: string;
      currency: string;
      status: string;
      created_at: string;
      first_order_item: {
        product_name: string;
        variant_name: string | null;
        product_id: number;
      } | null;
    };
  }>;
  meta?: {
    page: {
      total: number;
    };
  };
}

async function fetchLemonSqueezy<T>(
  endpoint: string,
  apiKey: string
): Promise<T> {
  const response = await fetch(`${LEMONSQUEEZY_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lemon Squeezy API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  if (!apiKey) {
    // Return empty data if not configured (graceful degradation)
    return NextResponse.json({
      data: {
        summary: {
          totalRevenue: 0,
          totalRevenueFormatted: "$0.00",
          thirtyDayRevenue: 0,
          thirtyDayRevenueFormatted: "$0.00",
          totalOrders: 0,
          thirtyDayOrders: 0,
          averageOrderValue: 0,
          averageOrderValueFormatted: "$0.00",
          currency: "USD",
        },
        recentOrders: [],
        revenueByDay: [],
        productBreakdown: [],
        dateRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        },
      },
      warning: "Lemon Squeezy API key not configured",
    });
  }

  try {
    const url = new URL(request.url);
    const fromParam =
      url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toParam = url.searchParams.get("to") || new Date().toISOString();

    // Fetch store data for totals if storeId is configured
    let storeData: LemonSqueezyStoreResponse["data"]["attributes"] | null = null;
    if (storeId) {
      try {
        const storeResponse = await fetchLemonSqueezy<LemonSqueezyStoreResponse>(
          `/stores/${storeId}`,
          apiKey
        );
        storeData = storeResponse.data.attributes;
      } catch (e) {
        console.warn("Failed to fetch store data:", e);
      }
    }

    // Fetch orders - filter by date range
    const fromDate = new Date(fromParam).toISOString();
    const toDate = new Date(toParam).toISOString();

    // Build filter params
    const filterParams = new URLSearchParams();
    if (storeId) {
      filterParams.set("filter[store_id]", storeId);
    }
    filterParams.set("filter[created_at_gte]", fromDate.split("T")[0]);
    filterParams.set("filter[created_at_lte]", toDate.split("T")[0]);
    filterParams.set("page[size]", "100");
    filterParams.set("sort", "-created_at");

    const ordersResponse = await fetchLemonSqueezy<LemonSqueezyOrdersResponse>(
      `/orders?${filterParams.toString()}`,
      apiKey
    );

    const orders = ordersResponse.data || [];
    const currency = storeData?.currency || orders[0]?.attributes?.currency || "USD";

    // Map orders to our format
    const recentOrders: LemonSqueezyOrder[] = orders.slice(0, 20).map((order) => ({
      id: order.id,
      storeId: String(order.attributes.store_id),
      customerEmail: order.attributes.user_email,
      customerName: order.attributes.user_name,
      total: order.attributes.total,
      totalFormatted: order.attributes.total_formatted,
      currency: order.attributes.currency,
      status: order.attributes.status as LemonSqueezyOrder["status"],
      createdAt: order.attributes.created_at,
      productName: order.attributes.first_order_item?.product_name || "Unknown Product",
      variantName: order.attributes.first_order_item?.variant_name || null,
    }));

    // Calculate revenue by day (last 30 days)
    const revenueByDayMap = new Map<string, { revenue: number; orders: number }>();

    // Initialize all days in range with zero
    const startDate = new Date(fromParam);
    const endDate = new Date(toParam);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      revenueByDayMap.set(dateKey, { revenue: 0, orders: 0 });
    }

    // Sum up orders by day
    for (const order of orders) {
      if (order.attributes.status === "paid") {
        const dateKey = order.attributes.created_at.split("T")[0];
        const existing = revenueByDayMap.get(dateKey) || { revenue: 0, orders: 0 };
        revenueByDayMap.set(dateKey, {
          revenue: existing.revenue + order.attributes.total,
          orders: existing.orders + 1,
        });
      }
    }

    const revenueByDay: LemonSqueezyRevenueByDay[] = Array.from(revenueByDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: data.revenue / 100, // Convert cents to dollars
        orders: data.orders,
      }));

    // Calculate product breakdown
    const productMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of orders) {
      if (order.attributes.status === "paid") {
        const productId = String(order.attributes.first_order_item?.product_id || "unknown");
        const productName = order.attributes.first_order_item?.product_name || "Unknown";
        const existing = productMap.get(productId) || { name: productName, count: 0, revenue: 0 };
        productMap.set(productId, {
          name: productName,
          count: existing.count + 1,
          revenue: existing.revenue + order.attributes.total,
        });
      }
    }

    const productBreakdown: LemonSqueezyProductBreakdown[] = Array.from(productMap.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        orderCount: data.count,
        revenue: data.revenue / 100,
        revenueFormatted: formatCurrency(data.revenue, currency),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate summary from orders in date range
    const paidOrders = orders.filter((o) => o.attributes.status === "paid");
    const periodRevenue = paidOrders.reduce((sum, o) => sum + o.attributes.total, 0);
    const periodOrderCount = paidOrders.length;

    // Use store data for totals if available, otherwise use period data
    const summary: LemonSqueezyAnalyticsSummary = {
      totalRevenue: storeData ? storeData.total_revenue : periodRevenue,
      totalRevenueFormatted: formatCurrency(
        storeData ? storeData.total_revenue : periodRevenue,
        currency
      ),
      thirtyDayRevenue: storeData ? storeData.thirty_day_revenue : periodRevenue,
      thirtyDayRevenueFormatted: formatCurrency(
        storeData ? storeData.thirty_day_revenue : periodRevenue,
        currency
      ),
      totalOrders: storeData ? storeData.total_sales : periodOrderCount,
      thirtyDayOrders: storeData ? storeData.thirty_day_sales : periodOrderCount,
      averageOrderValue:
        periodOrderCount > 0 ? Math.round(periodRevenue / periodOrderCount) : 0,
      averageOrderValueFormatted: formatCurrency(
        periodOrderCount > 0 ? Math.round(periodRevenue / periodOrderCount) : 0,
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
    });
  } catch (error) {
    console.error("Lemon Squeezy analytics API error:", error);

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
          totalRevenueFormatted: "$0.00",
          thirtyDayRevenue: 0,
          thirtyDayRevenueFormatted: "$0.00",
          totalOrders: 0,
          thirtyDayOrders: 0,
          averageOrderValue: 0,
          averageOrderValueFormatted: "$0.00",
          currency: "USD",
        },
        recentOrders: [],
        revenueByDay: [],
        productBreakdown: [],
        dateRange: { from: fromFallback, to: toFallback },
      },
      error: "Failed to fetch Lemon Squeezy data",
    });
  }
}
