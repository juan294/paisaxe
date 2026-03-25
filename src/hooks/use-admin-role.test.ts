import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAdminRole } from "./use-admin-role";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Supabase browser client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    from: mockFrom,
  }),
}));

function setupSupabaseMock(data: { role: string } | null, error: unknown = null) {
  mockSingle.mockResolvedValue({ data, error });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe("useAdminRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isLoading true while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });

    const { result } = renderHook(() => useAdminRole());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it("returns isAdmin false when user is not authenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns isAdmin true when user has admin role", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "admin@example.com" },
      isLoading: false,
    });
    setupSupabaseMock({ role: "admin" });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockSelect).toHaveBeenCalledWith("role");
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("returns isAdmin false when user has user role", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-456", email: "user@example.com" },
      isLoading: false,
    });
    setupSupabaseMock({ role: "user" });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
  });

  it("returns isAdmin false when profile query returns error", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-789", email: "error@example.com" },
      isLoading: false,
    });
    setupSupabaseMock(null, { message: "Not found" });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
  });

  it("returns isAdmin false when profile query returns null data", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-000", email: "nodata@example.com" },
      isLoading: false,
    });
    setupSupabaseMock(null);

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
  });

  it("returns isAdmin false when query throws", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-err", email: "throw@example.com" },
      isLoading: false,
    });
    mockSingle.mockRejectedValue(new Error("Network error"));
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
  });

  it("skips re-checking role when user ID has already been verified", async () => {
    const user = { id: "user-123", email: "admin@example.com" };
    mockUseAuth.mockReturnValue({ user, isLoading: false });
    setupSupabaseMock({ role: "admin" });

    const { result, rerender } = renderHook(() => useAdminRole());

    // Wait for first check to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // Re-render with same user — should NOT trigger another query
    rerender();

    // Still admin, and no additional query was made
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("re-checks role when user changes after initial check", async () => {
    // First user is admin
    const user1 = { id: "user-aaa", email: "admin@example.com" };
    mockUseAuth.mockReturnValue({ user: user1, isLoading: false });
    setupSupabaseMock({ role: "admin" });

    const { result, rerender } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // Switch to a different user who is NOT admin
    const user2 = { id: "user-bbb", email: "regular@example.com" };
    mockUseAuth.mockReturnValue({ user: user2, isLoading: false });
    setupSupabaseMock({ role: "user" });

    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have queried again for the new user
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result.current.isAdmin).toBe(false);
  });

  it("skips re-checking when effect re-runs with same user ID but new object reference", async () => {
    const user1 = { id: "user-same", email: "admin@example.com" };
    mockUseAuth.mockReturnValue({ user: user1, isLoading: false });
    setupSupabaseMock({ role: "admin" });

    const { result, rerender } = renderHook(() => useAdminRole());

    // Wait for first check to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // Create a NEW object with the SAME id — triggers useEffect (new ref) but
    // checkedUserIdRef.current === user.id is true, so it returns early (line 33)
    const user2 = { id: "user-same", email: "admin@example.com" };
    mockUseAuth.mockReturnValue({ user: user2, isLoading: false });

    rerender();

    // Should still be admin, and no additional query was made (line 33 early return)
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("resets checked user ref when user logs out", async () => {
    // Start with an admin user
    const user = { id: "user-ccc", email: "admin@example.com" };
    mockUseAuth.mockReturnValue({ user, isLoading: false });
    setupSupabaseMock({ role: "admin" });

    const { result, rerender } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(true);

    // User logs out
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(false);

    // Same user logs back in — should re-check (ref was cleared on logout)
    mockUseAuth.mockReturnValue({ user, isLoading: false });
    setupSupabaseMock({ role: "admin" });
    vi.clearAllMocks();
    setupSupabaseMock({ role: "admin" });

    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1); // re-checked after logout cycle
  });
});
