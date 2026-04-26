import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  fetchAnthropicCosts,
  fetchAnthropicCostsByDay,
  fetchTwilioCosts,
  fetchElevenLabsCosts,
  fetchManualCosts,
  createManualCost,
  generateRecurringCosts,
} from "@/lib/costs";
import type {
  CostsAnalyticsDashboardData,
  CostsAnalyticsSummary,
  ServiceCost,
  CostsByDay,
  CreateManualCostRequest,
  UsageMetrics,
} from "@/types/costs-analytics";
import { queryPostHog, formatForHogQL } from "@/lib/posthog-query";
import { ELEVENLABS_API_BASE } from "@/config/elevenlabs-agents";
import { logger } from "@/lib/logger";

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

    // Add recurring costs for services not already covered by API or manual
    const coveredServiceIds = new Set(services.map((s) => s.serviceId));
    const recurringCosts = generateRecurringCosts(fromParam, toParam);
    for (const recurringCost of recurringCosts) {
      if (!coveredServiceIds.has(recurringCost.serviceId)) {
        services.push(recurringCost);
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

    // Optionally fetch usage metrics for forecast
    let usageMetrics: UsageMetrics | undefined;
    if (url.searchParams.get("includeUsage") === "true") {
      usageMetrics = await fetchUsageMetrics(fromParam, toParam);
    }

    const data: CostsAnalyticsDashboardData = {
      summary,
      services,
      costsByDay,
      dateRange: {
        from: fromParam,
        to: toParam,
      },
      usageMetrics,
    };

    return NextResponse.json({ data }, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    logger.error("[COSTS_ANALYTICS_GET_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Failed to fetch costs data" },
      { status: 500 }
    );
  }
}

/**
 * Fetch usage metrics from PostHog and ElevenLabs for forecast computation.
 * Gracefully returns undefined on failure.
 */
async function fetchUsageMetrics(
  from: string,
  to: string
): Promise<UsageMetrics | undefined> {
  try {
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const posthogKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY?.trim();

    const periodDays = Math.max(
      1,
      Math.ceil(
        (new Date(to).getTime() - new Date(from).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    );

    let visitors = 0;
    let chatConversations = 0;
    let voiceConversations = 0;
    let voiceMinutes = 0;
    let posthogEvents = 0;

    // Fetch PostHog metrics (visitors + chat conversations + total events)
    if (projectId && posthogKey) {
      const hogFrom = formatForHogQL(from);
      const hogTo = formatForHogQL(to);

      try {
        const [visitorsResult, chatsResult, eventsResult] = await Promise.all([
          queryPostHog(
            `SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= '${hogFrom}' AND timestamp <= '${hogTo}' AND properties.$current_url NOT LIKE '%localhost%'`,
            projectId,
            posthogKey
          ),
          queryPostHog(
            `SELECT count() FROM events WHERE event = 'chat_conversation_started' AND timestamp >= '${hogFrom}' AND timestamp <= '${hogTo}'`,
            projectId,
            posthogKey
          ),
          queryPostHog(
            `SELECT count() FROM events WHERE timestamp >= '${hogFrom}' AND timestamp <= '${hogTo}'`,
            projectId,
            posthogKey
          ),
        ]);

        visitors = Number(visitorsResult.results[0]?.[0] || 0);
        chatConversations = Number(chatsResult.results[0]?.[0] || 0);
        posthogEvents = Number(eventsResult.results[0]?.[0] || 0);
      } catch (error) {
        logger.warn("[COSTS_ANALYTICS_POSTHOG_USAGE_FETCH_FAILED]", { error });
      }
    }

    // Fetch ElevenLabs voice metrics (filtered to Paisaxe agents only)
    if (elevenLabsKey) {
      try {
        // First fetch agents list to identify Paisaxe agents
        const agentsResponse = await fetch(
          `${ELEVENLABS_API_BASE}/convai/agents`,
          {
            headers: {
              "xi-api-key": elevenLabsKey,
            },
          }
        );

        let paisaxeAgentIds = new Set<string>();
        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          const agents: Array<{ agent_id: string; name?: string }> =
            agentsData.agents || [];
          // Only include agents whose name starts with "Paisaxe"
          paisaxeAgentIds = new Set(
            agents
              .filter((a) => a.name?.startsWith("Paisaxe"))
              .map((a) => a.agent_id)
          );
        }

        // If no Paisaxe agents found via API, fall back to known config IDs
        if (paisaxeAgentIds.size === 0) {
          const { ELEVENLABS_AGENT_IDS } = await import(
            "@/config/elevenlabs-agents"
          );
          for (const id of Object.values(ELEVENLABS_AGENT_IDS)) {
            if (id) paisaxeAgentIds.add(id);
          }
        }

        const response = await fetch(
          `${ELEVENLABS_API_BASE}/convai/conversations?page_size=100`,
          {
            headers: {
              "xi-api-key": elevenLabsKey,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const conversations: Array<{
            agent_id?: string;
            start_time_unix_secs?: number;
            call_duration_secs?: number;
          }> = data.conversations || [];

          const fromTs = new Date(from).getTime() / 1000;
          const toTs = new Date(to).getTime() / 1000;

          // Filter by date range AND Paisaxe agent IDs
          const filtered = conversations.filter((c) => {
            const ts = c.start_time_unix_secs || 0;
            const inDateRange = ts >= fromTs && ts <= toTs;
            const isPaisaxeAgent = paisaxeAgentIds.has(c.agent_id || "");
            return inDateRange && isPaisaxeAgent;
          });

          voiceConversations = filtered.length;
          voiceMinutes = filtered.reduce(
            (sum: number, c: { call_duration_secs?: number }) =>
              sum + (c.call_duration_secs || 0) / 60,
            0
          );
          voiceMinutes = Math.round(voiceMinutes * 10) / 10;
        }
      } catch (error) {
        logger.warn("[COSTS_ANALYTICS_ELEVENLABS_USAGE_FETCH_FAILED]", { error });
      }
    }

    return {
      visitors,
      chatConversations,
      voiceConversations,
      voiceMinutes,
      periodDays,
      posthogEvents,
    };
  } catch (error) {
    logger.warn("[COSTS_ANALYTICS_USAGE_FETCH_FAILED]", { error });
    return undefined;
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
    logger.error("[COSTS_ANALYTICS_CREATE_MANUAL_COST_FAILED]", { error });
    return NextResponse.json(
      { error: "Failed to create cost entry" },
      { status: 500 }
    );
  }
}
