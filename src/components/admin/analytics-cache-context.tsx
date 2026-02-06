"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AdminApiResponse } from "@/types/admin";

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

interface AnalyticsCacheContextValue {
  cache: Map<string, CacheEntry>;
  inflight: Map<string, Promise<unknown>>;
}

const AnalyticsCacheContext = createContext<AnalyticsCacheContextValue | null>(
  null
);

export function AnalyticsCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef(new Map<string, CacheEntry>());
  const inflightRef = useRef(new Map<string, Promise<unknown>>());

  // Stable context value — refs don't change identity
  const valueRef = useRef<AnalyticsCacheContextValue>({
    cache: cacheRef.current,
    inflight: inflightRef.current,
  });

  return (
    <AnalyticsCacheContext.Provider value={valueRef.current}>
      {children}
    </AnalyticsCacheContext.Provider>
  );
}

interface UseAnalyticsDataOptions {
  staleTime?: number;
  enabled?: boolean;
}

interface UseAnalyticsDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string;
  refresh: () => void;
}

export function useAnalyticsData<T>(
  tabKey: string,
  fetchFn: () => Promise<AdminApiResponse<T>>,
  params: string,
  options?: UseAnalyticsDataOptions
): UseAnalyticsDataResult<T> {
  const ctx = useContext(AnalyticsCacheContext);
  if (!ctx) {
    throw new Error(
      "useAnalyticsData must be used within an AnalyticsCacheProvider"
    );
  }

  const { cache, inflight } = ctx;
  const staleTime = options?.staleTime ?? STALE_TIME;
  const enabled = options?.enabled ?? true;

  const cacheKey = `${tabKey}:${params}`;

  const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [isLoading, setIsLoading] = useState(!cached && enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Track current cache key to avoid stale updates
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Counter to force effect re-run when staleness is detected during render
  const [revalidationTrigger, setRevalidationTrigger] = useState(0);

  const doFetch = useCallback(
    (isBackground: boolean) => {
      const key = cacheKeyRef.current;

      // Deduplication: if there's already an inflight request for this key, skip
      if (inflight.has(key)) {
        return;
      }

      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError("");

      const promise = fetchFnRef.current().then((result) => {
        inflight.delete(key);

        // Only update state if the cache key hasn't changed while fetching
        if (cacheKeyRef.current !== key) return;

        if (result.error) {
          setError(result.error);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        if (result.data !== undefined) {
          cache.set(key, { data: result.data, timestamp: Date.now() });
          setData(result.data);
        }
        setIsLoading(false);
        setIsRefreshing(false);
      });

      inflight.set(key, promise);
    },
    [cache, inflight]
  );

  // Render-time staleness check: if cached data exists but is stale,
  // bump the trigger to force the effect to re-run and start background revalidation.
  // This handles same-key re-renders (e.g., tab switch back to a panel).
  if (enabled && cached && !inflight.has(cacheKey)) {
    const isStale = Date.now() - cached.timestamp > staleTime;
    if (isStale) {
      // Schedule a state update to trigger the effect on next render
      // Using queueMicrotask to avoid setState-during-render warnings
      queueMicrotask(() => setRevalidationTrigger((n) => n + 1));
    }
  }

  // Fetch on mount / params change / revalidation trigger
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const entry = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (entry) {
      // Cache hit — use cached data
      setData(entry.data);
      setIsLoading(false);

      // Check staleness
      const isStale = Date.now() - entry.timestamp > staleTime;
      if (isStale) {
        doFetch(true);
      }
    } else {
      // Cache miss — full load
      setData(null);
      doFetch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, revalidationTrigger]);

  const refresh = useCallback(() => {
    cache.delete(cacheKeyRef.current);
    inflight.delete(cacheKeyRef.current);
    doFetch(true);
  }, [cache, inflight, doFetch]);

  return { data, isLoading, isRefreshing, error, refresh };
}
