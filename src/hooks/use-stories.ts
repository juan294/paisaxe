"use client";

import { useState, useEffect, useCallback } from "react";
import { FALLBACK_STORIES, getStoriesFromDB } from "@/lib/stories-data";
import type { Story } from "@/types/immersive";

// Simple in-memory cache for stories
interface StoriesCache {
  data: Story[] | null;
  timestamp: number;
  promise: Promise<Story[]> | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Singleton cache shared across all hook instances
const cache: StoriesCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

/**
 * Hook for fetching and caching stories data.
 * Implements stale-while-revalidate pattern:
 * - Returns cached data immediately if available
 * - Revalidates in background if cache is stale
 * - Deduplicates concurrent requests
 */
export function useStories() {
  const [stories, setStories] = useState<Story[]>(cache.data || FALLBACK_STORIES);
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
      })
      .catch(console.error);
  }
}
