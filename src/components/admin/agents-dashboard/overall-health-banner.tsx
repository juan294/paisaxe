"use client";

import type { AgentHealthStatus, AgentStatus } from "@/types/agents-dashboard";
import { HEALTH_BG, HEALTH_COLORS, HEALTH_LABELS, HEALTH_TEXT_COLORS } from "./constants";

export function OverallHealthBanner({ health, agents }: { health: AgentHealthStatus; agents: AgentStatus[] }) {
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
