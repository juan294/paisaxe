import type { AdminApiResponse } from "@/types/admin";
import type { AgentsDashboardData, AgentRunStatus, AgentLogsResponse } from "@/types/agents-dashboard";
import { csrfHeaders } from "@/lib/csrf-client";

const API_BASE = "/api/admin";

/**
 * Fetch agents dashboard summary
 */
export async function fetchAgentsSummary(): Promise<AdminApiResponse<AgentsDashboardData>> {
  try {
    const response = await fetch(`${API_BASE}/agents-summary`);

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch agents summary" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching agents summary:", error);
    return { error: "Network error" };
  }
}

/**
 * Trigger an on-demand agent run
 */
export async function triggerAgentRun(
  agentKey: string,
): Promise<AdminApiResponse<{ started: boolean; agentKey: string; startedAt: string }>> {
  try {
    const response = await fetch(`${API_BASE}/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ agentKey }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to start agent" };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error("Error triggering agent run:", error);
    return { error: "Network error" };
  }
}

/**
 * Check which agents are currently running
 */
export async function fetchRunningAgents(): Promise<AdminApiResponse<AgentRunStatus>> {
  try {
    const response = await fetch(`${API_BASE}/agents/run`);

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch running agents" };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error("Error fetching running agents:", error);
    return { error: "Network error" };
  }
}

/**
 * Stop a running agent
 */
export async function stopAgent(agentKey: string): Promise<AdminApiResponse<{ stopped: boolean; agentKey: string }>> {
  try {
    const response = await fetch(`${API_BASE}/agents/run`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ agentKey }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to stop agent" };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error("Error stopping agent:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch logs for a running (or recently finished) agent
 */
export async function fetchAgentLogs(
  agentKey: string,
  since?: number,
): Promise<AdminApiResponse<AgentLogsResponse>> {
  try {
    const url = new URL(`${API_BASE}/agents/run`, window.location.origin);
    url.searchParams.set("agentKey", agentKey);
    if (since !== undefined) url.searchParams.set("since", String(since));

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch agent logs" };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error("Error fetching agent logs:", error);
    return { error: "Network error" };
  }
}
