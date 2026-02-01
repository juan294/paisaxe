"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Users, DollarSign, Mic } from "lucide-react";

export type AnalyticsSubTab = "visitors" | "revenue" | "voice";

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
    shortcut: "v",
  },
  {
    value: "revenue",
    label: "Revenue",
    icon: <DollarSign className="h-4 w-4" />,
    shortcut: "r",
  },
  {
    value: "voice",
    label: "Voice",
    icon: <Mic className="h-4 w-4" />,
    shortcut: "e",
  },
];

export function AnalyticsTabs({ activeTab, onTabChange, children }: AnalyticsTabsProps) {
  // Keyboard shortcuts: v for visitors, r for revenue, e for voice (elevenlabs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
      {/* Sub-tab navigation */}
      <nav className="flex items-center gap-2" role="tablist" aria-label="Analytics sections">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.value
                ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                : "bg-white text-[#6b6560] hover:bg-[#f5f3ee] dark:bg-[#252320] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
            )}
          >
            <span
              className={cn(
                activeTab === tab.value
                  ? "text-[#a39e98] dark:text-[#6b6560]"
                  : "text-[#a39e98] group-hover:text-[#6b6560] dark:text-[#6b6560] dark:group-hover:text-[#a39e98]"
              )}
            >
              {tab.icon}
            </span>
            {tab.label}
            <kbd
              className={cn(
                "hidden sm:inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[10px]",
                activeTab === tab.value
                  ? "bg-[#3d3a36] text-[#a39e98] dark:bg-[#e5e3de] dark:text-[#6b6560]"
                  : "bg-[#f5f3ee] text-[#a39e98] dark:bg-[#3d3a36] dark:text-[#6b6560]"
              )}
            >
              {tab.shortcut.toUpperCase()}
            </kbd>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div role="tabpanel">{children}</div>
    </div>
  );
}
