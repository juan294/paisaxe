"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics } from "@/lib/admin-api";
import { RefreshCw, AlertCircle } from "lucide-react";
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

  return (
    <div className="space-y-16">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-stone-200 pb-6 dark:border-stone-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">Admin / Analytics</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-stone-900 dark:text-stone-100">
            Visitor Data
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-stone-400">
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
            onClick={loadData}
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

      {isLoading && !data ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-stone-300" />
        </div>
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
          <p className="text-2xl font-extralight text-stone-300">No data yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
            Visitor data will appear here once browsing begins
          </p>
        </div>
      ) : data ? (
        <>
          {/* Large Stats */}
          <section className="grid grid-cols-2 gap-16">
            <div>
              <p className="text-8xl font-extralight tabular-nums tracking-tighter text-stone-900 dark:text-stone-100">
                {data.summary.totalPageviews.toLocaleString()}
              </p>
              <p className="mt-4 font-mono text-xs uppercase tracking-widest text-stone-400">Total Pageviews</p>
            </div>
            <div>
              <p className="text-8xl font-extralight tabular-nums tracking-tighter text-stone-900 dark:text-stone-100">
                {data.summary.uniqueVisitors.toLocaleString()}
              </p>
              <p className="mt-4 font-mono text-xs uppercase tracking-widest text-stone-400">Unique Visitors</p>
            </div>
          </section>

          {/* Data Tables */}
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
            <DataTable
              number="03"
              title="Countries"
              items={data.countries}
              renderItem={(item: CountryBreakdown) => item.country}
              getCount={(item: CountryBreakdown) => item.count}
            />
            <DataTable
              number="04"
              title="Devices"
              items={data.devices}
              renderItem={(item: DeviceBreakdown) => item.device}
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

interface DataTableProps<T> {
  number: string;
  title: string;
  items: T[];
  renderItem: (item: T) => string;
  getCount: (item: T) => number;
}

function DataTable<T>({
  number,
  title,
  items,
  renderItem,
  getCount,
}: DataTableProps<T>) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
          {number} — {title}
        </h2>
        <p className="py-8 text-center font-mono text-xs text-stone-300">No data available</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
        {number} — {title}
      </h2>
      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-200 text-left dark:border-stone-800">
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">#</th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Name</th>
            <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-stone-400">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-3 font-mono text-sm tabular-nums text-stone-300">
                {String(idx + 1).padStart(2, '0')}
              </td>
              <td className="py-3 text-sm capitalize text-stone-700 dark:text-stone-300">
                {renderItem(item)}
              </td>
              <td className="py-3 text-right font-mono text-sm tabular-nums text-stone-900 dark:text-stone-100">
                {getCount(item).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
