import type { ServiceCost } from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";

interface AnthropicCostReportResponse {
  data: Array<{
    date: string;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    model: string;
  }>;
}

/**
 * Fetches cost data from Anthropic API.
 * Uses ANTHROPIC_API_KEY (or ANTHROPIC_ADMIN_API_KEY if set).
 * @see https://docs.anthropic.com/en/api/admin-api/cost-report
 */
export async function fetchAnthropicCosts(
  startDate: string,
  endDate: string
): Promise<ServiceCost | null> {
  // Use admin key if available, otherwise fall back to regular API key
  const apiKey = (process.env.ANTHROPIC_ADMIN_API_KEY || process.env.ANTHROPIC_API_KEY)?.trim();

  if (!apiKey) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      group_by: "none",
    });

    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?${params}`,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    if (!response.ok) {
      console.error(
        "Anthropic cost API error:",
        response.status,
        await response.text()
      );
      return null;
    }

    const data: AnthropicCostReportResponse = await response.json();

    // Sum up costs across all days
    const totalCostUsd = data.data.reduce((sum, day) => sum + day.cost_usd, 0);

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
    };
  } catch (error) {
    console.error("Error fetching Anthropic costs:", error);
    return null;
  }
}

/**
 * Fetches daily cost breakdown from Anthropic.
 */
export async function fetchAnthropicCostsByDay(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; costUsd: number }>> {
  const apiKey = (process.env.ANTHROPIC_ADMIN_API_KEY || process.env.ANTHROPIC_API_KEY)?.trim();

  if (!apiKey) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      group_by: "day",
    });

    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?${params}`,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data: AnthropicCostReportResponse = await response.json();

    return data.data.map((day) => ({
      date: day.date,
      costUsd: day.cost_usd,
    }));
  } catch {
    return [];
  }
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
