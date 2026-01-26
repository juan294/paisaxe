"use client";

import { cn } from "@/lib/utils";
import type { CurationStatus } from "@/types/admin";

interface CurationBadgeProps {
  status: CurationStatus;
  className?: string;
  variant?: "default" | "minimal";
}

export function CurationBadge({
  status,
  className,
  variant = "default",
}: CurationBadgeProps) {
  const isApproved = status === "approved";

  if (variant === "minimal") {
    return (
      <span className={cn("flex items-center gap-1.5", className)}>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isApproved ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {isApproved ? "Approved" : "Pending"}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        isApproved
          ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          : "bg-amber-500/10 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isApproved ? "bg-emerald-500" : "bg-amber-500"
        )}
      />
      <span>{isApproved ? "Approved" : "Pending"}</span>
    </span>
  );
}
