"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Users, DollarSign, Mic, Receipt, GitBranch } from "lucide-react";

export type AnalyticsSubTab = "visitors" | "revenue" | "voice" | "costs" | "github";

interface AnalyticsTabsProps {
  activeTab: AnalyticsSubTab;
  onTabChange: (tab: AnalyticsSubTab) => void;
  children: React.ReactNode;
}

const SUB_TABS: {
  value: AnalyticsSubTab;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}[] = [
  {
    value: "visitors",
    label: "Visitors",
    icon: <Users className="h-4 w-4" />,
    shortcut: "u",
  },
  {
    value: "voice",
    label: "Voice",
    icon: <Mic className="h-4 w-4" />,
    shortcut: "i",
  },
  {
    value: "github",
    label: "GitHub",
    icon: <GitBranch className="h-4 w-4" />,
    shortcut: "o",
  },
  {
    value: "costs",
    label: "Costs",
    icon: <Receipt className="h-4 w-4" />,
    shortcut: "p",
  },
  {
    value: "revenue",
    label: "Revenue",
    icon: <DollarSign className="h-4 w-4" />,
    shortcut: "l",
  },
];

export function AnalyticsTabs({ activeTab, onTabChange, children }: AnalyticsTabsProps) {
  // Keyboard shortcuts: Cmd+U/I/O/P for tab switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Require Cmd (Mac) or Ctrl (Windows/Linux)
      if (!e.metaKey && !e.ctrlKey) return;

      // Skip if other modifiers are also pressed
      if (e.altKey || e.shiftKey) return;

      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const tab = SUB_TABS.find((t) => t.shortcut === key);
      if (tab) {
        e.preventDefault();
        onTabChange(tab.value);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTabChange]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-[#e5e3de] pb-6 dark:border-[#3d3a36]">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Admin / Analytics</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
            Analytics
          </h1>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Analytics sections">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.value
                ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                : "text-[#6b6560] hover:bg-white dark:text-[#a39e98] dark:hover:bg-[#252320]"
            )}
          >
            {tab.icon}
            {tab.label}
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === tab.value
                ? "bg-[#1a1917] text-[#a39e98] dark:bg-[#e5e3de] dark:text-[#6b6560]"
                : "bg-[#e5e3de] text-[#6b6560] dark:bg-[#3d3a36] dark:text-[#a39e98]"
            )}>
              {"⌘" + tab.shortcut.toUpperCase()}
            </span>
          </button>
        ))}
      </nav>

      {/* Tab content — each panel provides its own tabpanel role */}
      {children}
    </div>
  );
}
