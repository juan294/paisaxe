"use client";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getBrowserQueryClient,
  publicQueryKey,
  useClientQueryClient,
} from "@/lib/client-query";
import { FALLBACK_STORIES } from "@/lib/stories-fallback";
import { clientLogger } from "@/lib/client-logger";
import type { PublicStory, Story } from "@/types/immersive";
import {
  publicStoryToStory,
  toPublicStory,
  VALID_CATEGORIES,
  STORY_SOURCE_TYPES,
} from "@/types/immersive";
const STORAGE_KEY = "paisaxe-stories-cache";
const STORAGE_VERSION = 1;
const CACHE_TTL = 5 * 60 * 1000;
const key = publicQueryKey("stories");
interface PersistedCache {
  version: number;
  data: PublicStory[];
  timestamp: number;
}
interface UseStoriesResult {
  stories: Story[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const StoriesContext = createContext<UseStoriesResult | null>(null);

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const optionalStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(
    (key) => value[key] === undefined || typeof value[key] === "string",
  );
function validPublicStory(value: unknown): value is PublicStory {
  if (
    !record(value) ||
    !["id", "title", "subtitle", "description", "image"].every(
      (key) => typeof value[key] === "string",
    )
  )
    return false;
  if (
    !optionalStrings(value, [
      "slug",
      "imageSource",
      "blurDataUrl",
      "createdAt",
      "location",
      "duration",
    ])
  )
    return false;
  if (
    !VALID_CATEGORIES.includes(value.category as PublicStory["category"]) ||
    (value.sourceType !== undefined &&
      !STORY_SOURCE_TYPES.includes(
        value.sourceType as PublicStory["sourceType"] & string,
      ))
  )
    return false;
  if (
    value.displayOrder !== undefined &&
    (typeof value.displayOrder !== "number" ||
      !Number.isFinite(value.displayOrder))
  )
    return false;
  if (value.relatedStories !== undefined && !strings(value.relatedStories))
    return false;
  if (
    value.bestMonths !== undefined &&
    (!Array.isArray(value.bestMonths) ||
      !value.bestMonths.every(
        (month) => Number.isInteger(month) && month >= 1 && month <= 12,
      ))
  )
    return false;
  if (value.metadata === undefined) return true;
  if (
    !record(value.metadata) ||
    !optionalStrings(value.metadata, ["asturianu_title", "asturianu_subtitle"])
  )
    return false;
  const metadata = value.metadata;
  if (
    ["question_prompts", "mood_tags"].some(
      (key) => metadata[key] !== undefined && !strings(metadata[key]),
    )
  )
    return false;
  if (metadata.translations === undefined) return true;
  return (
    record(metadata.translations) &&
    Object.values(metadata.translations).every(
      (translation) =>
        record(translation) &&
        optionalStrings(translation, ["title", "subtitle", "description"]) &&
        (translation.question_prompts === undefined ||
          strings(translation.question_prompts)),
    )
  );
}

function loadFromStorage(): Story[] | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: PersistedCache = JSON.parse(stored);

    if (
      !Number.isFinite(parsed.timestamp) ||
      parsed.timestamp > Date.now() ||
      !Array.isArray(parsed.data) ||
      !parsed.data.every(validPublicStory)
    )
      throw new Error("Invalid story cache");

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

    return parsed.data.map(publicStoryToStory);
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
      data: data.map(toPublicStory),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Storage full or other error - ignore
    clientLogger.warn(
      "[STORIES_CACHE] Failed to persist stories to localStorage",
    );
  }
}

async function fetchStories(signal?: AbortSignal): Promise<Story[]> {
  try {
    const response = await fetch("/api/stories", { signal });
    if (!response.ok)
      throw new Error(`Failed to fetch stories: ${response.status}`);
    const payload: { data: Story[] } = await response.json();
    signal?.throwIfAborted();
    saveToStorage(payload.data);
    return payload.data;
  } catch (error) {
    if (signal?.aborted) throw error;
    clientLogger.warn("Failed to refresh stories, using cached", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error instanceof Error ? error : new Error("Failed to fetch stories");
  }
}

function useStoriesState(
  initialStories?: Story[],
  initialUpdatedAt?: number,
): UseStoriesResult {
  const client = useClientQueryClient();
  const [ready, setReady] = useState(false);
  const seed = initialStories?.length ? initialStories : undefined;
  const query = useQuery(
    {
      queryKey: key,
      queryFn: ({ signal }) => fetchStories(signal),
      staleTime: CACHE_TTL,
      enabled: ready,
    },
    client,
  );
  useEffect(() => {
    const cachedAt = client.getQueryState(key)?.dataUpdatedAt;
    if (
      seed &&
      (!client.getQueryData(key) ||
        (initialUpdatedAt !== undefined &&
          Number.isFinite(initialUpdatedAt) &&
          initialUpdatedAt > (cachedAt ?? 0)))
    ) {
      // A newer seed supersedes reads started against the previous snapshot.
      void client.cancelQueries({ queryKey: key, exact: true });
      client.setQueryData(
        key,
        seed,
        initialUpdatedAt === undefined
          ? undefined
          : { updatedAt: initialUpdatedAt },
      );
    } else if (!client.getQueryData(key)) {
      const stored = loadFromStorage();
      // Preserve the previous persistent-cache bootstrap's 30-second grace.
      if (stored)
        client.setQueryData(key, stored, {
          updatedAt: Date.now() - CACHE_TTL + 30_000,
        });
    }
    setReady(true);
  }, [client, seed, initialUpdatedAt]);
  useEffect(() => {
    const focus = () => {
      const state = client.getQueryState(key);
      if (state?.data && Date.now() - state.dataUpdatedAt >= CACHE_TTL)
        void client.refetchQueries(
          { queryKey: key, exact: true, type: "active" },
          { cancelRefetch: false },
        );
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [client]);
  const refetch = query.refetch;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const stories =
    !ready && seed ? seed : (query.data ?? seed ?? FALLBACK_STORIES);
  const isLoading = !seed && query.isPending && !query.error;
  const error = query.error;
  return useMemo(
    () => ({ stories, isLoading, error, refresh }),
    [stories, isLoading, error, refresh],
  );
}

export function StoriesProvider({
  children,
  initialStories,
  initialUpdatedAt,
}: {
  children?: ReactNode;
  initialStories?: Story[];
  initialUpdatedAt?: number;
}) {
  return createElement(
    StoriesContext.Provider,
    { value: useStoriesState(initialStories, initialUpdatedAt) },
    children,
  );
}
export function useStories() {
  const context = useContext(StoriesContext);
  if (!context)
    throw new Error("useStories must be used within a StoriesProvider");
  return context;
}
export function prefetchStories(): void {
  const client = getBrowserQueryClient();
  void client
    .fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) => fetchStories(signal),
      staleTime: CACHE_TTL,
    })
    .catch((error: unknown) =>
      clientLogger.error("[STORIES_PREFETCH_FAILURE]", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
}
export function clearStoriesCache(): void {
  const client = getBrowserQueryClient();
  void client.cancelQueries({ queryKey: key });
  client.removeQueries({ queryKey: key });
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Optional persistence. */
    }
  }
}
