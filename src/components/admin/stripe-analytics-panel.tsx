"use client";

import { useState, useCallback } from "react";
import { fetchStripeAnalytics } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import {
  AlertCircle,
  DollarSign,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import type {
  StripeAnalyticsDashboardData,
  StripeOrder,
  StripeProductBreakdown,
  StripeRevenueByDay,
} from "@/types/stripe-analytics";

export function StripeAnalyticsPanel() {
  const [warning, setWarning] = useState("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
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
        <h2 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Revenue Data
        </h2>
        <div className="flex items-center gap-6">
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
          <DollarSign className="h-8 w-8 text-[#e5e3de]" />
          <p className="text-2xl font-extralight text-[#a39e98]">No revenue data yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Revenue data will appear here once sales begin
          </p>
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 rounded-full bg-[#2d2a26] px-4 py-2 text-sm font-medium text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
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
          <div className="font-mono text-xs text-[#6b6560] dark:text-[#a39e98]">
            Gross: {data.summary.totalRevenueFormatted}
            {" — "}Refunds: {data.summary.totalRefundsFormatted}
            {" = "}Net: {data.summary.netRevenueFormatted}
          </div>

          {/* Revenue Chart */}
          {data.revenueByDay.length > 0 && (
            <section>
              <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
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
              className="flex items-center gap-2 rounded-full border border-[#e5e3de] bg-white px-6 py-3 text-sm font-medium text-[#6b6560] transition-colors hover:border-[#2d2a26] hover:text-[#2d2a26] dark:border-[#3d3a36] dark:bg-[#252320] dark:text-[#a39e98] dark:hover:border-[#f5f3ee] dark:hover:text-[#f5f3ee]"
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

interface StatCardProps {
  value: number | string;
  label: string;
  color?: "blue" | "emerald" | "amber" | "violet" | "rose";
}

const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  violet: "text-violet-600 dark:text-violet-400",
  rose: "text-rose-600 dark:text-rose-400",
};

function StatCard({ value, label, color }: StatCardProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;
  const colorClass = color ? statColorClasses[color] : "text-[#2d2a26] dark:text-[#f5f3ee]";
  return (
    <div>
      <p className={`text-5xl font-extralight tabular-nums tracking-tighter lg:text-6xl ${colorClass}`}>
        {displayValue}
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {label}
      </p>
    </div>
  );
}

interface RevenueChartProps {
  data: StripeRevenueByDay[];
  currency: string;
}

function RevenueChart({ data, currency }: RevenueChartProps) {
  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = Math.max(2, chartWidth / data.length - 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-3xl" preserveAspectRatio="xMidYMid meet">
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

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.revenue / maxRevenue) * chartHeight;
          const x = padding.left + (i * chartWidth) / data.length;
          const y = padding.top + chartHeight - barHeight;

          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              className="fill-emerald-500 dark:fill-emerald-400"
              rx={1}
            />
          );
        })}

        {/* X-axis labels (dates) */}
        {data.map((d, i) => {
          const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={`label-${i}`}
              x={padding.left + (i * chartWidth) / data.length + barWidth / 2}
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
          {formatCurrencyShort(maxRevenue, currency)}
        </text>
        <text
          x={padding.left - 10}
          y={padding.top + chartHeight + 4}
          textAnchor="end"
          className="fill-[#a39e98] font-mono text-[10px]"
        >
          €0
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-emerald-500 dark:bg-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400">Daily Revenue</span>
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCurrencyShort(amount: number, currency: string): string {
  if (amount >= 1000) {
    return `€${(amount / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ProductBreakdownTableProps {
  number: string;
  title: string;
  items: StripeProductBreakdown[];
}

function ProductBreakdownTable({ number, title, items }: ProductBreakdownTableProps) {
  if (items.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          {number} — {title}
        </h3>
        <p className="py-6 text-center font-mono text-xs text-[#a39e98]">No product data available</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Product
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Orders
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {items.map((item, idx) => (
            <tr key={item.productId}>
              <td className="py-2 font-mono text-sm tabular-nums text-[#a39e98]">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
                {item.productName}
              </td>
              <td className="py-2 text-right font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                {item.orderCount}
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {item.revenueFormatted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface RecentOrdersTableProps {
  number: string;
  title: string;
  orders: StripeOrder[];
}

function RecentOrdersTable({ number, title, orders }: RecentOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          {number} — {title}
        </h3>
        <p className="py-6 text-center font-mono text-xs text-[#a39e98]">No orders yet</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Date</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Product
            </th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Status
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {orders.slice(0, 10).map((order) => (
            <tr key={order.id}>
              <td className="py-2 font-mono text-xs tabular-nums text-[#6b6560]">
                {formatOrderDate(order.createdAt)}
              </td>
              <td className="max-w-[150px] truncate py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
                {order.productName}
              </td>
              <td className="py-2">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="py-2 text-right font-mono text-sm tabular-nums">
                {order.refundedAmount > 0 ? (
                  <div>
                    <span className="text-[#a39e98] line-through">{order.totalFormatted}</span>
                    <span className="ml-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                      -{order.refundedAmountFormatted}
                    </span>
                  </div>
                ) : (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {order.totalFormatted}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatOrderDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderStatusBadge({ status }: { status: StripeOrder["status"] }) {
  const styles: Record<
    StripeOrder["status"],
    { bg: string; text: string; label: string }
  > = {
    succeeded: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "Paid",
    },
    pending: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
      label: "Pending",
    },
    failed: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
      label: "Failed",
    },
    refunded: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
      label: "Refunded",
    },
    partially_refunded: {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
      label: "Partial",
    },
  };

  const style = styles[status] || styles.pending;

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

// ============================================================================
// Skeleton Components for Loading State
// ============================================================================

function SkeletonRevenueDashboard() {
  return (
    <>
      {/* Summary Stats Skeleton */}
      <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        <SkeletonStatCard color="emerald" />
        <SkeletonStatCard color="rose" />
        <SkeletonStatCard color="blue" />
        <SkeletonStatCard color="amber" />
      </section>

      {/* Revenue Chart Skeleton */}
      <section>
        <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonRevenueChart />
      </section>

      {/* Data Tables Skeleton */}
      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonProductTable number="01" title="Revenue by Product" />
        <SkeletonOrdersTable number="02" title="Recent Orders" />
      </div>
    </>
  );
}

const skeletonColorClasses: Record<string, string> = {
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
  amber: "bg-amber-200 dark:bg-amber-900/30",
  violet: "bg-violet-200 dark:bg-violet-900/30",
  rose: "bg-rose-200 dark:bg-rose-900/30",
};

function SkeletonStatCard({ color }: { color: "blue" | "emerald" | "amber" | "violet" | "rose" }) {
  return (
    <div>
      <div className={`h-12 w-28 animate-pulse rounded lg:h-16 lg:w-36 ${skeletonColorClasses[color]}`} />
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
    </div>
  );
}

function SkeletonRevenueChart() {
  return (
    <div className="overflow-x-auto">
      <div className="relative h-[200px] w-full max-w-3xl">
        {/* Chart area placeholder */}
        <div className="absolute inset-0 animate-pulse rounded bg-[#f5f3ee] dark:bg-[#2d2a26]">
          {/* Grid lines */}
          <div className="absolute left-14 right-5 top-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-14 right-5 top-1/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-14 right-5 top-1/2 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-14 right-5 top-3/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute bottom-8 left-14 right-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />

          {/* Bar placeholders */}
          <div className="absolute bottom-8 left-16 flex items-end gap-2">
            {[60, 40, 80, 30, 70, 50, 90].map((height, i) => (
              <div
                key={i}
                className="w-6 rounded-t bg-emerald-200 dark:bg-emerald-900/30"
                style={{ height: `${height}%`, maxHeight: "140px" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend skeleton */}
      <div className="mt-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded bg-emerald-300 dark:bg-emerald-800" />
        <div className="h-3 w-24 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
      </div>
    </div>
  );
}

function SkeletonProductTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Product
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Orders
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Revenue
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
                  style={{ width: `${70 - idx * 10}%` }}
                />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-8 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-14 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SkeletonOrdersTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Date</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Product
            </th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Status
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {[1, 2, 3, 4, 5].map((idx) => (
            <tr key={idx}>
              <td className="py-2">
                <div className="h-3 w-24 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
              </td>
              <td className="py-2">
                <div
                  className="h-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]"
                  style={{ width: `${60 - idx * 5}%` }}
                />
              </td>
              <td className="py-2">
                <div className="h-5 w-12 animate-pulse rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
