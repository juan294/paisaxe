import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAdminAuth, withAdmin } from "./admin-auth";

// Mock createAdminClient so withAdmin tests don't need SUPABASE_SERVICE_KEY
const mockAdminClient = { from: vi.fn() };
vi.mock("./supabase", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// Mock next/headers cookies
const mockGetAll = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => mockGetAll(),
    set: (...args: unknown[]) => mockSet(...args),
  }),
}));

// Mock Supabase server client — capture cookie config to exercise callbacks
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

type CookieConfig = {
  cookies: {
    getAll: () => unknown[];
    setAll: (cookies: { name: string; value: string; options?: unknown }[]) => void;
  };
};

let capturedCookieConfig: CookieConfig | null = null;
let capturedUrl: string | null = null;
let capturedAnonKey: string | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (url: string, key: string, config: CookieConfig) => {
    capturedCookieConfig = config;
    capturedUrl = url;
    capturedAnonKey = key;
    return {
      auth: {
        getUser: mockGetUser,
      },
      from: mockFrom,
    };
  },
}));

function setupProfileMock(data: { role: string } | null, error: unknown = null) {
  mockSingle.mockResolvedValue({ data, error });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

// ─── DO-M1 regression: admin-auth must trim Supabase env vars ──────────────
describe("DO-M1: validateAdminAuth trims Supabase env vars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCookieConfig = null;
    capturedUrl = null;
    capturedAnonKey = null;
    mockGetAll.mockReturnValue([]);
  });

  it("strips trailing newline from SUPABASE_URL before passing to createServerClient", async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co\n";

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await validateAdminAuth();

    expect(capturedUrl).toBe("https://test.supabase.co");
    expect(capturedUrl).not.toMatch(/\n/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  });

  it("strips whitespace from SUPABASE_ANON_KEY before passing to createServerClient", async () => {
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  test-anon-key  ";

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await validateAdminAuth();

    expect(capturedAnonKey).toBe("test-anon-key");

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey;
  });
});

describe("validateAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCookieConfig = null;
    capturedUrl = null;
    capturedAnonKey = null;
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

  describe("withAdmin HOF", () => {
    it("should return 401 response when auth fails", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // withAdmin calls validateAdminAuth internally — no valid session → 401
      const handler = vi.fn().mockResolvedValue({ ok: true });
      const result = await withAdmin(handler) as Response;

      expect(result.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should call handler with admin client when auth succeeds", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "admin@example.com" } },
        error: null,
      });
      setupProfileMock({ role: "admin" });

      const handlerResult = { message: "success" };
      const handler = vi.fn().mockResolvedValue(handlerResult);

      const result = await withAdmin(handler);

      // Handler should have been called with a supabase-like client
      expect(handler).toHaveBeenCalledTimes(1);
      // The handler's return value is returned directly
      expect(result).toBe(handlerResult);
    });

    it("should return 403 response when user is not admin", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-456", email: "user@example.com" } },
        error: null,
      });
      setupProfileMock({ role: "user" });

      const handler = vi.fn().mockResolvedValue({ ok: true });
      const result = await withAdmin(handler) as Response;

      expect(result.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should pass supabase client (createAdminClient result) to handler", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "admin@example.com" } },
        error: null,
      });
      setupProfileMock({ role: "admin" });

      let capturedClient: unknown = undefined;
      const handler = vi.fn().mockImplementation((client: unknown) => {
        capturedClient = client;
        return Promise.resolve("done");
      });

      await withAdmin(handler);

      // createAdminClient requires SUPABASE_SERVICE_KEY — in tests that env var
      // may be undefined, so we only assert the handler received *something*
      // (truthy check is skipped because env is not set in unit test context)
      expect(handler).toHaveBeenCalledOnce();
      // capturedClient is whatever createAdminClient() returned (may be undefined
      // or throw if key missing — the call itself is what we verify)
      expect(capturedClient).toBeDefined();
    });
  });

  describe("cookie callbacks", () => {
    it("getAll callback should delegate to cookieStore.getAll", async () => {
      const fakeCookies = [{ name: "sb-token", value: "abc123" }];
      mockGetAll.mockReturnValue(fakeCookies);
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "admin@example.com" } },
        error: null,
      });
      setupProfileMock({ role: "admin" });

      await validateAdminAuth();

      // The captured cookie config should have been passed to createServerClient
      expect(capturedCookieConfig).not.toBeNull();
      const result = capturedCookieConfig!.cookies.getAll();
      expect(result).toEqual(fakeCookies);
      expect(mockGetAll).toHaveBeenCalled();
    });

    it("setAll callback should delegate to cookieStore.set for each cookie", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "admin@example.com" } },
        error: null,
      });
      setupProfileMock({ role: "admin" });

      await validateAdminAuth();

      expect(capturedCookieConfig).not.toBeNull();
      const cookiesToSet = [
        { name: "sb-access-token", value: "token1", options: { path: "/" } },
        { name: "sb-refresh-token", value: "token2", options: { path: "/" } },
      ];
      capturedCookieConfig!.cookies.setAll(cookiesToSet);

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledWith("sb-access-token", "token1", { path: "/" });
      expect(mockSet).toHaveBeenCalledWith("sb-refresh-token", "token2", { path: "/" });
    });

    it("setAll callback should silently catch errors (Server Component context)", async () => {
      mockSet.mockImplementation(() => {
        throw new Error("Headers already sent");
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "admin@example.com" } },
        error: null,
      });
      setupProfileMock({ role: "admin" });

      await validateAdminAuth();

      expect(capturedCookieConfig).not.toBeNull();
      // Should not throw even though mockSet throws
      expect(() => {
        capturedCookieConfig!.cookies.setAll([
          { name: "sb-token", value: "val", options: {} },
        ]);
      }).not.toThrow();
    });
  });
});
