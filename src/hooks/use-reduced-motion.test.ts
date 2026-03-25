import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "./use-reduced-motion";

// Capture useState initializers so we can test the SSR guard (line 14).
// vi.mock hoists above imports, so this wraps every useState call in the test file.
const capturedInitializers: Array<(() => boolean) | boolean> = [];
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initializer: (() => boolean) | boolean) => {
      capturedInitializers.push(initializer);
      return actual.useState(initializer);
    },
  };
});

describe("useReducedMotion", () => {
  let matchMediaMock: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    capturedInitializers.length = 0;

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

  it("should return false from useState initializer when window is undefined (SSR guard)", () => {
    // Render the hook so our mocked useState captures the initializer function
    renderHook(() => useReducedMotion());

    // The first captured initializer is from our hook's useState call
    const initializer = capturedInitializers[0];
    expect(typeof initializer).toBe("function");

    // Temporarily remove window to simulate SSR environment
    const originalWindow = globalThis.window;
    // @ts-expect-error -- intentionally deleting window to simulate SSR
    delete globalThis.window;

    try {
      // Call the initializer without window — exercises the SSR guard (line 14)
      const result = (initializer as () => boolean)();
      expect(result).toBe(false);
    } finally {
      // Always restore window for subsequent tests
      globalThis.window = originalWindow;
    }
  });
});
