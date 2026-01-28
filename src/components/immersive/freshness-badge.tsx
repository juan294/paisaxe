"use client";

import { isNewStory } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n";

interface FreshnessBadgeProps {
  createdAt?: string;
  storyId: string;
}

export function FreshnessBadge({ createdAt, storyId: _storyId }: FreshnessBadgeProps) {
  const { t } = useTranslation();

  const isNew = createdAt ? isNewStory(createdAt) : false;

  if (!isNew) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/80 text-white backdrop-blur-sm">
      {t("stories.new_badge")}
    </span>
  );
}
