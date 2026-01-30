"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
 * Initialize cache from localStorage if available
 * Called once when module loads on client
 */
function initializeCache(): void {
  if (cache.data) return; // Already initialized

  const stored = loadFromStorage();
  if (stored && stored.length > 0) {
    cache.data = stored;
    // Use stored timestamp but mark as slightly stale to trigger revalidation
    cache.timestamp = Date.now() - CACHE_TTL + 30000; // Will revalidate in 30s
  }
}

/**
 * Hook for fetching and caching stories data.
 *
 * Implements stale-while-revalidate pattern with localStorage persistence:
 * - On first load, tries to restore from localStorage (instant render)
 * - Returns cached data immediately if available
 * - Revalidates in background if cache is stale
 * - Deduplicates concurrent requests
 * - Persists to localStorage for next visit
 */
export function useStories() {
  // Initialize cache from storage on first render
  const initialized = useRef(false);
  if (!initialized.current && typeof window !== "undefined") {
    initializeCache();
    initialized.current = true;
  }

  const [stories, setStories] = useState<Story[]>(cache.data || FALLBACK_STORIES);
  // If we have cached data (from localStorage or memory), don't show loading
  const [isLoading, setIsLoading] = useState(!cache.data);
  const [error, setError] = useState<Error | null>(null);

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
  }, [fetchStories]);

  // Revalidate on window focus (like SWR)
  useEffect(() => {
    function handleFocus() {
      const isStale = Date.now() - cache.timestamp > CACHE_TTL;
      if (isStale && cache.data) {
        fetchStories().then(setStories).catch(console.error);
      }
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchStories]);

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
