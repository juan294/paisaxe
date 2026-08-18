"use client";

import { useMediaQuery } from "./use-media-query";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Hook that detects whether the user prefers reduced motion.
 * Listens to OS-level `prefers-reduced-motion` media query
 * and updates reactively when the preference changes.
 *
 * FE-M6 (#768): delegates to useMediaQuery, which already initializes to
 * `false` — matching what the server renders (no `window`) — and sets the
 * real value in an effect, avoiding a hydration mismatch for reduced-motion
 * visitors.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
