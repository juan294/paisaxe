import type { AdminApiResponse } from "@/types/admin";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";

const API_BASE = "/api/admin";

/**
 * Fetch all feature flags
 */
export async function fetchFeatureFlags(): Promise<AdminApiResponse<FeatureFlag[]>> {
  try {
    const response = await fetch("/api/feature-flags", {
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch feature flags" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error fetching feature flags", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Toggle a feature flag on or off
 */
export async function updateFeatureFlag(
  flagKey: FeatureFlagKey,
  enabled: boolean
): Promise<AdminApiResponse<FeatureFlag>> {
  try {
    const response = await fetch(`${API_BASE}/feature-flags/${flagKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update feature flag" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error updating feature flag", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Update a feature flag's configuration
 */
export async function updateFeatureFlagConfig(
  flagKey: FeatureFlagKey,
  config: Record<string, unknown>
): Promise<AdminApiResponse<FeatureFlag>> {
  try {
    const response = await fetch(`${API_BASE}/feature-flags/${flagKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ config }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update feature flag config" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error updating feature flag config", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}
