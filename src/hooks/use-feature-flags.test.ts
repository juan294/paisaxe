import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { FeatureFlag } from "@/types/feature-flags";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeFlag(
  key: string,
  enabled: boolean
): FeatureFlag {
  return {
    id: `id-${key}`,
    flagKey: key as FeatureFlag["flagKey"],
    enabled,
    label: key,
    description: null,
    config: {},
    environment: "development",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("useFeatureFlags", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Reset the module cache so the singleton cache object is fresh each test
    vi.resetModules();
  });

  it("should return empty flags initially while loading", async () => {
    // Never-resolving fetch so we can observe the loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toEqual([]);
    expect(result.current.isReady).toBe(false);
  });

  it("should fetch flags from /api/feature-flags", async () => {
    const flags = [makeFlag("contextual_prompts", true)];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/feature-flags");
    expect(result.current.flags).toEqual(flags);
  });

  it("should return isEnabled(key) = true when flag is enabled", async () => {
    const flags = [
      makeFlag("contextual_prompts", true),
      makeFlag("related_stories", false),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.isEnabled("contextual_prompts")).toBe(true);
  });

  it("should return isEnabled(key) = false when flag is disabled", async () => {
    const flags = [
      makeFlag("contextual_prompts", true),
      makeFlag("related_stories", false),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.isEnabled("related_stories")).toBe(false);
  });

  it("should return isEnabled(key) = false when flag key is missing", async () => {
    const flags = [makeFlag("contextual_prompts", true)];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.isEnabled("surprise_me")).toBe(false);
  });

  it("should default all flags to false on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.flags).toEqual([]);
    expect(result.current.isEnabled("contextual_prompts")).toBe(false);
    expect(result.current.isEnabled("related_stories")).toBe(false);
  });

  it("should default all flags to false when response is not ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.flags).toEqual([]);
    expect(result.current.isEnabled("contextual_prompts")).toBe(false);
  });
});

describe("useFeatureFlags isReady state", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("should set isReady to false initially when no cache", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.isReady).toBe(false);
  });

  it("should set isReady to true after successful fetch", async () => {
    const flags = [makeFlag("contextual_prompts", true)];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });

  it("should set isReady to true even after fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });
});

describe("useFeatureFlags isEnabledWithDefault", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("should return default value while loading", async () => {
    // Never-resolving fetch to stay in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    // While loading, should return the default value
    expect(result.current.isEnabledWithDefault("contextual_prompts", true)).toBe(true);
    expect(result.current.isEnabledWithDefault("contextual_prompts", false)).toBe(false);
    expect(result.current.isEnabledWithDefault("related_stories")).toBe(false); // default is false
  });

  it("should return actual flag value after loading", async () => {
    const flags = [
      makeFlag("contextual_prompts", true),
      makeFlag("related_stories", false),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Should return actual flag value, ignoring the default
    expect(result.current.isEnabledWithDefault("contextual_prompts", false)).toBe(true);
    expect(result.current.isEnabledWithDefault("related_stories", true)).toBe(false);
  });

  it("should return false for unknown flag after loading (ignoring default)", async () => {
    const flags = [makeFlag("contextual_prompts", true)];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Unknown flag should return false after loading (not the default)
    expect(result.current.isEnabledWithDefault("surprise_me", true)).toBe(false);
  });
});

describe("useFeatureFlags cache behavior", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("should return cached data without fetching again when cache is fresh (line 41)", async () => {
    const flags = [makeFlag("contextual_prompts", true)];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: flags }),
    });

    // Import the module once — cache will be shared across renders
    const { useFeatureFlags } = await import("./use-feature-flags");

    // First render: populates the cache
    const { result: result1, unmount } = renderHook(() => useFeatureFlags());
    await waitFor(() => {
      expect(result1.current.isReady).toBe(true);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    unmount();

    // Second render: same module, cache is still fresh (within 60s TTL)
    const { result: result2 } = renderHook(() => useFeatureFlags());

    // Should be immediately ready from cache (isReady starts true because cache.data exists)
    expect(result2.current.isReady).toBe(true);
    expect(result2.current.flags).toEqual(flags);

    // fetch should NOT have been called again — served from fresh cache
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should deduplicate in-flight requests and return the same promise (line 45)", async () => {
    let resolveFirstFetch!: (value: Response) => void;
    mockFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFirstFetch = resolve;
      })
    );

    // Import the module once — cache will be shared
    const { useFeatureFlags } = await import("./use-feature-flags");

    // First render: starts a fetch that hangs
    const { result: result1 } = renderHook(() => useFeatureFlags());
    expect(result1.current.isReady).toBe(false);

    // Second render: while first fetch is still pending
    const { result: result2 } = renderHook(() => useFeatureFlags());
    expect(result2.current.isReady).toBe(false);

    // fetch should only have been called ONCE — second render joined the existing promise
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Now resolve the hanging fetch
    const flags = [makeFlag("contextual_prompts", true)];
    resolveFirstFetch({
      ok: true,
      json: async () => ({ data: flags }),
    } as Response);

    // Both hooks should receive the data
    await waitFor(() => {
      expect(result1.current.isReady).toBe(true);
    });
    await waitFor(() => {
      expect(result2.current.isReady).toBe(true);
    });

    expect(result1.current.flags).toEqual(flags);
    expect(result2.current.flags).toEqual(flags);
    // Still only one fetch call total
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should return cached data when a refresh fetch fails (lines 60-61)", async () => {
    const flags = [makeFlag("contextual_prompts", true)];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: flags }),
    });

    // Import the module once — cache will be shared
    const { useFeatureFlags } = await import("./use-feature-flags");

    // First render: populates the cache successfully
    const { result: result1, unmount } = renderHook(() => useFeatureFlags());
    await waitFor(() => {
      expect(result1.current.isReady).toBe(true);
    });
    expect(result1.current.flags).toEqual(flags);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    unmount();

    // Force the cache to become stale by advancing time past TTL (60s)
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120_000);

    // Make the next fetch fail
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Second render: cache is stale, fetch will fail, should fall back to cached data
    const { result: result2 } = renderHook(() => useFeatureFlags());
    await waitFor(() => {
      expect(result2.current.isReady).toBe(true);
    });

    // Should still have the cached flags from the first fetch
    expect(result2.current.flags).toEqual(flags);
    // Should have warned about using cached data
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to refresh feature flags, using cached:",
      expect.any(Error)
    );

    warnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("should set flags to [] when useEffect load() catch block triggers (lines 81-83)", async () => {
    // The catch block in the useEffect's load() only triggers if fetchFlags()
    // rejects with an unhandled error. Since fetchFlags() has its own .catch()
    // that always resolves (returning [] or cache.data), the outer catch is
    // effectively unreachable under normal conditions.
    //
    // To trigger it, we need fetchFlags itself to throw synchronously or the
    // promise to reject in a way that bypasses the inner .catch().
    // We can achieve this by mocking the module's fetchFlags to reject.

    // Import fresh module
    const mod = await import("./use-feature-flags");

    // Spy on the hook's internal behavior by making fetch throw in a way
    // that causes the load() promise chain to reject.
    // The inner .catch() handles fetch rejections, but if Date.now itself
    // throws, fetchFlags will throw synchronously before creating the promise.
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now exploded");
    });

    const { result } = renderHook(() => mod.useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // The catch block sets flags to []
    expect(result.current.flags).toEqual([]);

    dateNowSpy.mockRestore();
  });
});
