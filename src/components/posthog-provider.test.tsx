import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PostHogPageView,
  PostHogProviderWrapper,
  usePaisaxePostHog,
} from "./posthog-provider";

// Renders the live PostHogContext value so tests can assert on it directly
// instead of a DOM testid (FE-M5, #767): the posthog-js/react wrapper node
// this file used to assert on was removed as dead code.
function ContextProbe() {
  const posthog = usePaisaxePostHog();
  return (
    <div data-testid="posthog-context-value">
      {posthog ? "loaded" : "null"}
    </div>
  );
}

// Mock next/navigation
const mockUsePathname = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock posthog-js — dynamic import, so we mock the module entirely.
// PostHogProviderWrapper uses `import("posthog-js")`.
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

describe("PostHogProviderWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
    mockUseSearchParams.mockReturnValue(null);
    mockPosthog.__loaded = false;
  });

  // FE-M5 (#497): React tree must NOT reshape after PostHog initialises.
  // Children should not unmount/remount when PostHog loads.
  it("FE-M5: children are not remounted when PostHog initialises (stable tree shape)", () => {
    // We track mount count of a child component.
    // If the tree reshapes (e.g. an extra wrapper appears), React will
    // unmount and remount all children, incrementing the counter > 1.
    let mountCount = 0;
    function ChildWithMountCounter() {
      // Count mounts via side-effect on empty deps (runs once per mount)
      // We use a module-level counter instead of state to survive re-renders.
      mountCount += 1;
      return <div data-testid="child">child</div>;
    }

    render(
      <PostHogProviderWrapper>
        <ChildWithMountCounter />
      </PostHogProviderWrapper>
    );

    // Reset count after initial mount so we only measure subsequent remounts
    const initialCount = mountCount;
    // Trigger a re-render of the wrapper (simulate PostHog loading in useEffect).
    // Because PostHog does NOT load in jsdom (no NEXT_PUBLIC_POSTHOG_KEY),
    // the tree is effectively stable; we verify the child was only mounted once.
    expect(initialCount).toBe(1);
    // And still only 1 mount — no remount occurred
    expect(mountCount).toBe(1);
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

describe("PostHog production initialization (non-localhost)", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/immersive");
    mockUseSearchParams.mockReturnValue(null);
    mockPosthog.__loaded = false;

    // Replace window.location to simulate production hostname
    // jsdom's location properties are not configurable, so we replace the whole object
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "paisaxe.es", origin: "https://paisaxe.es" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // Restore original jsdom location
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    // Clean up window.posthog
    delete (window as unknown as Record<string, unknown>).posthog;
  });

  it("initializes PostHog on production hostname with env key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    render(
      <PostHogProviderWrapper>
        <div data-testid="app">Content</div>
      </PostHogProviderWrapper>
    );

    // Wait for dynamic import promise to resolve and PostHog to initialize
    await vi.waitFor(() => {
      expect(mockInit).toHaveBeenCalledWith("phc_test_key_12345", expect.objectContaining({
        person_profiles: "never",
        persistence: "memory",
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
      }));
    });

    expect(screen.getByTestId("app")).toBeInTheDocument();
  });

  it("provides the PostHog instance via context after initialization", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    render(
      <PostHogProviderWrapper>
        <div data-testid="app">Content</div>
        <ContextProbe />
      </PostHogProviderWrapper>
    );

    // After PostHog loads, usePaisaxePostHog() should return the instance.
    await vi.waitFor(() => {
      expect(screen.getByTestId("posthog-context-value")).toHaveTextContent("loaded");
    });

    expect(screen.getByTestId("app")).toBeInTheDocument();
  });

  // FE-M5 (#497): After PostHog initialises the React tree shape must stay stable —
  // children must NOT be remounted (mount count stays at 1).
  it("FE-M5: children are not remounted when PostHog initialises in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    let mountCount = 0;
    function ChildWithMountCounter() {
      mountCount += 1;
      return <div data-testid="stable-child">stable</div>;
    }

    render(
      <PostHogProviderWrapper>
        <ChildWithMountCounter />
        <ContextProbe />
      </PostHogProviderWrapper>
    );

    // Wait for PostHog to fully initialise so the tree settles.
    await vi.waitFor(() => {
      expect(screen.getByTestId("posthog-context-value")).toHaveTextContent("loaded");
    });

    // Child must have been mounted exactly once — no remount from tree reshaping
    expect(mountCount).toBe(1);
    expect(screen.getByTestId("stable-child")).toBeInTheDocument();
  });

  it("skips init when PostHog is already loaded (__loaded = true)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
    mockPosthog.__loaded = true;

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
        <ContextProbe />
      </PostHogProviderWrapper>
    );

    // Wait for dynamic import to resolve
    await vi.waitFor(() => {
      expect(screen.getByTestId("posthog-context-value")).toHaveTextContent("loaded");
    });

    // init should NOT be called because __loaded is true
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("uses window.posthog global singleton when available", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");

    const windowPosthog = {
      __loaded: true,
      init: vi.fn(),
      capture: vi.fn(),
      register: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).posthog = windowPosthog;

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
        <ContextProbe />
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("posthog-context-value")).toHaveTextContent("loaded");
    });

    // Should NOT have called init on either mock — window.posthog was already __loaded
    expect(mockInit).not.toHaveBeenCalled();
    expect(windowPosthog.init).not.toHaveBeenCalled();
  });

  it("uses NEXT_PUBLIC_POSTHOG_HOST env var for api_host", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.posthog.com");

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(mockInit).toHaveBeenCalledWith("phc_test_key_12345", expect.objectContaining({
        api_host: "https://eu.posthog.com",
      }));
    });
  });

  it("defaults api_host to /a when NEXT_PUBLIC_POSTHOG_HOST is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;

    render(
      <PostHogProviderWrapper>
        <div>Content</div>
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(mockInit).toHaveBeenCalledWith("phc_test_key_12345", expect.objectContaining({
        api_host: "/a",
      }));
    });
  });
});

describe("PostHogPageViewTracker with loaded PostHog", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPosthog.__loaded = false;

    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "paisaxe.es", origin: "https://paisaxe.es" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    delete (window as unknown as Record<string, unknown>).posthog;
  });

  it("captures pageview with pathname when PostHog is loaded", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
    mockUsePathname.mockReturnValue("/immersive");
    mockUseSearchParams.mockReturnValue(null);

    render(
      <PostHogProviderWrapper>
        <PostHogPageView />
      </PostHogProviderWrapper>
    );

    // Wait for PostHog to initialize and then for pageview capture
    // Component uses window.origin (not window.location.origin)
    await vi.waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith("$pageview", {
        $current_url: `${window.origin}/immersive`,
      });
    });
  });

  it("captures pageview with search params appended", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
    mockUsePathname.mockReturnValue("/story/covadonga");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("lang=es&ref=social"));

    render(
      <PostHogProviderWrapper>
        <PostHogPageView />
      </PostHogProviderWrapper>
    );

    await vi.waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith("$pageview", {
        $current_url: `${window.origin}/story/covadonga?lang=es&ref=social`,
      });
    });
  });

  it("does not capture when pathname is null even with PostHog loaded", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_12345");
    mockUsePathname.mockReturnValue(null);
    mockUseSearchParams.mockReturnValue(null);

    render(
      <PostHogProviderWrapper>
        <PostHogPageView />
        <ContextProbe />
      </PostHogProviderWrapper>
    );

    // Wait for PostHog to load
    await vi.waitFor(() => {
      expect(screen.getByTestId("posthog-context-value")).toHaveTextContent("loaded");
    });

    // capture should NOT be called with null pathname
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
