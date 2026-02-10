"use client";

import { cn } from "@/lib/utils";
import { statColorClasses } from "./constants";

export function StatCard({
  number,
  value,
  label,
  color,
  isError = false,
}: {
  number: string;
  value: number;
  label: string;
  color?: "blue" | "emerald" | "amber" | "rose";
  isError?: boolean;
}) {
  const colorClass = isError && value > 0
    ? "text-red-500"
    : color
      ? statColorClasses[color]
      : "text-[#2d2a26] dark:text-[#f5f3ee]";

  return (
    <div>
      <p className="font-mono text-xs tabular-nums text-[#a39e98]">{number}</p>
      <p className={cn(
        "mt-2 text-5xl font-extralight tabular-nums tracking-tighter",
        colorClass
      )}>
        {value.toLocaleString()}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">{label}</p>
    </div>
  );
}
