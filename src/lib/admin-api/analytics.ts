import type { AdminApiResponse } from "@/types/admin";
import type { AnalyticsDashboardData } from "@/types/analytics";
import type { ElevenLabsAnalyticsDashboardData } from "@/types/elevenlabs-analytics";
import type { StripeAnalyticsDashboardData } from "@/types/stripe-analytics";
import type { GitHubAnalyticsDashboardData } from "@/types/github-analytics";
import { csrfHeaders } from "@/lib/csrf-client";

const API_BASE = "/api/admin";

/**
 * Fetch analytics dashboard data
 */
export async function fetchAnalytics(
  from?: string,
  to?: string,
  includeLocalhost?: boolean
): Promise<AdminApiResponse<AnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);
    if (includeLocalhost) url.searchParams.set("includeLocalhost", "true");

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch analytics" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch ElevenLabs voice agent analytics
 */
export async function fetchElevenLabsAnalytics(
  from?: string,
  to?: string
): Promise<AdminApiResponse<ElevenLabsAnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/elevenlabs-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch ElevenLabs analytics" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching ElevenLabs analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch Stripe revenue analytics
 */
export async function fetchStripeAnalytics(
  from?: string,
  to?: string
): Promise<AdminApiResponse<StripeAnalyticsDashboardData> & { warning?: string }> {
  try {
    const url = new URL(`${API_BASE}/stripe-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch Stripe analytics" };
    }

    const result = await response.json();
    return {
      data: result.data,
      warning: result.warning,
    };
  } catch (error) {
    console.error("Error fetching Stripe analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch GitHub repository traffic analytics
 */
export async function fetchGithubAnalytics(
  from?: string,
  to?: string
): Promise<AdminApiResponse<GitHubAnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/github-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch GitHub analytics" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Trigger a manual GitHub traffic sync
 */
export async function syncGithubTraffic(): Promise<AdminApiResponse<{ synced: boolean; syncedAt: string }>> {
  try {
    const response = await fetch("/api/cron/github-traffic-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to sync GitHub traffic" };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error("Error syncing GitHub traffic:", error);
    return { error: "Network error" };
  }
}
