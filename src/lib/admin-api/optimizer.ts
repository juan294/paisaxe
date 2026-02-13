import type { AdminApiResponse } from "@/types/admin";
import { csrfHeaders } from "@/lib/csrf-client";

interface OptimizerRunResult {
  success: boolean;
  analyzedAt: string;
  totalMonthlySpend: number;
  servicesAnalyzed: number;
  actionableItems: number;
  recommendations: { service: string; action: string; reason: string }[];
  report: string;
}

/**
 * Trigger the subscription optimizer directly via its cron endpoint.
 * Unlike other agents (which are long-running shell processes), the optimizer
 * is a single API call that returns immediately with a full report.
 */
export async function triggerOptimizerRun(
  usageMetrics?: Record<string, number>,
): Promise<AdminApiResponse<OptimizerRunResult>> {
  try {
    const response = await fetch("/api/cron/subscription-optimizer", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(usageMetrics ? { usageMetrics } : {}),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to run optimizer" };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error("Error triggering optimizer run:", error);
    return { error: "Network error" };
  }
}
