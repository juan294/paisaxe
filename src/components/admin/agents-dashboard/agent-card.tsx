"use client";

import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types/agents-dashboard";
import { HEALTH_COLORS, relativeTime } from "./constants";

export function AgentCard({
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
