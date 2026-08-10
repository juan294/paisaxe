"use client";

import { useState, useEffect, useRef } from "react";
import { subscribeToFeatureFlags } from "@/lib/realtime";
import { rowToFeatureFlag } from "@/types/feature-flags";
import type { FeatureFlag, FeatureFlagRow } from "@/types/feature-flags";

/**
 * React hook that subscribes to Supabase Realtime updates on the
 * `feature_flags` table and merges changes into local state.
 *
 * When a flag is toggled in the admin panel, all active browser sessions
 * pick up the change immediately without polling or page refresh.
 *
 * @param initialFlags - The feature flags array from the server fetch
 * @returns The live-updated flags array
 */
export function useRealtimeFeatureFlags(
  initialFlags: FeatureFlag[]
): FeatureFlag[] {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);

  // Track initial flags changes (e.g., from server re-fetch)
  const prevInitialRef = useRef(initialFlags);
  useEffect(() => {
    if (prevInitialRef.current !== initialFlags) {
      prevInitialRef.current = initialFlags;
      setFlags(initialFlags);
    }
  }, [initialFlags]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    subscribeToFeatureFlags((row: FeatureFlagRow) => {
      const updatedFlag = rowToFeatureFlag(row);

      setFlags((currentFlags) => {
        const index = currentFlags.findIndex(
          (f) => f.flagKey === updatedFlag.flagKey
        );

        if (index >= 0) {
          // Replace the existing flag with the updated one
          const next = [...currentFlags];
          next[index] = updatedFlag;
          return next;
        }

        // New flag not yet in the array -- append it
        return [...currentFlags, updatedFlag];
      });
    }).then((fn) => {
      // The dynamic import behind subscribeToFeatureFlags resolves after
      // this effect may have already been cleaned up (fast unmount/remount).
      // If so, tear down immediately instead of leaking the subscription.
      if (cancelled) {
        fn();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return flags;
}
