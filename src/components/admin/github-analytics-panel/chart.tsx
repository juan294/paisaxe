import type { GitHubTrafficDaily } from "@/types/github-analytics";

interface StatCardProps {
  value: number | string;
  label: string;
  suffix?: string;
  icon: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "violet" | "stone";
}

const statColorClasses: Record<NonNullable<StatCardProps["color"]>, { value: string; icon: string }> = {
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
    value: "text-admin-muted dark:text-admin-subtle",
    icon: "text-admin-subtle",
  },
};

export function StatCard({ value, label, suffix, icon, color = "stone" }: StatCardProps) {
  const colors = statColorClasses[color] || statColorClasses.stone;
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${colors.icon}`}>
        {icon}
        <span className="font-mono text-xs uppercase tracking-widest text-admin-subtle">{label}</span>
      </div>
      <p className={`text-3xl font-extralight tabular-nums tracking-tight ${colors.value}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="ml-1 text-lg text-admin-subtle">{suffix}</span>}
      </p>
    </div>
  );
}

export function TrafficChart({ daily }: { daily: GitHubTrafficDaily[] }) {
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
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
        Daily Traffic
      </h3>
      <div className="flex items-center gap-6 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 bg-blue-500" />
          <span className="font-mono text-xs text-admin-subtle">Views</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 bg-emerald-500" />
          <span className="font-mono text-xs text-admin-subtle">Clones</span>
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
            className="text-admin-line dark:text-admin-depth"
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
              className="fill-admin-subtle font-mono"
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

