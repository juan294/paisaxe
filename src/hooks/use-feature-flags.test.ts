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
