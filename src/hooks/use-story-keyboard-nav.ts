"use client";

import { useEffect, useRef } from "react";

interface UseStoryKeyboardNavOptions {
  onNext: () => void;
  onPrev: () => void;
  onToggleInfo: () => void;
  chatOpen: boolean;
}

// Capture runs before a widget's stopPropagation, so ownership must be checked
// before claiming a shortcut. The marker covers the story progress control;
// standard editing/dialog/widget semantics cover other local focus owners.
const LOCAL_KEYBOARD_OWNER = [
  "input", "textarea", "select", "form", '[contenteditable]:not([contenteditable="false"])',
  "dialog", '[role="dialog"]', '[role="menu"]', '[role="menubar"]',
  '[role="tablist"]', '[role="listbox"]', '[role="combobox"]',
  '[role="slider"]', '[role="spinbutton"]', '[role="tree"]', '[role="grid"]',
  "[data-story-keyboard-local]",
].join(",");

/** One capture listener for story shortcuts, with current callbacks and chat state. */
export function useStoryKeyboardNav(options: UseStoryKeyboardNavOptions): void {
  const current = useRef(options);
  current.current = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || current.current.chatOpen) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(LOCAL_KEYBOARD_OWNER) ||
          (target instanceof HTMLElement && target.isContentEditable)) return;
      // Space activates native controls itself; claiming it here would also
      // navigate when a visitor activates an unrelated button or link.
      if (event.key === " " && target?.closest("button, a[href], summary")) return;

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        current.current.onNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        current.current.onPrev();
      } else if (event.key === "i") {
        current.current.onToggleInfo();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);
}
