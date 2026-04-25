/**
 * FE-M3: useFavorites anonymous-user state must be consistent.
 *
 * The model: anonymous users cannot persist favorites (requires sign-in).
 * localStorage must never be read for anonymous users.
 * `requiresAuth` must be true for anonymous users.
 * `favorites` must always be empty for anonymous users regardless of
 * what is in localStorage.
 * `toggleFavorite` must be a no-op for anonymous users.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockAuthReturn: {
  user: Record<string, unknown> | null;
  session: Record<string, unknown> | null;
  isLoading: boolean;
} = {
  user: null,
  session: null,
  isLoading: false,
};

vi.mock("./use-auth", () => ({
  useAuth: () => mockAuthReturn,
}));

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
    _getStore: () => store,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

global.fetch = vi.fn();

import { useFavorites } from "./use-favorites";

describe("FE-M3: useFavorites anonymous-user consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.getItem.mockImplementation(
      (key: string) => localStorageMock._getStore()[key] || null
    );
    mockAuthReturn.user = null;
    mockAuthReturn.session = null;
    mockAuthReturn.isLoading = false;
  });

  it("anonymous user: favorites should always be empty regardless of localStorage contents", async () => {
    // Populate localStorage with favorites (should be ignored for anon users)
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify(["story-1", "story-2"])
    );

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.favorites).toEqual([]);
  });

  it("anonymous user: localStorage must never be read (no side-reads)", async () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify(["story-1"])
    );
    localStorageMock.getItem.mockClear(); // Reset call count

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // localStorage should not be read for anonymous users at all
    expect(localStorageMock.getItem).not.toHaveBeenCalledWith("paisaxe_favorites");
  });

  it("anonymous user: requiresAuth should be true", async () => {
    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.requiresAuth).toBe(true);
  });

  it("anonymous user: isFavorite should always return false", async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFavorite("story-1")).toBe(false);
    expect(result.current.isFavorite("any-id")).toBe(false);
  });

  it("anonymous user: toggleFavorite should be a no-op (no localStorage writes)", async () => {
    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleFavorite("story-1");
    });

    expect(result.current.favorites).toEqual([]);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("anonymous user: no fetch calls should be made", async () => {
    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
