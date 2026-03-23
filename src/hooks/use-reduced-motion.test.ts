import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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

  // Line 14: `if (typeof window === "undefined") return false` is an SSR guard
  // inside the useState initializer. This branch is unreachable in jsdom because
  // React DOM itself requires `window` to render. Deleting `globalThis.window`
  // causes React's rendering to fail before the hook code executes.
  // This line can only be covered in a Node.js environment with a server-side
  // React rendering approach (e.g., renderToString), which is outside the scope
  // of these unit tests. The guard is a standard SSR safety pattern.
});
