"use client";

import type { AgentActivityItem } from "@/types/agents-dashboard";
import { HEALTH_COLORS, relativeTime } from "./constants";

export function ActivityItem({ item, isLast }: { item: AgentActivityItem; isLast: boolean }) {
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
