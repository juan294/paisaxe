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
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
        Cross-Agent Insights
      </h2>

      {/* Agent selector pills */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setSelectedIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="shrink-0 rounded-full p-1 text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted disabled:opacity-30 dark:hover:bg-admin-depth"
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
                  ? "bg-admin-ink text-admin-paper dark:bg-admin-paper dark:text-admin-ink"
                  : "bg-admin-paper text-admin-muted hover:bg-admin-line dark:bg-admin-depth dark:text-admin-subtle dark:hover:bg-[#4a4540]"
              )}
            >
              {entry.agentName}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectedIndex(Math.min(uniqueEntries.length - 1, index + 1))}
          disabled={index === uniqueEntries.length - 1}
          className="shrink-0 rounded-full p-1 text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted disabled:opacity-30 dark:hover:bg-admin-depth"
          aria-label="Next agent insight"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Selected insight card */}
      {selected && <SharedContextCard entry={selected} />}

      {/* Entry counter */}
      <p className="mt-2 text-center font-mono text-[10px] text-admin-subtle dark:text-admin-muted">
        {index + 1} / {uniqueEntries.length}
      </p>
    </section>
  );
}

function SharedContextCard({ entry }: { entry: SharedContextEntry }) {
  return (
    <div className="rounded-2xl bg-white p-5 dark:bg-admin-panel">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-admin-ink dark:text-admin-paper">
          {entry.agentName}
        </span>
        <span className="font-mono text-[10px] text-admin-subtle dark:text-admin-muted">
          {relativeTime(entry.timestamp)}
        </span>
      </div>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-admin-muted dark:text-admin-subtle [&_ul]:mt-1">
        <SafeMarkdown content={entry.content} />
      </div>
    </div>
  );
}
