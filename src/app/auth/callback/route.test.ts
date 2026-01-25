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
  });
});
