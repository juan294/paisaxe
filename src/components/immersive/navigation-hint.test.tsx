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
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
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

describe("NavigationHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    // Default: simulate a touch device
    mockMatchMedia(true);
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

  it("does NOT render when localStorage key is set", () => {
    localStorage.setItem("paisaxe-nav-hint-seen", "true");

    render(<NavigationHint />);

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
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

  it("dismisses immediately on user click", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toBeInTheDocument();

    fireEvent.click(hint);

    // Should start fading
    expect(hint).toHaveClass("opacity-0");

    // After fade-out, should unmount
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  it("dismisses immediately on user touch", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    fireEvent.touchStart(hint);

    // Should start fading
    expect(hint).toHaveClass("opacity-0");

    // After fade-out, should unmount
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  it("sets localStorage key after dismissing", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    fireEvent.click(hint);

    expect(localStorage.getItem("paisaxe-nav-hint-seen")).toBe("true");
  });

  it("sets localStorage key after auto-dismiss", () => {
    render(<NavigationHint />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(localStorage.getItem("paisaxe-nav-hint-seen")).toBe("true");
  });

  it("does NOT render on desktop (pointer: fine)", () => {
    mockMatchMedia(false);

    render(<NavigationHint />);

    expect(screen.queryByTestId("navigation-hint")).not.toBeInTheDocument();
  });

  it("renders with z-30 to sit above nav buttons", () => {
    render(<NavigationHint />);

    const hint = screen.getByTestId("navigation-hint");
    expect(hint).toHaveClass("z-30");
  });

  it("renders chevron icons", () => {
    const { container } = render(<NavigationHint />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
  });
});
