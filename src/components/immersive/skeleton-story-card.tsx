import { Skeleton } from "@/components/ui/skeleton";

export function StoryCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-testid="skeleton-story-card"
      className="fixed inset-0 overflow-hidden bg-black"
    >
      {/* Background image placeholder */}
      <div className="absolute inset-0">
        <Skeleton className="h-full w-full rounded-none" />
        {/* Gradient overlay matching real story viewer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </div>

      {/* Progress bar skeleton segments */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton
            key={i}
            data-testid="skeleton-progress-segment"
            className="flex-1 h-1 rounded-full bg-white/20"
          />
        ))}
      </div>

      {/* Category badge skeleton */}
      <div className="absolute top-12 left-6 z-20">
        <Skeleton className="h-7 w-24 rounded-full bg-white/10" />
      </div>

      {/* Bottom content overlay skeleton */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 z-10">
        {/* Subtitle */}
        <Skeleton
          data-testid="skeleton-text-line"
          className="h-4 w-32 mb-3 bg-white/15"
        />

        {/* Title */}
        <Skeleton
          data-testid="skeleton-text-line"
          className="h-10 w-80 md:w-[28rem] mb-3 bg-white/15"
        />

        {/* Description lines */}
        <Skeleton
          data-testid="skeleton-text-line"
          className="h-5 w-full max-w-lg mb-2 bg-white/10"
        />
        <Skeleton
          data-testid="skeleton-text-line"
          className="h-5 w-3/4 max-w-md mb-8 bg-white/10"
        />

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Skeleton
            data-testid="skeleton-button"
            className="h-12 w-44 rounded-full bg-white/15"
          />
          <Skeleton
            data-testid="skeleton-button"
            className="h-12 w-32 rounded-full bg-white/15"
          />
        </div>
      </div>

      {/* Navigation arrow skeletons */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
        <Skeleton className="h-14 w-14 rounded-full bg-white/10" />
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
        <Skeleton className="h-14 w-14 rounded-full bg-white/10" />
      </div>

      {/* Top-right controls skeleton */}
      <div className="absolute top-16 right-6 z-20 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full bg-white/10" />
        <Skeleton className="h-9 w-9 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
