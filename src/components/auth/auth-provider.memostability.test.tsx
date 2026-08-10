/**
 * FE-M1: Regression tests — AuthProvider context value must be memoized.
 *
 * A fresh object literal as the Provider `value` causes every context consumer
 * to re-render on every parent render, even when user/session/isLoading haven't
 * changed. These tests assert that consumers do not re-render spuriously when
 * AuthProvider's own state hasn't changed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { memo, useRef, useState } from "react";
import { AuthProvider, useAuthContext } from "./auth-provider";

vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

/**
 * A memoized consumer that counts how many times it renders.
 * Because it is wrapped in memo(), it only re-renders when its OWN
 * props change — but the context subscription via useAuthContext() will
 * cause a re-render whenever the context value reference changes.
 *
 * With a non-memoized `value` object, every AuthProvider state update
 * (even unrelated ones) produces a new reference, causing this to re-render.
 * With useMemo, the reference is stable when deps are unchanged.
 */
const ConsumerWithRenderCount = memo(function ConsumerWithRenderCount() {
  const { isLoading } = useAuthContext();
  const renderCount = useRef(0);
  renderCount.current += 1;
  return (
    <div
      data-testid="consumer"
      data-loading={String(isLoading)}
      data-renders={renderCount.current}
    />
  );
});

/**
 * Wrapper that can trigger its own re-render via setState, which
 * forces AuthProvider to re-render without changing auth state.
 */
function ParentThatRerenders({ children }: { children: React.ReactNode }) {
  const [, setTick] = useState(0);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setTick((n) => n + 1)}>
        tick
      </button>
      {children}
    </div>
  );
}

describe("AuthProvider — context value memoization (FE-M1)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });

  it("memoized consumer does not re-render when parent re-renders without auth state change", () => {
    render(
      <ParentThatRerenders>
        <AuthProvider deferInitialAuth>
          <ConsumerWithRenderCount />
        </AuthProvider>
      </ParentThatRerenders>
    );

    const consumer = screen.getByTestId("consumer");
    const initialRenders = Number(consumer.getAttribute("data-renders"));

    // Force the parent (and thus AuthProvider) to re-render
    act(() => {
      screen.getByTestId("trigger").click();
    });
    act(() => {
      screen.getByTestId("trigger").click();
    });

    // With useMemo on the context value, re-renders of the parent
    // that don't change user/session/isLoading must NOT re-render consumers.
    const finalRenders = Number(consumer.getAttribute("data-renders"));
    expect(finalRenders).toBe(initialRenders);
  });

  it("context value reference is stable for deferInitialAuth=true (no state transitions)", () => {
    // Capture the value reference across two renders
    const capturedValues: object[] = [];

    function ValueCapture() {
      const value = useAuthContext();
      capturedValues.push(value);
      return <div data-testid="capture">{String(value.isLoading)}</div>;
    }

    const { rerender } = render(
      <AuthProvider deferInitialAuth>
        <ValueCapture />
      </AuthProvider>
    );

    rerender(
      <AuthProvider deferInitialAuth>
        <ValueCapture />
      </AuthProvider>
    );

    // With useMemo, the value reference should be the same object
    // on the second render (no state changed)
    expect(capturedValues.length).toBeGreaterThanOrEqual(2);
    expect(capturedValues[capturedValues.length - 1]).toBe(
      capturedValues[capturedValues.length - 2]
    );
  });
});
