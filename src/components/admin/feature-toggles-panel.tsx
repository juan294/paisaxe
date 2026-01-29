"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";
import { RefreshCw, AlertCircle, ChevronDown, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/feature-flags";
import { VisitorVoiceConfigPanel } from "./visitor-voice-config-panel";

// Flags that have configurable settings
const CONFIGURABLE_FLAGS = ["visitor_voice_agent"];

export function FeatureTogglesPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const enabledCount = flags.filter((f) => f.enabled).length;

  if (isLoading && flags.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-stone-300" />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-stone-200 pb-6 dark:border-stone-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">Admin / Settings</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-stone-900 dark:text-stone-100">
            Feature Toggles
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
            {enabledCount}/{flags.length} Active
          </p>
          <button
            onClick={loadFlags}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 disabled:opacity-50 dark:hover:text-stone-100"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Flags Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-200 text-left dark:border-stone-800">
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">#</th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Feature</th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Description</th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Status</th>
            <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-stone-400">Toggle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {flags.map((flag, idx) => (
            <tr key={flag.flagKey} className="group">
              <td
                colSpan={5}
                className={cn("p-0", flag.enabled && "bg-stone-50 dark:bg-stone-900/50")}
              >
                {/* Main row content */}
                <div className="flex items-center py-5">
                  <div className="w-12 font-mono text-sm tabular-nums text-stone-300">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 text-sm font-medium text-stone-900 dark:text-stone-100">
                    <div className="flex items-center gap-2">
                      {flag.label}
                      {isConfigurable(flag.flagKey) && (
                        <button
                          onClick={() => toggleExpanded(flag.flagKey)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-normal text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
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
                  <div className="flex-1 text-sm text-stone-500">
                    {flag.description || "—"}
                  </div>
                  <div className="w-24">
                    {flag.enabled ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-stone-900 dark:text-stone-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        On
                      </span>
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-widest text-stone-300">
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
                          ? "bg-stone-900 dark:bg-stone-100"
                          : "bg-stone-200 dark:bg-stone-800",
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
                            ? "left-[22px] bg-white dark:bg-stone-900"
                            : "left-0.5 bg-white dark:bg-stone-600"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Expandable config panel */}
                {expandedKey === flag.flagKey && flag.flagKey === "visitor_voice_agent" && (
                  <div className="border-t border-stone-100 px-12 pb-6 dark:border-stone-800">
                    <VisitorVoiceConfigPanel
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

      <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
        Changes propagate to all visitors within 1 minute
      </p>
    </div>
  );
}
