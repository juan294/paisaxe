"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { fetchAgentsSummary, fetchFeatureFlags, updateFeatureFlag, triggerAgentRun, fetchRunningAgents, stopAgent, fetchAgentLogs } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import { AgentConfigPanel } from "./agent-config-panel";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy, Loader2, Play, Square, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/feature-flags";
import type {
  AgentHealthStatus,
  AgentStatus,
  SharedContextEntry,
  AgentActivityItem,
  AgentLogLine,
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

/** Map flag keys to display names for the terminal header. */
const AGENT_NAMES: Record<string, string> = {
  coverage_agent_enabled: "Coverage Agent",
  security_agent_enabled: "Security Agent",
  documentation_agent_enabled: "Documentation Agent",
  performance_agent_enabled: "Performance Agent",
  qa_agent_enabled: "QA Agent",
  localization_agent_enabled: "Localization Agent",
  cost_analyst_agent_enabled: "Cost Analyst Agent",
};

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

function formatElapsed(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(diff / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "agents",
    fetchFn,
    "{}",
  );

  // Agent feature flag toggles
  const [agentFlags, setAgentFlags] = useState<FeatureFlag[]>([]);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // On-demand agent runner state
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Terminal state
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<AgentLogLine[]>([]);
  const [terminalOffset, setTerminalOffset] = useState(0);
  const [terminalFinished, setTerminalFinished] = useState(false);
  const [terminalExitCode, setTerminalExitCode] = useState<number | null>(null);
  const [terminalStoppedByUser, setTerminalStoppedByUser] = useState(false);
  const [terminalStartedAt, setTerminalStartedAt] = useState<string | null>(null);
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track last run results per agent for card display
  const [lastRunResults, setLastRunResults] = useState<Record<string, {
    status: "success" | "error" | "stopped";
    time: string;
  }>>({});

  useEffect(() => {
    fetchFeatureFlags().then((result) => {
      if (result.data) {
        setAgentFlags(result.data.filter((f) => (AGENT_FLAG_KEYS as readonly string[]).includes(f.flagKey)));
      }
    });
  }, []);

  // Poll running agents when any are active
  useEffect(() => {
    if (runningAgents.size === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const result = await fetchRunningAgents();
      if (!result.data) return;

      const stillRunning = new Set(Object.keys(result.data.running));
      const justFinished = [...runningAgents].filter((k) => !stillRunning.has(k));

      if (justFinished.length > 0) {
        refresh();
      }

      setRunningAgents(stillRunning);
    };

    pollingRef.current = setInterval(poll, 10_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningAgents.size]);

  // Poll logs for the active terminal
  useEffect(() => {
    if (!activeTerminal) {
      if (logPollRef.current) {
        clearInterval(logPollRef.current);
        logPollRef.current = null;
      }
      return;
    }

    // Use a ref-stable offset for incremental fetching
    let currentOffset = terminalOffset;

    const pollLogs = async () => {
      const result = await fetchAgentLogs(activeTerminal, currentOffset);
      if (!result.data) return;

      if (result.data.logs.length > 0) {
        setTerminalLogs((prev) => [...prev, ...result.data!.logs]);
        currentOffset = result.data.offset;
        setTerminalOffset(result.data.offset);
      }

      if (result.data.finished) {
        setTerminalFinished(true);
        setTerminalExitCode(result.data.exitCode);
        setTerminalStoppedByUser(result.data.stoppedByUser);

        // Record last run result for the card
        const status = result.data.stoppedByUser
          ? "stopped" as const
          : (result.data.exitCode === 0 ? "success" as const : "error" as const);
        setLastRunResults((prev) => ({
          ...prev,
          [activeTerminal]: { status, time: new Date().toISOString() },
        }));

        if (logPollRef.current) {
          clearInterval(logPollRef.current);
          logPollRef.current = null;
        }
      }
    };

    // Immediate first fetch
    pollLogs();
    logPollRef.current = setInterval(pollLogs, 2_000);

    return () => {
      if (logPollRef.current) clearInterval(logPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTerminal]);

  const handleRunAgent = async (agentKey: string) => {
    const result = await triggerAgentRun(agentKey);
    if (result.data?.started) {
      setRunningAgents((prev) => new Set([...prev, agentKey]));
      // Open terminal for this agent
      setTerminalLogs([]);
      setTerminalOffset(0);
      setTerminalFinished(false);
      setTerminalExitCode(null);
      setTerminalStoppedByUser(false);
      setTerminalStartedAt(result.data.startedAt);
      setActiveTerminal(agentKey);
    }
  };

  const handleStopAgent = async (agentKey: string) => {
    await stopAgent(agentKey);
    setRunningAgents((prev) => {
      const next = new Set(prev);
      next.delete(agentKey);
      return next;
    });
    // Terminal will pick up "finished" on next poll
  };

  const handleCloseTerminal = () => {
    setActiveTerminal(null);
    setTerminalLogs([]);
    setTerminalOffset(0);
    setTerminalFinished(false);
    setTerminalExitCode(null);
    setTerminalStoppedByUser(false);
    setTerminalStartedAt(null);
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
          {data.agents.map((agent) => (
            <AgentCard
              key={agent.flagKey}
              agent={agent}
              isRunning={runningAgents.has(agent.flagKey)}
              lastRunResult={lastRunResults[agent.flagKey]}
              onRun={() => handleRunAgent(agent.flagKey)}
              onStop={() => handleStopAgent(agent.flagKey)}
            />
          ))}
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
          onClose={handleCloseTerminal}
        />
      )}

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

function AgentCard({
  agent,
  isRunning,
  lastRunResult,
  onRun,
  onStop,
}: {
  agent: AgentStatus;
  isRunning: boolean;
  lastRunResult?: { status: "success" | "error" | "stopped"; time: string };
  onRun: () => void;
  onStop: () => void;
}) {
  // Determine what to show: running state > recent run result > report data
  const showLastRun = lastRunResult && !isRunning;
  const healthDot = isRunning
    ? "bg-[#c9a55c] animate-pulse"
    : showLastRun
      ? lastRunResult.status === "success" ? "bg-[#7a9e7a]" : lastRunResult.status === "error" ? "bg-[#c97a7a]" : "bg-[#c9a55c]"
      : HEALTH_COLORS[agent.health];

  const summaryText = isRunning
    ? "Running..."
    : showLastRun
      ? lastRunResult.status === "error"
        ? "Last run failed"
        : lastRunResult.status === "stopped"
          ? "Last run stopped by user"
          : "Last run completed successfully"
      : agent.healthSummary;

  const summaryColor = showLastRun && lastRunResult.status === "error"
    ? "text-[#c97a7a]"
    : "text-[#6b6560] dark:text-[#a39e98]";

  const timeText = showLastRun ? relativeTime(lastRunResult.time) : relativeTime(agent.lastRun);

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
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onStop}
              className="rounded-full p-1 text-[#c97a7a] transition-colors hover:bg-[#c97a7a]/10"
              aria-label={`Stop ${agent.name}`}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onRun}
              className="rounded-full p-1 text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
              aria-label={`Run ${agent.name}`}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <div className={cn("mt-0 h-2.5 w-2.5 rounded-full", healthDot)} />
        </div>
      </div>
      <p className={cn("mt-3 text-xs leading-relaxed", summaryColor)}>
        {summaryText}
      </p>
      <p className="mt-3 font-mono text-[10px] text-[#a39e98] dark:text-[#6b6560]">
        {timeText}
      </p>
    </div>
  );
}

function AgentTerminal({
  agentKey: _agentKey,
  agentName,
  logs,
  finished,
  exitCode,
  stoppedByUser,
  startedAt,
  onClose,
}: {
  agentKey: string;
  agentName: string;
  logs: AgentLogLine[];
  finished: boolean;
  exitCode: number | null;
  stoppedByUser: boolean;
  startedAt: string | null;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState("0:00");
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  // Update elapsed time every second while running
  useEffect(() => {
    if (!startedAt || finished) return;

    const tick = () => setElapsed(formatElapsed(startedAt));
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [startedAt, finished]);

  // Compute final elapsed when finished
  useEffect(() => {
    if (finished && startedAt) {
      setElapsed(formatElapsed(startedAt));
    }
  }, [finished, startedAt]);

  const failed = finished && exitCode !== null && exitCode !== 0;
  const statusLabel = !finished
    ? "Running..."
    : stoppedByUser
      ? "Stopped"
      : failed
        ? `Failed (exit ${exitCode})`
        : "Completed";
  const statusColor = !finished
    ? "text-[#c9a55c]"
    : stoppedByUser
      ? "text-[#c9a55c]"
      : failed
        ? "text-[#c97a7a]"
        : "text-[#7a9e7a]";

  return (
    <section>
      <div className="overflow-hidden rounded-2xl border border-[#3d3a36]">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#e5e3de]">{agentName}</span>
            <span className={cn("flex items-center gap-1.5 font-mono text-xs", statusColor)}>
              {!finished && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9a55c]" />}
              {statusLabel}
            </span>
            <span className="font-mono text-xs text-[#6b6560]">{elapsed}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const text = logs.map((l) => `${new Date(l.timestamp).toLocaleTimeString()}  ${l.text}`).join("\n");
                navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="rounded p-1 text-[#6b6560] transition-colors hover:bg-[#3d3a36] hover:text-[#e5e3de]"
              aria-label="Copy terminal output"
            >
              {copied ? <Check className="h-4 w-4 text-[#7a9e7a]" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-[#6b6560] transition-colors hover:bg-[#3d3a36] hover:text-[#e5e3de]"
              aria-label="Close terminal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Log content */}
        <div
          ref={scrollRef}
          className="max-h-[400px] overflow-y-auto bg-[#111] p-4 font-mono text-xs leading-relaxed"
        >
          {logs.length === 0 ? (
            <p className="text-[#6b6560]">Waiting for output...</p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 select-none text-[#4a4540]">
                  {new Date(line.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn(
                  "whitespace-pre-wrap break-all",
                  line.text.startsWith("[stderr]") ? "text-[#c97a7a]" : "text-[#d4d0ca]",
                )}>
                  {line.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/** Convert basic markdown (headings, bold, list items) to HTML. Content is from our own agents, not user input. */
function renderMarkdown(md: string): string {
  return md
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n").map((line) => {
        // Headings → bold text
        if (/^#{1,3}\s+/.test(line)) {
          const text = line.replace(/^#{1,3}\s+/, "");
          return `<strong class="text-[#2d2a26] dark:text-[#f5f3ee]">${text}</strong>`;
        }
        // List items → bullet
        if (/^[-*]\s+/.test(line)) {
          const text = line.replace(/^[-*]\s+/, "");
          return `<li>${text}</li>`;
        }
        return line;
      });

      // Wrap consecutive <li> items in <ul>
      const html = lines.join("\n")
        .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-4 space-y-0.5">$1</ul>');

      return `<div>${html}</div>`;
    })
    .join("")
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[#2d2a26] dark:text-[#f5f3ee]">$1</strong>');
}

/**
 * Deduplicate shared context entries by agent name, keeping only the most recent per agent.
 */
function deduplicateByAgent(entries: SharedContextEntry[]): SharedContextEntry[] {
  const seen = new Map<string, SharedContextEntry>();
  for (const entry of entries) {
    const existing = seen.get(entry.agentName);
    if (!existing || entry.timestamp > existing.timestamp) {
      seen.set(entry.agentName, entry);
    }
  }
  return [...seen.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function CrossAgentInsights({ entries }: { entries: SharedContextEntry[] }) {
  const uniqueEntries = deduplicateByAgent(entries);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Clamp index if entries change
  const index = Math.min(selectedIndex, uniqueEntries.length - 1);
  const selected = uniqueEntries[index];

  return (
    <section>
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        Cross-Agent Insights
      </h2>

      {/* Agent selector pills */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setSelectedIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="shrink-0 rounded-full p-1 text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] disabled:opacity-30 dark:hover:bg-[#3d3a36]"
          aria-label="Previous agent insight"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-none">
          {uniqueEntries.map((entry, i) => (
            <button
              key={`${entry.agentFlag}-${entry.timestamp}`}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                i === index
                  ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                  : "bg-[#f5f3ee] text-[#6b6560] hover:bg-[#e5e3de] dark:bg-[#3d3a36] dark:text-[#a39e98] dark:hover:bg-[#4a4540]"
              )}
            >
              {entry.agentName}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectedIndex(Math.min(uniqueEntries.length - 1, index + 1))}
          disabled={index === uniqueEntries.length - 1}
          className="shrink-0 rounded-full p-1 text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] disabled:opacity-30 dark:hover:bg-[#3d3a36]"
          aria-label="Next agent insight"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Selected insight card */}
      {selected && <SharedContextCard entry={selected} />}

      {/* Entry counter */}
      <p className="mt-2 text-center font-mono text-[10px] text-[#a39e98] dark:text-[#6b6560]">
        {index + 1} / {uniqueEntries.length}
      </p>
    </section>
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
      <div
        className="mt-2 space-y-2 text-xs leading-relaxed text-[#6b6560] dark:text-[#a39e98] [&_ul]:mt-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
      />
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
