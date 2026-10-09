"use client";

import { interpolate } from "@/lib/i18n/interpolate";

import { memo, useCallback } from "react";
import { useRovingTabIndex } from "@/hooks/use-roving-tab-index";
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
  const base = Math.floor(currentIndex / PAGE_SIZE) * PAGE_SIZE;
  const segmentCount = Math.max(0, Math.min(PAGE_SIZE, storiesLength - base));
  const fillPosition = currentIndex - base;
  const { itemRefs: segmentRefs, getTabIndex, focusForKey } = useRovingTabIndex({
    count: segmentCount,
    activeIndex: fillPosition,
  });

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
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const next = focusForKey(event.key, index);
      if (next !== null) {
        event.preventDefault();
        event.stopPropagation();
        handleSelect(next);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        handleSelect(index);
      }
    },
    [focusForKey, handleSelect]
  );

  /**
   * Build the aria-label for a segment.
   * When storyTitles are provided, includes the story title for screen readers.
   */
  const getSegmentLabel = useCallback(
    (targetIndex: number): string => {
      const baseLabel = interpolate(t("accessibility.go_to_story"), { current: String(targetIndex + 1), total: String(storiesLength) });

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
        {interpolate(t("accessibility.story_counter"), { current: String(currentIndex + 1), total: String(storiesLength) })}
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
                tabIndex={getTabIndex(i)}
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
