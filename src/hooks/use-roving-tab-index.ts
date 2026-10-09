"use client";

import { useCallback, useEffect, useRef } from "react";

interface RovingTabIndexOptions {
  count: number;
  activeIndex: number;
  orientation?: "horizontal" | "both";
}

/** Index/focus mechanics only; each consumer owns selection and event policy. */
export function useRovingTabIndex({ count, activeIndex, orientation = "horizontal" }: RovingTabIndexOptions) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, count);
  }, [count]);

  const getTabIndex = useCallback(
    (index: number) => index >= 0 && index < count && index === activeIndex ? 0 : -1,
    [count, activeIndex]
  );

  const focusForKey = useCallback((key: string, index: number): number | null => {
    if (count <= 0 || index < 0 || index >= count) return null;
    let next: number;
    if (key === "ArrowRight" || (orientation === "both" && key === "ArrowDown")) {
      next = index < count - 1 ? index + 1 : 0;
    } else if (key === "ArrowLeft" || (orientation === "both" && key === "ArrowUp")) {
      next = index > 0 ? index - 1 : count - 1;
    } else if (key === "Home") {
      next = 0;
    } else if (key === "End") {
      next = count - 1;
    } else {
      return null;
    }
    itemRefs.current[next]?.focus();
    return next;
  }, [count, orientation]);

  return { itemRefs, getTabIndex, focusForKey };
}
