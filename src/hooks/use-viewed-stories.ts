"use client";

import { useState, useCallback, useEffect } from "react";

export function useViewedStories() {
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set());

  // Mark current index as viewed
  const markViewed = useCallback((index: number) => {
    setViewedIndices((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  // Auto-mark index 0 on mount
  useEffect(() => {
    markViewed(0);
  }, [markViewed]);

  return { viewedIndices, markViewed };
}
