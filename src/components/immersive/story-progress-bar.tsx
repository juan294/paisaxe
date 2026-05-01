"use client";

import { memo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface StoryProgressBarProps {
  storiesLength: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  t: (key: string) => string;
  /** Story titles for screen reader announcements (optional). */
  storyTitles?: string[];
}

export const StoryProgressBar = memo(function StoryProgressBar({
  storiesLength,
  currentIndex,
  onIndexChange,
  t,
  storyTitles,
}: StoryProgressBarProps) {
  const PAGE_SIZE = 20;
  const segmentCount = Math.min(PAGE_SIZE, storiesLength);
  const fillPosition = currentIndex % segmentCount;
  const base = currentIndex - fillPosition;

  // Refs for roving tabindex focus management
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Keep refs array sized correctly
  useEffect(() => {
    segmentRefs.current = segmentRefs.current.slice(0, segmentCount);
  }, [segmentCount]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest("[data-segment-index]");
      if (!target) return;
      e.stopPropagation();
      const idx = Number(target.getAttribute("data-segment-index"));
      const targetIndex = base + idx;
      if (targetIndex >= 0 && targetIndex < storiesLength) {
        onIndexChange(targetIndex);
      }
    },
    [base, storiesLength, onIndexChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest("[data-segment-index]");
      if (!target) return;

      const idx = Number(target.getAttribute("data-segment-index"));

      // Arrow-key navigation (roving tabindex pattern)
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        const nextIdx = idx < segmentCount - 1 ? idx + 1 : 0;
        const targetIndex = base + nextIdx;
        if (targetIndex >= 0 && targetIndex < storiesLength) {
          onIndexChange(targetIndex);
          // Focus will move via useEffect when fillPosition updates
          segmentRefs.current[nextIdx]?.focus();
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        const prevIdx = idx > 0 ? idx - 1 : segmentCount - 1;
        const targetIndex = base + prevIdx;
        if (targetIndex >= 0 && targetIndex < storiesLength) {
          onIndexChange(targetIndex);
          segmentRefs.current[prevIdx]?.focus();
        }
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        const targetIndex = base;
        if (targetIndex >= 0 && targetIndex < storiesLength) {
          onIndexChange(targetIndex);
          segmentRefs.current[0]?.focus();
        }
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        e.stopPropagation();
        const lastIdx = segmentCount - 1;
        const targetIndex = base + lastIdx;
        if (targetIndex >= 0 && targetIndex < storiesLength) {
          onIndexChange(targetIndex);
          segmentRefs.current[lastIdx]?.focus();
        }
        return;
      }

      // Enter/Space activation (existing behavior)
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        const targetIndex = base + idx;
        if (targetIndex >= 0 && targetIndex < storiesLength) {
          onIndexChange(targetIndex);
        }
      }
    },
    [base, segmentCount, storiesLength, onIndexChange]
  );

  /**
   * Build the aria-label for a segment.
   * When storyTitles are provided, includes the story title for screen readers.
   */
  const getSegmentLabel = useCallback(
    (segmentIdx: number, targetIndex: number): string => {
      const baseLabel = t("accessibility.go_to_story")
        .replace("{current}", String(targetIndex + 1))
        .replace("{total}", String(storiesLength));

      if (storyTitles && storyTitles[targetIndex]) {
        return `${storyTitles[targetIndex]} — ${baseLabel}`;
      }

      return baseLabel;
    },
    [t, storiesLength, storyTitles]
  );

  return (
    <div
      role="progressbar"
      aria-label={t("accessibility.story_progress")}
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={storiesLength}
      className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1 p-4"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: segmentCount }, (_, i) => {
        const targetIndex = base + i;
        const isCurrent = i === fillPosition;
        return (
          <div
            key={i}
            ref={(el) => { segmentRefs.current[i] = el; }}
            role="button"
            tabIndex={isCurrent ? 0 : -1}
            data-segment-index={i}
            aria-label={getSegmentLabel(i, targetIndex)}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              // UX-M10 (#520): h-1.5 default (was h-1) for better touch affordance;
              // hover/focus grows to h-2; inactive segments use bg-white/40 (was bg-white/30)
              // for better contrast on touch (coarse pointer) devices.
              "flex-1 h-1.5 hover:h-2 focus-visible:h-2 rounded-full bg-white/40 touch:bg-white/40 overflow-hidden cursor-pointer transition-all duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              isCurrent && "ring-1 ring-white/50"
            )}
          >
            <div
              className={cn(
                "h-full bg-white transition-all duration-300 motion-reduce:transition-none",
                i <= fillPosition ? "w-full" : "w-0"
              )}
            />
          </div>
        );
      })}
    </div>
  );
});
