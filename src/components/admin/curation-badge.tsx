"use client";

import { cn } from "@/lib/utils";
import type { CurationStatus } from "@/types/admin";

interface CurationBadgeProps {
  status: CurationStatus;
  className?: string;
}

export function CurationBadge({ status, className }: CurationBadgeProps) {
  const isApproved = status === "approved";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        isApproved
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        className
      )}
    >
      {isApproved ? "Approved" : "Needs Curation"}
    </span>
  );
}
