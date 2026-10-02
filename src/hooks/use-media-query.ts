"use client";

import { useState, useEffect } from "react";

/**
 * Generic hook that subscribes to a CSS media query and returns its current
 * matches value. The result is cached in React state and updated reactively
 * when the media environment changes (e.g. window resize or input device swap).
 *
 * @param query - A valid CSS media query string, e.g. "(pointer: fine)"
 * @returns `true` if the query currently matches, `false` otherwise.
 */
export function useMediaQuery(query: string): boolean {
  // FE-M6 (#768): always initialize to `false` — matching what the server
  // renders (no `window`) — and set the real value in the effect below.
  // Reading `window.matchMedia(query).matches` directly in the initializer
  // returned the real value on the client's first render, diverging from
  // the server-rendered `false` and causing a hydration mismatch.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Returns `true` when the primary pointing device is fine (mouse/trackpad),
 * `false` on touch-only devices. Result is cached and updated if the input
 * type changes (e.g. tablet with keyboard attached).
 */
export function useIsFinePointer(): boolean {
  return useMediaQuery("(pointer: fine)");
}
