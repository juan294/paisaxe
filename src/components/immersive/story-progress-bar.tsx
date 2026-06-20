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
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep refs array sized correctly
  useEffect(() => {
    segmentRefs.current = segmentRefs.current.slice(0, segmentCount);
  }, [segmentCount]);

  const handleSelect = useCallback(
    (idx: number) => {
      const targetIndex = base + idx;
      if (targetIndex >= 0 && targetIndex < storiesLength) {
        onIndexChange(targetIndex);
      }
    },
    [base, storiesLength, onIndexChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {

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
        handleSelect(idx);
      }
    },
    [base, segmentCount, storiesLength, onIndexChange, handleSelect]
  );

  /**
   * Build the aria-label for a segment.
   * When storyTitles are provided, includes the story title for screen readers.
   */
  const getSegmentLabel = useCallback(
    (targetIndex: number): string => {
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
    <nav
      aria-label={t("accessibility.story_progress")}
      className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1 p-4"
    >
      <span className="sr-only">
        {t("accessibility.story_counter")
          .replace("{current}", String(currentIndex + 1))
          .replace("{total}", String(storiesLength))}
      </span>
      <ol role="list" className="flex w-full items-center gap-1">
        {Array.from({ length: segmentCount }, (_, i) => {
          const targetIndex = base + i;
          const isCurrent = i === fillPosition;
          return (
            <li key={targetIndex} data-story-index={targetIndex} className="flex flex-1">
              <button
                type="button"
                ref={(el) => { segmentRefs.current[i] = el; }}
                tabIndex={isCurrent ? 0 : -1}
                data-segment-index={i}
                aria-label={getSegmentLabel(targetIndex)}
                aria-current={isCurrent ? "page" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelect(i);
                }}
                onKeyDown={(event) => handleKeyDown(event, i)}
                className={cn(
                  "h-1.5 w-full hover:h-2 focus-visible:h-2 rounded-full bg-white/40 touch:bg-white/40 overflow-hidden cursor-pointer transition-all duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                  isCurrent && "ring-1 ring-white/50"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-full bg-white transition-all duration-300 motion-reduce:transition-none",
                    i <= fillPosition ? "w-full" : "w-0"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
