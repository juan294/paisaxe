import type { StatCardProps, RevenueChartProps } from "./types";

const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  violet: "text-violet-600 dark:text-violet-400",
  rose: "text-rose-600 dark:text-rose-400",
};

export function StatCard({ value, label, color }: StatCardProps) {
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

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatCurrencyShort(amount: number, currency: string): string {
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

export function RevenueChart({ data, currency }: RevenueChartProps) {
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
