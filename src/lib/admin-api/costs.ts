import type { AdminApiResponse } from "@/types/admin";
import type {
  CostsAnalyticsDashboardData,
  CreateManualCostRequest,
  ManualCostEntry,
  UpdateManualCostRequest,
} from "@/types/costs-analytics";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";

const API_BASE = "/api/admin";

/**
 * Fetch platform costs analytics
 */
export async function fetchCostsAnalytics(
  from?: string,
  to?: string,
  options?: { includeUsage?: boolean }
): Promise<AdminApiResponse<CostsAnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/costs-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);
    if (options?.includeUsage) url.searchParams.set("includeUsage", "true");

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch costs analytics" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error fetching costs analytics", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Create a manual cost entry
 */
export async function createManualCostEntry(
  data: CreateManualCostRequest
): Promise<AdminApiResponse<ManualCostEntry>> {
  try {
    const response = await fetch(`${API_BASE}/costs-analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to create cost entry" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error creating cost entry", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Update a manual cost entry
 */
export async function updateManualCostEntry(
  id: string,
  data: UpdateManualCostRequest
): Promise<AdminApiResponse<ManualCostEntry>> {
  try {
    const response = await fetch(`${API_BASE}/costs-analytics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update cost entry" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error updating cost entry", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Delete a manual cost entry
 */
export async function deleteManualCostEntry(
  id: string
): Promise<AdminApiResponse<{ id: string; deleted: boolean }>> {
  try {
    const response = await fetch(`${API_BASE}/costs-analytics/${id}`, {
      method: "DELETE",
      headers: csrfHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to delete cost entry" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error deleting cost entry", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}
