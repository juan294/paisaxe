"use client";

import { Fragment } from "react";
import {
  RefreshCw,
  AlertCircle,
  Settings,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VisitorVoiceConfigPanel } from "./visitor-voice-config-panel";
import { MaintenanceConfigPanel } from "./maintenance-config-panel";
import { TunnelTableRow } from "./tunnel-control-panel";

import { CATEGORIES } from "./feature-toggles-panel/categories";
import { useFeatureToggles } from "./feature-toggles-panel/use-feature-toggles";

export function FeatureTogglesPanel() {
  const {
    flags,
    isLoading,
    error,
    updatingKey,
    expandedKey,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    setTunnelRunning,
    loadFlags,
    handleToggle,
    handleFlagUpdate,
    toggleExpanded,
    isConfigurable,
    enabledByCategory,
    filteredFlags,
  } = useFeatureToggles();

  if (isLoading && flags.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-admin-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-admin-line pb-6 dark:border-admin-depth">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">Admin / Settings</p>
          <h2 className="mt-2 text-4xl font-extralight tracking-tight text-admin-ink dark:text-admin-paper">
            Features
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            {enabledByCategory.all.enabled}/{enabledByCategory.all.total} Active
          </p>
          <button
            onClick={loadFlags}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:text-admin-ink disabled:opacity-50 dark:text-admin-subtle dark:hover:text-admin-paper"
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
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-subtle" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-48 rounded-xl border-none bg-white pl-10 pr-4 text-sm text-admin-ink placeholder:text-admin-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-warning dark:bg-admin-panel dark:text-admin-paper"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                activeCategory === category.key
                  ? "bg-admin-ink text-admin-paper dark:bg-admin-paper dark:text-admin-ink"
                  : "text-admin-muted hover:bg-white dark:text-admin-subtle dark:hover:bg-admin-panel"
              )}
              title={category.description}
            >
              {category.icon}
              {category.label}
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs tabular-nums",
                activeCategory === category.key
                  ? "bg-admin-canvas-dark text-admin-subtle dark:bg-admin-line dark:text-admin-muted"
                  : "bg-admin-line text-admin-muted dark:bg-admin-depth dark:text-admin-subtle"
              )}>
                {enabledByCategory[category.key].enabled}/{enabledByCategory[category.key].total}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Description */}
      <p className="text-sm text-admin-muted dark:text-admin-subtle">
        {CATEGORIES.find((c) => c.key === activeCategory)?.description}
      </p>

      {/* Flags Table */}
      {filteredFlags.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl bg-white dark:bg-admin-panel">
          <p className="text-sm text-admin-muted dark:text-admin-subtle">
            {searchQuery ? "No flags match your search" : "No flags in this category"}
          </p>
        </div>
      ) : (
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-admin-line text-left dark:border-admin-depth">
              <th className="w-12 pb-3 text-center font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">#</th>
              <th className="w-[240px] pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                {activeCategory === "system" ? "Setting" : "Feature"}
              </th>
              <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">Description</th>
              <th className="w-20 pb-3 text-center font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">Status</th>
              <th className="w-16 pb-3 text-center font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">Toggle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
            {filteredFlags.map((flag, idx) => (
              <Fragment key={flag.flagKey}>
                <tr className={cn("group", flag.enabled && "bg-admin-paper/50 dark:bg-admin-panel/50")}>
                  <td className="py-5 text-center align-top font-mono text-sm tabular-nums text-admin-subtle">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="py-5 align-top">
                    <div className="flex items-center gap-2 text-sm font-medium text-admin-ink dark:text-admin-paper">
                      {flag.label}
                      {isConfigurable(flag.flagKey) && (
                        <button
                          onClick={() => toggleExpanded(flag.flagKey)}
                          className="inline-flex items-center gap-1 rounded p-1 text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted dark:hover:bg-admin-depth dark:hover:text-admin-subtle"
                          aria-label={`Configure ${flag.label}`}
                          aria-expanded={expandedKey === flag.flagKey}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-5 pr-4 align-top text-sm text-admin-muted dark:text-admin-subtle">
                    {flag.description || "—"}
                  </td>
                  <td className="py-5 text-center align-top">
                    {flag.enabled ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-admin-ink dark:text-admin-paper">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        On
                      </span>
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
                        Off
                      </span>
                    )}
                  </td>
                  <td className="py-5 text-center align-top">
                    <button
                      onClick={() => handleToggle(flag)}
                      disabled={updatingKey === flag.flagKey}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        flag.enabled
                          ? "bg-admin-ink dark:bg-admin-paper"
                          : "bg-admin-line dark:bg-admin-depth",
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
                            ? "left-[22px] bg-white dark:bg-admin-ink"
                            : "left-0.5 bg-white dark:bg-admin-muted"
                        )}
                      />
                    </button>
                  </td>
                </tr>
                {/* Expandable config panel row */}
                {expandedKey === flag.flagKey && (
                  <tr className={cn(flag.enabled && "bg-admin-paper/50 dark:bg-admin-panel/50")}>
                    <td colSpan={6} className="px-12 pb-6">
                      {flag.flagKey === "visitor_voice_agent" && (
                        <VisitorVoiceConfigPanel
                          flag={flag}
                          onUpdate={handleFlagUpdate}
                        />
                      )}
                      {flag.flagKey === "maintenance_mode" && (
                        <MaintenanceConfigPanel
                          flag={flag}
                          onUpdate={handleFlagUpdate}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {/* Dev Tunnel row (System category only, development only) */}
            {activeCategory === "system" && (
              <TunnelTableRow rowNumber={filteredFlags.length + 1} onRunningChange={setTunnelRunning} />
            )}
          </tbody>
        </table>
      )}

      <p className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
        Changes propagate to all visitors within 1 minute
      </p>
    </div>
  );
}
