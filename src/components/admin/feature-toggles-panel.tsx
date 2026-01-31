"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";
import {
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Settings,
  Compass,
  Sparkles,
  Users,
  Mic,
  Cog,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
import { VisitorVoiceConfigPanel } from "./visitor-voice-config-panel";
import { AgentConfigPanel } from "./agent-config-panel";
import { MaintenanceConfigPanel } from "./maintenance-config-panel";

// Feature flag categories
type FlagCategory = "discovery" | "experience" | "social" | "voice" | "system";

interface CategoryConfig {
  key: FlagCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: "discovery",
    label: "Discovery",
    icon: <Compass className="h-4 w-4" />,
    description: "Help visitors find and explore stories",
  },
  {
    key: "experience",
    label: "Experience",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Enhance the viewing experience",
  },
  {
    key: "social",
    label: "Social",
    icon: <Users className="h-4 w-4" />,
    description: "Community and sharing features",
  },
  {
    key: "voice",
    label: "Voice",
    icon: <Mic className="h-4 w-4" />,
    description: "Voice assistant features",
  },
  {
    key: "system",
    label: "System",
    icon: <Cog className="h-4 w-4" />,
    description: "Administrative controls",
  },
];

// Map each flag to its category
const FLAG_CATEGORIES: Record<FeatureFlagKey, FlagCategory> = {
  // Discovery - help users find stories
  contextual_prompts: "discovery",
  related_stories: "discovery",
  randomized_order: "discovery",
  surprise_me: "discovery",
  seasonal_surfacing: "discovery",
  mood_discovery: "discovery",
  story_freshness: "discovery",
  // Experience - enhance viewing
  ambient_discovery: "experience",
  autoplay_button: "experience",
  asturianu_touches: "experience",
  // Social - community features
  story_sharing: "social",
  user_story_suggestions: "social",
  // Voice - AI assistant
  visitor_voice_agent: "voice",
  // System - admin controls
  maintenance_mode: "system",
  automated_agents: "system",
  coverage_agent_enabled: "system",
  security_agent_enabled: "system",
  docs_freshness_agent_enabled: "system",
  performance_agent_enabled: "system",
};

// Flags that have configurable settings
const CONFIGURABLE_FLAGS = [
  "visitor_voice_agent",
  "coverage_agent_enabled",
  "security_agent_enabled",
  "docs_freshness_agent_enabled",
  "performance_agent_enabled",
  "maintenance_mode",
];

