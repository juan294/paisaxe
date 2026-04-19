"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SharedContextEntry } from "@/types/agents-dashboard";
import { relativeTime } from "./constants";
import { deduplicateByAgent } from "./markdown";
import { SafeMarkdown } from "./safe-markdown";

export function CrossAgentInsights({ entries }: { entries: SharedContextEntry[] }) {
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
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-[#6b6560] dark:text-[#a39e98] [&_ul]:mt-1">
        <SafeMarkdown content={entry.content} />
      </div>
    </div>
  );
}
