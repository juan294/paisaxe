"use client";

import { useCallback, useState, useEffect } from "react";
import { fetchAgentsSummary, fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import { AgentConfigPanel } from "./agent-config-panel";
import { AlertCircle, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/feature-flags";
import type {
  AgentHealthStatus,
  AgentStatus,
  SharedContextEntry,
  AgentActivityItem,
} from "@/types/agents-dashboard";

const AGENT_FLAG_KEYS = [
  "automated_agents",
  "coverage_agent_enabled",
  "security_agent_enabled",
  "documentation_agent_enabled",
  "performance_agent_enabled",
  "qa_agent_enabled",
  "localization_agent_enabled",
  "cost_analyst_agent_enabled",
] as const;

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const HEALTH_COLORS: Record<AgentHealthStatus, string> = {
  green: "bg-[#7a9e7a]",
  yellow: "bg-[#c9a55c]",
  red: "bg-[#c97a7a]",
  unknown: "bg-[#a39e98]",
};

const HEALTH_TEXT_COLORS: Record<AgentHealthStatus, string> = {
  green: "text-[#7a9e7a]",
  yellow: "text-[#c9a55c]",
  red: "text-[#c97a7a]",
  unknown: "text-[#a39e98]",
};

const HEALTH_BG: Record<AgentHealthStatus, string> = {
  green: "bg-[#7a9e7a]/10 border-[#7a9e7a]/20",
  yellow: "bg-[#c9a55c]/10 border-[#c9a55c]/20",
  red: "bg-[#c97a7a]/10 border-[#c97a7a]/20",
  unknown: "bg-[#a39e98]/10 border-[#a39e98]/20",
};

const HEALTH_LABELS: Record<AgentHealthStatus, string> = {
  green: "All Systems Healthy",
  yellow: "Some Warnings Detected",
  red: "Critical Issues Found",
  unknown: "Status Unknown",
};

function AgentsDashboardInner() {
  const fetchFn = useCallback(() => fetchAgentsSummary(), []);
  const { data, isLoading, isRefreshing, error } = useAnalyticsData(
    "agents",
    fetchFn,
    "{}",
  );

  // Agent feature flag toggles
  const [agentFlags, setAgentFlags] = useState<FeatureFlag[]>([]);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatureFlags().then((result) => {
      if (result.data) {
        setAgentFlags(result.data.filter((f) => (AGENT_FLAG_KEYS as readonly string[]).includes(f.flagKey)));
      }
    });
  }, []);

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdatingKey(flag.flagKey);
    const result = await updateFeatureFlag(flag.flagKey, !flag.enabled);
    if (result.data) {
      setAgentFlags((prev) => prev.map((f) => (f.flagKey === flag.flagKey ? result.data! : f)));
    }
    setUpdatingKey(null);
  };

  const handleFlagUpdate = (updatedFlag: FeatureFlag) => {
    setAgentFlags((prev) => prev.map((f) => (f.flagKey === updatedFlag.flagKey ? updatedFlag : f)));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
        <Loader2 className="h-6 w-6 animate-spin text-[#a39e98]" />
        <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
        <AlertCircle className="h-8 w-8 text-[#c97a7a]" />
        <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-12">
      {/* Refreshing indicator */}
      {isRefreshing && (
        <div className="fixed top-16 left-0 right-0 z-50 h-0.5 bg-blue-400/50 animate-pulse" />
      )}

      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          Admin / Agents
        </p>
        <h1 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
          Agent Intelligence
        </h1>
      </div>

      {/* Overall Health Banner */}
      <OverallHealthBanner health={data.overallHealth} agents={data.agents} />

      {/* Agent Toggles */}
      {agentFlags.length > 0 && (
        <section>
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Agent Toggles
          </h2>
          <div className="rounded-2xl bg-white dark:bg-[#252320]">
            <table className="w-full">
              <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                {agentFlags.map((flag) => {
                  const isExpanded = expandedKey === flag.flagKey;
                  const isIndividualAgent = flag.flagKey.endsWith("_agent_enabled");
                  return (
                    <tr key={flag.flagKey} className={cn(flag.enabled && "bg-[#f5f3ee]/50 dark:bg-[#252320]/50")}>
                      <td className="py-4 pl-5 align-top">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-medium",
                            flag.flagKey === "automated_agents"
                              ? "text-[#2d2a26] dark:text-[#f5f3ee]"
                              : "pl-4 text-[#2d2a26] dark:text-[#f5f3ee]"
                          )}>
                            {flag.label}
                          </span>
                          {isIndividualAgent && (
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : flag.flagKey)}
                              className="inline-flex items-center rounded p-1 text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                              aria-label={`Configure ${flag.label}`}
                              aria-expanded={isExpanded}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {isExpanded && isIndividualAgent && (
                          <div className="mt-3 pl-4">
                            <AgentConfigPanel flag={flag} onUpdate={handleFlagUpdate} />
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4 align-top text-sm text-[#6b6560] dark:text-[#a39e98]">
                        {flag.description || "—"}
                      </td>
                      <td className="w-20 py-4 pr-5 text-center align-top">
                        <button
                          onClick={() => handleToggle(flag)}
                          disabled={updatingKey === flag.flagKey}
                          className={cn(
                            "relative h-6 w-11 rounded-full transition-colors",
                            flag.enabled
                              ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
                              : "bg-[#e5e3de] dark:bg-[#3d3a36]",
                            updatingKey === flag.flagKey && "cursor-wait opacity-50"
                          )}
                          role="switch"
                          aria-checked={flag.enabled}
                          aria-label={`Toggle ${flag.label}`}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-5 w-5 rounded-full transition-all",
                              flag.enabled
                                ? "left-[22px] bg-white dark:bg-[#2d2a26]"
                                : "left-0.5 bg-white dark:bg-[#6b6560]"
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Agent Status Grid */}
      <section>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          Agent Status
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.agents.map((agent) => (
            <AgentCard key={agent.flagKey} agent={agent} />
          ))}
        </div>
      </section>

      {/* Cross-Agent Insights */}
      {data.sharedContext.length > 0 && (
        <section>
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Cross-Agent Insights
          </h2>
          <div className="space-y-4">
            {data.sharedContext.map((entry, i) => (
              <SharedContextCard key={`${entry.agentFlag}-${entry.timestamp}-${i}`} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity Timeline */}
      {data.recentActivity.length > 0 && (
        <section>
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Recent Activity
          </h2>
          <div className="rounded-2xl bg-white p-6 dark:bg-[#252320]">
            <div className="space-y-0">
              {data.recentActivity.map((item, i) => (
                <ActivityItem
                  key={`${item.agentName}-${item.timestamp}`}
                  item={item}
                  isLast={i === data.recentActivity.length - 1}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function OverallHealthBanner({ health, agents }: { health: AgentHealthStatus; agents: AgentStatus[] }) {
  const greenCount = agents.filter((a) => a.health === "green").length;
  const total = agents.length;

  return (
    <div className={`rounded-2xl border p-6 ${HEALTH_BG[health]}`}>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full ${HEALTH_COLORS[health]}`} />
        <span className={`text-sm font-medium ${HEALTH_TEXT_COLORS[health]}`}>
          {HEALTH_LABELS[health]}
        </span>
        <span className="font-mono text-xs text-[#a39e98] dark:text-[#6b6560]">
          {greenCount}/{total} agents healthy
        </span>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentStatus }) {
  return (
    <div className="rounded-2xl bg-white p-5 dark:bg-[#252320]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            {agent.name}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#a39e98] dark:text-[#6b6560]">
            {agent.schedule}
          </p>
        </div>
        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${HEALTH_COLORS[agent.health]}`} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#6b6560] dark:text-[#a39e98]">
        {agent.healthSummary}
      </p>
      <p className="mt-3 font-mono text-[10px] text-[#a39e98] dark:text-[#6b6560]">
        {relativeTime(agent.lastRun)}
      </p>
    </div>
  );
}

function SharedContextCard({ entry }: { entry: SharedContextEntry }) {
  return (
    <div className="rounded-2xl bg-white p-5 dark:bg-[#252320]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          {entry.agentName}
        </span>
        <span className="font-mono text-[10px] text-[#a39e98] dark:text-[#6b6560]">
          {relativeTime(entry.timestamp)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[#6b6560] dark:text-[#a39e98]">
        {entry.content}
      </p>
    </div>
  );
}

function ActivityItem({ item, isLast }: { item: AgentActivityItem; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${HEALTH_COLORS[item.health]}`} />
        {!isLast && (
          <div className="w-px flex-1 bg-[#e5e3de] dark:bg-[#3d3a36]" />
        )}
      </div>
      {/* Content */}
      <div className={`${isLast ? "pb-0" : "pb-6"}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            {item.agentName}
          </span>
          <span className="font-mono text-[10px] text-[#a39e98] dark:text-[#6b6560]">
            {relativeTime(item.timestamp)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#6b6560] dark:text-[#a39e98]">
          {item.summary}
        </p>
      </div>
    </div>
  );
}

export function AgentsDashboard() {
  return (
    <AnalyticsCacheProvider>
      <AgentsDashboardInner />
    </AnalyticsCacheProvider>
  );
}
