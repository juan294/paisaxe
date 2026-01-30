"use client";

import { useState, useEffect, useCallback } from "react";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";

interface FlagsCache {
  data: FeatureFlag[] | null;
  timestamp: number;
  promise: Promise<FeatureFlag[]> | null;
}

const CACHE_TTL = 60_000; // 1 minute

const cache: FlagsCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

/**
 * Feature flags hook with deferred loading.
 *
 * Returns flags immediately with defaults (all disabled) and fetches actual
 * values in the background. This prevents blocking the initial render while
 * still enabling feature flags to control UI behavior.
 *
 * Use `isReady` to determine if flags have actually been loaded from the server.
 * Use `isEnabled` to check individual flags (returns false if not loaded).
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(cache.data || []);
  // isReady indicates whether flags have been fetched at least once
  // This is different from isLoading - we render immediately with defaults
  const [isReady, setIsReady] = useState(!!cache.data);

  const fetchFlags = useCallback(async (): Promise<FeatureFlag[]> => {
    const now = Date.now();
    const isStale = now - cache.timestamp > CACHE_TTL;

    if (cache.data && !isStale) {
      return cache.data;
    }

    if (cache.promise) {
      return cache.promise;
    }

    cache.promise = fetch("/api/feature-flags")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch flags");
        const json = await res.json();
        cache.data = json.data;
        cache.timestamp = Date.now();
        cache.promise = null;
        return json.data;
      })
      .catch((err) => {
        cache.promise = null;
        if (cache.data) {
          console.warn("Failed to refresh feature flags, using cached:", err);
          return cache.data;
        }
        console.warn("Failed to fetch feature flags, defaulting all to false:", err);
        return [];
      });

    return cache.promise;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await fetchFlags();
        if (mounted) {
          setFlags(data);
          setIsReady(true);
        }
      } catch {
        if (mounted) {
          setFlags([]);
          setIsReady(true);
        }
      }
    }

    load();
    return () => { mounted = false; };
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (key: FeatureFlagKey): boolean => {
      const flag = flags.find((f) => f.flagKey === key);
      return flag?.enabled ?? false;
    },
    [flags]
  );

  /**
   * Check if a flag is enabled, with a fallback value while loading.
   * Use this when you want to show UI optimistically during initial load.
   */
  const isEnabledWithDefault = useCallback(
    (key: FeatureFlagKey, defaultValue: boolean = false): boolean => {
      if (!isReady) return defaultValue;
      const flag = flags.find((f) => f.flagKey === key);
      return flag?.enabled ?? false;
    },
    [flags, isReady]
  );

  return {
    flags,
    /** Whether flags have been loaded from server */
    isReady,
    /** Check if a flag is enabled (returns false while loading) */
    isEnabled,
    /** Check if a flag is enabled with a default value while loading */
    isEnabledWithDefault,
  };
}
