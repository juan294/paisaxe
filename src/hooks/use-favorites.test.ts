import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFavorites } from "./use-favorites";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock fetch
global.fetch = vi.fn();

// Mock useAuth hook
vi.mock("./use-auth", () => ({
  useAuth: () => ({
    user: null,
    session: null,
  }),
}));

describe("useFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe("initialization", () => {
    it("should start with empty favorites when localStorage is empty", async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });

    it("should load favorites from localStorage on mount", async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1", "story-2"]));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual(["story-1", "story-2"]);
    });

    it("should handle invalid JSON in localStorage gracefully", async () => {
      localStorageMock.getItem.mockReturnValue("invalid-json");

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });

    it("should handle non-array values in localStorage", async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ not: "an array" }));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });
  });

  describe("isFavorite", () => {
    it("should return true for favorited stories", async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite("story-1")).toBe(true);
      expect(result.current.isFavorite("story-2")).toBe(false);
    });
  });

  describe("hook interface", () => {
    it("should return required functions and state", async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.favorites).toBe("object");
      expect(typeof result.current.isFavorite).toBe("function");
      expect(typeof result.current.toggleFavorite).toBe("function");
      expect(typeof result.current.dismissSignInPrompt).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.showSignInPrompt).toBe("boolean");
    });

    it("should start with showSignInPrompt as false", async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showSignInPrompt).toBe(false);
    });
  });
});
