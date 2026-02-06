/**
 * Types for the Agents admin dashboard tab (#06).
 * Displays agent status, cross-agent insights, and activity timeline.
 */

export type AgentHealthStatus = "green" | "yellow" | "red" | "unknown";

export interface AgentStatus {
  /** Feature flag key (e.g., "coverage_agent_enabled") */
  flagKey: string;
  /** Display name (e.g., "Coverage Agent") */
  name: string;
  /** Schedule description (e.g., "Daily at 2:00 AM") */
  schedule: string;
  /** Path to the agent's report file */
  reportFile: string;
  /** ISO timestamp of the report's last modification */
  lastRun: string | null;
  /** Health status parsed from the report */
  health: AgentHealthStatus;
  /** One-line health summary from the report */
  healthSummary: string;
}

export interface SharedContextEntry {
  /** Feature flag key of the agent that wrote this entry */
  agentFlag: string;
  /** Display name of the agent */
  agentName: string;
  /** ISO timestamp */
  timestamp: string;
  /** The markdown content of the entry */
  content: string;
}

export interface AgentActivityItem {
  /** Agent display name */
  agentName: string;
  /** ISO timestamp of the activity */
  timestamp: string;
  /** Short description of key finding */
  summary: string;
  /** Health status at time of report */
  health: AgentHealthStatus;
}

export interface AgentsDashboardData {
  /** Overall platform health based on all agents */
  overallHealth: AgentHealthStatus;
  /** Status of each agent */
  agents: AgentStatus[];
  /** Parsed shared context entries */
  sharedContext: SharedContextEntry[];
  /** Recent activity timeline */
  recentActivity: AgentActivityItem[];
}

export interface AgentRunStatus {
  running: Record<string, { startedAt: string }>;
}
