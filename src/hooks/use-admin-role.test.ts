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
});
