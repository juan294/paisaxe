import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnalytics } from "./use-analytics";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sessionStorage
const sessionStorageStore: Record<string, string> = {};
const mockSessionStorage = {
  getItem: vi.fn((key: string) => sessionStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete sessionStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(sessionStorageStore)) {
      delete sessionStorageStore[key];
    }
  }),
  length: 0,
  key: vi.fn(() => null),
};

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});

// Mock crypto.randomUUID
const MOCK_UUID = "test-uuid-1234-5678-abcd";
Object.defineProperty(globalThis, "crypto", {
  value: {
    ...globalThis.crypto,
    randomUUID: vi.fn(() => MOCK_UUID),
  },
  writable: true,
});

describe("useAnalytics", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
    mockSessionStorage.getItem.mockClear();
    mockSessionStorage.setItem.mockClear();
    // Clear the in-memory store
    for (const key of Object.keys(sessionStorageStore)) {
      delete sessionStorageStore[key];
    }
  });

  it("should POST to /api/analytics with eventName, featureFlag, sessionId, and metadata", () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.trackEvent("story_view", "contextual_prompts", {
        storyId: "abc",
      });
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "story_view",
        featureFlag: "contextual_prompts",
        sessionId: MOCK_UUID,
        metadata: { storyId: "abc" },
      }),
    });
  });

  it("should send null featureFlag when not provided", () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.trackEvent("page_load");
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.featureFlag).toBeNull();
    expect(body.metadata).toEqual({});
  });

  it("should create a new session ID and store it in sessionStorage", () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.trackEvent("test_event");
    });

    expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
      "paisaxe-session-id"
    );
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      "paisaxe-session-id",
      MOCK_UUID
    );
  });

  it("should reuse session ID from sessionStorage if it already exists", () => {
    const existingId = "existing-session-id";
    sessionStorageStore["paisaxe-session-id"] = existingId;

    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.trackEvent("test_event");
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.sessionId).toBe(existingId);
    // Should NOT have written a new session ID
    expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
  });

  it("should silently ignore fetch errors (fire-and-forget)", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useAnalytics());

    // Should not throw
    act(() => {
      result.current.trackEvent("test_event");
    });

    // Wait a tick for the promise to settle
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // If we got here without an unhandled rejection, the test passes
  });
});
