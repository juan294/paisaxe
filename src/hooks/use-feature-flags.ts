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

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(cache.data || []);
  const [isLoading, setIsLoading] = useState(!cache.data);

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
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setFlags([]);
          setIsLoading(false);
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

  return { flags, isLoading, isEnabled };
}
