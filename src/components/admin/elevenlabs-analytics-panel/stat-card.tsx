interface StatCardProps {
  value: number | string;
  label: string;
  suffix?: string;
  icon: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "rose" | "violet" | "yellow" | "stone";
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
  rose: {
    value: "text-rose-600 dark:text-rose-400",
    icon: "text-rose-500 dark:text-rose-400",
  },
  violet: {
    value: "text-violet-600 dark:text-violet-400",
    icon: "text-violet-500 dark:text-violet-400",
  },
  yellow: {
    value: "text-yellow-600 dark:text-yellow-400",
    icon: "text-yellow-500 dark:text-yellow-400",
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

