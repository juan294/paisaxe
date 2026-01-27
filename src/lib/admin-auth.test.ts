import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAdminAuth } from "./admin-auth";

// Mock next/headers cookies
const mockGetAll = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => mockGetAll(),
    set: (...args: unknown[]) => mockSet(...args),
  }),
}));

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

function setupProfileMock(data: { role: string } | null, error: unknown = null) {
  mockSingle.mockResolvedValue({ data, error });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe("validateAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockReturnValue([]);
  });

  it("should return valid true with userId for admin user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "admin@example.com" } },
      error: null,
    });
    setupProfileMock({ role: "admin" });

    const result = await validateAdminAuth();

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userId).toBe("user-123");
    }
    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("should return 401 when no user session exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await validateAdminAuth();

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const body = await result.error.json();
      expect(result.error.status).toBe(401);
      expect(body.error).toBe("Authentication required");
    }
  });

  it("should return 401 when getUser returns an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const result = await validateAdminAuth();

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.status).toBe(401);
    }
  });

  it("should return 403 when user has 'user' role (not admin)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-456", email: "user@example.com" } },
      error: null,
    });
    setupProfileMock({ role: "user" });

    const result = await validateAdminAuth();

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const body = await result.error.json();
      expect(result.error.status).toBe(403);
      expect(body.error).toBe("Admin access required");
    }
  });

  it("should return 403 when user profile not found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-789", email: "noone@example.com" } },
      error: null,
    });
    setupProfileMock(null);

    const result = await validateAdminAuth();

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.status).toBe(403);
    }
  });

  it("should return 403 when profile query returns error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-000", email: "error@example.com" } },
      error: null,
    });
    setupProfileMock(null, { message: "Query failed" });

    const result = await validateAdminAuth();

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.status).toBe(403);
    }
  });

  it("should return 500 when an unexpected error is thrown", async () => {
    mockGetUser.mockRejectedValue(new Error("Unexpected failure"));

    const result = await validateAdminAuth();

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const body = await result.error.json();
      expect(result.error.status).toBe(500);
      expect(body.error).toBe("Authentication failed");
    }
  });
});
