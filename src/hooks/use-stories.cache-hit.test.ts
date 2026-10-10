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

    // A real fresh focus event reuses the query result without a network read.
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(mockGetStoriesFromDB).toHaveBeenCalledTimes(callsAfterMount);
    const { result: follower } = renderHook(() => useStories(), { wrapper });
    expect(follower.current.stories).toEqual(mockStories);
    expect(follower.current.isLoading).toBe(false);
    expect(mockGetStoriesFromDB).toHaveBeenCalledTimes(callsAfterMount);
  });
});
