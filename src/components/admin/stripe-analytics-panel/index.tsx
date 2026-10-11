"use client";

import { useState, useCallback } from "react";
import { fetchStripeAnalytics } from "@/lib/admin-api";
import { useAnalyticsData } from "../analytics-cache-context";
import {
  AlertCircle,
  DollarSign,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import type { StripeAnalyticsDashboardData } from "./types";
import { StatCard, RevenueChart } from "./chart";
import { ProductBreakdownTable, RecentOrdersTable } from "./tables";
import { SkeletonRevenueDashboard } from "./skeletons";

export function StripeAnalyticsPanel() {
  const [warning, setWarning] = useState("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace(/T.*$/, ""),
    to: new Date().toISOString().replace(/T.*$/, ""),
  });

  const fromISO = new Date(dateRange.from).toISOString();
  const toISO = new Date(dateRange.to + "T23:59:59").toISOString();

  const params = JSON.stringify({ from: dateRange.from, to: dateRange.to });
  const fetchFn = useCallback(async () => {
    const result = await fetchStripeAnalytics(fromISO, toISO);
    if (result.warning) {
      setWarning(result.warning);
    } else {
      setWarning("");
    }
    return result;
  }, [fromISO, toISO]);

  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "revenue",
    fetchFn,
    params
  );

  return (
    <div className="space-y-12">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
          Revenue Data
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
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:text-admin-ink disabled:opacity-50 dark:text-admin-subtle dark:hover:text-admin-paper"
          >
            {isLoading ? "Loading..." : isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {warning && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 font-mono text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {warning}
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 underline hover:no-underline"
          >
            Configure API
            <ExternalLink className="h-3 w-3" />
          </a>
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
        <SkeletonRevenueDashboard />
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
          <DollarSign className="h-8 w-8 text-admin-line" />
          <p className="text-2xl font-extralight text-admin-subtle">No revenue data yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Revenue data will appear here once sales begin
          </p>
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 rounded-full bg-admin-ink px-4 py-2 text-sm font-medium text-admin-paper hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
          >
            Open Stripe Dashboard
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : data ? (
        <>
          {/* Summary Stats */}
          <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
            <StatCard
              value={data.summary.netRevenueFormatted}
              label="Net Revenue"
              color="emerald"
            />
            <StatCard
              value={data.summary.totalRefundsFormatted}
              label="Refunds"
              color="rose"
            />
            <StatCard
              value={data.summary.thirtyDayNetRevenueFormatted}
              label="30-Day Net"
              color="blue"
            />
            <StatCard
              value={data.summary.totalOrders}
              label="Total Orders"
              color="amber"
            />
          </section>

          {/* Revenue Breakdown */}
          <div className="font-mono text-xs text-admin-muted dark:text-admin-subtle">
            Gross: {data.summary.totalRevenueFormatted}
            {" — "}Refunds: {data.summary.totalRefundsFormatted}
            {" = "}Net: {data.summary.netRevenueFormatted}
          </div>

          {/* Revenue Chart */}
          {data.revenueByDay.length > 0 && (
            <section>
              <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                Revenue Over Time
              </h2>
              <RevenueChart data={data.revenueByDay} currency={data.summary.currency} />
            </section>
          )}

          {/* Data Tables */}
          <div className="grid gap-16 lg:grid-cols-2">
            <ProductBreakdownTable
              number="01"
              title="Revenue by Product"
              items={data.productBreakdown}
            />
            <RecentOrdersTable
              number="02"
              title="Recent Orders"
              orders={data.recentOrders}
            />
          </div>

          {/* Stripe Dashboard Link */}
          <div className="flex justify-center pt-8">
            <a
              href="https://dashboard.stripe.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-admin-line bg-white px-6 py-3 text-sm font-medium text-admin-muted transition-colors hover:border-admin-ink hover:text-admin-ink dark:border-admin-depth dark:bg-admin-panel dark:text-admin-subtle dark:hover:border-admin-paper dark:hover:text-admin-paper"
            >
              <TrendingUp className="h-4 w-4" />
              View Full Dashboard on Stripe
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function isEmptyData(data: StripeAnalyticsDashboardData): boolean {
  return (
    data.summary.totalOrders === 0 &&
    data.recentOrders.length === 0 &&
    data.productBreakdown.length === 0
  );
}
