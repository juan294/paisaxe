import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FeatureFlag, FeatureFlagRow } from "@/types/feature-flags";

// Mock the realtime module
vi.mock("@/lib/realtime", () => ({
  subscribeToFeatureFlags: vi.fn(),
}));

import { subscribeToFeatureFlags } from "@/lib/realtime";

function makeFlag(key: string, enabled: boolean): FeatureFlag {
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

function makeFlagRow(key: string, enabled: boolean): FeatureFlagRow {
  return {
    id: `id-${key}`,
    flag_key: key,
    enabled,
    label: key,
    description: null,
    config: {},
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-06-01T00:00:00Z",
  };
}

describe("useRealtimeFeatureFlags", () => {
  let capturedCallback: ((row: FeatureFlagRow) => void) | null;
  let mockCleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    capturedCallback = null;
    mockCleanup = vi.fn();

    vi.mocked(subscribeToFeatureFlags).mockImplementation((cb) => {
      capturedCallback = cb;
      return mockCleanup;
    });
  });

  it("should return the initial flags unchanged", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [
      makeFlag("contextual_prompts", true),
      makeFlag("related_stories", false),
    ];

    const { result } = renderHook(() =>
      useRealtimeFeatureFlags(initialFlags)
    );

    expect(result.current).toEqual(initialFlags);
  });

  it("should subscribe to feature flag updates on mount", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [makeFlag("contextual_prompts", true)];

    renderHook(() => useRealtimeFeatureFlags(initialFlags));

    expect(subscribeToFeatureFlags).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should update flags when a realtime update arrives", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [
      makeFlag("contextual_prompts", true),
      makeFlag("related_stories", false),
    ];

    const { result } = renderHook(() =>
      useRealtimeFeatureFlags(initialFlags)
    );

    // Simulate a realtime update: related_stories toggled to true
    const updatedRow = makeFlagRow("related_stories", true);
    act(() => {
      capturedCallback!(updatedRow);
    });

    // The flag should now be updated
    const relatedFlag = result.current.find(
      (f) => f.flagKey === "related_stories"
    );
    expect(relatedFlag?.enabled).toBe(true);

    // The other flag should remain unchanged
    const contextualFlag = result.current.find(
      (f) => f.flagKey === "contextual_prompts"
    );
    expect(contextualFlag?.enabled).toBe(true);
  });

  it("should convert the database row to FeatureFlag format", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [makeFlag("surprise_me", false)];

    const { result } = renderHook(() =>
      useRealtimeFeatureFlags(initialFlags)
    );

    const updatedRow = makeFlagRow("surprise_me", true);
    updatedRow.updated_at = "2025-06-15T12:00:00Z";

    act(() => {
      capturedCallback!(updatedRow);
    });

    const flag = result.current.find((f) => f.flagKey === "surprise_me");
    expect(flag).toEqual({
      id: "id-surprise_me",
      flagKey: "surprise_me",
      enabled: true,
      label: "surprise_me",
      description: null,
      config: {},
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-06-15T12:00:00Z",
    });
  });

  it("should add new flags that were not in the initial array", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [makeFlag("contextual_prompts", true)];

    const { result } = renderHook(() =>
      useRealtimeFeatureFlags(initialFlags)
    );

    // A new flag arrives that wasn't in the initial array
    const newRow = makeFlagRow("story_sharing", true);
    act(() => {
      capturedCallback!(newRow);
    });

    expect(result.current).toHaveLength(2);
    const newFlag = result.current.find((f) => f.flagKey === "story_sharing");
    expect(newFlag?.enabled).toBe(true);
  });

  it("should clean up the subscription on unmount", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [makeFlag("contextual_prompts", true)];

    const { unmount } = renderHook(() =>
      useRealtimeFeatureFlags(initialFlags)
    );

    unmount();

    expect(mockCleanup).toHaveBeenCalled();
  });

  it("should update when initial flags change via props", async () => {
    const { useRealtimeFeatureFlags } = await import(
      "./use-realtime-feature-flags"
    );
    const initialFlags = [makeFlag("contextual_prompts", true)];

    const { result, rerender } = renderHook(
      ({ flags }) => useRealtimeFeatureFlags(flags),
      { initialProps: { flags: initialFlags } }
    );

    expect(result.current).toHaveLength(1);

    // Rerender with new initial flags (e.g., after a server refetch)
    const newInitialFlags = [
      makeFlag("contextual_prompts", true),
      makeFlag("related_stories", true),
    ];

    rerender({ flags: newInitialFlags });

    expect(result.current).toHaveLength(2);
  });
});
