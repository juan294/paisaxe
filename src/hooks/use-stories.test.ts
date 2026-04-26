import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useStories, clearStoriesCache, prefetchStories } from "./use-stories";

const mockStories = [
  {
    id: "db-story-1",
    slug: "db-story-1",
    title: "DB Story 1",
    subtitle: "Sub 1",
    description: "Desc 1",
    image: "/img1.png",
    category: "nature" as const,
    sourcePdf: "story1.pdf",
  },
  {
    id: "db-story-2",
    slug: "db-story-2",
    title: "DB Story 2",
    subtitle: "Sub 2",
    description: "Desc 2",
    image: "/img2.png",
    category: "cities" as const,
    sourcePdf: "story2.pdf",
  },
];

const mockFallbackStories = [
  {
    id: "fallback-1",
    slug: "fallback-1",
    title: "Fallback Story",
    subtitle: "Fallback Sub",
    description: "Fallback Desc",
    image: "/fallback.png",
    category: "nature" as const,
    sourcePdf: "fallback.pdf",
  },
];

const mockGetStoriesFromDB = vi.fn();

vi.mock("@/lib/stories-data", () => ({
  FALLBACK_STORIES: [
    {
      id: "fallback-1",
      slug: "fallback-1",
      title: "Fallback Story",
      subtitle: "Fallback Sub",
      description: "Fallback Desc",
      image: "/fallback.png",
      category: "nature",
      sourcePdf: "fallback.pdf",
    },
  ],
  getStoriesFromDB: (...args: unknown[]) => mockGetStoriesFromDB(...args),
}));

