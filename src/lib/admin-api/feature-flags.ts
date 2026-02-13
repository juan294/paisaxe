import type { AdminApiResponse } from "@/types/admin";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
import { csrfHeaders } from "@/lib/csrf-client";

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
    console.error("Error fetching feature flags:", error);
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
    console.error("Error updating feature flag:", error);
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
    console.error("Error updating feature flag config:", error);
    return { error: "Network error" };
  }
}
