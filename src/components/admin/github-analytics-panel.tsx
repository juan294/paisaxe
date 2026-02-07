"use client";

import { useState, useCallback } from "react";
import { fetchGithubAnalytics, syncGithubTraffic } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import {
  AlertCircle,
  GitBranch,
  Eye,
  Download,
  Globe,
  FileText,
  RefreshCw,
} from "lucide-react";
import type {
  GitHubAnalyticsDashboardData,
  GitHubTrafficDaily,
  GitHubTrafficReferrer,
  GitHubTrafficPath,
} from "@/types/github-analytics";

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
        <h2 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          GitHub Traffic
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-[#6b6560] dark:text-[#a39e98]">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="bg-transparent outline-none"
            />
            <span>—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="bg-transparent outline-none"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
          >
            {isLoading ? "Loading..." : isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Last synced + sync error */}
      {data?.lastSyncedAt && (
        <p className="font-mono text-xs text-[#a39e98]">
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
          <GitBranch className="h-8 w-8 text-[#e5e3de]" />
          <p className="text-xl font-extralight text-[#a39e98]">No traffic data yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
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

// ============================================================================
// Sub-components
// ============================================================================

interface StatCardProps {
  value: number | string;
  label: string;
  suffix?: string;
  icon: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "violet" | "stone";
}

const statColorClasses: Record<string, { value: string; icon: string }> = {
  blue: {
    value: "text-blue-600 dark:text-blue-400",
    icon: "text-blue-500 dark:text-blue-400",
  },
  emerald: {
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-500 dark:text-emerald-400",
  },
  amber: {
    value: "text-amber-600 dark:text-amber-400",
    icon: "text-amber-500 dark:text-amber-400",
  },
  violet: {
    value: "text-violet-600 dark:text-violet-400",
    icon: "text-violet-500 dark:text-violet-400",
  },
  stone: {
    value: "text-[#6b6560] dark:text-[#a39e98]",
    icon: "text-[#a39e98]",
  },
};

function StatCard({ value, label, suffix, icon, color = "stone" }: StatCardProps) {
  const colors = statColorClasses[color] || statColorClasses.stone;
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${colors.icon}`}>
        {icon}
        <span className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">{label}</span>
      </div>
      <p className={`text-3xl font-extralight tabular-nums tracking-tight ${colors.value}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="ml-1 text-lg text-[#a39e98]">{suffix}</span>}
      </p>
    </div>
  );
}

function TrafficChart({ daily }: { daily: GitHubTrafficDaily[] }) {
  if (daily.length === 0) return null;

  const maxViews = Math.max(...daily.map((d) => d.views), 1);
  const maxClones = Math.max(...daily.map((d) => d.clones), 1);
  const maxVal = Math.max(maxViews, maxClones);

  const chartWidth = 600;
  const chartHeight = 160;
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const w = chartWidth - padding.left - padding.right;
  const h = chartHeight - padding.top - padding.bottom;

  const xStep = daily.length > 1 ? w / (daily.length - 1) : w;

  const viewsPath = daily
    .map((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + h - (d.views / maxVal) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const clonesPath = daily
    .map((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + h - (d.clones / maxVal) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Show ~5 x-axis labels
  const labelInterval = Math.max(1, Math.floor(daily.length / 5));

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        Daily Traffic
      </h3>
      <div className="flex items-center gap-6 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 bg-blue-500" />
          <span className="font-mono text-xs text-[#a39e98]">Views</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 bg-emerald-500" />
          <span className="font-mono text-xs text-[#a39e98]">Clones</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={padding.left}
            y1={padding.top + h * (1 - frac)}
            x2={chartWidth - padding.right}
            y2={padding.top + h * (1 - frac)}
            stroke="currentColor"
            className="text-[#e5e3de] dark:text-[#3d3a36]"
            strokeWidth={0.5}
          />
        ))}

        {/* Views line */}
        <path d={viewsPath} fill="none" stroke="#3b82f6" strokeWidth={2} />

        {/* Clones line */}
        <path d={clonesPath} fill="none" stroke="#10b981" strokeWidth={2} />

        {/* X-axis date labels */}
        {daily.map((d, i) =>
          i % labelInterval === 0 || i === daily.length - 1 ? (
            <text
              key={d.date}
              x={padding.left + i * xStep}
              y={chartHeight - 5}
              textAnchor="middle"
              className="fill-[#a39e98] font-mono"
              fontSize={9}
            >
              {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </text>
          ) : null
        )}
      </svg>
    </section>
  );
}

function ReferrersTable({ number, referrers }: { number: string; referrers: GitHubTrafficReferrer[] }) {
  if (referrers.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          {number} — Top Referrers
        </h3>
        <p className="py-6 text-center font-mono text-xs text-[#a39e98]">No referrer data</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — Top Referrers
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              <Globe className="inline h-3 w-3 mr-1" />
              Referrer
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Unique
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Views
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {referrers.map((ref, idx) => (
            <tr key={ref.referrer}>
              <td className="py-2 font-mono text-sm tabular-nums text-[#a39e98]">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
                {ref.referrer}
              </td>
              <td className="py-2 text-right font-mono text-xs tabular-nums text-violet-500 dark:text-violet-400">
                {ref.uniques.toLocaleString()}
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {ref.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PathsTable({ number, paths }: { number: string; paths: GitHubTrafficPath[] }) {
  if (paths.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          {number} — Popular Paths
        </h3>
        <p className="py-6 text-center font-mono text-xs text-[#a39e98]">No path data</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — Popular Paths
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              <FileText className="inline h-3 w-3 mr-1" />
              Path
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Unique
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Views
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {paths.map((p, idx) => (
            <tr key={p.path}>
              <td className="py-2 font-mono text-sm tabular-nums text-[#a39e98]">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
                <span className="font-mono text-xs">{p.path}</span>
                {p.title && (
                  <span className="ml-2 text-xs text-[#a39e98]">({p.title})</span>
                )}
              </td>
              <td className="py-2 text-right font-mono text-xs tabular-nums text-violet-500 dark:text-violet-400">
                {p.uniques.toLocaleString()}
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {p.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================================
// Skeleton Components
// ============================================================================

function SkeletonGitHubDashboard() {
  return (
    <>
      <section className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
        {["blue", "violet", "emerald", "amber", "stone"].map((color) => (
          <div key={color} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
            </div>
            <div className="h-9 w-16 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          Daily Traffic
        </h3>
        <div className="h-40 w-full animate-pulse rounded bg-[#f5f3ee] dark:bg-[#3d3a36]" />
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <SkeletonTable number="01" title="Top Referrers" />
        <SkeletonTable number="02" title="Popular Paths" />
      </div>
    </>
  );
}

function SkeletonTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Name</th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {[1, 2, 3].map((idx) => (
            <tr key={idx}>
              <td className="py-2 font-mono text-sm tabular-nums text-[#a39e98]">
                {String(idx).padStart(2, "0")}
              </td>
              <td className="py-2">
                <div
                  className="h-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]"
                  style={{ width: `${65 - idx * 10}%` }}
                />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-10 animate-pulse rounded bg-sky-200 dark:bg-sky-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
