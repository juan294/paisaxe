import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "./route";

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  })),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

// Get mock reference
import { createServerClient } from "@supabase/ssr";
const mockCreateServerClient = vi.mocked(createServerClient);

describe("Favorites API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (method: string, options: {
    headers?: Record<string, string>;
    body?: object;
    searchParams?: Record<string, string>;
  } = {}) => {
    const url = new URL("http://localhost:3000/api/favorites");
    if (options.searchParams) {
      Object.entries(options.searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return new NextRequest(url, {
      method,
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  describe("GET /api/favorites", () => {
    it("should return 401 when not authenticated", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest("GET");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when Authorization header is missing", async () => {
      const request = createRequest("GET");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return favorites when authenticated", async () => {
      const mockFavorites = [
        { story_id: "story-1" },
        { story_id: "story-2" },
      ];

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
              order: vi.fn(() => Promise.resolve({ data: mockFavorites, error: null })),
            })),
          })),
        })),
      } as never);

      const request = createRequest("GET", {
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual(["story-1", "story-2"]);
    });

    it("should return 500 on database error", async () => {
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
              order: vi.fn(() => Promise.resolve({ data: null, error: { message: "DB error" } })),
            })),
          })),
        })),
      } as never);

      const request = createRequest("GET", {
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe("POST /api/favorites", () => {
    it("should return 401 when not authenticated", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest("POST", {
        body: { storyIds: ["story-1"] },
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when storyIds is missing", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: {},
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("storyIds array is required");
    });

    it("should return 400 when storyIds is empty array", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: { storyIds: [] },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should add favorites successfully", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          upsert: vi.fn(() => Promise.resolve({ error: null })),
        })),
      } as never);

      const request = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: { storyIds: ["story-1", "story-2"] },
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it("should return 500 on database error", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          upsert: vi.fn(() => Promise.resolve({ error: { message: "DB error" } })),
        })),
      } as never);

      const request = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: { storyIds: ["story-1"] },
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe("DELETE /api/favorites", () => {
    it("should return 401 when not authenticated", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest("DELETE", {
        searchParams: { storyId: "story-1" },
      });
      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when storyId is missing", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(),
      } as never);

      const request = createRequest("DELETE", {
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("storyId is required");
    });

    it("should delete favorite successfully", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        })),
      } as never);

      const request = createRequest("DELETE", {
        headers: { Authorization: "Bearer valid-token" },
        searchParams: { storyId: "story-1" },
      });
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it("should return 500 on database error", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: { message: "DB error" } })),
            })),
          })),
        })),
      } as never);

      const request = createRequest("DELETE", {
        headers: { Authorization: "Bearer valid-token" },
        searchParams: { storyId: "story-1" },
      });
      const response = await DELETE(request);

      expect(response.status).toBe(500);
    });
  });
});
