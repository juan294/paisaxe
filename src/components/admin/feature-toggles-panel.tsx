"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/feature-flags";

interface FeatureTogglesPanelProps {
  adminKey: string;
}

export function FeatureTogglesPanel({ adminKey }: FeatureTogglesPanelProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await fetchFeatureFlags(adminKey);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setFlags(result.data);
    }
    setIsLoading(false);
  }, [adminKey]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdatingKey(flag.flagKey);
    const result = await updateFeatureFlag(adminKey, flag.flagKey, !flag.enabled);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setFlags((prev) =>
        prev.map((f) => (f.flagKey === flag.flagKey ? result.data! : f))
      );
    }
    setUpdatingKey(null);
  };

  if (isLoading && flags.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">Loading feature flags...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Feature Toggles
        </h2>
        <button
          onClick={loadFlags}
          disabled={isLoading}
          className="p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        {flags.map((flag) => (
          <div
            key={flag.flagKey}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {flag.label}
              </h3>
              {flag.description && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  {flag.description}
                </p>
              )}
            </div>
            <button
              onClick={() => handleToggle(flag)}
              disabled={updatingKey === flag.flagKey}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2",
                flag.enabled ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600",
                updatingKey === flag.flagKey && "opacity-50 cursor-wait"
              )}
              role="switch"
              aria-checked={flag.enabled}
              aria-label={`Toggle ${flag.label}`}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  flag.enabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Changes take effect within 1 minute for all visitors.
      </p>
    </div>
  );
}
