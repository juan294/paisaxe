"use client";

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface StoryProgressBarProps {
  storiesLength: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  t: (key: string) => string;
}

export const StoryProgressBar = memo(function StoryProgressBar({
  storiesLength,
  currentIndex,
  onIndexChange,
  t,
}: StoryProgressBarProps) {
  const PAGE_SIZE = 20;
  const segmentCount = Math.min(PAGE_SIZE, storiesLength);
  const fillPosition = currentIndex % segmentCount;
  const base = currentIndex - fillPosition;

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
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = (e.target as HTMLElement).closest("[data-segment-index]");
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(target.getAttribute("data-segment-index"));
      const targetIndex = base + idx;
      if (targetIndex >= 0 && targetIndex < storiesLength) {
        onIndexChange(targetIndex);
      }
    },
    [base, storiesLength, onIndexChange]
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
        return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            data-segment-index={i}
            aria-label={t("accessibility.go_to_story")
              .replace("{current}", String(targetIndex + 1))
              .replace("{total}", String(storiesLength))}
            className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden cursor-pointer transition-all duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
