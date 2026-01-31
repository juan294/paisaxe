"use client";

import { cn } from "@/lib/utils";

export type AdminTab = "stories" | "suggestions" | "toggles" | "analytics" | "marketing";

interface AdminTabsProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export const TABS: { value: AdminTab; label: string; number: string }[] = [
  { value: "stories", label: "Stories", number: "01" },
  { value: "toggles", label: "Toggles", number: "02" },
  { value: "analytics", label: "Analytics", number: "03" },
  { value: "marketing", label: "Marketing", number: "04" },
  { value: "suggestions", label: "Suggestions", number: "05" },
];

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <nav
      className="flex items-center gap-8 border-b border-stone-200 dark:border-stone-800"
      role="tablist"
    >
      {TABS.map((tab, index) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "group relative flex items-center gap-2 pb-4 font-mono text-xs uppercase tracking-widest transition-colors",
            activeTab === tab.value
              ? "text-stone-900 dark:text-stone-100"
              : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          )}
        >
          <span className="tabular-nums text-stone-300 group-hover:text-stone-400 dark:text-stone-600">
            {tab.number}
          </span>
          {tab.label}
          <kbd className="inline-flex items-center justify-center rounded bg-stone-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-stone-400 dark:bg-stone-800 dark:text-stone-500">
            ⌘{index + 1}
          </kbd>
          {activeTab === tab.value && (
            <span className="absolute bottom-0 left-0 h-px w-full bg-stone-900 dark:bg-stone-100" />
          )}
        </button>
      ))}
    </nav>
  );
}
