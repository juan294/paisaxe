"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FALLBACK_STORIES, getStoriesFromDB } from "@/lib/stories-data";
import type { Story } from "@/types/immersive";

// LocalStorage key for persistent cache
const STORAGE_KEY = "paisaxe-stories-cache";
const STORAGE_VERSION = 1; // Increment to invalidate old caches

// Simple in-memory cache for stories
interface StoriesCache {
  data: Story[] | null;
  timestamp: number;
  promise: Promise<Story[]> | null;
}

// LocalStorage cache structure
interface PersistedCache {
  version: number;
  data: Story[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Singleton cache shared across all hook instances
const cache: StoriesCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

interface UseStoriesResult {
  stories: Story[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const StoriesContext = createContext<UseStoriesResult | null>(null);

/**
 * Try to load stories from localStorage
 * Returns null if no valid cache exists
 */
function loadFromStorage(): Story[] | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: PersistedCache = JSON.parse(stored);

    // Check version compatibility
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Check if cache is too old (24 hours max for localStorage)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - parsed.timestamp > maxAge) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed.data;
  } catch {
    // Invalid JSON or other error - clear it
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    return null;
  }
}

/**
 * Save stories to localStorage
 */
function saveToStorage(data: Story[]): void {
  if (typeof window === "undefined") return;

  try {
    const toStore: PersistedCache = {
      version: STORAGE_VERSION,
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Storage full or other error - ignore
    console.warn("Failed to persist stories to localStorage");
  }
}


/**
 * Hook for fetching and caching stories data.
 *
 * Implements stale-while-revalidate pattern with localStorage persistence:
 * - On first load, tries to restore from localStorage (after hydration, in useEffect)
 * - Returns server-provided initialStories immediately when available
 * - Revalidates in background if cache is stale
 * - Deduplicates concurrent requests
 * - Persists to localStorage for next visit
 *
 * localStorage bootstrap is intentionally deferred to a useEffect so the initial
 * render is identical between server and client, preventing hydration mismatches.
 * Only server-provided `initialStories` may seed the cache during render.
 */
function useStoriesState(
  initialStories?: Story[],
  enabled: boolean = true
): UseStoriesResult {
  // Seed in-memory cache from server-provided stories during render.
  // localStorage is intentionally NOT read here — that happens in useEffect
  // below so the server render and first client render produce identical output.
  const initializedFromServer = useRef(false);
  if (!initializedFromServer.current) {
    if (initialStories?.length) {
      // Always apply server-provided stories to ensure freshness post-deploy
      cache.data = initialStories;
      cache.timestamp = Date.now();
    }
    initializedFromServer.current = true;
  }

  const hasInitial = !!(initialStories && initialStories.length > 0);
  // Initial state: use server-provided stories or in-memory cache (set by StoriesProvider
  // or a previous mount), but never from localStorage at render time.
  const [stories, setStories] = useState<Story[]>(cache.data || FALLBACK_STORIES);
  // If we have server-provided initial stories or a warm in-memory cache, skip loading.
  const [isLoading, setIsLoading] = useState(!cache.data && !hasInitial);
  const [error, setError] = useState<Error | null>(null);

  // Bootstrap from localStorage after hydration.
  // This effect runs once per hook instance on the client, after the first render.
  // By running in useEffect (not during render), the server render and first client
  // render produce identical output, preventing hydration mismatches.
  const localStorageBootstrapped = useRef(false);
  useEffect(() => {
    if (localStorageBootstrapped.current) return;
    localStorageBootstrapped.current = true;

    // If in-memory cache already has data (from initialStories or a prior mount), skip.
    if (cache.data) return;

    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      cache.data = stored;
      // Mark as slightly stale so the initial-load effect below triggers revalidation.
      cache.timestamp = Date.now() - CACHE_TTL + 30000; // Revalidate in ~30 s
      setStories(stored);
      setIsLoading(false);
    }
   
  }, []);

  const fetchStories = useCallback(async (force = false): Promise<Story[]> => {
    const now = Date.now();
    const isStale = now - cache.timestamp > CACHE_TTL;

    // Return cached data if fresh and not forcing refresh
    if (cache.data && !isStale && !force) {
      return cache.data;
    }

    // Deduplicate concurrent requests
    if (cache.promise) {
      return cache.promise;
    }

    // Create new fetch promise
    cache.promise = getStoriesFromDB()
      .then((data) => {
        cache.data = data;
        cache.timestamp = Date.now();
        cache.promise = null;

        // Persist to localStorage for next visit
        saveToStorage(data);

        return data;
      })
      .catch((err) => {
        cache.promise = null;
        // Keep stale data on error
        if (cache.data) {
          console.warn("Failed to refresh stories, using cached data:", err);
          return cache.data;
        }
        throw err;
      });

    return cache.promise;
  }, []);

  // Initial load
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;

    async function load() {
      try {
        // If we have cached data, use it immediately
        if (cache.data) {
          setStories(cache.data);
          setIsLoading(false);

          // Check if we need to revalidate in background
          const isStale = Date.now() - cache.timestamp > CACHE_TTL;
          if (isStale) {
            const fresh = await fetchStories();
            if (mounted) {
              setStories(fresh);
            }
          }
        } else {
          // No cache, need to fetch
          const data = await fetchStories();
          if (mounted) {
            setStories(data);
            setIsLoading(false);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to load stories"));
          setIsLoading(false);
          // Use fallback on error
          setStories(FALLBACK_STORIES);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [enabled, fetchStories]);

  // Revalidate on window focus (like SWR)
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleFocus() {
      const isStale = Date.now() - cache.timestamp > CACHE_TTL;
      if (isStale && cache.data) {
        fetchStories().then(setStories).catch(console.error);
      }
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [enabled, fetchStories]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchStories(true);
      setStories(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to refresh stories"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchStories]);

  return {
    stories,
    isLoading,
    error,
    refresh,
  };
}

interface StoriesProviderProps {
  children: ReactNode;
  initialStories?: Story[];
}

export function StoriesProvider({ children, initialStories }: StoriesProviderProps) {
  const value = useStoriesState(initialStories);

  return createElement(StoriesContext.Provider, { value }, children);
}

export function useStories(initialStories?: Story[]) {
  const context = useContext(StoriesContext);
  const fallback = useStoriesState(initialStories, !context);
  return context ?? fallback;
}

/**
 * Prefetch stories data without subscribing to updates.
 * Call this on hover or route prefetch to warm the cache.
 */
export function prefetchStories(): void {
  const isStale = Date.now() - cache.timestamp > CACHE_TTL;
  if (!cache.data || isStale) {
    getStoriesFromDB()
      .then((data) => {
        cache.data = data;
        cache.timestamp = Date.now();
        saveToStorage(data);
      })
      .catch(console.error);
  }
}

/**
 * Clear the stories cache (both memory and localStorage)
 * Useful for debugging or forcing a fresh fetch
 */
export function clearStoriesCache(): void {
  cache.data = null;
  cache.timestamp = 0;
  cache.promise = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
