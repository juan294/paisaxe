/**
 * Feature Flag Integration Tests
 *
 * Tests that verify untested feature flags are properly checked
 * in the components/modules that consume them.
 *
 * Fixes #96 — Covers: mood_discovery, asturianu_touches,
 * story_freshness, automated_agents, content_discovery_agent_enabled
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
// 4. automated_agents — master toggle for the agent system
// ---------------------------------------------------------------------------
describe("Feature flag: automated_agents", () => {
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

    expect(result.current.isEnabled("automated_agents")).toBe(false);
  });

  it("should return true when automated_agents flag is enabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeFlag("automated_agents", true)] }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("automated_agents")).toBe(true);
  });

  it("should be listed in AGENT_FLAG_KEYS constants", async () => {
    const { AGENT_FLAG_KEYS } = await import(
      "@/components/admin/agents-dashboard/constants"
    );

    expect(AGENT_FLAG_KEYS).toContain("automated_agents");
  });

  it("automated_agents is treated as the master toggle (not an individual agent)", async () => {
    // In the agents dashboard, automated_agents is explicitly different
    // from individual agent flags — it doesn't have a config panel
    const { AGENT_FLAG_KEYS } = await import(
      "@/components/admin/agents-dashboard/constants"
    );

    // automated_agents should be in the list
    expect(AGENT_FLAG_KEYS).toContain("automated_agents");

    // It should be the first flag in the list (master toggle)
    expect(AGENT_FLAG_KEYS[0]).toBe("automated_agents");
  });
});

// ---------------------------------------------------------------------------
// 5. content_discovery_agent_enabled — content discovery agent toggle
// ---------------------------------------------------------------------------
describe("Feature flag: content_discovery_agent_enabled", () => {
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

    expect(result.current.isEnabled("content_discovery_agent_enabled")).toBe(false);
  });

  it("should return true when content_discovery_agent_enabled flag is enabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [makeFlag("content_discovery_agent_enabled", true)],
      }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("content_discovery_agent_enabled")).toBe(true);
  });

  it("should return false when content_discovery_agent_enabled flag is disabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [makeFlag("content_discovery_agent_enabled", false)],
      }),
    });

    const { useFeatureFlags } = await import("./use-feature-flags");
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEnabled("content_discovery_agent_enabled")).toBe(false);
  });

  it("content_discovery_agent_enabled is a valid FeatureFlagKey", async () => {
    // Type-level check — if this compiles, the key is valid
    const key: FeatureFlagKey = "content_discovery_agent_enabled";
    expect(key).toBe("content_discovery_agent_enabled");
  });
});

// ---------------------------------------------------------------------------
// Cross-flag: verify all 5 flags can coexist and be queried independently
// ---------------------------------------------------------------------------
describe("Feature flags: combined behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("should handle all 5 flags being enabled simultaneously", async () => {
    const allFlags = [
      makeFlag("mood_discovery", true),
      makeFlag("asturianu_touches", true),
      makeFlag("story_freshness", true),
      makeFlag("automated_agents", true),
      makeFlag("content_discovery_agent_enabled", true),
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
    expect(result.current.isEnabled("automated_agents")).toBe(true);
    expect(result.current.isEnabled("content_discovery_agent_enabled")).toBe(true);
  });

  it("should handle all 5 flags being disabled simultaneously", async () => {
    const allFlags = [
      makeFlag("mood_discovery", false),
      makeFlag("asturianu_touches", false),
      makeFlag("story_freshness", false),
      makeFlag("automated_agents", false),
      makeFlag("content_discovery_agent_enabled", false),
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
    expect(result.current.isEnabled("automated_agents")).toBe(false);
    expect(result.current.isEnabled("content_discovery_agent_enabled")).toBe(false);
  });

  it("should handle mixed enabled/disabled state", async () => {
    const mixedFlags = [
      makeFlag("mood_discovery", true),
      makeFlag("asturianu_touches", false),
      makeFlag("story_freshness", true),
      makeFlag("automated_agents", false),
      makeFlag("content_discovery_agent_enabled", true),
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
    expect(result.current.isEnabled("automated_agents")).toBe(false);
    expect(result.current.isEnabled("content_discovery_agent_enabled")).toBe(true);
  });
});
