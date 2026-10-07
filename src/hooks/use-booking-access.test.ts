import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingAccess } from "./use-booking-access";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const limits = { chatTurns: { used: 1, limit: 60 }, bookingAttempts: { used: 0, limit: 10 } };

describe("useBookingAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "anon-1", email: null },
      session: { access_token: "token-1" },
      isLoading: false,
    });
  });

  it("is inactive without a user and does not call the API", async () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false });
    const { result } = renderHook(() => useBookingAccess());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ active: false, limits: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("is active with the limits when the server grants access", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ active: true, limits }) });
    const { result } = renderHook(() => useBookingAccess());

    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.limits).toEqual(limits);
    expect(mockFetch).toHaveBeenCalledWith("/api/booking/access", {
      headers: { Authorization: "Bearer token-1" },
      cache: "no-store",
    });
  });

  it("treats the gate's 404 as inactive", async () => {
    // Even a body that claims access must not count when the status is not OK.
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ active: true, limits }) });
    const { result } = renderHook(() => useBookingAccess());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ active: false, limits: null });
  });

  it("treats a network failure as inactive", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useBookingAccess());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.active).toBe(false);
  });

  it("does not refetch when only the token refreshes for the same user", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ active: true, limits }) });
    const { result, rerender } = renderHook(() => useBookingAccess());
    await waitFor(() => expect(result.current.active).toBe(true));

    mockUseAuth.mockReturnValue({
      user: { id: "anon-1", email: null },
      session: { access_token: "token-2" },
      isLoading: false,
    });
    rerender();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refetches when the user changes", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ active: true, limits }) });
    const { rerender } = renderHook(() => useBookingAccess());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockUseAuth.mockReturnValue({ user: { id: "google-1", email: "a@b.c" }, session: { access_token: "g" }, isLoading: false });
    rerender();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe("Bearer g");
  });
});
