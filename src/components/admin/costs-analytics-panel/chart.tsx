"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import type {
  CostChartProps,
  StatCardProps,
  ServiceBreakdownTableProps,
  CostCategory,
} from "./types";

const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  orange: "text-orange-600 dark:text-orange-400",
};

export function StatCard({ value, label, color }: StatCardProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;
  const colorClass = color
    ? statColorClasses[color]
    : "text-[#2d2a26] dark:text-[#f5f3ee]";
  return (
    <div>
      <p
        className={`text-5xl font-extralight tabular-nums tracking-tighter lg:text-6xl ${colorClass}`}
      >
        {displayValue}
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {label}
      </p>
    </div>
  );
}

export function CostChart({ data }: CostChartProps) {
  if (data.length === 0) return null;

  const maxCost = Math.max(...data.map((d) => d.costUsd), 0.01);

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = Math.max(2, chartWidth / data.length - 2);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-3xl"
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

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.costUsd / maxCost) * chartHeight;
          const x = padding.left + (i * chartWidth) / data.length;
          const y = padding.top + chartHeight - barHeight;

          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              className="fill-rose-500 dark:fill-rose-400"
              rx={1}
            />
          );
        })}

        {/* X-axis labels (dates) */}
        {data.map((d, i) => {
          const showLabel =
            data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
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
          {formatCurrencyShort(maxCost)}
        </text>
        <text
          x={padding.left - 10}
          y={padding.top + chartHeight + 4}
          textAnchor="end"
          className="fill-[#a39e98] font-mono text-[10px]"
        >
          $0
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-rose-500 dark:bg-rose-400" />
          <span className="text-rose-600 dark:text-rose-400">Daily Cost</span>
        </div>
      </div>
    </div>
  );
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCurrencyShort(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
}

export function ServiceBreakdownTable({
  services,
  onEdit,
  onDelete,
}: ServiceBreakdownTableProps) {
  if (services.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs text-[#a39e98]">
        No cost data available
      </p>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Service
          </th>
          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Category
          </th>
          <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Cost
          </th>
          <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
        {services.map((service) => (
          <tr key={`${service.serviceId}-${service.billingPeriodStart}`}>
            <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {service.serviceName}
                  {service.dashboardUrl && (
                    <a
                      href={service.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a39e98] hover:text-[#6b6560]"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {service.notes && (
                  <span className="text-xs text-[#a39e98]">
                    {service.notes}
                  </span>
                )}
              </div>
            </td>
            <td className="py-2">
              <CategoryBadge category={service.category} />
            </td>
            <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400">
              {service.costFormatted}
            </td>
            <td className="py-2 text-right">
              {service.source === "manual" ? (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(service)}
                    className="rounded p-1 text-[#a39e98] hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() =>
                      onDelete(
                        `${service.serviceId}-${service.billingPeriodStart}`
                      )
                    }
                    className="rounded p-1 text-[#a39e98] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[#a39e98]">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoryBadge({ category }: { category: CostCategory }) {
  const styles: Record<CostCategory, { bg: string; text: string }> = {
    ai: {
      bg: "bg-violet-100 dark:bg-violet-900/30",
      text: "text-violet-700 dark:text-violet-400",
    },
    infrastructure: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
    },
    communications: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
    },
    analytics: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
    },
    payments: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
    },
    development: {
      bg: "bg-cyan-100 dark:bg-cyan-900/30",
      text: "text-cyan-700 dark:text-cyan-400",
    },
  };

  const style = styles[category];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium capitalize ${style.bg} ${style.text}`}
    >
      {category}
    </span>
  );
}
