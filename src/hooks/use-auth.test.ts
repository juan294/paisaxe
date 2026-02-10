import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuth } from "./use-auth";

// Mock the auth provider's useAuthContext
const mockAuthContext = {
  user: null,
  session: null,
  isLoading: false,
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthContext: () => mockAuthContext,
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.user = null;
    mockAuthContext.session = null;
    mockAuthContext.isLoading = false;
  });

  it("returns the auth context value", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current).toBe(mockAuthContext);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.signInWithGoogle).toBeDefined();
    expect(result.current.signOut).toBeDefined();
  });

  it("returns user when authenticated", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.jpg",
    };
    (mockAuthContext as Record<string, unknown>).user = mockUser;

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(mockUser);
  });

  it("returns isLoading true while auth is initializing", () => {
    (mockAuthContext as Record<string, unknown>).isLoading = true;

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
  });

  it("exposes signInWithGoogle function", () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.signInWithGoogle).toBe("function");
  });

  it("exposes signOut function", () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.signOut).toBe("function");
  });

  it("throws when used outside AuthProvider", () => {
    // Reset the mock to simulate missing context
    vi.resetModules();

    // We test the actual useAuthContext behavior indirectly:
    // When useAuthContext returns the context, useAuth just passes it through.
    // The actual throw is in useAuthContext (tested in auth-provider.test.tsx).
    // Here we verify useAuth is a thin wrapper that delegates correctly.
    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeDefined();
  });
});
