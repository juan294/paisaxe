"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics } from "@/lib/admin-api";
import { RefreshCw, AlertCircle, Eye, Users, Globe, Monitor, Link2, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalyticsDashboardData,
  TopPage,
  TopReferrer,
  CountryBreakdown,
  DeviceBreakdown,
} from "@/types/analytics";

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

  // Calculate max for bar chart scaling
  const maxPageCount = data?.topPages.reduce((max, p) => Math.max(max, p.count), 0) || 1;
  const maxReferrerCount = data?.topReferrers.reduce((max, r) => Math.max(max, r.count), 0) || 1;
  const maxCountryCount = data?.countries.reduce((max, c) => Math.max(max, c.count), 0) || 1;
  const maxDeviceCount = data?.devices.reduce((max, d) => Math.max(max, d.count), 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            Analytics
          </h2>
          <p className="mt-1 text-[#6b6560] dark:text-[#a39e98]">
            Track visitor engagement and behavior
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range picker */}
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 dark:bg-[#252320]">
            <Calendar className="h-4 w-4 text-[#a39e98]" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="bg-transparent text-sm text-[#2d2a26] focus:outline-none dark:text-[#f5f3ee]"
            />
            <span className="text-[#a39e98]">—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="bg-transparent text-sm text-[#2d2a26] focus:outline-none dark:text-[#f5f3ee]"
            />
          </div>
          <button
            onClick={loadData}
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

      {isLoading && !data ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
          <RefreshCw className="h-6 w-6 animate-spin text-[#a39e98]" />
          <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">Loading analytics...</p>
        </div>
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl bg-white p-8 dark:bg-[#252320]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f3ee] dark:bg-[#2d2a26]">
            <Eye className="h-8 w-8 text-[#a39e98]" />
          </div>
          <p className="mt-4 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            No analytics data yet
          </p>
          <p className="mt-1 max-w-sm text-center text-sm text-[#6b6560] dark:text-[#a39e98]">
            Data will appear here once visitors start browsing. PostHog tracks pageviews, referrers, countries, and devices automatically.
          </p>
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 dark:bg-[#252320]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-[#2d2a26] dark:text-[#f5f3ee]">
                    {data.summary.totalPageviews.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-[#6b6560] dark:text-[#a39e98]">
                    Total Pageviews
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c9a55c]/10 text-[#c9a55c] dark:bg-[#c9a55c]/20">
                  <Eye className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 dark:bg-[#252320]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-[#2d2a26] dark:text-[#f5f3ee]">
                    {data.summary.uniqueVisitors.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-[#6b6560] dark:text-[#a39e98]">
                    Unique Visitors
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7a9e7a]/10 text-[#7a9e7a] dark:bg-[#7a9e7a]/20">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Data sections */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DataSection
              title="Top Pages"
              icon={<FileText className="h-4 w-4" />}
              items={data.topPages}
              maxCount={maxPageCount}
              color="gold"
              renderItem={(item: TopPage) => (
                <span className="truncate text-sm text-[#2d2a26] dark:text-[#f5f3ee]">
                  {formatUrl(item.url)}
                </span>
              )}
              getCount={(item: TopPage) => item.count}
            />

            <DataSection
              title="Top Referrers"
              icon={<Link2 className="h-4 w-4" />}
              items={data.topReferrers}
              maxCount={maxReferrerCount}
              color="sage"
              renderItem={(item: TopReferrer) => (
                <span className="truncate text-sm text-[#2d2a26] dark:text-[#f5f3ee]">
                  {formatUrl(item.referrer)}
                </span>
              )}
              getCount={(item: TopReferrer) => item.count}
            />

            <DataSection
              title="Countries"
              icon={<Globe className="h-4 w-4" />}
              items={data.countries}
              maxCount={maxCountryCount}
              color="gold"
              renderItem={(item: CountryBreakdown) => (
                <span className="text-sm text-[#2d2a26] dark:text-[#f5f3ee]">
                  {item.country}
                </span>
              )}
              getCount={(item: CountryBreakdown) => item.count}
            />

            <DataSection
              title="Devices"
              icon={<Monitor className="h-4 w-4" />}
              items={data.devices}
              maxCount={maxDeviceCount}
              color="sage"
              renderItem={(item: DeviceBreakdown) => (
                <span className="text-sm capitalize text-[#2d2a26] dark:text-[#f5f3ee]">
                  {item.device}
                </span>
              )}
              getCount={(item: DeviceBreakdown) => item.count}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function isEmptyData(data: AnalyticsDashboardData): boolean {
  return (
    data.summary.totalPageviews === 0 &&
    data.summary.uniqueVisitors === 0 &&
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

interface DataSectionProps<T> {
  title: string;
  icon: React.ReactNode;
  items: T[];
  maxCount: number;
  color: "gold" | "sage";
  renderItem: (item: T) => React.ReactNode;
  getCount: (item: T) => number;
}

const colorConfig = {
  gold: {
    icon: "bg-[#c9a55c]/10 text-[#c9a55c] dark:bg-[#c9a55c]/20",
    bar: "bg-[#c9a55c]",
  },
  sage: {
    icon: "bg-[#7a9e7a]/10 text-[#7a9e7a] dark:bg-[#7a9e7a]/20",
    bar: "bg-[#7a9e7a]",
  },
};

function DataSection<T>({
  title,
  icon,
  items,
  maxCount,
  color,
  renderItem,
  getCount,
}: DataSectionProps<T>) {
  const colors = colorConfig[color];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 dark:bg-[#252320]">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colors.icon)}>
            {icon}
          </div>
          <h3 className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">{title}</h3>
        </div>
        <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-[#252320]">
      <div className="flex items-center gap-3 border-b border-[#f5f3ee] px-5 py-4 dark:border-[#2d2a26]">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colors.icon)}>
          {icon}
        </div>
        <h3 className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">{title}</h3>
      </div>
      <div className="divide-y divide-[#f5f3ee]/50 dark:divide-[#2d2a26]/50">
        {items.map((item, idx) => {
          const count = getCount(item);
          return (
            <div key={idx} className="px-5 py-3">
              <div className="mb-2 flex items-center justify-between">
                {renderItem(item)}
                <span className="ml-3 text-sm font-medium tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                  {count.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f5f3ee] dark:bg-[#2d2a26]">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
