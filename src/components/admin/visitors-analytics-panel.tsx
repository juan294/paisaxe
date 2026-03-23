"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import { AlertCircle } from "lucide-react";
import type {
  AnalyticsDashboardData,
  TimeSeriesPoint,
  TopPage,
  TopReferrer,
  CountryBreakdown,
  CityBreakdown,
  DeviceBreakdown,
  BrowserBreakdown,
  OSBreakdown,
  ScreenSizeBreakdown,
  EntryPageBreakdown,
  ExitPageBreakdown,
  UTMBreakdown,
} from "@/types/analytics";

// Storage key for persisting dev toggle preference
const DEV_TOGGLE_KEY = "admin:visitors:includeLocalhost";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function getStoredDevToggle(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(DEV_TOGGLE_KEY);
  // If no stored preference, default to ON for localhost, OFF for production
  if (stored === null) {
    return isLocalhost();
  }
  return stored === "true";
}

export function VisitorsAnalyticsPanel() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [includeLocalhost, setIncludeLocalhost] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  // Initialize from localStorage on mount (client-side only)
  useEffect(() => {
    const storedValue = getStoredDevToggle();
    setIncludeLocalhost(storedValue);
    setIsInitialized(true);
  }, []);

  // Persist dev toggle preference to localStorage (skip initial mount)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(DEV_TOGGLE_KEY, String(includeLocalhost));
    }
  }, [includeLocalhost, isInitialized]);

  const fromISO = new Date(dateRange.from).toISOString();
  const toISO = new Date(dateRange.to + "T23:59:59").toISOString();

  const params = JSON.stringify({ from: dateRange.from, to: dateRange.to, includeLocalhost });
  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "visitors",
    useCallback(() => fetchAnalytics(fromISO, toISO, includeLocalhost), [fromISO, toISO, includeLocalhost]),
    params,
    { enabled: isInitialized }
  );

  return (
    <div className="space-y-12">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Visitor Data
        </h2>
        <div className="flex items-center gap-6">
          {/* Localhost toggle */}
          <label htmlFor="dev-toggle" className="flex cursor-pointer items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Dev
            </span>
            <button
              id="dev-toggle"
              type="button"
              role="switch"
              aria-checked={includeLocalhost}
              onClick={() => setIncludeLocalhost((prev) => !prev)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                includeLocalhost
                  ? "bg-amber-500"
                  : "bg-[#d5d3ce] dark:bg-[#4d4944]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  includeLocalhost ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </label>
          <div className="flex items-center gap-2 font-mono text-xs text-[#6b6560] dark:text-[#a39e98]">
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
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
          >
            {isLoading ? "Loading..." : isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

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
        <SkeletonDashboard />
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
          <p className="text-2xl font-extralight text-[#a39e98]">No data yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Visitor data will appear here once browsing begins
          </p>
        </div>
      ) : data ? (
        <>
          {/* Large Stats */}
          <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
            <StatCard value={data.summary.totalPageviews} label="Pageviews" color="blue" />
            <StatCard value={data.summary.uniqueVisitors} label="Visitors" color="emerald" />
            <StatCard value={data.summary.totalSessions} label="Sessions" color="amber" />
            <StatCard value={`${data.summary.bounceRate}%`} label="Bounce Rate" color="rose" />
          </section>

          {/* Time Series Chart */}
          {data.timeSeries.length > 0 && (
            <section>
              <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                Traffic Over Time
              </h2>
              <TimeSeriesChart data={data.timeSeries} />
            </section>
          )}

          {/* Data Tables - Two Column Grid */}
          <div className="grid gap-16 lg:grid-cols-2">
            <DataTable
              number="01"
              title="Top Pages"
              items={data.topPages}
              renderItem={(item: TopPage) => formatUrl(item.url)}
              getCount={(item: TopPage) => item.count}
            />
            <DataTable
              number="02"
              title="Top Referrers"
              items={data.topReferrers}
              renderItem={(item: TopReferrer) => formatUrl(item.referrer)}
              getCount={(item: TopReferrer) => item.count}
            />
          </div>

          {/* UTM Campaigns */}
          {data.utmCampaigns.length > 0 && (
            <section>
              <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                03 — UTM Campaigns
              </h2>
              <UTMTable items={data.utmCampaigns} />
            </section>
          )}

          {/* Geography */}
          <div className="grid gap-16 lg:grid-cols-2">
            <DataTable
              number="04"
              title="Countries"
              items={data.countries}
              renderItem={(item: CountryBreakdown) => item.country}
              getCount={(item: CountryBreakdown) => item.count}
            />
            <DataTable
              number="05"
              title="Cities"
              items={data.cities}
              renderItem={(item: CityBreakdown) => `${item.city}, ${item.country}`}
              getCount={(item: CityBreakdown) => item.count}
            />
          </div>

          {/* Technology */}
          <div className="grid gap-16 lg:grid-cols-2">
            <DataTable
              number="06"
              title="Devices"
              items={data.devices}
              renderItem={(item: DeviceBreakdown) => item.device}
              getCount={(item: DeviceBreakdown) => item.count}
            />
            <DataTable
              number="07"
              title="Browsers"
              items={data.browsers}
              renderItem={(item: BrowserBreakdown) => item.browser}
              getCount={(item: BrowserBreakdown) => item.count}
            />
          </div>

          <div className="grid gap-16 lg:grid-cols-2">
            <DataTable
              number="08"
              title="Operating Systems"
              items={data.operatingSystems}
              renderItem={(item: OSBreakdown) => item.os}
              getCount={(item: OSBreakdown) => item.count}
            />
            <DataTable
              number="09"
              title="Screen Sizes"
              items={data.screenSizes}
              renderItem={(item: ScreenSizeBreakdown) => `${item.width} × ${item.height}`}
              getCount={(item: ScreenSizeBreakdown) => item.count}
            />
          </div>

          {/* Behavior */}
          <div className="grid gap-16 lg:grid-cols-2">
            <DataTable
              number="10"
              title="Entry Pages"
              items={data.entryPages}
              renderItem={(item: EntryPageBreakdown) => item.page}
              getCount={(item: EntryPageBreakdown) => item.count}
            />
            <DataTable
              number="11"
              title="Exit Pages"
              items={data.exitPages}
              renderItem={(item: ExitPageBreakdown) => item.page}
              getCount={(item: ExitPageBreakdown) => item.count}
            />
          </div>

          {/* New vs Returning */}
          <section>
            <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              12 — New vs Returning Visitors
            </h2>
            <NewVsReturningBar
              newVisitors={data.newVsReturning.newVisitors}
              returningVisitors={data.newVsReturning.returningVisitors}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function isEmptyData(data: AnalyticsDashboardData): boolean {
  return (
    data.summary.totalPageviews === 0 &&
    data.summary.uniqueVisitors === 0 &&
    data.summary.totalSessions === 0 &&
    data.topPages.length === 0 &&
    data.topReferrers.length === 0 &&
    data.countries.length === 0 &&
    data.devices.length === 0
  );
}

function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.hostname : `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

interface StatCardProps {
  value: number | string;
  label: string;
  color?: "blue" | "emerald" | "amber" | "rose";
}

const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

function StatCard({ value, label, color }: StatCardProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;
  const colorClass = color ? statColorClasses[color] : "text-[#2d2a26] dark:text-[#f5f3ee]";
  return (
    <div>
      <p className={`text-6xl font-extralight tabular-nums tracking-tighter lg:text-8xl ${colorClass}`}>
        {displayValue}
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {label}
      </p>
    </div>
  );
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (data.length === 0) return null;

  const maxPageviews = Math.max(...data.map((d) => d.pageviews));
  const maxVisitors = Math.max(...data.map((d) => d.visitors));
  const maxValue = Math.max(maxPageviews, maxVisitors, 1);

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xStep = chartWidth / Math.max(data.length - 1, 1);

  const pageviewsPath = data
    .map((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.pageviews / maxValue) * chartHeight;
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(" ");

  const visitorsPath = data
    .map((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.visitors / maxValue) * chartHeight;
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - ratio)}
            x2={width - padding.right}
            y2={padding.top + chartHeight * (1 - ratio)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
        ))}

        {/* Pageviews line (solid blue) */}
        <path d={pageviewsPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} />

        {/* Visitors line (emerald) */}
        <path d={visitorsPath} fill="none" stroke="#10b981" strokeWidth={2.5} />

        {/* Data points for pageviews */}
        {data.map((d, i) => (
          <circle
            key={`pv-${i}`}
            cx={padding.left + i * xStep}
            cy={padding.top + chartHeight - (d.pageviews / maxValue) * chartHeight}
            r={4}
            fill="#3b82f6"
          />
        ))}

        {/* Data points for visitors */}
        {data.map((d, i) => (
          <circle
            key={`v-${i}`}
            cx={padding.left + i * xStep}
            cy={padding.top + chartHeight - (d.visitors / maxValue) * chartHeight}
            r={4}
            fill="#10b981"
          />
        ))}

        {/* X-axis labels (dates) */}
        {data.map((d, i) => {
          // Only show every nth label to avoid crowding
          const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={`label-${i}`}
              x={padding.left + i * xStep}
              y={height - 8}
              textAnchor="middle"
              className="fill-[#a39e98] font-mono text-[10px]"
            >
              {formatDateShort(d.date)}
            </text>
          );
        })}

        {/* Y-axis labels */}
        <text
          x={padding.left - 10}
          y={padding.top + 4}
          textAnchor="end"
          className="fill-[#a39e98] font-mono text-[10px]"
        >
          {maxValue.toLocaleString()}
        </text>
        <text
          x={padding.left - 10}
          y={padding.top + chartHeight + 4}
          textAnchor="end"
          className="fill-[#a39e98] font-mono text-[10px]"
        >
          0
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-blue-500" />
          <span className="text-blue-600 dark:text-blue-400">Pageviews</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-emerald-500" />
          <span className="text-emerald-600 dark:text-emerald-400">Visitors</span>
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

interface DataTableProps<T> {
  number: string;
  title: string;
  items: T[];
  renderItem: (item: T) => string;
  getCount: (item: T) => number;
}

function DataTable<T>({ number, title, items, renderItem, getCount }: DataTableProps<T>) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          {number} — {title}
        </h2>
        <p className="py-8 text-center font-mono text-xs text-[#a39e98]">No data available</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {number} — {title}
      </h2>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              #
            </th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Name
            </th>
            <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-3 font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-3 text-sm capitalize text-[#4d4944] dark:text-[#a39e98]">
                {renderItem(item)}
              </td>
              <td className="py-3 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {getCount(item).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface UTMTableProps {
  items: UTMBreakdown[];
}

function UTMTable({ items }: UTMTableProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-[#a39e98]">No UTM data available</p>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            #
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Source
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Medium
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Campaign
          </th>
          <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Count
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
        {items.map((item, idx) => (
          <tr key={idx}>
            <td className="py-3 font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
              {String(idx + 1).padStart(2, "0")}
            </td>
            <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">{item.source}</td>
            <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">{item.medium}</td>
            <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">{item.campaign}</td>
            <td className="py-3 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
              {item.count.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface NewVsReturningBarProps {
  newVisitors: number;
  returningVisitors: number;
}

function NewVsReturningBar({ newVisitors, returningVisitors }: NewVsReturningBarProps) {
  const total = newVisitors + returningVisitors;
  if (total === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-[#a39e98]">No visitor data available</p>
    );
  }

  const newPercent = Math.round((newVisitors / total) * 100);
  const returningPercent = 100 - newPercent;

  return (
    <div className="space-y-4">
      {/* Bar */}
      <div className="flex h-10 overflow-hidden rounded">
        <div
          className="flex items-center justify-center bg-violet-500 text-xs font-medium text-white transition-all dark:bg-violet-400"
          style={{ width: `${newPercent}%` }}
        >
          {newPercent > 10 && `${newPercent}%`}
        </div>
        <div
          className="flex items-center justify-center bg-teal-500 text-xs font-medium text-white transition-all dark:bg-teal-400"
          style={{ width: `${returningPercent}%` }}
        >
          {returningPercent > 10 && `${returningPercent}%`}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-violet-500 dark:bg-violet-400" />
          <span className="text-violet-600 dark:text-violet-400">
            New: {newVisitors.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-teal-500 dark:bg-teal-400" />
          <span className="text-teal-600 dark:text-teal-400">
            Returning: {returningVisitors.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Components for Loading State
// ============================================================================

function SkeletonDashboard() {
  return (
    <>
      {/* Large Stats Skeleton */}
      <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        <SkeletonStatCard color="blue" />
        <SkeletonStatCard color="emerald" />
        <SkeletonStatCard color="amber" />
        <SkeletonStatCard color="rose" />
      </section>

      {/* Time Series Chart Skeleton */}
      <section>
        <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonChart />
      </section>

      {/* Data Tables Skeleton - Two Column Grid */}
      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="01" title="Top Pages" />
        <SkeletonDataTable number="02" title="Top Referrers" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="04" title="Countries" />
        <SkeletonDataTable number="05" title="Cities" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="06" title="Devices" />
        <SkeletonDataTable number="07" title="Browsers" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="08" title="Operating Systems" />
        <SkeletonDataTable number="09" title="Screen Sizes" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="10" title="Entry Pages" />
        <SkeletonDataTable number="11" title="Exit Pages" />
      </div>

      {/* New vs Returning Skeleton */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          12 — New vs Returning Visitors
        </h2>
        <SkeletonBar />
      </section>
    </>
  );
}

const skeletonColorClasses = {
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
  amber: "bg-amber-200 dark:bg-amber-900/30",
  rose: "bg-rose-200 dark:bg-rose-900/30",
};

function SkeletonStatCard({ color }: { color: "blue" | "emerald" | "amber" | "rose" }) {
  return (
    <div>
      <div className={`h-16 w-32 animate-pulse rounded lg:h-24 lg:w-48 ${skeletonColorClasses[color]}`} />
      <div className="mt-4 h-3 w-20 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="overflow-x-auto">
      <div className="relative h-[200px] w-full max-w-3xl">
        {/* Chart area placeholder */}
        <div className="absolute inset-0 animate-pulse rounded bg-[#f5f3ee] dark:bg-[#2d2a26]">
          {/* Grid lines */}
          <div className="absolute left-12 right-5 top-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-12 right-5 top-1/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-12 right-5 top-1/2 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-12 right-5 top-3/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute bottom-8 left-12 right-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
        </div>
      </div>

      {/* Legend skeleton */}
      <div className="mt-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-blue-300 dark:bg-blue-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-blue-200 dark:bg-blue-900/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-emerald-300 dark:bg-emerald-800" />
          <div className="h-3 w-14 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
        </div>
      </div>
    </div>
  );
}

function SkeletonDataTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {number} — {title}
      </h2>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              #
            </th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Name
            </th>
            <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {[1, 2, 3, 4, 5].map((idx) => (
            <tr key={idx}>
              <td className="py-3 font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                {String(idx).padStart(2, "0")}
              </td>
              <td className="py-3">
                <div
                  className="h-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]"
                  style={{ width: `${70 - idx * 8}%` }}
                />
              </td>
              <td className="py-3 text-right">
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-sky-200 dark:bg-sky-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SkeletonBar() {
  return (
    <div className="space-y-4">
      {/* Bar */}
      <div className="flex h-10 overflow-hidden rounded">
        <div className="w-2/3 animate-pulse bg-violet-200 dark:bg-violet-900/30" />
        <div className="w-1/3 animate-pulse bg-teal-200 dark:bg-teal-900/30" />
      </div>

      {/* Labels */}
      <div className="flex justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-violet-300 dark:bg-violet-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-violet-200 dark:bg-violet-900/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-teal-300 dark:bg-teal-800" />
          <div className="h-3 w-20 animate-pulse rounded bg-teal-200 dark:bg-teal-900/30" />
        </div>
      </div>
    </div>
  );
}
