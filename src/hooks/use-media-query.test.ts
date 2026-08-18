import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { render, renderHook, act } from "@testing-library/react";
import { useMediaQuery, useIsFinePointer } from "./use-media-query";

// Build a controllable MediaQueryList mock
function createMqlMock(initialMatches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: initialMatches,
    media: "",
    onchange: null,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
    /** Helper: fire a change event on all registered listeners */
    _fire(newMatches: boolean) {
      mql.matches = newMatches;
      listeners.forEach((cb) => cb({ matches: newMatches } as MediaQueryListEvent));
    },
  };
  return mql;
}

describe("useMediaQuery", () => {
  let mql: ReturnType<typeof createMqlMock>;

  beforeEach(() => {
    mql = createMqlMock(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue(mql),
    });
  });

  it("returns false when media query does not match initially", () => {
    mql.matches = false;
    const { result } = renderHook(() => useMediaQuery("(pointer: fine)"));
    expect(result.current).toBe(false);
  });

  it("returns true when media query matches initially", () => {
    mql.matches = true;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue(mql),
    });
    const { result } = renderHook(() => useMediaQuery("(pointer: fine)"));
    expect(result.current).toBe(true);
  });

  it("updates when media query changes", () => {
    const { result } = renderHook(() => useMediaQuery("(pointer: fine)"));
    expect(result.current).toBe(false);

    act(() => mql._fire(true));
    expect(result.current).toBe(true);

    act(() => mql._fire(false));
    expect(result.current).toBe(false);
  });

  it("removes the event listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(pointer: fine)"));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("calls window.matchMedia with the provided query string", () => {
    renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 768px)");
  });

  it("returns false on the client's very first render, matching the SSR value, even when the query already matches (FE-M6 hydration parity)", () => {
    // Simulate a client where the query already matches before mount
    // (e.g. `(prefers-reduced-motion: reduce)` on a reduced-motion visitor).
    mql.matches = true;

    const renderedValues: boolean[] = [];
    function Probe() {
      const value = useMediaQuery("(pointer: fine)");
      renderedValues.push(value);
      return null;
    }

    render(createElement(Probe));

    // The server always renders `false` (no window). The hook's first
    // client render must return the same value, or React discards the
    // server-rendered markup for this subtree (hydration mismatch).
    expect(renderedValues[0]).toBe(false);

    // The effect then corrects state to the real media query value.
    expect(renderedValues[renderedValues.length - 1]).toBe(true);
  });
});

describe("useIsFinePointer", () => {
  beforeEach(() => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue(mql),
    });
  });

  it("queries (pointer: fine) media feature", () => {
    renderHook(() => useIsFinePointer());
    expect(window.matchMedia).toHaveBeenCalledWith("(pointer: fine)");
  });

  it("returns false when pointer is coarse (touch device)", () => {
    const { result } = renderHook(() => useIsFinePointer());
    expect(result.current).toBe(false);
  });

  it("returns true when pointer is fine (mouse/trackpad)", () => {
    const mqlFine = createMqlMock(true);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue(mqlFine),
    });
    const { result } = renderHook(() => useIsFinePointer());
    expect(result.current).toBe(true);
  });
});
