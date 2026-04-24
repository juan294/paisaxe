"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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

interface UseFeatureFlagsResult {
  flags: FeatureFlag[];
  isReady: boolean;
  isEnabled: (key: FeatureFlagKey) => boolean;
  isEnabledWithDefault: (key: FeatureFlagKey, defaultValue?: boolean) => boolean;
}

const FeatureFlagsContext = createContext<UseFeatureFlagsResult | null>(null);

/**
 * Convert a `Partial<Record<FeatureFlagKey, boolean>>` map (as passed by a
 * server component) into the full `FeatureFlag[]` shape expected by the hook.
 */
function initialFlagsToArray(
  initial: Partial<Record<FeatureFlagKey, boolean>>
): FeatureFlag[] {
  return Object.entries(initial).map(([key, enabled]) => ({
    id: `initial-${key}`,
    flagKey: key as FeatureFlagKey,
    enabled: enabled ?? false,
    label: key,
    description: null,
    config: {},
    environment: "development" as const,
    createdAt: "",
    updatedAt: "",
  }));
}

/**
 * Feature flags hook with deferred loading.
 *
 * Returns flags immediately with defaults (all disabled) and fetches actual
 * values in the background. This prevents blocking the initial render while
 * still enabling feature flags to control UI behavior.
 *
 * Pass `initialFlags` from a server component to eliminate the flag flash:
 * the hook will use those values immediately and skip the initial client fetch.
 * A background refetch still occurs after CACHE_TTL (60 s) to stay fresh.
 *
 * Use `isReady` to determine if flags have actually been loaded from the server.
 * Use `isEnabled` to check individual flags (returns false if not loaded).
 */
function useFeatureFlagsState(
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>,
  enabled: boolean = true
) : UseFeatureFlagsResult {
  // If initialFlags are provided, seed the state and skip the first fetch.
  // We still use the shared module-level cache so multiple hook instances
  // on the same page share a single in-flight request on refetch.
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    if (initialFlags) return initialFlagsToArray(initialFlags);
    return cache.data ?? [];
  });
  // isReady is true immediately when initialFlags are provided — no flash.
  const [isReady, setIsReady] = useState(initialFlags !== undefined || !!cache.data);

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
    if (!enabled) {
      return;
    }

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

    if (initialFlags !== undefined) {
      // Skip the immediate fetch — the caller provided fresh server-rendered values.
      // Schedule a background refresh once the stale window has elapsed so the
      // client eventually re-validates without causing a flash on first paint.
      const delay = CACHE_TTL;
      const timerId = setTimeout(() => {
        if (mounted) load();
      }, delay);
      return () => {
        mounted = false;
        clearTimeout(timerId);
      };
    }

    load();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchFlags]);

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

interface FeatureFlagsProviderProps {
  children: ReactNode;
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>;
}

export function FeatureFlagsProvider({
  children,
  initialFlags,
}: FeatureFlagsProviderProps) {
  const value = useFeatureFlagsState(initialFlags);

  return createElement(FeatureFlagsContext.Provider, { value }, children);
}

export function useFeatureFlags(
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>
): UseFeatureFlagsResult {
  const context = useContext(FeatureFlagsContext);
  const fallback = useFeatureFlagsState(initialFlags, !context);
  return context ?? fallback;
}
