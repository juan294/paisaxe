import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "./use-reduced-motion";

describe("useReducedMotion", () => {
  let matchMediaMock: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    matchMediaMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => matchMediaMock),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return false when prefers-reduced-motion is not set", () => {
    matchMediaMock.matches = false;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it("should return true when prefers-reduced-motion is set to reduce", () => {
    matchMediaMock.matches = true;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it("should query the correct media query string", () => {
    renderHook(() => useReducedMotion());

    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)"
    );
  });

  it("should add an event listener for media query changes", () => {
    renderHook(() => useReducedMotion());

    expect(matchMediaMock.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });

  it("should remove event listener on unmount", () => {
    const { unmount } = renderHook(() => useReducedMotion());

    unmount();

    expect(matchMediaMock.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });

  it("should update when media query changes", () => {
    matchMediaMock.matches = false;

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Simulate the media query changing
    const changeHandler = matchMediaMock.addEventListener.mock.calls[0][1];
    act(() => {
      changeHandler({ matches: true });
    });

    expect(result.current).toBe(true);
  });

  it("returns false on the client's very first render, matching the SSR value, even when prefers-reduced-motion already matches (FE-M6 hydration parity)", () => {
    // Simulate a reduced-motion visitor: matchMedia already reports `true`
    // on the client before the component ever mounts.
    matchMediaMock.matches = true;

    const renderedValues: boolean[] = [];
    function Probe() {
      const value = useReducedMotion();
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
