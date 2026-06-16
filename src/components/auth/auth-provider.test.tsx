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

const mockCreateSupabaseBrowserClient = vi.fn(() => ({
  auth: {
    getSession: mockGetSession,
    getUser: mockGetUser,
    onAuthStateChange: mockOnAuthStateChange,
    signInWithOAuth: mockSignInWithOAuth,
    signOut: mockSignOut,
  },
}));

vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => mockCreateSupabaseBrowserClient(),
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

describe("AuthProvider — null supabase client (FE-M4 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSupabaseBrowserClient.mockReturnValue(null as unknown as ReturnType<typeof mockCreateSupabaseBrowserClient>);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });

  it("renders children without throwing when supabase client is null", () => {
    expect(() =>
      render(
        <AuthProvider>
          <span>child</span>
        </AuthProvider>
      )
    ).not.toThrow();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("resolves isLoading to false when supabase client is null", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  // Regression for #556: clicking sign-in (e.g. via the bookmark button) when
  // the supabase client failed to initialize must not throw a TypeError. The
  // user-visible symptom was a silent click-with-no-feedback.
  it("signInWithGoogle does not throw when supabase client is null", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.signInWithGoogle()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Supabase client unavailable"),
    );

    consoleSpy.mockRestore();
  });

  it("signOut returns early and logs error when supabase client is null", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // signOut must resolve (not throw) even when supabase is null
    await expect(result.current.signOut()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Supabase client unavailable — cannot sign out.",
    );

    consoleSpy.mockRestore();
  });
});

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithOAuth: mockSignInWithOAuth,
        signOut: mockSignOut,
      },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
  });

  it("renders children", async () => {
    render(
      <AuthProvider>
        <span>child content</span>
      </AuthProvider>
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("stops loading and logs when the supabase client fails to initialize", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateSupabaseBrowserClient.mockImplementation(() => {
      throw new Error("client init failed");
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error initializing auth:",
      expect.any(Error)
    );
    expect(mockGetSession).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
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

  it("does not call Supabase session bootstrap while initial auth is deferred", async () => {
    mockGetSession.mockImplementation(() => new Promise(() => {}));
    mockGetUser.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider deferInitialAuth>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockCreateSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockOnAuthStateChange).not.toHaveBeenCalled();
  });

  it("loads the Supabase client on demand when a deferred route starts sign-in", async () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: ({ children }) => (
        <AuthProvider deferInitialAuth>{children}</AuthProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockCreateSupabaseBrowserClient).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockCreateSupabaseBrowserClient).toHaveBeenCalledTimes(1);
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/auth/callback"),
      },
    });
  });

  it("runs the Supabase session bootstrap when a deferred route later requires auth", async () => {
    const { rerender } = render(
      <AuthProvider deferInitialAuth>
        <TestConsumer />
      </AuthProvider>
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();

    rerender(
      <AuthProvider deferInitialAuth={false}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(1);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
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

  it("handles getUser returning error even with a user object (clears auth state)", async () => {
    // Edge case: getUser returns both an error AND a user
    // The error should take precedence
    mockGetUser.mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: { message: "session_expired" },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Error takes precedence — user should be cleared
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

  it("signInWithGoogle falls back to NEXT_PUBLIC_SITE_URL when window is undefined", async () => {
    // Exercise the SSR fallback branch (line 75-76) by temporarily stubbing
    // window to undefined. The callback evaluates `typeof window` at call time,
    // so we can render normally, then stub window just for the callback invocation.
    process.env.NEXT_PUBLIC_SITE_URL = "https://paisaxe.es";

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Save real window and stub it to undefined
    const realWindow = globalThis.window;
    vi.stubGlobal("window", undefined);

    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signInWithGoogle();
    });
    // Restore window before awaiting (React needs window for state updates)
    vi.stubGlobal("window", realWindow);
    await signInPromise!;

    const callArgs = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toBe("https://paisaxe.es/auth/callback");

    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("signInWithGoogle falls back to localhost:3000 when window and SITE_URL are undefined", async () => {
    // Exercise the final fallback branch (line 77) where both window and
    // NEXT_PUBLIC_SITE_URL are unavailable.
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const realWindow = globalThis.window;
    vi.stubGlobal("window", undefined);

    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signInWithGoogle();
    });
    vi.stubGlobal("window", realWindow);
    await signInPromise!;

    const callArgs = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toBe("http://localhost:3000/auth/callback");
  });

  it("signInWithGoogle uses window.location.origin for redirect URL", async () => {
    // In jsdom, window.location.origin is "http://localhost" by default
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signInWithGoogle();
    });
    await signInPromise!;

    // Verify it uses window.location.origin (the "typeof window !== undefined" branch)
    const callArgs = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toBe(
      `${window.location.origin}/auth/callback`
    );
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
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithOAuth: mockSignInWithOAuth,
        signOut: mockSignOut,
      },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
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

describe("AuthProvider — cancelled guard (line 91)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithOAuth: mockSignInWithOAuth,
        signOut: mockSignOut,
      },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
  });

  it("ignores auth state changes after component unmounts (cancelled=true guard)", async () => {
    let authChangeCallback: ((event: string, session: unknown) => void) | null = null;
    const mockUnsubscribe = vi.fn();
    mockOnAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authChangeCallback).not.toBeNull();
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });

    // Unmount — sets cancelled = true and calls unsubscribe
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();

    // Fire the callback after unmount — the cancelled guard prevents state updates
    // This should not throw a "can't perform state update on unmounted component" error
    expect(() => {
      act(() => {
        authChangeCallback!("SIGNED_OUT", null);
      });
    }).not.toThrow();
  });
});
