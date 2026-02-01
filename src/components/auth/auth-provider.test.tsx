import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { AuthProvider, useAuthContext } from "./auth-provider";
import { mapSupabaseUser } from "@/types/auth";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

// --- Supabase mocks ---
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  }),
}));

// --- Test consumer component ---
function TestConsumer() {
  const auth = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="user">{auth.user?.email || "none"}</span>
      <span data-testid="user-name">{auth.user?.name || "none"}</span>
    </div>
  );
}

// --- Helpers ---
const mockSupabaseUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
  },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00Z",
};

const mockSession = {
  access_token: "test-token",
  refresh_token: "test-refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: mockSupabaseUser,
};

function setupDefaultMocks() {
  mockGetSession.mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });
  mockGetUser.mockResolvedValue({
    data: { user: mockSupabaseUser },
    error: null,
  });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockSignInWithOAuth.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders children", async () => {
    render(
      <AuthProvider>
        <span>child content</span>
      </AuthProvider>
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("provides user and session after getSession resolves", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });
    await waitFor(() => {
      expect(screen.getByTestId("user-name").textContent).toBe("Test User");
    });
  });

  it("isLoading starts true, becomes false after session loaded", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially loading is true (synchronous render)
    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("handles getSession error gracefully (sets isLoading false)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSession.mockRejectedValue(new Error("Session fetch failed"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // User should remain null on error
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error initializing auth:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("handles getUser returning invalid session (clears auth state)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid_grant: Token is expired" },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // User should be null when getUser fails
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("auth state changes via onAuthStateChange callback", async () => {
    // Start with no session so initial state is "none"
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    let authChangeCallback: ((event: string, session: unknown) => void) | null = null;
    mockOnAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Wait for the effect to fire and capture the callback
    await waitFor(() => {
      expect(authChangeCallback).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    // Confirm no user initially
    expect(screen.getByTestId("user").textContent).toBe("none");

    // Simulate auth state change with a new user
    const newUser = {
      ...mockSupabaseUser,
      id: "user-456",
      email: "new@example.com",
      user_metadata: {
        full_name: "New User",
        avatar_url: "https://example.com/new-avatar.jpg",
      },
    };
    const newSession = { ...mockSession, user: newUser };

    act(() => {
      authChangeCallback!("SIGNED_IN", newSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("new@example.com");
      expect(screen.getByTestId("user-name").textContent).toBe("New User");
    });
  });

  it("auth state change with null session clears user", async () => {
    let authChangeCallback: (event: string, session: unknown) => void;
    mockOnAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });

    act(() => {
      authChangeCallback!("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("none");
    });
  });

  it("signInWithGoogle calls supabase signInWithOAuth", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Call signInWithGoogle and let it resolve
    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signInWithGoogle();
    });
    await signInPromise!;

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/auth/callback"),
      },
    });
  });

  it("signInWithGoogle appends redirectPath as ?next= param when provided", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signInWithGoogle("/admin");
    });
    await signInPromise!;

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/auth/callback?next=%2Fadmin"),
      },
    });
  });

  it("signInWithGoogle throws on error", async () => {
    const oauthError = new Error("OAuth failed");
    mockSignInWithOAuth.mockResolvedValue({ error: oauthError });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signInWithGoogle();
    });

    await expect(signInPromise!).rejects.toThrow("OAuth failed");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error signing in with Google:",
      oauthError
    );

    consoleSpy.mockRestore();
  });

  it("signOut calls supabase signOut", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let signOutPromise: Promise<void>;
    act(() => {
      signOutPromise = result.current.signOut();
    });
    await signOutPromise!;

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("signOut throws on error", async () => {
    const signOutError = new Error("Sign out failed");
    mockSignOut.mockResolvedValue({ error: signOutError });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let signOutPromise: Promise<void>;
    act(() => {
      signOutPromise = result.current.signOut();
    });

    await expect(signOutPromise!).rejects.toThrow("Sign out failed");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error signing out:",
      signOutError
    );

    consoleSpy.mockRestore();
  });

  it("unsubscribes from auth state changes on unmount", async () => {
    const unsubscribeFn = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeFn } },
    });

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    unmount();
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});

describe("useAuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("throws when used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useAuthContext must be used within an AuthProvider");

    consoleSpy.mockRestore();
  });
});

describe("mapSupabaseUser", () => {
  it("returns null for null input", () => {
    expect(mapSupabaseUser(null)).toBeNull();
  });

  it("maps user with all metadata (full_name and avatar_url)", () => {
    const user = {
      id: "u1",
      email: "user@example.com",
      user_metadata: {
        full_name: "Full Name",
        avatar_url: "https://example.com/avatar.jpg",
      },
      app_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as User;

    const result = mapSupabaseUser(user);
    expect(result).toEqual({
      id: "u1",
      email: "user@example.com",
      name: "Full Name",
      avatarUrl: "https://example.com/avatar.jpg",
    });
  });

  it("falls back to name when full_name is missing", () => {
    const user = {
      id: "u2",
      email: "user2@example.com",
      user_metadata: {
        name: "Fallback Name",
        avatar_url: "https://example.com/avatar2.jpg",
      },
      app_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as User;

    const result = mapSupabaseUser(user);
    expect(result).toEqual({
      id: "u2",
      email: "user2@example.com",
      name: "Fallback Name",
      avatarUrl: "https://example.com/avatar2.jpg",
    });
  });

  it("falls back to picture when avatar_url is missing", () => {
    const user = {
      id: "u3",
      email: "user3@example.com",
      user_metadata: {
        full_name: "User Three",
        picture: "https://example.com/picture.jpg",
      },
      app_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as User;

    const result = mapSupabaseUser(user);
    expect(result).toEqual({
      id: "u3",
      email: "user3@example.com",
      name: "User Three",
      avatarUrl: "https://example.com/picture.jpg",
    });
  });

  it("handles missing metadata gracefully", () => {
    const user = {
      id: "u4",
      email: undefined,
      user_metadata: {},
      app_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as User;

    const result = mapSupabaseUser(user);
    expect(result).toEqual({
      id: "u4",
      email: null,
      name: null,
      avatarUrl: null,
    });
  });
});