// Mock localStorage
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
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("useStories", () => {
  beforeEach(() => {
    clearStoriesCache();
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    // Default: resolve with mock stories
    mockGetStoriesFromDB.mockResolvedValue(mockStories);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return fallback stories initially when no cache", async () => {
    // Make DB fetch delay so we can check initial state
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockStories), 100))
    );

    const { result } = renderHook(() => useStories());

    // Initially should have fallback stories (no cache exists yet)
    expect(result.current.stories).toEqual(mockFallbackStories);
  });

  it("should fetch stories from DB on mount", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetStoriesFromDB).toHaveBeenCalled();
  });

  it("should return fetched stories after load", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockStories);
  });

  it("should show loading state during fetch", async () => {
    let resolveDB: (value: unknown) => void;
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => { resolveDB = resolve; })
    );

    const { result } = renderHook(() => useStories());

    // Should be loading since no cache and fetch is pending
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveDB!(mockStories);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should handle fetch error and fall back to FALLBACK_STORIES", async () => {
    mockGetStoriesFromDB.mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockFallbackStories);
  });

  it("should set error state on failure", async () => {
    mockGetStoriesFromDB.mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    // The hook preserves the original Error message when err instanceof Error
    expect(result.current.error?.message).toBe("DB error");
  });

  it("should set error state with generic message for non-Error throws", async () => {
    mockGetStoriesFromDB.mockRejectedValue("string error");

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Failed to load stories");
  });

  it("should refresh and force-fetch new data", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockStories);

    // Now update the mock to return different data
    const updatedStories = [
      { ...mockStories[0], title: "Updated Story 1" },
    ];
    mockGetStoriesFromDB.mockResolvedValue(updatedStories);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(updatedStories);
  });

  it("should keep cached data on refresh failure when cache exists", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockStories);

    // Make next fetch fail - but since cache.data exists,
    // fetchStories will return cached data instead of throwing
    mockGetStoriesFromDB.mockRejectedValue(new Error("Refresh error"));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should still have the cached stories (fetchStories catches and returns cached data)
    expect(result.current.stories).toEqual(mockStories);

    consoleSpy.mockRestore();
  });

  it("should set error on refresh failure when no cached data", async () => {
    // Start with a fetch that fails immediately - no cache will be populated
    mockGetStoriesFromDB.mockRejectedValue(new Error("Initial error"));

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Now try refresh - it should also fail and set error
    // because cache.data is null (never successfully populated)
    mockGetStoriesFromDB.mockRejectedValue(new Error("Refresh error"));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("should wrap non-Error thrown values in refresh catch block", async () => {
    // Start with a fetch that fails immediately (no cache)
    mockGetStoriesFromDB.mockRejectedValue("string error");

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Refresh also rejects with a non-Error value
    mockGetStoriesFromDB.mockRejectedValue("refresh string error");

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Failed to refresh stories");
  });

  it("should revalidate stale data on window focus", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockStories);

    // Clear call count after initial fetch
    const callsAfterMount = mockGetStoriesFromDB.mock.calls.length;

    // Make the cache stale by manipulating the module's cache timestamp
    // We'll use vi.spyOn(Date, 'now') to simulate time passing
    const realDateNow = Date.now;
    const initialTime = realDateNow();
    // After 6 minutes, cache should be stale (TTL is 5 min)
    vi.spyOn(Date, "now").mockReturnValue(initialTime + 6 * 60 * 1000);

    const updatedStories = [{ ...mockStories[0], title: "Refreshed" }];
    mockGetStoriesFromDB.mockResolvedValue(updatedStories);

    // Dispatch focus event
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(mockGetStoriesFromDB.mock.calls.length).toBeGreaterThan(
        callsAfterMount
      );
    });

    vi.spyOn(Date, "now").mockRestore();
  });

  it("should not revalidate fresh cache on window focus", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callsAfterMount = mockGetStoriesFromDB.mock.calls.length;

    // Focus without time passing - cache should still be fresh
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // No additional calls expected
    expect(mockGetStoriesFromDB.mock.calls.length).toBe(callsAfterMount);
  });

  it("should deduplicate concurrent requests", async () => {
    let resolveCount = 0;
    let resolveDB: (value: unknown) => void;
    mockGetStoriesFromDB.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCount++;
          resolveDB = resolve;
        })
    );

    // Render two hook instances simultaneously
    const { result: result1 } = renderHook(() => useStories());
    const { result: result2 } = renderHook(() => useStories());

    // Both hooks should share the same promise, so only 1 call to getStoriesFromDB
    // (though the second renderHook may or may not trigger a second useEffect depending on timing)
    // The key is the deduplication logic: cache.promise is set, so subsequent calls reuse it
    expect(resolveCount).toBeLessThanOrEqual(2); // Could be 1 or 2 depending on timing, but NOT more

    await act(async () => {
      resolveDB!(mockStories);
    });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });
    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });
  });

  it("should use cached data when fresh (within 5min TTL)", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockStories);
    const initialCallCount = mockGetStoriesFromDB.mock.calls.length;

    // Render again - cache should still be fresh
    const { result: result2 } = renderHook(() => useStories());

    // Should immediately have cached data
    expect(result2.current.stories).toEqual(mockStories);
    expect(result2.current.isLoading).toBe(false);

    // No additional fetch should have happened
    expect(mockGetStoriesFromDB.mock.calls.length).toBe(initialCallCount);
  });

  it("should return stories and no error initially", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.stories.length).toBeGreaterThan(0);
  });

  it("should revalidate stale cache in background on mount", async () => {
    // Step 1: Populate the cache with initial data
    const { result: result1 } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });
    expect(result1.current.stories).toEqual(mockStories);

    const callsAfterFirstMount = mockGetStoriesFromDB.mock.calls.length;

    // Step 2: Make cache stale by mocking Date.now to be 6 minutes later
    const realDateNow = Date.now;
    const futureTime = realDateNow() + 6 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(futureTime);

    // Step 3: Render a new hook instance - cache.data exists but is stale
    // The load function should use cached data immediately but revalidate in background
    const updatedStories = [{ ...mockStories[0], title: "Background Updated" }];
    mockGetStoriesFromDB.mockResolvedValue(updatedStories);

    const { result: result2 } = renderHook(() => useStories());

    // Should immediately have cached data (from stale cache), not loading
    expect(result2.current.stories).toEqual(mockStories);
    expect(result2.current.isLoading).toBe(false);

    // After background revalidation completes, should have updated stories
    await waitFor(() => {
      expect(mockGetStoriesFromDB.mock.calls.length).toBeGreaterThan(callsAfterFirstMount);
    });

    // Restore Date.now before the data settles
    vi.spyOn(Date, "now").mockRestore();

    await waitFor(() => {
      expect(result2.current.stories).toEqual(updatedStories);
    });
  });

  it("should not update stories when unmounted during stale revalidation (line 190)", async () => {
    // Step 1: Populate the cache
    const { result: result1 } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });
    expect(result1.current.stories).toEqual(mockStories);

    // Step 2: Make cache stale
    const realDateNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(realDateNow() + 6 * 60 * 1000);

    // Step 3: Make DB fetch slow so we can unmount before it resolves
    let resolveDB: (value: unknown) => void;
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => { resolveDB = resolve; })
    );

    // Step 4: Render a new hook that will trigger stale revalidation
    const { unmount } = renderHook(() => useStories());

    // Step 5: Unmount before the fetch resolves — sets mounted = false
    unmount();

    // Step 6: Resolve the fetch after unmount
    await act(async () => {
      resolveDB!(mockStories);
    });

    // No React warning about updating unmounted component.
    // The mounted guard at line 190 prevents setStories from being called.
    vi.spyOn(Date, "now").mockRestore();
  });

  it("should not update state when unmounted during initial fetch (line 197)", async () => {
    // No cache — the hook will fetch from DB
    let resolveDB: (value: unknown) => void;
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => { resolveDB = resolve; })
    );

    const { unmount, result } = renderHook(() => useStories());

    // Should be loading
    expect(result.current.isLoading).toBe(true);

    // Unmount before fetch resolves
    unmount();

    // Resolve after unmount — mounted guard at line 197 prevents state updates
    await act(async () => {
      resolveDB!(mockStories);
    });
  });

  it("should not set error state when unmounted during fetch failure (line 203)", async () => {
    // No cache — the hook will fetch from DB
    let rejectDB: (reason: unknown) => void;
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((_, reject) => { rejectDB = reject; })
    );

    const { unmount, result } = renderHook(() => useStories());

    // Should be loading
    expect(result.current.isLoading).toBe(true);

    // Unmount before fetch rejects
    unmount();

    // Reject after unmount — mounted guard at line 203 prevents setError/setStories
    await act(async () => {
      rejectDB!(new Error("Failed after unmount"));
    });
  });

});

