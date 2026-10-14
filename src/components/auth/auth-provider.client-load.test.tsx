import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { AuthProvider, useAuthContext } from "./auth-provider";

const gate = vi.hoisted(() => {
  let open!: () => void;
  const promise = new Promise<void>(resolve => { open = resolve; });
  return { promise, open };
});
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

// The factory models a cold dev compile: the browser client chunk is not
// available until the test opens the gate.
vi.mock("@/lib/supabase-browser", async () => {
  await gate.promise;
  return {
    createSupabaseBrowserClient: () => ({
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    }),
  };
});

const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

function Consumer() {
  const auth = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="error">{String(auth.authError)}</span>
      <span data-testid="user">{auth.user?.email ?? "none"}</span>
    </div>
  );
}

const supabaseUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {},
  app_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00Z",
};

describe("AuthProvider client chunk load vs verification deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: supabaseUser } },
      error: null,
    });
    errorSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("does not spend the 1.5s verification deadline while the browser client chunk is still loading", async () => {
    mockGetUser.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    render(<AuthProvider><Consumer /></AuthProvider>);

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.getByTestId("error").textContent).toBe("false");
    expect(screen.getByTestId("loading").textContent).toBe("true");

    await act(async () => { gate.open(); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    expect(screen.getByTestId("error").textContent).toBe("false");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("still times out 1.5s after the client loads when the network verification never answers", async () => {
    gate.open();
    mockGetUser.mockReturnValue(new Promise(() => {}));
    render(<AuthProvider><Consumer /></AuthProvider>);

    await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
    expect(screen.getByTestId("error").textContent).toBe("false");

    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByTestId("error").textContent).toBe("true");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });
});
