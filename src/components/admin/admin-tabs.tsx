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
      className="flex items-center gap-8 border-b border-[#e5e3de] dark:border-[#3d3a36]"
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
              ? "text-[#2d2a26] dark:text-[#f5f3ee]"
              : "text-[#a39e98] hover:text-[#6b6560] dark:hover:text-[#a39e98]"
          )}
        >
          <span className="tabular-nums text-[#a39e98] group-hover:text-[#a39e98] dark:text-[#6b6560]">
            {tab.number}
          </span>
          {tab.label}
          <kbd className="inline-flex items-center justify-center rounded bg-[#f5f3ee] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#a39e98] dark:bg-[#3d3a36] dark:text-[#6b6560]">
            ⌘{index + 1}
          </kbd>
          {activeTab === tab.value && (
            <span className="absolute bottom-0 left-0 h-px w-full bg-[#2d2a26] dark:bg-[#f5f3ee]" />
          )}
        </button>
      ))}
    </nav>
  );
}
