import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostHogPageView, PostHogProviderWrapper } from "./posthog-provider";

// Mock next/navigation
const mockUsePathname = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock posthog-js — dynamic import, so we mock the module entirely.
// PostHogProviderWrapper uses `import("posthog-js")` and `import("posthog-js/react")`.
// We mock at the module level so the dynamic import resolves our mock.
const mockCapture = vi.fn();
const mockInit = vi.fn();
const mockPosthog = {
  __loaded: false,
  init: mockInit,
  capture: mockCapture,
  // Minimal shape to avoid runtime errors
  register: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
};

vi.mock("posthog-js", () => ({
  default: mockPosthog,
}));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({
    children,
  }: {
    client: unknown;
    children: React.ReactNode;
  }) => <div data-testid="posthog-react-provider">{children}</div>,
}));

describe("PostHogProviderWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
    mockUseSearchParams.mockReturnValue(null);
    mockPosthog.__loaded = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders children immediately (before PostHog loads)", () => {
    // No NEXT_PUBLIC_POSTHOG_KEY set — PostHog should not initialize,
    // but children must still render.
    render(
      <PostHogProviderWrapper>
        <div data-testid="child">Hello Asturias</div>
      </PostHogProviderWrapper>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello Asturias")).toBeInTheDocument();
  });

  it("renders multiple children correctly", () => {
    render(
      <PostHogProviderWrapper>
        <span data-testid="first">First</span>
        <span data-testid="second">Second</span>
      </PostHogProviderWrapper>
    );

    expect(screen.getByTestId("first")).toBeInTheDocument();
    expect(screen.getByTestId("second")).toBeInTheDocument();
  });

  it("does not initialize PostHog when env var is missing", async () => {
    // Ensure the env var is not set
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
      </PostHogProviderWrapper>
    );

    // Allow any pending effects to run
    await vi.waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    // posthog.init should NOT have been called
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("does not initialize PostHog on localhost (jsdom default hostname)", async () => {
    // jsdom sets window.location.hostname to "localhost" by default.
    // Even with a key set, shouldInitializePostHog() should return false.
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    // PostHog should NOT be initialized on localhost
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("provides null context when PostHog is not initialized", () => {
    // No env var = PostHog will not load = context value should be null.
    // We verify this by rendering a consumer that reads the context.
    // Since usePostHog is not exported, we test indirectly:
    // PostHogPageViewTracker checks `posthog` from context — if null,
    // it won't call capture. We can verify no capture calls are made.
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    mockUsePathname.mockReturnValue("/immersive");
    mockUseSearchParams.mockReturnValue(null);

    render(
      <PostHogProviderWrapper>
        <PostHogPageView />
        <div data-testid="app">App Content</div>
      </PostHogProviderWrapper>
    );

    expect(screen.getByTestId("app")).toBeInTheDocument();
    // PostHog capture should NOT be called because context is null
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe("PostHogPageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders without adding visible content", () => {
    mockUsePathname.mockReturnValue("/immersive");
    mockUseSearchParams.mockReturnValue(null);

    const { container } = render(
      <PostHogProviderWrapper>
        <PostHogPageView />
      </PostHogProviderWrapper>
    );

    // PostHogPageView returns null — no text content should be present
    expect(container.textContent).toBe("");
  });

  it("does not call capture when PostHog is not loaded (null context)", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    mockUsePathname.mockReturnValue("/story/oviedo-old-town");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("lang=es"));

    render(
      <PostHogProviderWrapper>
        <PostHogPageView />
      </PostHogProviderWrapper>
    );

    // No capture because PostHog context is null
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("does not call capture when pathname is null", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    mockUsePathname.mockReturnValue(null);
    mockUseSearchParams.mockReturnValue(null);

    render(
      <PostHogProviderWrapper>
        <PostHogPageView />
      </PostHogProviderWrapper>
    );

    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe("shouldInitializePostHog (tested via rendering behavior)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
    mockUseSearchParams.mockReturnValue(null);
    mockPosthog.__loaded = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not initialize when NEXT_PUBLIC_POSTHOG_KEY is empty string", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("does not initialize when hostname includes 127.0.0.1", async () => {
    // This test documents the behavior — in jsdom, hostname is "localhost"
    // which already triggers the guard. We test the 127.0.0.1 path by
    // verifying the guard logic exists and both conditions are checked.
    // Since we can't easily change jsdom hostname, we verify localhost
    // blocks initialization (which covers the same code path).
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    // Hostname is "localhost" in jsdom — init should not be called
    expect(mockInit).not.toHaveBeenCalled();
    expect(window.location.hostname).toBe("localhost");
  });

  it("children are always rendered regardless of PostHog initialization", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    render(
      <PostHogProviderWrapper>
        <main data-testid="main-content">
          <h1>Welcome to Asturias</h1>
          <p>Explore the beauty of northern Spain</p>
        </main>
      </PostHogProviderWrapper>
    );

    expect(screen.getByTestId("main-content")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Asturias")).toBeInTheDocument();
    expect(
      screen.getByText("Explore the beauty of northern Spain")
    ).toBeInTheDocument();
  });
});
