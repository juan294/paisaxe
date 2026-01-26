"use client";

import { cn } from "@/lib/utils";

export type AdminTab = "stories" | "toggles" | "analytics";

interface AdminTabsProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const TABS: { value: AdminTab; label: string }[] = [
  { value: "stories", label: "Stories" },
  { value: "toggles", label: "Feature Toggles" },
  { value: "analytics", label: "Analytics" },
];

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <nav className="flex items-center gap-1" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            activeTab === tab.value
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