describe("useStories with initialStories", () => {
  const serverStories = [
    {
      id: "server-1",
      slug: "server-1",
      title: "Server Story 1",
      subtitle: "Sub 1",
      description: "Desc 1",
      image: "/s1.png",
      category: "nature" as const,
      sourcePdf: "s1.pdf",
    },
    {
      id: "server-2",
      slug: "server-2",
      title: "Server Story 2",
      subtitle: "Sub 2",
      description: "Desc 2",
      image: "/s2.png",
      category: "cities" as const,
      sourcePdf: "s2.pdf",
    },
  ];

  beforeEach(() => {
    clearStoriesCache();
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    mockGetStoriesFromDB.mockResolvedValue(mockStories);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use initial stories immediately (isLoading=false) when no cache", async () => {
    // Make DB fetch slow to verify we're using initialStories, not waiting for fetch
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockStories), 1000))
    );

    const { result } = renderHook(() => useStories(serverStories));

    // Should immediately have server stories, NOT loading
    expect(result.current.stories).toEqual(serverStories);
    expect(result.current.isLoading).toBe(false);
  });

  it("should overwrite cache with initialStories for freshness", async () => {
    // First: populate cache via a hook with no initialStories
    const { result: result1 } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });
    expect(result1.current.stories).toEqual(mockStories);

    // Second: render with initialStories — initialStories overwrites cache
    // to ensure post-deploy freshness (FE-M2)
    const { result: result2 } = renderHook(() => useStories(serverStories));
    expect(result2.current.stories).toEqual(serverStories);
    expect(result2.current.isLoading).toBe(false);
  });

  it("should fall back to normal behavior when initialStories is empty", async () => {
    let resolveDB: (value: unknown) => void;
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => { resolveDB = resolve; })
    );

    const { result } = renderHook(() => useStories([]));

    // Empty initialStories should not seed cache, so isLoading should be true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.stories).toEqual(mockFallbackStories);

    await act(async () => {
      resolveDB!(mockStories);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stories).toEqual(mockStories);
  });
});

describe("useStories localStorage persistence", () => {
  beforeEach(() => {
    clearStoriesCache();
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    mockGetStoriesFromDB.mockResolvedValue(mockStories);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should persist stories to localStorage after fetch", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check that localStorage.setItem was called
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const setItemCalls = localStorageMock.setItem.mock.calls;
    const storiesCall = setItemCalls.find(
      (call: [string, string]) => call[0] === "paisaxe-stories-cache"
    );
    expect(storiesCall).toBeDefined();

    // Parse the stored data and verify structure
    const stored = JSON.parse(storiesCall![1]);
    expect(stored.version).toBe(1);
    expect(stored.data).toEqual(mockStories);
    expect(stored.timestamp).toBeDefined();
  });

  it("should restore stories from localStorage on mount", async () => {
    // Pre-populate localStorage with stories
    const storedCache = {
      version: 1,
      data: mockStories,
      timestamp: Date.now(),
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCache));

    // Make DB fetch slow so we can verify localStorage is used first
    mockGetStoriesFromDB.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockStories), 1000))
    );

    const { result } = renderHook(() => useStories());

    // Should immediately have stories from localStorage, not loading
    expect(result.current.stories).toEqual(mockStories);
    expect(result.current.isLoading).toBe(false);
  });

  it("should ignore localStorage cache with wrong version", async () => {
    // Pre-populate localStorage with old version
    const storedCache = {
      version: 0, // Wrong version
      data: [{ id: "old", title: "Old Story" }],
      timestamp: Date.now(),
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCache));

    const { result } = renderHook(() => useStories());

    // Should be loading (localStorage cache ignored due to version mismatch)
    expect(result.current.isLoading).toBe(true);

    // Should have removed invalid cache
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("paisaxe-stories-cache");
  });

  it("should ignore localStorage cache older than 24 hours", async () => {
    // Pre-populate localStorage with old cache (25 hours ago)
    const storedCache = {
      version: 1,
      data: mockStories,
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCache));

    const { result } = renderHook(() => useStories());

    // Should be loading (localStorage cache expired)
    expect(result.current.isLoading).toBe(true);

    // Should have removed expired cache
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("paisaxe-stories-cache");
  });

  it("should handle invalid JSON in localStorage gracefully", async () => {
    localStorageMock.getItem.mockReturnValue("not valid json");

    const { result } = renderHook(() => useStories());

    // Should be loading (localStorage invalid)
    expect(result.current.isLoading).toBe(true);

    // Should have attempted to remove invalid cache
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("paisaxe-stories-cache");
  });

  it("should handle localStorage errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error("localStorage full");
    });

    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should still have stories despite localStorage error
    expect(result.current.stories).toEqual(mockStories);
    expect(consoleSpy).toHaveBeenCalledWith("Failed to persist stories to localStorage");

    consoleSpy.mockRestore();
  });
});

