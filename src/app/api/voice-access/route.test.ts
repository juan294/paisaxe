import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger,
}));

import { GET } from "./route";

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    })
  ),
}));

// Get mock reference
import { createServerClient } from "@supabase/ssr";
const mockCreateServerClient = vi.mocked(createServerClient);

describe("Voice Access API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (options: { headers?: Record<string, string> } = {}) => {
    const url = new URL("http://localhost:3000/api/voice-access");
    return new NextRequest(url, {
      method: "GET",
      headers: options.headers || {},
    });
  };

  describe("GET /api/voice-access", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when Authorization header does not start with Bearer", async () => {
      const request = createRequest({
        headers: { Authorization: "Basic some-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when getUser returns error", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Invalid token" },
          }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest({
        headers: { Authorization: "Bearer invalid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return 401 when getUser returns no user", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest({
        headers: { Authorization: "Bearer token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return hasAccess: false when no active voice purchase found (maybeSingle returns null data)", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() =>
                      // maybeSingle returns {data: null, error: null} for no rows — no PGRST116
                      Promise.resolve({ data: null, error: null })
                    ),
                  })),
                })),
              })),
            })),
          })),
        })),
      } as never);

      const request = createRequest({
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.hasAccess).toBe(false);
      expect(json.expiresAt).toBeNull();
      expect(json.purchaseType).toBeNull();
    });

    it("should return hasAccess: true when active voice purchase exists", async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() =>
                      Promise.resolve({
                        data: {
                          id: "purchase-123",
                          purchase_type: "day_pass",
                          expires_at: expiresAt,
                        },
                        error: null,
                      })
                    ),
                  })),
                })),
              })),
            })),
          })),
        })),
      } as never);

      const request = createRequest({
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.hasAccess).toBe(true);
      expect(json.expiresAt).toBe(expiresAt);
      expect(json.purchaseType).toBe("day_pass");
    });

    it("should return 500 on database error (maybeSingle returns non-null error)", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() =>
                      // With maybeSingle, any non-null error is a real DB error
                      Promise.resolve({
                        data: null,
                        error: { code: "PGRST500", message: "Database error" },
                      })
                    ),
                  })),
                })),
              })),
            })),
          })),
        })),
      } as never);

      const request = createRequest({
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith("[VOICE_ACCESS_FETCH_FAILED]", {
        user_id: "user-123",
        error: { code: "PGRST500", message: "Database error" },
      });
      const json = await response.json();
      expect(json.error).toBe("Failed to check access");
    });
  });
});
