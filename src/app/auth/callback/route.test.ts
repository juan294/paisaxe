import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock Supabase SSR
const mockExchangeCodeForSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

describe("Auth Callback Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  // Note: Lines 20-21 (getAll) and 22-31 (setAll try/catch) are internal cookie
  // plumbing passed as callbacks to createServerClient. Since createServerClient
  // is fully mocked, these callbacks are never invoked in unit tests. This is
  // expected and acceptable -- the Supabase SSR cookie integration is covered
  // by the library's own tests and by E2E/integration testing.
});
