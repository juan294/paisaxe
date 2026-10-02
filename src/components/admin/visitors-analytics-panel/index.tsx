"use client";

import { useState, useCallback } from "react";
import { fetchAnalytics } from "@/lib/admin-api";
import { useAnalyticsData } from "../analytics-cache-context";
import { AlertCircle } from "lucide-react";
import type {
  AnalyticsDashboardData,
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
} from "./types";
import { useDevToggle } from "./use-dev-toggle";
import { StatCard, TimeSeriesChart, NewVsReturningBar } from "./chart";
import { DataTable, UTMTable } from "./tables";
import { SkeletonDashboard } from "./skeletons";

export function VisitorsAnalyticsPanel() {
  const { includeLocalhost, setIncludeLocalhost, isInitialized } = useDevToggle();
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

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
