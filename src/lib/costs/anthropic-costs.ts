import type { ServiceCost } from "@/types/costs-analytics";

/**
 * Anthropic cost fetching — NOT AVAILABLE on personal accounts.
 *
 * The Anthropic Admin API (/v1/organizations/cost_report) requires a
 * Teams or Enterprise plan with an Admin API key (sk-ant-admin-...).
 * This project uses a personal Anthropic account, so programmatic cost
 * retrieval is impossible. The only way to check Anthropic spend is the
 * console dashboard: https://console.anthropic.com/settings/billing
 *
 * These functions are kept as stubs (returning null / []) so that callers
 * in the costs-analytics route don't need to be changed. If the project
 * ever migrates to a Teams/Enterprise plan, re-implement the API calls here.
 */

export async function fetchAnthropicCosts(
  _startDate: string,
  _endDate: string
): Promise<ServiceCost | null> {
  // Admin API not available on personal Anthropic accounts.
  return null;
}

export async function fetchAnthropicCostsByDay(
  _startDate: string,
  _endDate: string
): Promise<Array<{ date: string; costUsd: number }>> {
  // Admin API not available on personal Anthropic accounts.
  return [];
}
