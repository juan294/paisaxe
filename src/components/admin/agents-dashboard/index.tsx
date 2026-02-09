"use client";

import { useCallback, useState, useEffect } from "react";
import { fetchAgentsSummary, fetchFeatureFlags, updateFeatureFlag, triggerOptimizerRun } from "@/lib/admin-api";
import { useAnalyticsData } from "../analytics-cache-context";
import { AnalyticsCacheProvider } from "../analytics-cache-context";
import { AgentConfigPanel } from "../agent-config-panel";
import { AlertCircle, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/feature-flags";
import { AGENT_FLAG_KEYS, AGENT_NAMES } from "./constants";
import { useAgentRunner } from "./use-agent-runner";
import { useAgentTerminal } from "./use-agent-terminal";
import { AgentCard } from "./agent-card";
import { AgentTerminal } from "./terminal-display";
import { OverallHealthBanner } from "./overall-health-banner";
import { CrossAgentInsights } from "./cross-agent-insights";
import { ActivityItem } from "./activity-item";
import { OptimizerReportDialog } from "./optimizer-report-dialog";
import { OptimizerConfigPanel } from "./optimizer-config-panel";

// Re-export public API
export { escapeHtml, renderMarkdown } from "./markdown";

function AgentsDashboardInner() {
  const fetchFn = useCallback(() => fetchAgentsSummary(), []);
  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "agents",
    fetchFn,
    "{}",
  );

  // Agent feature flag toggles
  const [agentFlags, setAgentFlags] = useState<FeatureFlag[]>([]);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Optimizer-specific state
  const [optimizerRunning, setOptimizerRunning] = useState(false);
  const [showOptimizerReport, setShowOptimizerReport] = useState(false);
  const [optimizerReportContent, setOptimizerReportContent] = useState("");

  const {
    runningAgents,
    lastRunResults,
    handleRunAgent,
    handleStopAgent,
    recordRunResult,
  } = useAgentRunner({ onAgentsFinished: refresh });

  const {
    activeTerminal,
    terminalLogs,
    terminalFinished,
    terminalExitCode,
    terminalStoppedByUser,
    terminalStartedAt,
    openTerminal,
    closeTerminal,
  } = useAgentTerminal({
    onFinished: (agentKey, exitCode, stoppedByUser) => {
      const status = stoppedByUser
        ? "stopped" as const
        : (exitCode === 0 ? "success" as const : "error" as const);
      recordRunResult(agentKey, status);
    },
  });

  useEffect(() => {
    fetchFeatureFlags().then((result) => {
      if (result.data) {
        setAgentFlags(result.data.filter((f) => (AGENT_FLAG_KEYS as readonly string[]).includes(f.flagKey)));
      }
    });
  }, []);

  const onRunAgent = async (agentKey: string) => {
    // Optimizer is a synchronous API call, not a long-running shell process
    if (agentKey === "subscription_optimizer_enabled") {
      setOptimizerRunning(true);
      const result = await triggerOptimizerRun();
      setOptimizerRunning(false);
      if (result.data) {
        setOptimizerReportContent(result.data.report);
        recordRunResult(agentKey, "success");
      } else {
        recordRunResult(agentKey, "error");
      }
      refresh();
      return;
    }

    const result = await handleRunAgent(agentKey);
    if (result.started && result.startedAt) {
      openTerminal(agentKey, result.startedAt);
    }
  };

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
                  const isIndividualAgent = flag.flagKey !== "automated_agents";
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
                            {flag.flagKey === "subscription_optimizer_enabled" ? (
                              <OptimizerConfigPanel flag={flag} onUpdate={handleFlagUpdate} />
                            ) : (
                              <AgentConfigPanel flag={flag} onUpdate={handleFlagUpdate} />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4 align-top text-sm text-[#6b6560] dark:text-[#a39e98]">
                        {flag.description || "\u2014"}
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
          {data.agents.map((agent) => {
            const isOptimizer = agent.flagKey === "subscription_optimizer_enabled";
            return (
              <AgentCard
                key={agent.flagKey}
                agent={agent}
                isRunning={isOptimizer ? optimizerRunning : runningAgents.has(agent.flagKey)}
                lastRunResult={lastRunResults[agent.flagKey]}
                onRun={() => onRunAgent(agent.flagKey)}
                onStop={() => handleStopAgent(agent.flagKey)}
                onClick={isOptimizer ? () => setShowOptimizerReport(true) : undefined}
                hideStop={isOptimizer}
              />
            );
          })}
        </div>
      </section>

      {/* Agent Terminal */}
      {activeTerminal && (
        <AgentTerminal
          agentKey={activeTerminal}
          agentName={AGENT_NAMES[activeTerminal] ?? activeTerminal}
          logs={terminalLogs}
          finished={terminalFinished}
          exitCode={terminalExitCode}
          stoppedByUser={terminalStoppedByUser}
          startedAt={terminalStartedAt}
          onClose={closeTerminal}
        />
      )}

      {/* Optimizer Report Dialog */}
      <OptimizerReportDialog
        open={showOptimizerReport}
        onOpenChange={setShowOptimizerReport}
        reportMarkdown={
          optimizerReportContent ||
          data.agents.find((a) => a.flagKey === "subscription_optimizer_enabled")?.healthSummary ||
          ""
        }
        analyzedAt={
          data.agents.find((a) => a.flagKey === "subscription_optimizer_enabled")?.lastRun ?? null
        }
      />

      {/* Cross-Agent Insights */}
      {data.sharedContext.length > 0 && (
        <CrossAgentInsights entries={data.sharedContext} />
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

export function AgentsDashboard() {
  return (
    <AnalyticsCacheProvider>
      <AgentsDashboardInner />
    </AnalyticsCacheProvider>
  );
}
