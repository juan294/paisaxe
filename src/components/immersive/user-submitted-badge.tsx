"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface UserSubmittedBadgeProps {
  className?: string;
}

export function UserSubmittedBadge({ className }: UserSubmittedBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-200",
        className
      )}
      title={t("suggestions.community_pick")}
    >
      <Users className="h-3 w-3" />
      <span>{t("suggestions.community_pick")}</span>
    </span>
  );
}
