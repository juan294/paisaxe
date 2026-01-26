"use client";

import { useEffect, useRef } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { isNewStory } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n";

interface FreshnessBadgeProps {
  createdAt?: string;
  storyId: string;
}

export function FreshnessBadge({ createdAt, storyId }: FreshnessBadgeProps) {
  const { trackEvent } = useAnalytics();
  const { t } = useTranslation();
  const trackedRef = useRef(false);

  const isNew = createdAt ? isNewStory(createdAt) : false;

  useEffect(() => {
    if (isNew && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent("freshness_badge_visible", "story_freshness", { storyId });
    }
  }, [isNew, storyId, trackEvent]);

  if (!isNew) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/80 text-white backdrop-blur-sm">
      {t("stories.new_badge")}
    </span>
  );
}
