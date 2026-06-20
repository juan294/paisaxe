import type { ServiceCost } from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";
import { createAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

/**
 * Anthropic cost reporting (#138).
 *
 * Personal Anthropic accounts have no billing/Admin API, so instead of a static
 * placeholder we record per-request token usage (see lib/costs/anthropic-usage.ts)
 * and aggregate the estimated cost stored in the `anthropic_usage` table here.
 *
 * The reported cost is therefore an estimate derived from token counts and
 * published per-model pricing — surfaced in the admin dashboard with a note.
 * Verify against https://console.anthropic.com/settings/cost when precision matters.
 */

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface UsageCostRow {
  cost_usd: number | string | null;
  created_at: string;
}

/**
 * Total estimated Anthropic spend over a date range, aggregated from
 * recorded per-request token usage.
 */
export async function fetchAnthropicCosts(
  startDate: string,
  endDate: string
): Promise<ServiceCost | null> {
  const rows = await queryUsageRows(startDate, endDate);
  if (rows === null) {
    return null;
  }

  const totalCostUsd = rows.reduce(
    (sum, row) => sum + (Number(row.cost_usd) || 0),
    0
  );

  // No recorded usage yet — return null so the dashboard falls back to the
  // recurring/manual estimate rather than showing $0.
  if (rows.length === 0) {
    return null;
  }

  return {
    serviceId: PLATFORM_SERVICES.anthropic.id,
    serviceName: PLATFORM_SERVICES.anthropic.name,
    category: PLATFORM_SERVICES.anthropic.category,
    costUsd: totalCostUsd,
    costFormatted: formatUsd(totalCostUsd),
    source: "api",
    billingPeriodStart: startDate,
    billingPeriodEnd: endDate,
    dashboardUrl: PLATFORM_SERVICES.anthropic.dashboardUrl,
    notes:
      "Estimated from recorded token usage and published per-model pricing. " +
      "Verify exact spend in the Anthropic console.",
  };
}

/**
 * Daily estimated Anthropic spend, aggregated from recorded token usage.
 */
export async function fetchAnthropicCostsByDay(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; costUsd: number }>> {
  const rows = await queryUsageRows(startDate, endDate);
  if (!rows || rows.length === 0) {
    return [];
  }

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const date = (row.created_at || "").split("T")[0];
    if (!date) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + (Number(row.cost_usd) || 0));
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, costUsd]) => ({ date, costUsd }));
}

/**
 * Read recorded usage rows for a date range. Returns null on error (so callers
 * can fall back gracefully) and an empty array when there is simply no data.
 * `endDate` is treated as inclusive of the whole day.
 */
async function queryUsageRows(
  startDate: string,
  endDate: string
): Promise<UsageCostRow[] | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("anthropic_usage")
      .select("cost_usd, created_at")
      .gte("created_at", `${startDate}T00:00:00Z`)
      .lte("created_at", `${endDate}T23:59:59.999Z`);

    if (error) {
      logger.warn("[ANTHROPIC_USAGE_QUERY_FAILED]", { error: error.message });
      return null;
    }

    return (data as UsageCostRow[]) ?? [];
  } catch (err) {
    logger.warn("[ANTHROPIC_USAGE_QUERY_ERROR]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
