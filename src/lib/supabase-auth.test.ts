import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock cookie store with spies we can inspect
const mockCookieStore = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
};

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  })),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createServerClient } from "@supabase/ssr";
const mockCreateServerClient = vi.mocked(createServerClient);

import { getSupabaseClient, getUserFromRequest } from "./supabase-auth";

// ─── DO-M1: env vars must pass through env.ts .trim() ──────────────────────
describe("DO-M1: getSupabaseClient trims env vars (no bare process.env reads)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strips trailing newline from NEXT_PUBLIC_SUPABASE_URL before passing to createServerClient", async () => {
    // Save and inject a value with a trailing newline (typical Vercel CLI artifact)
    const saved = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co\n";

    await getSupabaseClient();

    const [url] = mockCreateServerClient.mock.calls[0];
    expect(url).toBe("https://test.supabase.co");
    expect(url).not.toMatch(/\n/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = saved;
  });

  it("strips trailing whitespace from NEXT_PUBLIC_SUPABASE_ANON_KEY before passing to createServerClient", async () => {
    const saved = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  test-anon-key  ";

    await getSupabaseClient();

    const [, anonKey] = mockCreateServerClient.mock.calls[0];
    expect(anonKey).toBe("test-anon-key");

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved;
  });
});

describe("getSupabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a Supabase server client with cookies", async () => {
    await getSupabaseClient();

    expect(createServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
  });

  it("should return the created client", async () => {
    const mockClient = {
      auth: { getUser: vi.fn() },
      from: vi.fn(),
    };
    mockCreateServerClient.mockReturnValue(mockClient as never);

    const client = await getSupabaseClient();
    expect(client).toBe(mockClient);
  });

  describe("cookies callbacks", () => {
    async function getCookiesConfig() {
      await getSupabaseClient();
      const callArgs = mockCreateServerClient.mock.calls[0];
      const options = callArgs[2] as { cookies: { getAll: () => unknown; setAll: (cookies: Array<{ name: string; value: string; options?: object }>) => void } };
      return options.cookies;
    }

    it("getAll should delegate to cookieStore.getAll()", async () => {
      const fakeCookies = [
        { name: "sb-token", value: "abc123" },
        { name: "sb-refresh", value: "def456" },
      ];
      mockCookieStore.getAll.mockReturnValue(fakeCookies as never);

      const cookiesConfig = await getCookiesConfig();
      const result = cookiesConfig.getAll();

      expect(mockCookieStore.getAll).toHaveBeenCalled();
      expect(result).toEqual(fakeCookies);
    });

    it("setAll should call cookieStore.set() for each cookie", async () => {
      const cookiesToSet = [
        { name: "sb-token", value: "abc123", options: { path: "/" } },
        { name: "sb-refresh", value: "def456", options: { path: "/", httpOnly: true } },
      ];

      const cookiesConfig = await getCookiesConfig();
      cookiesConfig.setAll(cookiesToSet);

      expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
      expect(mockCookieStore.set).toHaveBeenCalledWith("sb-token", "abc123", { path: "/" });
      expect(mockCookieStore.set).toHaveBeenCalledWith("sb-refresh", "def456", { path: "/", httpOnly: true });
    });

    it("setAll should silently catch errors from cookieStore.set()", async () => {
      mockCookieStore.set.mockImplementation(() => {
        throw new Error("Cannot set cookies in server component");
      });

      const cookiesConfig = await getCookiesConfig();

      // Should not throw
      expect(() =>
        cookiesConfig.setAll([
          { name: "sb-token", value: "abc123", options: { path: "/" } },
        ])
      ).not.toThrow();
    });
  });
});

describe("getUserFromRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (headers: Record<string, string> = {}) => {
    return new NextRequest("http://localhost:3000/api/test", {
      method: "GET",
      headers,
    });
  };

  // ─── BE-H2: cookie-session is tried first when no bearer token present ──────
  it("BE-H2: returns user from cookie session when no Authorization header is present", async () => {
    const mockUser = { id: "cookie-user-123", email: "cookie@example.com" };
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    // No Authorization header — browser user with session cookie
    const request = createRequest();
    const user = await getUserFromRequest(request);

    expect(user).toEqual(mockUser);
    // Cookie-based: getUser called with NO token argument
    expect(mockGetUser).toHaveBeenCalledWith();
  });

  it("BE-H2: returns null when no Authorization header and cookie session is expired", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "session not found" },
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const request = createRequest();
    const user = await getUserFromRequest(request);

    expect(user).toBeNull();
  });

  it("BE-H2: prefers bearer token when Authorization header is present", async () => {
    const mockUser = { id: "bearer-user-456", email: "bearer@example.com" };
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer my-api-token" });
    const user = await getUserFromRequest(request);

    expect(user).toEqual(mockUser);
    // Bearer token path: getUser called WITH the token
    expect(mockGetUser).toHaveBeenCalledWith("my-api-token");
  });

  // SE-L2 (#511): Explicit precedence test — bearer token wins when BOTH
  // Authorization header AND a session cookie are present.
  it("SE-L2 (a): bearer token takes precedence when both Authorization header AND session cookie are present", async () => {
    const bearerUser = { id: "bearer-user-999", email: "bearer@example.com" };
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: bearerUser },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    // Simulate having a session cookie by putting something in the mock cookie store
    mockCookieStore.getAll.mockReturnValue([
      { name: "sb-access-token", value: "cookie-session-token" },
    ] as never);

    // Request has BOTH a Bearer header and a session cookie
    const request = createRequest({ Authorization: "Bearer explicit-bearer-token" });
    const user = await getUserFromRequest(request);

    expect(user).toEqual(bearerUser);
    // Bearer path: getUser called WITH the token (not the cookie-based no-arg call)
    expect(mockGetUser).toHaveBeenCalledWith("explicit-bearer-token");
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  // SE-L2 (#511) (b): Only a session cookie — cookie session is used.
  it("SE-L2 (b): uses cookie session when no Authorization header present (even with cookies set)", async () => {
    const cookieUser = { id: "cookie-user-777", email: "cookie@example.com" };
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: cookieUser },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    // Simulate cookies being set
    mockCookieStore.getAll.mockReturnValue([
      { name: "sb-access-token", value: "cookie-session-token" },
    ] as never);

    // No Authorization header — only cookie session
    const request = createRequest();
    const user = await getUserFromRequest(request);

    expect(user).toEqual(cookieUser);
    // Cookie path: getUser called with NO argument
    expect(mockGetUser).toHaveBeenCalledWith();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("should return null when Authorization header does not start with Bearer (cookie session also empty)", async () => {
    // Non-Bearer auth header → falls through to cookie session; cookie session also null
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Basic some-token" });
    const user = await getUserFromRequest(request);
    expect(user).toBeNull();
  });

  it("should return null when getUser returns an error", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Token expired" },
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer expired-token" });
    const user = await getUserFromRequest(request);

    expect(user).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith("expired-token");
  });

  it("should return null when getUser returns no user", async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer token" });
    const user = await getUserFromRequest(request);

    expect(user).toBeNull();
  });

  it("should return user when token is valid", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer valid-token" });
    const user = await getUserFromRequest(request);

    expect(user).toEqual(mockUser);
  });

  it("should extract token correctly from Bearer header", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer my-secret-token" });
    await getUserFromRequest(request);

    expect(mockGetUser).toHaveBeenCalledWith("my-secret-token");
  });
});
