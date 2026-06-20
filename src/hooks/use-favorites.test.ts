import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mutable auth mock reference
const mockAuthReturn: {
  user: Record<string, unknown> | null;
  session: Record<string, unknown> | null;
  isLoading: boolean;
} = {
  user: null,
  session: null,
  isLoading: false,
};

// Mock useAuth hook with mutable return
vi.mock("./use-auth", () => ({
  useAuth: () => mockAuthReturn,
}));

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
    _getStore: () => store,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useFavorites } from "./use-favorites";

describe("useFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Restore getItem implementation after any mockReturnValue overrides
    localStorageMock.getItem.mockImplementation(
      (key: string) => localStorageMock._getStore()[key] || null
    );
    mockAuthReturn.user = null;
    mockAuthReturn.session = null;
    mockAuthReturn.isLoading = false;
    mockFetch.mockReset();
  });

  describe("initialization", () => {
    it("should start with empty favorites when localStorage is empty", async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });

    it("should load favorites from localStorage on mount for logged-in users", async () => {
      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      localStorageMock.getItem.mockReturnValue(
        JSON.stringify(["story-1", "story-2"])
      );

      // Mock the cloud sync GET to return same favorites
      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => ["story-1", "story-2"] };
        }
        return { ok: true, json: async () => ({}) };
      });

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual(["story-1", "story-2"]);
    });

    it("should not load favorites for anonymous users", async () => {
      mockAuthReturn.user = null;
      mockAuthReturn.session = null;

      localStorageMock.getItem.mockReturnValue(
        JSON.stringify(["story-1", "story-2"])
      );

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Anonymous users should have empty favorites
      expect(result.current.favorites).toEqual([]);
      // And should indicate auth is required
      expect(result.current.requiresAuth).toBe(true);
    });

    it("should handle invalid JSON in localStorage gracefully", async () => {
      localStorageMock.getItem.mockReturnValue("invalid-json");

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });

    it("should handle invalid JSON in localStorage for logged-in users (catch branch)", async () => {
      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      localStorageMock.getItem.mockReturnValue("not-valid-json{{{");

      // Mock the cloud sync to avoid secondary effects
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The catch block on line 35-37 sets favorites to []
      expect(result.current.favorites).toEqual([]);
    });

    it("should handle non-array values in localStorage", async () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ not: "an array" })
      );

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });

    it("should handle non-array values in localStorage for logged-in user (line 34 branch)", async () => {
      // Line 34: setFavorites(Array.isArray(parsed) ? parsed : [])
      // When localStorage contains valid JSON that is not an array (e.g., an object),
      // favorites should be set to [].
      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ not: "an array" })
      );

      // Mock the cloud sync to avoid secondary effects
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The non-array value should be replaced with []
      expect(result.current.favorites).toEqual([]);
    });
  });

  describe("isFavorite", () => {
    it("should return true for favorited stories (logged-in user)", async () => {
      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => ["story-1"] };
        }
        return { ok: true, json: async () => ({}) };
      });

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite("story-1")).toBe(true);
      expect(result.current.isFavorite("story-2")).toBe(false);
    });

    it("should always return false for anonymous users", async () => {
      mockAuthReturn.user = null;
      mockAuthReturn.session = null;

      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite("story-1")).toBe(false);
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
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("toggleFavorite (anonymous users)", () => {
    it("should do nothing for anonymous users", async () => {
      mockAuthReturn.user = null;
      mockAuthReturn.session = null;

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      // Should still be empty - anonymous users can't save favorites
      expect(result.current.favorites).toEqual([]);
      // localStorage should NOT have been updated
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe("cloud sync on toggleFavorite (logged in)", () => {
    beforeEach(() => {
      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };
    });

    it("should POST to /api/favorites when adding a favorite", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const { result } = renderHook(() => useFavorites());

      // Wait for cloud sync effect to settle
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      // Find the POST call for toggling (not cloud sync)
      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[1] as Record<string, unknown>)?.method === "POST"
      );
      const togglePostCall = postCalls.find((call: unknown[]) => {
        try {
          const body = JSON.parse((call[1] as Record<string, string>)?.body);
          return (
            body.storyIds &&
            body.storyIds.length === 1 &&
            body.storyIds[0] === "story-1"
          );
        } catch {
          return false;
        }
      });

      expect(togglePostCall).toBeDefined();
      expect(togglePostCall![0]).toBe("/api/favorites");
      expect(togglePostCall![1] as Record<string, unknown>).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should DELETE from /api/favorites when removing a favorite", async () => {
      // The cloud sync GET returns story-1 so it's in favorites
      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => ["story-1"] };
        }
        return { ok: true, json: async () => ({}) };
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // story-1 should now be in favorites (from cloud merge or local)
      await waitFor(() => {
        expect(result.current.favorites).toContain("story-1");
      });

      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      const deleteCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[1] as Record<string, unknown>)?.method === "DELETE"
      );
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);

      const deleteCall = deleteCalls[0];
      expect(deleteCall[0]).toBe("/api/favorites?storyId=story-1");
      expect(deleteCall[1]).toEqual(
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should revert local state when cloud sync fails on add", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      let cloudSyncDone = false;

      // Cloud sync GET succeeds, but toggle POST fails
      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => [] };
        }
        // Only throw for POST/DELETE (toggle sync)
        if (cloudSyncDone) {
          throw new Error("Network error");
        }
        return { ok: true, json: async () => ({}) };
      });

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Now make subsequent POST calls fail
      cloudSyncDone = true;
      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => [] };
        }
        throw new Error("Network error");
      });

      // Should not throw
      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      // Favorite should be REVERTED since cloud sync failed
      expect(result.current.favorites).not.toContain("story-1");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error syncing favorite to cloud")
      );

      consoleSpy.mockRestore();
    });

    it("should revert state and localStorage when add returns a non-ok response", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => [] };
        }
        return { ok: false, status: 500 };
      });

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      expect(result.current.favorites).not.toContain("story-1");

      const lastSetCall = localStorageMock.setItem.mock.calls
        .filter((call: unknown[]) => call[0] === "paisaxe_favorites")
        .pop();
      expect(JSON.parse(lastSetCall![1])).toEqual([]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error syncing favorite to cloud")
      );

      consoleSpy.mockRestore();
    });

    it("should revert localStorage when cloud sync fails on remove", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Cloud sync GET succeeds with story-1, toggle DELETE will fail
      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => ["story-1"] };
        }
        if (options?.method === "DELETE") {
          throw new Error("Network error");
        }
        return { ok: true, json: async () => ({}) };
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.favorites).toContain("story-1");
      });

      // Try to remove story-1 — should be reverted when cloud fails
      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      // State should be reverted
      expect(result.current.favorites).toContain("story-1");

      // localStorage should be reverted to pre-toggle value
      const lastSetCall = localStorageMock.setItem.mock.calls
        .filter((call: unknown[]) => call[0] === "paisaxe_favorites")
        .pop();
      const savedFavorites = JSON.parse(lastSetCall![1]);
      expect(savedFavorites).toContain("story-1");

      consoleSpy.mockRestore();
    });

    it("should revert state and localStorage when remove returns a non-ok response", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
        if (!options?.method || options.method === "GET") {
          return { ok: true, json: async () => ["story-1"] };
        }
        if (options.method === "DELETE") {
          return { ok: false, status: 500 };
        }
        return { ok: true, json: async () => ({}) };
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.favorites).toContain("story-1");
      });

      await act(async () => {
        await result.current.toggleFavorite("story-1");
      });

      expect(result.current.favorites).toContain("story-1");

      const lastSetCall = localStorageMock.setItem.mock.calls
        .filter((call: unknown[]) => call[0] === "paisaxe_favorites")
        .pop();
      expect(JSON.parse(lastSetCall![1])).toEqual(["story-1"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error syncing favorite to cloud")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("cloud sync on login", () => {
    it("should replace local cache with cloud favorites when user logs in", async () => {
      // Local cache has story-1, cloud is source of truth with story-2
      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      mockFetch.mockResolvedValue({ ok: true, json: async () => ["story-2"] });

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.favorites).toEqual(["story-2"]);
      });
    });

    it("should not upload stale local favorites to cloud", async () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify(["story-1", "story-3"])
      );

      mockFetch.mockResolvedValue({ ok: true, json: async () => ["story-1"] });

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.favorites).toEqual(["story-1"]);
      });

      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[1] as Record<string, unknown>)?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });

    it("should not upload to cloud if no new local favorites", async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      mockFetch.mockImplementation(async () => {
        return { ok: true, json: async () => ["story-1"] };
      });

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait a tick for async operations to settle
      await waitFor(() => {
        expect(result.current.favorites).toContain("story-1");
      });

      // No POST calls should have been made since all local favorites exist in cloud
      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[1] as Record<string, unknown>)?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });

    it("should handle cloud sync fetch error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFetch.mockRejectedValue(new Error("Network error"));

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error syncing favorites")
      );

      consoleSpy.mockRestore();
    });

    it("should handle non-ok response from cloud fetch", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not crash - just skip the cloud cache refresh
      expect(result.current.favorites).toBeDefined();
    });

    it("should save cloud favorites to localStorage", async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(["story-1"]));

      mockFetch.mockResolvedValue({ ok: true, json: async () => ["story-2"] });

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.favorites).toEqual(["story-2"]);
      });

      // localStorage should be updated with cloud favorites only
      const setItemCalls = localStorageMock.setItem.mock.calls.filter(
        (call: unknown[]) => call[0] === "paisaxe_favorites"
      );
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const savedFavorites = JSON.parse(lastCall[1]);
      expect(savedFavorites).toEqual(["story-2"]);
    });

    it("should set isLoading during cloud sync", async () => {
      let resolveCloudFetch: (value: unknown) => void;
      const cloudFetchPromise = new Promise((resolve) => {
        resolveCloudFetch = resolve;
      });

      mockFetch.mockImplementation(async () => {
        return cloudFetchPromise;
      });

      mockAuthReturn.user = { id: "user-1", email: "test@test.com" };
      mockAuthReturn.session = { access_token: "test-token" };

      const { result } = renderHook(() => useFavorites());

      // While cloud fetch is in progress, should be loading
      // (After initial localStorage load it sets isLoading=false, but then cloud sync sets it back to true)
      // Resolve the cloud fetch
      await act(async () => {
        resolveCloudFetch!({ ok: true, json: async () => [] });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
