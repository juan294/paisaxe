import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NavigationHint } from "./navigation-hint";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.hint_previous": "Anterior",
        "nav.hint_next": "Siguiente",
      };
      return translations[key] || key;
    },
    locale: "es",
  }),
}));

// Helper to set up matchMedia mock
// Accepts a boolean (all queries match/don't match) or a record of query -> matches
function mockMatchMedia(matches: boolean | Record<string, boolean>) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        typeof matches === "boolean" ? matches : (matches[query] ?? false),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Simulate a phone: touch device + narrow viewport (below sm breakpoint 640px)
function mockPhone() {
  mockMatchMedia({
    "(pointer: coarse)": true,
    "(max-width: 639px)": true,
  });
}

// Simulate a tablet: touch device + wide viewport (above sm breakpoint)
function mockTablet() {
  mockMatchMedia({
    "(pointer: coarse)": true,
    "(max-width: 639px)": false,
  });
}

describe("NavigationHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // UX-M2: hint now uses sessionStorage (per-session, not permanent localStorage)
    sessionStorage.clear();
    localStorage.clear();
    // Default: simulate a phone (touch + narrow viewport)
    mockPhone();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the hint indicators on first visit", () => {
    render(<NavigationHint />);

    expect(screen.getByTestId("navigation-hint")).toBeInTheDocument();
    expect(screen.getByText("Anterior")).toBeInTheDocument();
    expect(screen.getByText("Siguiente")).toBeInTheDocument();
  });

  // UX-M2: Now uses sessionStorage — checking the session key suppresses the hint
  it("does NOT render when sessionStorage key is set (same session, already seen)", () => {
    sessionStorage.setItem("paisaxe-nav-hint-seen", "true");

    render(<NavigationHint />);

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  // UX-M2: Shows again in a new session (localStorage set from previous impl should NOT block it)
  it("renders again in a new session even if localStorage key was set (old format)", () => {
    // Simulate old localStorage-based dismiss — hint should still show in new session
    localStorage.setItem("paisaxe-nav-hint-seen", "true");
    // sessionStorage is clear (new session)

    render(<NavigationHint />);

    // Should show again — old localStorage flag has no effect with new implementation
    expect(screen.getByTestId("navigation-hint")).toBeInTheDocument();
  });

  it("auto-dismisses after ~3 seconds", () => {
    render(<NavigationHint />);

    expect(screen.getByTestId("navigation-hint")).toBeInTheDocument();

    // Trigger the auto-dismiss timeout
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should start fading (opacity-0 class applied)
    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toHaveClass("opacity-0");

    // After the fade-out duration, component should unmount
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  // UX-M9: dismissal is driven by a passive window-level listener (not a
  // handler on the overlay itself), so it must fire on interactions
  // anywhere on the page -- not just on the hint element.
  it("dismisses immediately on a click anywhere on the page", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toBeInTheDocument();

    fireEvent.click(window);

    // Should start fading
    expect(hint).toHaveClass("opacity-0");

    // After fade-out, should unmount
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  it("dismisses immediately on a touch anywhere on the page", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    fireEvent.touchStart(window);

    // Should start fading
    expect(hint).toHaveClass("opacity-0");

    // After fade-out, should unmount
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  // UX-M9: The overlay must be pointer-events-none so the user's first tap
  // reaches -- and is handled by -- whatever nav zone/toolbar sits beneath
  // it, instead of being swallowed just to dismiss the hint.
  it("does not block the tap that reaches an element underneath it", () => {
    render(
      <div>
        <button data-testid="nav-zone">Next</button>
        <NavigationHint />
      </div>
    );

    const navZone = screen.getByTestId("nav-zone");
    const navClickHandler = vi.fn();
    navZone.addEventListener("click", navClickHandler);

    fireEvent.click(navZone);

    // The underlying element's own handler still runs...
    expect(navClickHandler).toHaveBeenCalledTimes(1);

    // ...and the same tap dismisses the hint via the passive window listener.
    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  // UX-M9: Now sets sessionStorage key (not localStorage)
  it("sets sessionStorage key after dismissing (not localStorage)", () => {
    render(<NavigationHint />);

    fireEvent.click(window);

    expect(sessionStorage.getItem("paisaxe-nav-hint-seen")).toBe("true");
    // Must NOT write to localStorage (new session-scoped behavior)
    expect(localStorage.getItem("paisaxe-nav-hint-seen")).toBeNull();
  });

  // UX-M2: Now sets sessionStorage key after auto-dismiss too
  it("sets sessionStorage key after auto-dismiss", () => {
    render(<NavigationHint />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(sessionStorage.getItem("paisaxe-nav-hint-seen")).toBe("true");
  });

  it("does NOT render on desktop (pointer: fine)", () => {
    mockMatchMedia(false);

    render(<NavigationHint />);

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  it("does NOT render on tablet (touch device but wide viewport)", () => {
    mockTablet();

    render(<NavigationHint />);

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  it("renders with z-30 to sit above nav buttons", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toHaveClass("z-30");
  });

  // UX-M9: pointer-events-none is applied at all times (not just while
  // fading) so the overlay never intercepts the tap meant for whatever is
  // underneath it.
  it("is pointer-events-none while visible, and stays that way while fading", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toHaveClass("pointer-events-none");

    fireEvent.click(window);

    expect(hint).toHaveClass("pointer-events-none");
    expect(hint).toHaveClass("opacity-0");
  });

  it("renders chevron icons", () => {
    const { container } = render(<NavigationHint />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
  });
});
