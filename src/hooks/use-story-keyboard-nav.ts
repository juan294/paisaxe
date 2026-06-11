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

    const handledEvents = new WeakSet<KeyboardEvent>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (handledEvents.has(e)) {
        return;
      }

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
        handledEvents.add(e);
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        handledEvents.add(e);
        e.preventDefault();
        onPrev();
      } else if (e.key === "i") {
        handledEvents.add(e);
        onToggleInfo();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [chatOpen, onNext, onPrev, onToggleInfo]);
}
