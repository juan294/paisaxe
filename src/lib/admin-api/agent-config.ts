import type { AdminApiResponse } from "@/types/admin";
import type { AgentConfigFile } from "@/types/agent-config";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";

const API_URL = "/api/admin/agent-config";

/**
 * Fetch the local agent configuration.
 */
export async function fetchAgentConfig(): Promise<
  AdminApiResponse<AgentConfigFile>
> {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch agent config" };
    }
    return await response.json();
  } catch (error) {
    clientLogger.error("Error fetching agent config", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Toggle master enabled state.
 */
export async function updateAgentMaster(
  enabled: boolean,
): Promise<AdminApiResponse<AgentConfigFile>> {
  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ master_enabled: enabled }),
    });
    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update master toggle" };
    }
    return await response.json();
  } catch (error) {
    clientLogger.error("Error updating agent master", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Toggle an individual agent enabled state.
 */
export async function updateAgentEnabled(
  key: string,
  enabled: boolean,
): Promise<AdminApiResponse<AgentConfigFile>> {
  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ key, enabled }),
    });
    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update agent" };
    }
    return await response.json();
  } catch (error) {
    clientLogger.error("Error updating agent enabled", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}

/**
 * Update a specific config value for an agent.
 */
export async function updateAgentConfigValue(
  key: string,
  configKey: string,
  value: unknown,
): Promise<AdminApiResponse<AgentConfigFile>> {
  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ key, config_key: configKey, value }),
    });
    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update agent config" };
    }
    return await response.json();
  } catch (error) {
    clientLogger.error("Error updating agent config value", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Network error" };
  }
}
