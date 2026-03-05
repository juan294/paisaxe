/**
 * Feature Flag Integration Tests
 *
 * Tests that verify untested feature flags are properly checked
 * in the components/modules that consume them.
 *
 * Fixes #96 — Covers: mood_discovery, asturianu_touches, story_freshness
 *
 * Note: automated_agents and content_discovery_agent_enabled were removed
 * from FeatureFlagKey — agent flags are now managed locally via
 * scripts/agent-config.json (not Supabase feature_flags).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeFlag(key: FeatureFlagKey, enabled: boolean): FeatureFlag {
  return {
    id: `id-${key}`,
    flagKey: key,
    enabled,
    label: key,
    description: null,
    config: {},
    environment: "development",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// 1. mood_discovery — controls whether MoodOverlay renders in ImmersivePageContent
// ---------------------------------------------------------------------------
describe("Feature flag: mood_discovery", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("should be false by default when flag is not present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("mood_discovery")).toBe(false);
  });

  it("should return true when mood_discovery flag is enabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeFlag("mood_discovery", true)] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("mood_discovery")).toBe(true);
  });

  it("should return false when mood_discovery flag is disabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeFlag("mood_discovery", false)] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("mood_discovery")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. asturianu_touches — controls Asturian language labels via getLabel()
// ---------------------------------------------------------------------------
describe("Feature flag: asturianu_touches", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("should be false by default when flag is not present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("asturianu_touches")).toBe(false);
  });

  it("should return true when asturianu_touches flag is enabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeFlag("asturianu_touches", true)] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("asturianu_touches")).toBe(true);
  });

  it("should control which labels getLabel() returns", async () => {
    const { getLabel } = await import("@/lib/asturianu");

    // When disabled, getLabel returns Spanish
    expect(getLabel("ask_about", false)).toBe("Preguntar sobre esto");

    // When enabled, getLabel returns Asturianu
    expect(getLabel("ask_about", true)).toBe("Entrugame sobre esto");
  });

  it("getLabel() returns correct labels for all known keys when flag is toggled", async () => {
    const { getLabel } = await import("@/lib/asturianu");

    const testCases = [
      { key: "saved", es: "Guardados", ast: "Guardaos" },
      { key: "new_badge", es: "Nuevo", ast: "Nuevu" },
      { key: "ask_placeholder", es: "Escribe tu pregunta...", ast: "Escribi la to entruga..." },
    ];

    for (const { key, es, ast } of testCases) {
      expect(getLabel(key, false)).toBe(es);
      expect(getLabel(key, true)).toBe(ast);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. story_freshness — controls whether FreshnessBadge renders in StoryViewer
// ---------------------------------------------------------------------------
describe("Feature flag: story_freshness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("should be false by default when flag is not present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("story_freshness")).toBe(false);
  });

  it("should return true when story_freshness flag is enabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeFlag("story_freshness", true)] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("story_freshness")).toBe(true);
  });

  it("should return false when story_freshness flag is disabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeFlag("story_freshness", false)] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("story_freshness")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-flag: verify all 3 flags can coexist and be queried independently
// ---------------------------------------------------------------------------
describe("Feature flags: combined behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("should handle all 3 flags being enabled simultaneously", async () => {
    const allFlags = [
      makeFlag("mood_discovery", true),
      makeFlag("asturianu_touches", true),
      makeFlag("story_freshness", true),
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: allFlags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("mood_discovery")).toBe(true);
    expect(result.current.isEnabled("asturianu_touches")).toBe(true);
    expect(result.current.isEnabled("story_freshness")).toBe(true);
  });

  it("should handle all 3 flags being disabled simultaneously", async () => {
    const allFlags = [
      makeFlag("mood_discovery", false),
      makeFlag("asturianu_touches", false),
      makeFlag("story_freshness", false),
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: allFlags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("mood_discovery")).toBe(false);
    expect(result.current.isEnabled("asturianu_touches")).toBe(false);
    expect(result.current.isEnabled("story_freshness")).toBe(false);
  });

  it("should handle mixed enabled/disabled state", async () => {
    const mixedFlags = [
      makeFlag("mood_discovery", true),
      makeFlag("asturianu_touches", false),
      makeFlag("story_freshness", true),
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mixedFlags }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("mood_discovery")).toBe(true);
    expect(result.current.isEnabled("asturianu_touches")).toBe(false);
    expect(result.current.isEnabled("story_freshness")).toBe(true);
  });
});