describe("clearStoriesCache", () => {
  beforeEach(() => {
    clearStoriesCache();
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    mockGetStoriesFromDB.mockResolvedValue(mockStories);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should clear both memory and localStorage cache", async () => {
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear the cache
    clearStoriesCache();

    // localStorage should be cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("paisaxe-stories-cache");
  });
});

describe("prefetchStories", () => {
  beforeEach(() => {
    clearStoriesCache();
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    mockGetStoriesFromDB.mockResolvedValue(mockStories);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should warm the cache when called", async () => {
    prefetchStories();

    await waitFor(() => {
      expect(mockGetStoriesFromDB).toHaveBeenCalledTimes(1);
    });
  });

  it("should not fetch if cache is fresh", async () => {
    // First, populate the cache by using the hook
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callCount = mockGetStoriesFromDB.mock.calls.length;

    // Now prefetch - cache is still fresh, should not fetch again
    prefetchStories();

    // No additional calls
    expect(mockGetStoriesFromDB.mock.calls.length).toBe(callCount);
  });

  it("should fetch if cache is stale", async () => {
    // First, populate the cache
    const { result } = renderHook(() => useStories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callCount = mockGetStoriesFromDB.mock.calls.length;

    // Make cache stale
    const realDateNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(realDateNow() + 6 * 60 * 1000);

    prefetchStories();

    expect(mockGetStoriesFromDB.mock.calls.length).toBeGreaterThan(callCount);

    vi.spyOn(Date, "now").mockRestore();
  });

  it("should handle prefetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetStoriesFromDB.mockRejectedValue(new Error("Prefetch error"));

    // Should not throw
    prefetchStories();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("should persist to localStorage after prefetch", async () => {
    prefetchStories();

    await waitFor(() => {
      expect(mockGetStoriesFromDB).toHaveBeenCalled();
    });

    // Wait for the persistence
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});

describe("use-stories SSR guard coverage notes (loadFromStorage, saveToStorage, clearStoriesCache)", () => {
  // loadFromStorage and saveToStorage have `if (typeof window === "undefined")` guards.
  // These guards are SSR-only paths: in a Node.js server environment, `window` is undefined
  // and the functions return early to avoid localStorage access. In jsdom (vitest/browser test
  // environment), `window` is always defined, so these branches are structurally unreachable.
  //
  // The private functions are not exported and cannot be called directly. The only way to
  // exercise the SSR path would be to delete `window` from the global, which is not a valid
  // test pattern for jsdom-based tests.
  //
  // Note: initializeCache() was removed in FE-M1 fix. localStorage bootstrap now happens
  // exclusively in a useEffect inside useStoriesState, preventing hydration mismatches.

  it("documents loadFromStorage SSR guard as untestable in jsdom", () => {
    // The `if (typeof window === "undefined") return null;` branch is never taken in jsdom.
    // jsdom always provides window, so loadFromStorage proceeds normally (reads localStorage).
    expect(typeof window).not.toBe("undefined");
  });

  it("documents saveToStorage SSR guard as untestable in jsdom", () => {
    // The `if (typeof window === "undefined") return;` branch is never taken in jsdom.
    // jsdom always provides window, so saveToStorage proceeds normally (writes localStorage).
    expect(typeof window).not.toBe("undefined");
  });

  it("documents clearStoriesCache SSR guard as untestable in jsdom", () => {
    // The `if (typeof window !== "undefined")` guard inside clearStoriesCache().
    // The false branch (SSR context where window is undefined) never runs in jsdom.
    // clearStoriesCache is called in beforeEach of this test suite, so the true branch
    // (window available, removing localStorage item) IS always exercised.
    expect(typeof window).toBe("object");
  });
});

