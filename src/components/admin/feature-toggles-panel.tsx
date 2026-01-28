"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";
import { RefreshCw, AlertCircle, ToggleRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/feature-flags";

export function FeatureTogglesPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

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

  const enabledCount = flags.filter((f) => f.enabled).length;

  if (isLoading && flags.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
        <RefreshCw className="h-6 w-6 animate-spin text-[#a39e98]" />
        <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">Loading feature flags...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            Feature Toggles
          </h2>
          <p className="mt-1 text-[#6b6560] dark:text-[#a39e98]">
            Control feature availability across the site
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 dark:bg-[#252320]">
            <Zap className="h-4 w-4 text-[#c9a55c]" />
            <span className="text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">
              {enabledCount}/{flags.length} active
            </span>
          </div>
          <button
            onClick={loadFlags}
            disabled={isLoading}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
              "text-[#6b6560] hover:bg-white hover:text-[#2d2a26]",
              "dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]",
              "disabled:opacity-50"
            )}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#c9a55c]/10 px-5 py-4 text-sm text-[#8b6c2e] dark:bg-[#c9a55c]/20 dark:text-[#d4b876]">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Flags list */}
      <div className="overflow-hidden rounded-3xl bg-white dark:bg-[#252320]">
        <div className="divide-y divide-[#f5f3ee] dark:divide-[#2d2a26]">
          {flags.map((flag) => (
            <div
              key={flag.flagKey}
              className={cn(
                "flex items-center justify-between p-5 transition-colors",
                flag.enabled && "bg-[#7a9e7a]/5 dark:bg-[#7a9e7a]/10"
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className={cn(
                  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-colors",
                  flag.enabled
                    ? "bg-[#7a9e7a]/10 text-[#7a9e7a] dark:bg-[#7a9e7a]/20"
                    : "bg-[#f5f3ee] text-[#a39e98] dark:bg-[#2d2a26]"
                )}>
                  <ToggleRight className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                    {flag.label}
                  </h3>
                  {flag.description && (
                    <p className="mt-0.5 truncate text-sm text-[#6b6560] dark:text-[#a39e98]">
                      {flag.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => handleToggle(flag)}
                disabled={updatingKey === flag.flagKey}
                className={cn(
                  "relative ml-4 inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
                  flag.enabled
                    ? "bg-[#7a9e7a]"
                    : "bg-[#e5e3de] dark:bg-[#3d3a36]",
                  updatingKey === flag.flagKey && "cursor-wait opacity-50"
                )}
                role="switch"
                aria-checked={flag.enabled}
                aria-label={`Toggle ${flag.label}`}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                    flag.enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Note */}
      <p className="text-sm text-[#a39e98]">
        Changes take effect within 1 minute for all visitors.
      </p>
    </div>
  );
}
