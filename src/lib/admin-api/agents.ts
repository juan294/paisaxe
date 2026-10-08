import type { AdminApiResponse } from "@/types/admin";
import type { AgentsDashboardData, AgentRunStatus, AgentLogsResponse } from "@/types/agents-dashboard";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";

type LocalApiResponse<T> = AdminApiResponse<T> & { unavailable?: boolean };

async function localError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return { error: body.error || fallback, ...(response.status === 403 || response.status === 404 || body.localOnly === true ? { unavailable: true } : {}) };
}

const API_BASE = "/api/admin";

/**
 * Fetch agents dashboard summary
 */
export async function fetchAgentsSummary(): Promise<LocalApiResponse<AgentsDashboardData>> {
  try {
    const response = await fetch(`${API_BASE}/agents-summary`);

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch agents summary" };
    }

    return await response.json();
  } catch (error) {
    clientLogger.error("Error fetching agents summary", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Trigger an on-demand agent run
 */
export async function triggerAgentRun(
  agentKey: string,
): Promise<LocalApiResponse<{ started: boolean; agentKey: string; startedAt: string }>> {
  try {
    const response = await fetch(`${API_BASE}/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ agentKey }),
    });

    if (!response.ok) {
      return localError(response, "Failed to start agent");
    }

    return { data: await response.json() };
  } catch (error) {
    clientLogger.error("Error triggering agent run", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Check which agents are currently running
 */
export async function fetchRunningAgents(): Promise<LocalApiResponse<AgentRunStatus>> {
  try {
    const response = await fetch(`${API_BASE}/agents/run`);

    if (!response.ok) {
      return localError(response, "Failed to fetch running agents");
    }

    return { data: await response.json() };
  } catch (error) {
    clientLogger.error("Error fetching running agents", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Stop a running agent
 */
export async function stopAgent(agentKey: string): Promise<LocalApiResponse<{ stopped: boolean; agentKey: string }>> {
  try {
    const response = await fetch(`${API_BASE}/agents/run`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ agentKey }),
    });

    if (!response.ok) {
      return localError(response, "Failed to stop agent");
    }

    return { data: await response.json() };
  } catch (error) {
    clientLogger.error("Error stopping agent", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Fetch logs for a running (or recently finished) agent
 */
export async function fetchAgentLogs(
  agentKey: string,
  since?: number,
): Promise<LocalApiResponse<AgentLogsResponse>> {
  try {
    const url = new URL(`${API_BASE}/agents/run`, window.location.origin);
    url.searchParams.set("agentKey", agentKey);
    if (since !== undefined) url.searchParams.set("since", String(since));

    const response = await fetch(url.toString());

    if (!response.ok) {
      return localError(response, "Failed to fetch agent logs");
    }

    return { data: await response.json() };
  } catch (error) {
    clientLogger.error("Error fetching agent logs", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}
