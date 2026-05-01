import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { FeatureFlagsProvider, useFeatureFlags } from "./use-feature-flags";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function FlagState() {
  const { isReady, isEnabled } = useFeatureFlags();
  const state = isReady && isEnabled("contextual_prompts") ? "enabled" : "disabled";
  return <div>{state}</div>;
}

describe("FeatureFlagsProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("shares server-seeded flags without re-fetching on mount", () => {
    render(
      <FeatureFlagsProvider initialFlags={{ contextual_prompts: true }}>
        <FlagState />
        <FlagState />
      </FeatureFlagsProvider>
    );

    expect(screen.getAllByText("enabled")).toHaveLength(2);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when useFeatureFlags is called outside a FeatureFlagsProvider", () => {
    expect(() => renderHook(() => useFeatureFlags())).toThrow(
      "useFeatureFlags must be used within a FeatureFlagsProvider"
    );
  });
});
