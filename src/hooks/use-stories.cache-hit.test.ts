/**
 * Dedicated test for the fetchStories cache-hit branch (line 142).
 *
 * This file deliberately avoids vi.resetModules() so that v8 coverage
 * correctly attributes execution to the original source. The singleton
 * cache is reset between tests via clearStoriesCache().
 *
 * IMPORTANT: Must be in its own file. When co-located with other tests that
 * create multiple useCallback closures, v8 coverage loses track of the
 * cache-hit branch due to closure-level coverage merging limitations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { stubStoriesApiFetch } from "@/test/mock-stories-api-fetch";

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
];

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
      subtitle: "Fallback Sub",
      description: "Fallback Desc",
      image: "/fallback.png",
      category: "nature",
      sourcePdf: "fallback.pdf",
    },
  ],
}));

stubStoriesApiFetch(mockGetStoriesFromDB);

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
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Single static import — no vi.resetModules() anywhere in this file
// so v8 coverage maps execution back to the original source file.
import React from "react";
import { useStories, clearStoriesCache, StoriesProvider } from "./use-stories";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(StoriesProvider, null, children);

describe("useStories fetchStories cache-hit (line 142)", () => {
  beforeEach(() => {
    mockGetStoriesFromDB.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    mockGetStoriesFromDB.mockResolvedValue(mockStories);
    clearStoriesCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStoriesCache();
  });

  it("returns cached data without fetching when cache is fresh (cache-hit at line 142)", async () => {
    // Step 1: Populate the singleton cache via an initial fetch
    const { result } = renderHook(() => useStories(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.stories).toEqual(mockStories);

    const callsAfterMount = mockGetStoriesFromDB.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThanOrEqual(1);

    // Step 2: Mock Date.now with sequential values.
    // IMPORTANT: jsdom's Event constructor also calls Date.now() internally
    // (to set event.timeStamp), so we need to account for that extra call.
    //
    // Call sequence:
    //   #1 — new Event("focus") [jsdom internal] → doesn't matter, return staleTime
    //   #2 — handleFocus staleness check → must return staleTime (>TTL from cache.timestamp)
    //   #3 — fetchStories staleness check → must return freshTime (within TTL)
    const realNow = Date.now();
    const staleTime = realNow + 6 * 60 * 1000; // 6 min ahead → appears stale
    const freshTime = realNow;                   // original time → appears fresh

    let dateNowCallCount = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      dateNowCallCount++;
      // Calls 1 and 2 return staleTime (jsdom Event + handleFocus check)
      // Call 3+ returns freshTime (fetchStories check → cache hit at line 142)
      return dateNowCallCount <= 2 ? staleTime : freshTime;
    });

    // Step 3: Dispatch focus event
    // handleFocus sees stale (call #2) → calls fetchStories
    // fetchStories sees fresh (call #3) → returns cache.data at line 142
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // Verify Date.now was called >= 3 times (Event ctor + handleFocus + fetchStories)
    expect(dateNowCallCount).toBeGreaterThanOrEqual(3);

    // No additional DB fetch — fetchStories returned cached data at line 142
    expect(mockGetStoriesFromDB.mock.calls.length).toBe(callsAfterMount);

    vi.spyOn(Date, "now").mockRestore();
  });
});
