"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
type TFunction = (key: string) => string;

interface StoryToolbarProps {
  onPrev: () => void;
  onNext: () => void;
  t: TFunction;
}

/**
 * Navigation arrow buttons for the StoryViewer.
 * Renders as invisible 20-wide tap zones on mobile and visible rounded buttons on
 * tablets/desktop (sm: breakpoint and up).
 */
export function StoryToolbar({ onPrev, onNext, t }: StoryToolbarProps) {
  return (
    <>
      {/* Previous — invisible tap zone on mobile, visible button on sm+ */}
      <button
        data-testid="prev-story-button"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label={t("accessibility.previous_story")}
        className="absolute left-0 top-0 h-full w-20 z-20 flex items-center justify-start pl-4 sm:left-4 sm:top-1/2 sm:h-auto sm:w-auto sm:-translate-y-1/2 sm:p-3 sm:rounded-full sm:bg-white/10 sm:hover:bg-white/20 sm:backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-nav-reset touch-nav-left"
      >
        <ChevronLeft className="h-8 w-8 text-white hidden sm:block" />
      </button>

      {/* Next — invisible tap zone on mobile, visible button on sm+ */}
      <button
        data-testid="next-story-button"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label={t("accessibility.next_story")}
        className="absolute right-0 top-0 h-full w-20 z-20 flex items-center justify-end pr-4 sm:right-4 sm:top-1/2 sm:h-auto sm:w-auto sm:-translate-y-1/2 sm:p-3 sm:rounded-full sm:bg-white/10 sm:hover:bg-white/20 sm:backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-nav-reset touch-nav-right"
      >
        <ChevronRight className="h-8 w-8 text-white hidden sm:block" />
      </button>
    </>
  );
}
