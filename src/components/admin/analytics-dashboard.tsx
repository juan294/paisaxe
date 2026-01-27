"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics } from "@/lib/admin-api";
import { RefreshCw, AlertCircle, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyticsDashboardData, FeatureAnalytics } from "@/types/analytics";

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const fromISO = new Date(dateRange.from).toISOString();
    const toISO = new Date(dateRange.to + "T23:59:59").toISOString();

    const result = await fetchAnalytics(fromISO, toISO);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }
    setIsLoading(false);
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxEventCount = data?.summary.featureBreakdown.reduce(
    (max, f) => Math.max(max, f.eventCount),
    0
  ) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Analytics
        </h2>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">From</label>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
          className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
        />
        <label className="text-xs text-neutral-500 dark:text-neutral-400">To</label>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
          className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
          <p className="mt-3 text-sm text-neutral-500">Loading analytics...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Total Events</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {data.summary.totalEvents.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Unique Sessions</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {data.summary.totalSessions.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Per-feature usage table */}
          {data.summary.featureBreakdown.length > 0 ? (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Per-Feature Usage
                </h3>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {data.summary.featureBreakdown
                  .sort((a, b) => b.eventCount - a.eventCount)
                  .map((feature: FeatureAnalytics) => (
                    <div key={feature.featureFlag} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {feature.featureFlag}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                          <span>{feature.eventCount} events</span>
                          <span>{feature.uniqueSessions} sessions</span>
                        </div>
                      </div>
                      {/* CSS bar chart */}
                      <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${(feature.eventCount / maxEventCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No analytics events recorded in this date range.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
