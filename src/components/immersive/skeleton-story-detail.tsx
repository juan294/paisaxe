"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";

export function StoryDetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t("common.loading")}
      className="absolute bottom-0 left-0 right-0 p-8 md:p-12 z-10"
    >
      {/* Subtitle skeleton */}
      <Skeleton
        data-testid="skeleton-subtitle"
        className="h-4 w-36 mb-3 bg-white/15"
      />

      {/* Title skeleton */}
      <Skeleton
        data-testid="skeleton-title"
        className="h-10 w-72 md:w-96 mb-4 bg-white/15"
      />

      {/* Description skeleton */}
      <Skeleton
        data-testid="skeleton-description"
        className="h-5 w-full max-w-xl mb-2 bg-white/10"
      />
      <Skeleton
        data-testid="skeleton-description"
        className="h-5 w-3/4 max-w-md mb-8 bg-white/10"
      />

      {/* Action button skeleton */}
      <Skeleton
        data-testid="skeleton-action"
        className="h-12 w-44 rounded-full bg-white/15"
      />
    </div>
  );
}
