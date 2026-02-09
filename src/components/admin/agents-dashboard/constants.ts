import type { AgentHealthStatus } from "@/types/agents-dashboard";

export const AGENT_FLAG_KEYS = [
  "automated_agents",
  "coverage_agent_enabled",
  "security_agent_enabled",
  "documentation_agent_enabled",
  "performance_agent_enabled",
  "qa_agent_enabled",
  "localization_agent_enabled",
  "cost_analyst_agent_enabled",
] as const;

/** Map flag keys to display names for the terminal header. */
export const AGENT_NAMES: Record<string, string> = {
  coverage_agent_enabled: "Coverage Agent",
  security_agent_enabled: "Security Agent",
  documentation_agent_enabled: "Documentation Agent",
  performance_agent_enabled: "Performance Agent",
  qa_agent_enabled: "QA Agent",
  localization_agent_enabled: "Localization Agent",
  cost_analyst_agent_enabled: "Cost Analyst Agent",
};

export function relativeTime(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatElapsed(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(diff / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const HEALTH_COLORS: Record<AgentHealthStatus, string> = {
  green: "bg-[#7a9e7a]",
  yellow: "bg-[#c9a55c]",
  red: "bg-[#c97a7a]",
  unknown: "bg-[#a39e98]",
};

export const HEALTH_TEXT_COLORS: Record<AgentHealthStatus, string> = {
  green: "text-[#7a9e7a]",
  yellow: "text-[#c9a55c]",
  red: "text-[#c97a7a]",
  unknown: "text-[#a39e98]",
};

export const HEALTH_BG: Record<AgentHealthStatus, string> = {
  green: "bg-[#7a9e7a]/10 border-[#7a9e7a]/20",
  yellow: "bg-[#c9a55c]/10 border-[#c9a55c]/20",
  red: "bg-[#c97a7a]/10 border-[#c97a7a]/20",
  unknown: "bg-[#a39e98]/10 border-[#a39e98]/20",
};

export const HEALTH_LABELS: Record<AgentHealthStatus, string> = {
  green: "All Systems Healthy",
  yellow: "Some Warnings Detected",
  red: "Critical Issues Found",
  unknown: "Status Unknown",
};
