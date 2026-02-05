import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  fetchAnthropicCosts,
  fetchAnthropicCostsByDay,
  fetchTwilioCosts,
  fetchElevenLabsCosts,
  fetchManualCosts,
  createManualCost,
} from "@/lib/costs";
import type {
  CostsAnalyticsDashboardData,
  CostsAnalyticsSummary,
  ServiceCost,
  CostsByDay,
  CreateManualCostRequest,
} from "@/types/costs-analytics";

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * GET /api/admin/costs-analytics
 * Aggregates costs from all platform services.
 */
export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const url = new URL(request.url);

    // Default to current month
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultTo = now.toISOString().split("T")[0];

    const fromParam = url.searchParams.get("from") || defaultFrom;
    const toParam = url.searchParams.get("to") || defaultTo;

    // Fetch costs from all sources in parallel
    const [anthropicCost, twilioCost, elevenLabsCost, manualCosts] =
      await Promise.all([
        fetchAnthropicCosts(fromParam, toParam),
        fetchTwilioCosts(fromParam, toParam),
        fetchElevenLabsCosts(fromParam, toParam),
        fetchManualCosts(fromParam, toParam),
      ]);

    // Collect all service costs
    const services: ServiceCost[] = [];

    if (anthropicCost) {
      services.push(anthropicCost);
    }

    if (twilioCost) {
      services.push(twilioCost);
    }

    if (elevenLabsCost) {
      services.push(elevenLabsCost);
    }

    // Add manual costs, deduplicating by service ID if API data exists
    const apiServiceIds = new Set(services.map((s) => s.serviceId));
    for (const manualCost of manualCosts) {
      if (!apiServiceIds.has(manualCost.serviceId)) {
        services.push(manualCost);
      }
    }

    // Sort by cost descending
    services.sort((a, b) => b.costUsd - a.costUsd);

    // Calculate totals
    const totalMonthlyUsd = services.reduce((sum, s) => sum + s.costUsd, 0);
    const automatedServices = services.filter((s) => s.source === "api").length;

    // Fetch daily costs from services that support it
    const dailyCosts = await fetchAnthropicCostsByDay(fromParam, toParam);

    // Build costs by day map
    const costsByDayMap = new Map<string, number>();

    // Initialize all days in range
    const startDate = new Date(fromParam);
    const endDate = new Date(toParam);
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateKey = d.toISOString().split("T")[0];
      costsByDayMap.set(dateKey, 0);
    }

    // Add Anthropic daily costs (primary source of daily data)
    for (const day of dailyCosts) {
      const existing = costsByDayMap.get(day.date) || 0;
      costsByDayMap.set(day.date, existing + day.costUsd);
    }

    const costsByDay: CostsByDay[] = Array.from(costsByDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, costUsd]) => ({
        date,
        costUsd,
      }));

    // Calculate 30-day costs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDayUsd = costsByDay
      .filter((d) => new Date(d.date) >= thirtyDaysAgo)
      .reduce((sum, d) => sum + d.costUsd, 0);

    const summary: CostsAnalyticsSummary = {
      totalMonthlyUsd,
      totalMonthlyFormatted: formatUsd(totalMonthlyUsd),
      thirtyDayUsd,
      thirtyDayFormatted: formatUsd(thirtyDayUsd),
      servicesTracked: services.length,
      automatedServices,
    };

    const data: CostsAnalyticsDashboardData = {
      summary,
      services,
      costsByDay,
      dateRange: {
        from: fromParam,
        to: toParam,
      },
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Costs analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch costs data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/costs-analytics
 * Creates a new manual cost entry.
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body: CreateManualCostRequest = await request.json();

    // Validate required fields
    if (
      !body.serviceId ||
      !body.serviceName ||
      !body.category ||
      body.costUsd === undefined ||
      !body.billingPeriodStart ||
      !body.billingPeriodEnd
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const entry = await createManualCost(body, auth.userId);

    if (!entry) {
      return NextResponse.json(
        { error: "Failed to create cost entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    console.error("Create manual cost error:", error);
    return NextResponse.json(
      { error: "Failed to create cost entry" },
      { status: 500 }
    );
  }
}
