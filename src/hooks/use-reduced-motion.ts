"use client";

import { useState, useEffect } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Hook that detects whether the user prefers reduced motion.
 * Listens to OS-level `prefers-reduced-motion` media query
 * and updates reactively when the preference changes.
 */
export function useReducedMotion(): boolean {
  // FE-M6 (#768): always initialize to `false` — matching what the server
  // renders (no `window`) — and set the real value in the effect below.
  // Reading `window.matchMedia(...).matches` directly in the initializer
  // returned the real value on the client's first render, diverging from
  // the server-rendered `false` and causing a hydration mismatch for
  // reduced-motion visitors.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setPrefersReducedMotion(mql.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}
