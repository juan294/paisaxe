/**
 * Types for the local agent configuration system.
 * Agent flags are managed locally (scripts/agent-config.json),
 * not in Supabase feature_flags.
 */

export interface AgentEntry {
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AgentConfigFile {
  master_enabled: boolean;
  agents: Record<string, AgentEntry>;
}

/** Keys that identify agent flags in the local config. */
export type AgentFlagKey =
  | "coverage_agent_enabled"
  | "security_agent_enabled"
  | "qa_agent_enabled"
  | "documentation_agent_enabled"
  | "performance_agent_enabled"
  | "localization_agent_enabled"
  | "cost_analyst_agent_enabled"
  | "subscription_optimizer_enabled"
  | "content_discovery_agent_enabled";
