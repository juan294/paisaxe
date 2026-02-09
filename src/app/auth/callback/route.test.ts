import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock Supabase SSR — capture cookie config to exercise callbacks
const mockExchangeCodeForSession = vi.fn();

type CookieConfig = {
  cookies: {
    getAll: () => unknown[];
    setAll: (cookies: { name: string; value: string; options?: unknown }[]) => void;
  };
};

let capturedCookieConfig: CookieConfig | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, config: CookieConfig) => {
    capturedCookieConfig = config;
    return {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    };
  }),
}));

// Mock cookies
const mockCookieGetAll = vi.fn((): { name: string; value: string }[] => []);
const mockCookieSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    getAll: mockCookieGetAll,
    set: mockCookieSet,
  })),
}));

describe("Auth Callback Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCookieConfig = null;
  });

  const createRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL("http://localhost:3000/auth/callback");
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  describe("GET /auth/callback", () => {
    it("should redirect to /immersive on successful code exchange", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({ code: "valid-auth-code" });
      const response = await GET(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get("location")).toContain("/immersive");
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code");
    });

    it("should redirect to custom next path when provided", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({
        code: "valid-auth-code",
        next: "/favorites",
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/favorites");
    });

    it("should reject open redirect via //evil.com in next param", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({
        code: "valid-auth-code",
        next: "//evil.com",
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location") || "";
      // Should NOT redirect to evil.com — should fall back to /immersive
      expect(location).not.toContain("evil.com");
      expect(location).toContain("/immersive");
    });

    it("should reject open redirect via https://evil.com in next param", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({
        code: "valid-auth-code",
        next: "https://evil.com",
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location") || "";
      expect(location).not.toContain("evil.com");
      expect(location).toContain("/immersive");
    });

    it("should redirect to /immersive when code is missing", async () => {
      const request = createRequest({});
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/immersive");
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });

    it("should redirect to /immersive on code exchange error", async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: { message: "Invalid code" },
      });

      const request = createRequest({ code: "invalid-code" });
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/immersive");
    });

    it("should redirect to /immersive (not /immersive prefixed path) when no code and no next param", async () => {
      const request = createRequest({});
      const response = await GET(request);

      expect(response.status).toBe(307);
      // Should redirect to exactly /immersive (the fallback)
      const location = response.headers.get("location") || "";
      expect(location).toBe("http://localhost:3000/immersive");
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });

    it("should call createServerClient when code is present", async () => {
      const { createServerClient } = await import("@supabase/ssr");
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({ code: "some-code" });
      await GET(request);

      expect(createServerClient).toHaveBeenCalled();
    });
  });

  describe("cookie callbacks", () => {
    it("getAll callback should delegate to cookieStore.getAll", async () => {
      const fakeCookies = [{ name: "sb-token", value: "abc123" }];
      mockCookieGetAll.mockReturnValue(fakeCookies);
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({ code: "some-code" });
      await GET(request);

      expect(capturedCookieConfig).not.toBeNull();
      const result = capturedCookieConfig!.cookies.getAll();
      expect(result).toEqual(fakeCookies);
    });

    it("setAll callback should delegate to cookieStore.set for each cookie", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({ code: "some-code" });
      await GET(request);

      expect(capturedCookieConfig).not.toBeNull();
      const cookiesToSet = [
        { name: "sb-access-token", value: "token1", options: { path: "/" } },
        { name: "sb-refresh-token", value: "token2", options: { path: "/" } },
      ];
      capturedCookieConfig!.cookies.setAll(cookiesToSet);

      expect(mockCookieSet).toHaveBeenCalledTimes(2);
      expect(mockCookieSet).toHaveBeenCalledWith("sb-access-token", "token1", { path: "/" });
      expect(mockCookieSet).toHaveBeenCalledWith("sb-refresh-token", "token2", { path: "/" });
    });

    it("setAll callback should silently catch errors (Server Component context)", async () => {
      mockCookieSet.mockImplementation(() => {
        throw new Error("Headers already sent");
      });
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createRequest({ code: "some-code" });
      await GET(request);

      expect(capturedCookieConfig).not.toBeNull();
      // Should not throw even though cookieStore.set throws
      expect(() => {
        capturedCookieConfig!.cookies.setAll([
          { name: "sb-token", value: "val", options: {} },
        ]);
      }).not.toThrow();
    });
  });
});
