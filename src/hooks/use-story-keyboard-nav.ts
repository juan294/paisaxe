"use client";

import { useEffect } from "react";

interface UseStoryKeyboardNavOptions {
  onNext: () => void;
  onPrev: () => void;
  onToggleInfo: () => void;
  chatOpen: boolean;
}

/**
 * Attaches keyboard navigation handlers for the story viewer.
 * ArrowRight / Space → next, ArrowLeft → prev, i → toggle info.
 * Disabled when chatOpen is true or when the target is a form element.
 */
export function useStoryKeyboardNav({
  onNext,
  onPrev,
  onToggleInfo,
  chatOpen,
}: UseStoryKeyboardNavOptions): void {
  useEffect(() => {
    if (chatOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "i") {
        onToggleInfo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, onNext, onPrev, onToggleInfo]);
}
