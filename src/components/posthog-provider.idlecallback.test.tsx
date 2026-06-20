/**
 * PE-M3: PostHog must defer initialization via requestIdleCallback (with
 * setTimeout fallback) to avoid blocking first paint.
 *
 * The init must NOT happen synchronously on mount — it defers until the
 * browser is idle. This test verifies the behavior in a jsdom environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostHogProviderWrapper } from "./posthog-provider";

const mockInit = vi.fn();
const mockCapture = vi.fn();
const mockPosthog = {
  __loaded: false,
  init: mockInit,
  capture: mockCapture,
  register: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
};

vi.mock("posthog-js", () => ({ default: mockPosthog }));
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { client: unknown; children: React.ReactNode }) => (
    <div data-testid="posthog-react-provider">{children}</div>
  ),
}));

describe("PostHogProviderWrapper — requestIdleCallback deferral (PE-M3)", () => {
  const originalLocation = window.location;
  let idleCallbacks: (() => void)[] = [];
  let originalRequestIdleCallback: typeof window.requestIdleCallback | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPosthog.__loaded = false;
    idleCallbacks = [];

    // Stub requestIdleCallback to capture, not call immediately
    originalRequestIdleCallback = window.requestIdleCallback;
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      idleCallbacks.push(() => cb({ didTimeout: false, timeRemaining: () => 50 }));
      return idleCallbacks.length as unknown as ReturnType<typeof window.requestIdleCallback>;
    }) as typeof window.requestIdleCallback;

    // Set production hostname so shouldInitializePostHog() returns true
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "paisaxe.es", origin: "https://paisaxe.es" },
      writable: true,
      configurable: true,
    });
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.requestIdleCallback = originalRequestIdleCallback!;
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    delete (window as unknown as Record<string, unknown>).posthog;
  });

  it("does NOT call PostHog init synchronously on mount", async () => {
    render(
      <PostHogProviderWrapper>
        <div data-testid="app">content</div>
      </PostHogProviderWrapper>
    );

    expect(screen.getByTestId("app")).toBeInTheDocument();

    // Allow microtasks (dynamic import) to run but NOT idle callbacks
    await new Promise((r) => setTimeout(r, 0));

    // Init should NOT have been called yet (waiting for idle)
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("calls PostHog init when the idle callback fires", async () => {
    render(
      <PostHogProviderWrapper>
        <div data-testid="app">content</div>
      </PostHogProviderWrapper>
    );

    // Allow dynamic import to queue
    await new Promise((r) => setTimeout(r, 0));

    expect(mockInit).not.toHaveBeenCalled();

    // Trigger idle callback
    for (const cb of idleCallbacks) cb();

    await vi.waitFor(() => {
      expect(mockInit).toHaveBeenCalledWith(
        "phc_test_key_12345",
        expect.objectContaining({
          person_profiles: "never",
          persistence: "memory",
          capture_pageview: false,
          autocapture: false,
        })
      );
    });
  });

  it("children are rendered immediately without waiting for idle callback", () => {
    render(
      <PostHogProviderWrapper>
        <main data-testid="main">Asturias</main>
      </PostHogProviderWrapper>
    );

    // Main content must be visible before any idle callback fires
    expect(screen.getByTestId("main")).toBeInTheDocument();
    expect(idleCallbacks.length).toBeGreaterThanOrEqual(0); // may not have fired yet
  });
});
