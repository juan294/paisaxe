/**
 * FE-M1: useStories localStorage bootstrap must not happen during render.
 *
 * The hook must initialize state from `initialStories` only (or FALLBACK_STORIES
 * when none provided). localStorage cache reconciliation must happen in a
 * useEffect so the server render and first client render produce identical output,
 * preventing hydration mismatches.
 *
 * Key invariants:
 * - Initial render WITHOUT initialStories must start with FALLBACK_STORIES + isLoading=true
 *   even when localStorage contains a valid cache. (Before fix: cache was bootstrapped during
 *   render, so isLoading was false immediately.)
 * - Initial render WITH initialStories must use those stories (isLoading=false).
 * - After the effect runs, a valid localStorage cache should be applied.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { stubStoriesApiFetch } from "@/test/mock-stories-api-fetch";

// FE-H1 (#759): use-stories.ts now fetches through /api/stories instead of
// calling getStoriesFromDB directly. See use-stories.test.ts for the full
// rationale — the global fetch mock wraps mockGetStoriesFromDB in the same
// `{ data: [...] }` envelope the real route returns.
const mockGetStoriesFromDB = vi.fn();

vi.mock("@/lib/stories-fallback", () => ({
  FALLBACK_STORIES: [
    {
      id: "fallback-1",
      slug: "fallback-1",
      title: "Fallback Story",
      subtitle: "Fallback",
      description: "Fallback",
      image: "/fallback.png",
      category: "nature",
      sourcePdf: "fallback.pdf",
    },
  ],
}));

stubStoriesApiFetch(mockGetStoriesFromDB);

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _setStore: (key: string, value: string) => {
      store[key] = value;
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

import React from "react";
import { useStories, clearStoriesCache, StoriesProvider } from "./use-stories";

const cachedStories = [
  {
    id: "cached-1",
    slug: "cached-1",
    title: "Cached Story",
    subtitle: "Sub",
    description: "Desc",
    image: "/c.png",
    category: "nature" as const,
    sourcePdf: "c.pdf",
  },
];

const serverStories = [
  {
    id: "server-1",
    slug: "server-1",
    title: "Server Story",
    subtitle: "Sub",
    description: "Desc",
    image: "/s.png",
    category: "nature" as const,
    sourcePdf: "s.pdf",
  },
];

const cachedStoriesFromStorage = cachedStories.map((story) => ({
  ...story,
  sourcePdf: "",
}));

const fallbackStory = {
  id: "fallback-1",
  slug: "fallback-1",
  title: "Fallback Story",
  subtitle: "Fallback",
  description: "Fallback",
  image: "/fallback.png",
  category: "nature" as const,
  sourcePdf: "fallback.pdf",
};

describe("FE-M1: useStories initial render uses initialStories or FALLBACK_STORIES only", () => {
  beforeEach(() => {
    clearStoriesCache();
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    // mockReset resets both call counts AND implementation (returns undefined by default)
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
    localStorageMock.removeItem.mockReset();
    // Restore default implementation: reads from the internal store
    localStorageMock.getItem.mockImplementation(
      (key: string) => {
        // The store was just cleared above, so this returns null for all keys
        // unless a specific test overrides it.
        void key;
        return null;
      }
    );
    // Default: slow fetch so loading state is observable
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(cachedStories), 5000))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStoriesCache();
  });

  it("without initialStories and with valid localStorage cache: initial render must show FALLBACK_STORIES with isLoading=true", () => {
    // Pre-populate localStorage with a valid cache
    const storedCache = {
      version: 1,
      data: cachedStories,
      timestamp: Date.now(),
    };
    localStorageMock._setStore("paisaxe-stories-cache", JSON.stringify(storedCache));
    localStorageMock.getItem.mockImplementation(
      (key: string) => (key === "paisaxe-stories-cache" ? JSON.stringify(storedCache) : null)
    );

    // Capture state synchronously before any effects run by using a lazy initializer spy.
    // We test the useState initial values by checking what renderHook returns on the
    // VERY FIRST synchronous render — before effects flush.
    //
    // We use fake timers to prevent effects from running, then check the initial state.
    vi.useFakeTimers();

    let capturedInitialStories: unknown;
    let capturedInitialLoading: unknown;

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StoriesProvider, null, children);

    // Render without wrapping in act (to capture pre-effect state)
    // renderHook always wraps in act, so we intercept the first render using
    // a wrapper that captures state during the first render pass.
    const { result } = renderHook(() => {
      const hookResult = useStories();
      // Capture on first synchronous render
      if (capturedInitialStories === undefined) {
        capturedInitialStories = hookResult.stories;
        capturedInitialLoading = hookResult.isLoading;
      }
      return hookResult;
    }, { wrapper });

    // With fake timers, useEffect callbacks are deferred (they require timer advancement).
    // So `capturedInitialStories` reflects the state from the RENDER phase only.
    // After fix: localStorage is not read during render → initial state = FALLBACK_STORIES + isLoading=true
    expect(capturedInitialStories).toEqual([fallbackStory]);
    expect(capturedInitialLoading).toBe(true);

    vi.useRealTimers();
    // Verify result exists (cleanup reference)
    expect(result.current).toBeDefined();
  });

  it("without initialStories and no localStorage: initial render shows FALLBACK_STORIES with isLoading=true", () => {
    vi.useFakeTimers();

    let capturedStories: unknown;
    let capturedLoading: unknown;

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StoriesProvider, null, children);

    renderHook(() => {
      const hookResult = useStories();
      if (capturedStories === undefined) {
        capturedStories = hookResult.stories;
        capturedLoading = hookResult.isLoading;
      }
      return hookResult;
    }, { wrapper });

    // No localStorage, no initialStories → must start with fallback + loading
    expect(capturedStories).toEqual([fallbackStory]);
    expect(capturedLoading).toBe(true);

    vi.useRealTimers();
  });

  it("with initialStories: initial render uses those stories with isLoading=false", () => {
    vi.useFakeTimers();

    let capturedStories: unknown;
    let capturedLoading: unknown;

    const wrapperWithInitial = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StoriesProvider, { initialStories: serverStories }, children);

    renderHook(() => {
      const hookResult = useStories();
      if (capturedStories === undefined) {
        capturedStories = hookResult.stories;
        capturedLoading = hookResult.isLoading;
      }
      return hookResult;
    }, { wrapper: wrapperWithInitial });

    // Server-provided stories must be used immediately
    expect(capturedStories).toEqual(serverStories);
    expect(capturedLoading).toBe(false);

    vi.useRealTimers();
  });

  it("localStorage bootstrap happens in effect: after render, valid cache is applied", async () => {
    // Pre-populate localStorage with a valid, fresh cache
    const storedCache = {
      version: 1,
      data: cachedStories,
      timestamp: Date.now(),
    };
    localStorageMock.getItem.mockImplementation(
      (key: string) => (key === "paisaxe-stories-cache" ? JSON.stringify(storedCache) : null)
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StoriesProvider, null, children);
    const { result } = renderHook(() => useStories(), { wrapper });

    // After effects run (waitFor flushes them), the cached stories should be in state
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(cachedStoriesFromStorage);
    // localStorage.getItem must have been called (in the effect, not during render)
    expect(localStorageMock.getItem).toHaveBeenCalledWith("paisaxe-stories-cache");
  });

  it("initialStories prevents localStorage read", async () => {
    // Even if localStorage has data, when initialStories are provided,
    // localStorage should NOT be consulted (in-memory cache is already set).
    const storedCache = {
      version: 1,
      data: cachedStories,
      timestamp: Date.now(),
    };
    localStorageMock.getItem.mockImplementation(
      (key: string) => (key === "paisaxe-stories-cache" ? JSON.stringify(storedCache) : null)
    );
    localStorageMock.getItem.mockClear();

    const wrapperWithInitial = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StoriesProvider, { initialStories: serverStories }, children);
    const { result } = renderHook(() => useStories(), { wrapper: wrapperWithInitial });

    // Initial render: server stories, not loading
    expect(result.current.stories).toEqual(serverStories);
    expect(result.current.isLoading).toBe(false);

    // Let effects settle
    await act(async () => {});

    // localStorage should NOT have been read because initialStories seeded the cache
    expect(localStorageMock.getItem).not.toHaveBeenCalledWith("paisaxe-stories-cache");
  });

  it("without initialStories and no localStorage: fetches from DB after hydration", async () => {
    // Fast fetch for this test
    mockGetStoriesFromDB.mockResolvedValue(cachedStories);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StoriesProvider, null, children);
    const { result } = renderHook(() => useStories(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(cachedStories);
    expect(mockGetStoriesFromDB).toHaveBeenCalledTimes(1);
  });
});
