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
  onClick,
  hideStop,
}: {
  agent: AgentStatus;
  isRunning: boolean;
  lastRunResult?: { status: "success" | "error" | "stopped"; time: string };
  onRun: () => void;
  onStop: () => void;
  onClick?: () => void;
  hideStop?: boolean;
}) {
  // Determine what to show: running state > recent run result > report data
  const showLastRun = lastRunResult && !isRunning;
  const healthDot = isRunning
    ? "bg-admin-warning animate-pulse"
    : showLastRun
      ? lastRunResult.status === "success" ? "bg-admin-health-success" : lastRunResult.status === "error" ? "bg-admin-health-error" : "bg-admin-warning"
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
    ? "text-admin-health-error"
    : "text-admin-muted dark:text-admin-subtle";

  const timeText = showLastRun ? relativeTime(lastRunResult.time) : relativeTime(agent.lastRun);

  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-5 dark:bg-admin-panel",
        onClick && "cursor-pointer transition-colors hover:bg-[#fafaf8] dark:hover:bg-[#2a2724]"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-admin-ink dark:text-admin-paper">
            {agent.name}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-admin-subtle dark:text-admin-muted">
            {agent.schedule}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && !hideStop ? (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(); }}
              className="rounded-full p-1 text-admin-health-error transition-colors hover:bg-admin-health-error/10"
              aria-label={`Stop ${agent.name}`}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              className="rounded-full p-1 text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted dark:hover:bg-admin-depth"
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
      <p className="mt-3 font-mono text-[10px] text-admin-subtle dark:text-admin-muted">
        {timeText}
      </p>
    </div>
  );
}