export function FeatureTogglesPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FlagCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadFlags = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await fetchFeatureFlags();
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setFlags(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdatingKey(flag.flagKey);
    const result = await updateFeatureFlag(flag.flagKey, !flag.enabled);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setFlags((prev) =>
        prev.map((f) => (f.flagKey === flag.flagKey ? result.data! : f))
      );
    }
    setUpdatingKey(null);
  };

  const handleFlagUpdate = (updatedFlag: FeatureFlag) => {
    setFlags((prev) =>
      prev.map((f) => (f.flagKey === updatedFlag.flagKey ? updatedFlag : f))
    );
  };

  const toggleExpanded = (flagKey: string) => {
    setExpandedKey((prev) => (prev === flagKey ? null : flagKey));
  };

  const isConfigurable = (flagKey: string) => CONFIGURABLE_FLAGS.includes(flagKey);

  // Group flags by category
  const flagsByCategory = useMemo(() => {
    const grouped: Record<FlagCategory, FeatureFlag[]> = {
      discovery: [],
      experience: [],
      social: [],
      voice: [],
      system: [],
    };

    flags.forEach((flag) => {
      const category = FLAG_CATEGORIES[flag.flagKey];
      if (category) {
        grouped[category].push(flag);
      }
    });

    return grouped;
  }, [flags]);

  // Count enabled flags per category
  const enabledByCategory = useMemo(() => {
    const counts: Record<FlagCategory | "all", { enabled: number; total: number }> = {
      all: { enabled: 0, total: 0 },
      discovery: { enabled: 0, total: 0 },
      experience: { enabled: 0, total: 0 },
      social: { enabled: 0, total: 0 },
      voice: { enabled: 0, total: 0 },
      system: { enabled: 0, total: 0 },
    };

    flags.forEach((flag) => {
      const category = FLAG_CATEGORIES[flag.flagKey];
      if (category) {
        counts[category].total++;
        counts.all.total++;
        if (flag.enabled) {
          counts[category].enabled++;
          counts.all.enabled++;
        }
      }
    });

    return counts;
  }, [flags]);

  // Filter flags based on active category and search query
  const filteredFlags = useMemo(() => {
    let result = activeCategory === "all" ? flags : flagsByCategory[activeCategory];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((flag) => {
        const categoryLabel = CATEGORIES.find(
          (c) => c.key === FLAG_CATEGORIES[flag.flagKey]
        )?.label.toLowerCase();

        return (
          flag.label.toLowerCase().includes(query) ||
          (flag.description?.toLowerCase().includes(query) ?? false) ||
          (categoryLabel?.includes(query) ?? false)
        );
      });
    }

    return result;
  }, [flags, flagsByCategory, activeCategory, searchQuery]);

  if (isLoading && flags.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-[#a39e98]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-[#e5e3de] pb-6 dark:border-[#3d3a36]">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Admin / Settings</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
            Feature Toggles
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            {enabledByCategory.all.enabled}/{enabledByCategory.all.total} Active
          </p>
          <button
            onClick={loadFlags}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Search and Category Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a39e98]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-64 rounded-xl border-none bg-white pl-10 pr-4 text-sm text-[#2d2a26] placeholder:text-[#a39e98] focus:outline-none focus:ring-1 focus:ring-[#c9a55c] dark:bg-[#252320] dark:text-[#f5f3ee]"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            activeCategory === "all"
              ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
              : "text-[#6b6560] hover:bg-white dark:text-[#a39e98] dark:hover:bg-[#252320]"
          )}
        >
          All
          <span className={cn(
            "rounded-full px-2 py-0.5 text-xs tabular-nums",
            activeCategory === "all"
              ? "bg-[#1a1917] text-[#a39e98] dark:bg-[#e5e3de] dark:text-[#6b6560]"
              : "bg-[#e5e3de] text-[#6b6560] dark:bg-[#3d3a36] dark:text-[#a39e98]"
          )}>
            {enabledByCategory.all.enabled}/{enabledByCategory.all.total}
          </span>
        </button>

        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            onClick={() => setActiveCategory(category.key)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              activeCategory === category.key
                ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                : "text-[#6b6560] hover:bg-white dark:text-[#a39e98] dark:hover:bg-[#252320]"
            )}
            title={category.description}
          >
            {category.icon}
            {category.label}
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs tabular-nums",
              activeCategory === category.key
                ? "bg-[#1a1917] text-[#a39e98] dark:bg-[#e5e3de] dark:text-[#6b6560]"
                : "bg-[#e5e3de] text-[#6b6560] dark:bg-[#3d3a36] dark:text-[#a39e98]"
            )}>
              {enabledByCategory[category.key].enabled}/{enabledByCategory[category.key].total}
            </span>
          </button>
        ))}
        </div>
      </div>

      {/* Category Description */}
      {activeCategory !== "all" && (
        <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
          {CATEGORIES.find((c) => c.key === activeCategory)?.description}
        </p>
      )}

      {/* Flags Table */}
      {filteredFlags.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl bg-white dark:bg-[#252320]">
          <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
            {searchQuery ? "No flags match your search" : "No flags in this category"}
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
              <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">#</th>
              <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Feature</th>
              <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Description</th>
              <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Status</th>
              <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Toggle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
            {filteredFlags.map((flag, idx) => (
              <tr key={flag.flagKey} className="group">
                <td
                  colSpan={5}
                  className={cn("p-0", flag.enabled && "bg-[#f5f3ee]/50 dark:bg-[#252320]/50")}
                >
                  {/* Main row content */}
                  <div className="flex items-center py-5">
                    <div className="w-12 font-mono text-sm tabular-nums text-[#a39e98]">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                      <div className="flex items-center gap-2">
                        {flag.label}
                        {activeCategory === "all" && (
                          <span className="rounded bg-[#f5f3ee] px-1.5 py-0.5 text-xs font-normal text-[#6b6560] dark:bg-[#3d3a36] dark:text-[#a39e98]">
                            {CATEGORIES.find((c) => c.key === FLAG_CATEGORIES[flag.flagKey])?.label}
                          </span>
                        )}
                        {isConfigurable(flag.flagKey) && (
                          <button
                            onClick={() => toggleExpanded(flag.flagKey)}
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-normal text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36] dark:hover:text-[#a39e98]"
                            aria-label={`Configure ${flag.label}`}
                            aria-expanded={expandedKey === flag.flagKey}
                          >
                            <Settings className="h-3 w-3" />
                            Configure
                            {expandedKey === flag.flagKey ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 text-sm text-[#6b6560] dark:text-[#a39e98]">
                      {flag.description || "—"}
                    </div>
                    <div className="w-24">
                      {flag.enabled ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-[#2d2a26] dark:text-[#f5f3ee]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          On
                        </span>
                      ) : (
                        <span className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                          Off
                        </span>
                      )}
                    </div>
                    <div className="w-16 text-right">
                      <button
                        onClick={() => handleToggle(flag)}
                        disabled={updatingKey === flag.flagKey}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          flag.enabled
                            ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
                            : "bg-[#e5e3de] dark:bg-[#3d3a36]",
                          updatingKey === flag.flagKey && "cursor-wait opacity-50"
                        )}
                        role="switch"
                        aria-checked={flag.enabled}
                        aria-label={`Toggle ${flag.label}`}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full transition-all",
                            flag.enabled
                              ? "left-[22px] bg-white dark:bg-[#2d2a26]"
                              : "left-0.5 bg-white dark:bg-[#6b6560]"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expandable config panel */}
                  {expandedKey === flag.flagKey && flag.flagKey === "visitor_voice_agent" && (
                    <div className="border-t border-[#f5f3ee] px-12 pb-6 dark:border-[#3d3a36]">
                      <VisitorVoiceConfigPanel
                        flag={flag}
                        onUpdate={handleFlagUpdate}
                      />
                    </div>
                  )}
                  {expandedKey === flag.flagKey && flag.flagKey.endsWith("_agent_enabled") && (
                    <div className="border-t border-[#f5f3ee] px-12 pb-6 dark:border-[#3d3a36]">
                      <AgentConfigPanel
                        flag={flag}
                        onUpdate={handleFlagUpdate}
                      />
                    </div>
                  )}
                  {expandedKey === flag.flagKey && flag.flagKey === "maintenance_mode" && (
                    <div className="border-t border-[#f5f3ee] px-12 pb-6 dark:border-[#3d3a36]">
                      <MaintenanceConfigPanel
                        flag={flag}
                        onUpdate={handleFlagUpdate}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        Changes propagate to all visitors within 1 minute
      </p>
    </div>
  );
}
