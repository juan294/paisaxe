import type { StatCardProps, TimeSeriesChartProps, NewVsReturningBarProps } from "./types";

const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

export function StatCard({ value, label, color }: StatCardProps) {
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

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
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

export function NewVsReturningBar({ newVisitors, returningVisitors }: NewVsReturningBarProps) {
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
