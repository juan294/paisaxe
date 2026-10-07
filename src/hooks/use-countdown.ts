"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  /** Milliseconds left, 0 once expired, null without an expiry. */
  remainingMs: number | null;
  /** "m:ss", or null without an expiry. */
  label: string | null;
  expired: boolean;
}

const remainingUntil = (expiresAt: string) => Math.max(0, Date.parse(expiresAt) - Date.now());

function format(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * A once-a-second countdown to an ISO instant, such as a booking hold's expiry
 * (docs/plans/2026-10-07-booking-ui-polish.md, U09). Stops ticking at zero, so
 * the page re-renders into its expired state without any other trigger.
 */
export function useCountdown(expiresAt: string | null): Countdown {
  const [remainingMs, setRemainingMs] = useState(() => (expiresAt ? remainingUntil(expiresAt) : null));

  useEffect(() => {
    if (!expiresAt) return setRemainingMs(null);
    setRemainingMs(remainingUntil(expiresAt));
    if (remainingUntil(expiresAt) === 0) return;
    const timer = setInterval(() => {
      const left = remainingUntil(expiresAt);
      setRemainingMs(left);
      if (left === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (remainingMs === null) return { remainingMs: null, label: null, expired: false };
  return { remainingMs, label: format(remainingMs), expired: remainingMs === 0 };
}
