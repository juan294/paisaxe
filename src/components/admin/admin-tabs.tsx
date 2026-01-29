"use client";

import { cn } from "@/lib/utils";

export type AdminTab = "stories" | "toggles" | "analytics" | "marketing";

interface AdminTabsProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const TABS: { value: AdminTab; label: string }[] = [
  { value: "stories", label: "Stories" },
  { value: "toggles", label: "Toggles" },
  { value: "analytics", label: "Analytics" },
  { value: "marketing", label: "Marketing" },
];

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <nav
      className="flex items-center gap-1"
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-all",
            activeTab === tab.value
              ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
              : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
