/**
 * FE-H1 (#391) + PE-H2 (#395): ImmersivePageContent must provide server-seeded
 * feature flags and stories as a single hydrated source of truth.
 *
 * Nested consumers must receive the server-provided values immediately on first
 * render — no client fetch on mount, no flag-gated UI flash.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureFlagsProvider, useFeatureFlags } from "@/hooks/use-feature-flags";

const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * A test component that reads flags from context and renders its state.
 */
function FlagConsumer({ flagKey }: { flagKey: string }) {
  const { isReady, isEnabled } = useFeatureFlags();
  return (
    <div
      data-testid={`flag-${flagKey}`}
      data-ready={String(isReady)}
      data-enabled={String(isEnabled(flagKey as Parameters<typeof isEnabled>[0]))}
    />
  );
}

describe("FE-H1 + PE-H2: ImmersiveFlagsContext (FeatureFlagsProvider) hydration", () => {
  it("provides server-seeded flags to all nested consumers without fetching", () => {
    render(
      <FeatureFlagsProvider
        initialFlags={{
          randomized_order: true,
          mood_discovery: false,
          user_story_suggestions: true,
        }}
      >
        <FlagConsumer flagKey="randomized_order" />
        <FlagConsumer flagKey="mood_discovery" />
        <FlagConsumer flagKey="user_story_suggestions" />
        <FlagConsumer flagKey="contextual_prompts" />
      </FeatureFlagsProvider>
    );

    // All consumers must be ready immediately — no async wait needed
    const randFlag = screen.getByTestId("flag-randomized_order");
    expect(randFlag).toHaveAttribute("data-ready", "true");
    expect(randFlag).toHaveAttribute("data-enabled", "true");

    const moodFlag = screen.getByTestId("flag-mood_discovery");
    expect(moodFlag).toHaveAttribute("data-ready", "true");
    expect(moodFlag).toHaveAttribute("data-enabled", "false");

    const suggestFlag = screen.getByTestId("flag-user_story_suggestions");
    expect(suggestFlag).toHaveAttribute("data-ready", "true");
    expect(suggestFlag).toHaveAttribute("data-enabled", "true");

    // Flag not in initialFlags defaults to false (not undefined)
    const contextualFlag = screen.getByTestId("flag-contextual_prompts");
    expect(contextualFlag).toHaveAttribute("data-ready", "true");
    expect(contextualFlag).toHaveAttribute("data-enabled", "false");

    // No client fetch was triggered — all data came from the server-seeded context
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shares a single flag state across multiple sibling consumers (no per-consumer fetch)", () => {
    const renders: string[] = [];

    function TrackingConsumer({ id }: { id: string }) {
      const { isReady, isEnabled } = useFeatureFlags();
      renders.push(id);
      return (
        <div
          data-testid={`consumer-${id}`}
          data-ready={String(isReady)}
          data-enabled={String(isEnabled("surprise_me"))}
        />
      );
    }

    render(
      <FeatureFlagsProvider initialFlags={{ surprise_me: true }}>
        <TrackingConsumer id="a" />
        <TrackingConsumer id="b" />
        <TrackingConsumer id="c" />
      </FeatureFlagsProvider>
    );

    // All three consumers see the same value
    expect(screen.getByTestId("consumer-a")).toHaveAttribute("data-enabled", "true");
    expect(screen.getByTestId("consumer-b")).toHaveAttribute("data-enabled", "true");
    expect(screen.getByTestId("consumer-c")).toHaveAttribute("data-enabled", "true");

    // No fetch was made — context provided the truth
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("isReady is true synchronously when server seed is provided (no loading flash)", () => {
    let capturedIsReady = false;

    function ReadyCapture() {
      const { isReady } = useFeatureFlags();
      capturedIsReady = isReady;
      return null;
    }

    render(
      <FeatureFlagsProvider initialFlags={{ ambient_discovery: false }}>
        <ReadyCapture />
      </FeatureFlagsProvider>
    );

    // Must be synchronously true — no async resolution needed
    expect(capturedIsReady).toBe(true);
  });

  it("throws when useFeatureFlags is called outside a FeatureFlagsProvider", () => {
    // When useFeatureFlags is called outside of a FeatureFlagsProvider,
    // it must throw a descriptive error to prevent silent stale data issues.
    function StandaloneConsumer() {
      const { isReady } = useFeatureFlags();
      return <div data-testid="standalone" data-ready={String(isReady)} />;
    }

    // Suppress React's error boundary console output during this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<StandaloneConsumer />)).toThrow(
      "useFeatureFlags must be used within a FeatureFlagsProvider"
    );
    consoleSpy.mockRestore();
  });
});
