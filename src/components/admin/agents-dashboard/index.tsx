"use client";

import { useCallback, useState, useEffect } from "react";
import { fetchAgentsSummary, fetchAgentConfig, updateAgentMaster, updateAgentEnabled, triggerOptimizerRun } from "@/lib/admin-api";
import { useAnalyticsData } from "../analytics-cache-context";
import { AnalyticsCacheProvider } from "../analytics-cache-context";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentConfigFile } from "@/types/agent-config";
import { AGENT_FLAG_KEYS, AGENT_NAMES } from "./constants";
import { useAgentRunner } from "./use-agent-runner";
import { useAgentTerminal } from "./use-agent-terminal";
import { AgentCard } from "./agent-card";
import { AgentTerminal } from "./terminal-display";
import { OverallHealthBanner } from "./overall-health-banner";
import { CrossAgentInsights } from "./cross-agent-insights";
import { ActivityItem } from "./activity-item";
import { OptimizerReportDialog } from "./optimizer-report-dialog";

// Re-export public API
export { escapeHtml, renderMarkdown } from "./markdown";

function AgentsDashboardInner() {
  const fetchFn = useCallback(() => fetchAgentsSummary(), []);
  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "agents",
    fetchFn,
    "{}",
  );

  // Agent local config toggles
  const [agentConfig, setAgentConfig] = useState<AgentConfigFile | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

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
    fetchAgentConfig().then((result) => {
      if (result.data) {
        setAgentConfig(result.data);
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
        setShowOptimizerReport(true);
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

  const handleMasterToggle = async () => {
    if (!agentConfig) return;
    setUpdatingKey("master");
    const result = await updateAgentMaster(!agentConfig.master_enabled);
    if (result.data) setAgentConfig(result.data);
    setUpdatingKey(null);
  };

  const handleAgentToggle = async (key: string) => {
    if (!agentConfig) return;
    setUpdatingKey(key);
    const result = await updateAgentEnabled(key, !agentConfig.agents[key]?.enabled);
    if (result.data) setAgentConfig(result.data);
    setUpdatingKey(null);
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
        <h2 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
          Agent Intelligence
        </h2>
      </div>

      {/* Overall Health Banner */}
      <OverallHealthBanner health={data.overallHealth} agents={data.agents} />

      {/* Agent Toggles (local config) */}
      {agentConfig && (
        <section>
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Agent Toggles
          </h2>
          <div className="rounded-2xl bg-white dark:bg-[#252320]">
            <table className="w-full">
              <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                {/* Master toggle */}
                <tr className={cn(agentConfig.master_enabled && "bg-[#f5f3ee]/50 dark:bg-[#252320]/50")}>
                  <td className="py-4 pl-5 align-top">
                    <span className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                      All Automated Agents
                    </span>
                  </td>
                  <td className="py-4 pr-4 align-top text-sm text-[#6b6560] dark:text-[#a39e98]">
                    Master toggle for all agents
                  </td>
                  <td className="w-20 py-4 pr-5 text-center align-top">
                    <button
                      onClick={handleMasterToggle}
                      disabled={updatingKey === "master"}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        agentConfig.master_enabled
                          ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
                          : "bg-[#e5e3de] dark:bg-[#3d3a36]",
                        updatingKey === "master" && "cursor-wait opacity-50"
                      )}
                      role="switch"
                      aria-checked={agentConfig.master_enabled}
                      aria-label="Toggle All Automated Agents"
                    >
                      <span className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full transition-all",
                        agentConfig.master_enabled
                          ? "left-[22px] bg-white dark:bg-[#2d2a26]"
                          : "left-0.5 bg-white dark:bg-[#6b6560]"
                      )} />
                    </button>
                  </td>
                </tr>
                {/* Individual agent toggles */}
                {AGENT_FLAG_KEYS.map((key) => {
                  const agent = agentConfig.agents[key];
                  if (!agent) return null;
                  const name = AGENT_NAMES[key] ?? key;
                  return (
                    <tr key={key} className={cn(agent.enabled && "bg-[#f5f3ee]/50 dark:bg-[#252320]/50")}>
                      <td className="py-4 pl-5 align-top">
                        <span className="pl-4 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                          {name}
                        </span>
                      </td>
                      <td className="py-4 pr-4 align-top text-sm text-[#6b6560] dark:text-[#a39e98]">
                        {"\u2014"}
                      </td>
                      <td className="w-20 py-4 pr-5 text-center align-top">
                        <button
                          onClick={() => handleAgentToggle(key)}
                          disabled={updatingKey === key}
                          className={cn(
                            "relative h-6 w-11 rounded-full transition-colors",
                            agent.enabled
                              ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
                              : "bg-[#e5e3de] dark:bg-[#3d3a36]",
                            updatingKey === key && "cursor-wait opacity-50"
                          )}
                          role="switch"
                          aria-checked={agent.enabled}
                          aria-label={`Toggle ${name}`}
                        >
                          <span className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full transition-all",
                            agent.enabled
                              ? "left-[22px] bg-white dark:bg-[#2d2a26]"
                              : "left-0.5 bg-white dark:bg-[#6b6560]"
                          )} />
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
