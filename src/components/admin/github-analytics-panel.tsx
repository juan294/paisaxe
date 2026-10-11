"use client";

import { useState, useCallback } from "react";
import { fetchGithubAnalytics, syncGithubTraffic } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import {
  AlertCircle,
  GitBranch,
  Eye,
  Download,
  RefreshCw,
} from "lucide-react";
import type {
  GitHubAnalyticsDashboardData,
} from "@/types/github-analytics";

import { StatCard, TrafficChart } from "./github-analytics-panel/chart";
import { ReferrersTable, PathsTable } from "./github-analytics-panel/tables";
import { SkeletonGitHubDashboard } from "./github-analytics-panel/skeletons";

export function GitHubAnalyticsPanel() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const fromISO = dateRange.from;
  const toISO = dateRange.to;

  const params = JSON.stringify({ from: dateRange.from, to: dateRange.to });
  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "github",
    useCallback(() => fetchGithubAnalytics(fromISO, toISO), [fromISO, toISO]),
    params
  );

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError("");
    const result = await syncGithubTraffic();
    setIsSyncing(false);
    if (result.error) {
      setSyncError(result.error);
    } else {
      refresh();
    }
  };

  return (
    <div className="space-y-12">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
          GitHub Traffic
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-admin-muted dark:text-admin-subtle">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="bg-transparent outline-none rounded focus-visible:ring-1 focus-visible:ring-white/40"
            />
            <span>—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="bg-transparent outline-none rounded focus-visible:ring-1 focus-visible:ring-white/40"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            aria-label="Sync GitHub data"
            className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:text-admin-ink disabled:opacity-50 dark:text-admin-subtle dark:hover:text-admin-paper"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:text-admin-ink disabled:opacity-50 dark:text-admin-subtle dark:hover:text-admin-paper"
          >
            {isLoading ? "Loading..." : isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Last synced + sync error */}
      {data?.lastSyncedAt && (
        <p className="font-mono text-xs text-admin-subtle">
          Last synced: {new Date(data.lastSyncedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      {syncError && (
        <div className="flex items-center gap-3 font-mono text-xs text-amber-600">
          <AlertCircle className="h-4 w-4" />
          Sync failed: {syncError}
        </div>
      )}

      {isRefreshing && (
        <div className="h-0.5 w-full animate-pulse rounded-full bg-blue-500/30" />
      )}

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <SkeletonGitHubDashboard />
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
          <GitBranch className="h-8 w-8 text-admin-line" />
          <p className="text-xl font-extralight text-admin-subtle">No traffic data yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
            Click &quot;Sync Now&quot; to fetch data from GitHub
          </p>
        </div>
      ) : data ? (
        <>
          {/* Summary Stats */}
          <section className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              value={data.summary.totalViews}
              label="Total Views"
              icon={<Eye className="h-4 w-4" />}
              color="blue"
            />
            <StatCard
              value={data.summary.totalUniqueViews}
              label="Unique Visitors"
              icon={<Eye className="h-4 w-4" />}
              color="violet"
            />
            <StatCard
              value={data.summary.totalClones}
              label="Total Clones"
              icon={<Download className="h-4 w-4" />}
              color="emerald"
            />
            <StatCard
              value={data.summary.totalUniqueClones}
              label="Unique Cloners"
              icon={<Download className="h-4 w-4" />}
              color="amber"
            />
            <StatCard
              value={data.summary.dataPointCount}
              label="Days Tracked"
              suffix="days"
              icon={<GitBranch className="h-4 w-4" />}
              color="stone"
            />
          </section>

          {/* Daily Traffic Chart */}
          {data.daily.length > 0 && (
            <TrafficChart daily={data.daily} />
          )}

          {/* Breakdown Tables */}
          <div className="grid gap-12 lg:grid-cols-2">
            <ReferrersTable
              number="01"
              referrers={data.referrers}
            />
            <PathsTable
              number="02"
              paths={data.popularPaths}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function isEmptyData(data: GitHubAnalyticsDashboardData): boolean {
  return (
    data.summary.totalViews === 0 &&
    data.summary.totalClones === 0 &&
    data.daily.length === 0
  );
}
