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
    expect(result.current.isLoading).toBe(true);
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
      expect(result.current.isLoading).toBe(false);
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
      expect(result.current.isLoading).toBe(false);
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
      expect(result.current.isLoading).toBe(false);
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
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled("surprise_me")).toBe(false);
  });

  it("should default all flags to false on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
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
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual([]);
    expect(result.current.isEnabled("contextual_prompts")).toBe(false);
  });
});
