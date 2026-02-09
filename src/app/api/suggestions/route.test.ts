import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
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

describe("Suggestions API", () => {
  let requestCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    requestCounter++;
  });

  // Each request gets a unique IP to avoid rate limit collisions across tests
  const createRequest = (
    method: string,
    options: {
      headers?: Record<string, string>;
      body?: object;
    } = {}
  ) => {
    const url = new URL("http://localhost:3000/api/suggestions");
    const headers: Record<string, string> = {
      "x-forwarded-for": `10.0.0.${requestCounter}`,
      ...(options.headers || {}),
    };
    return new NextRequest(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  describe("GET /api/suggestions", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const request = createRequest("GET");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when Authorization header does not start with Bearer", async () => {
      const request = createRequest("GET", {
        headers: { Authorization: "Basic some-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
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

      const request = createRequest("GET", {
        headers: { Authorization: "Bearer invalid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return suggestions when authenticated", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          user_id: "user-123",
          place_name: "Test Place",
          comment: "A comment",
          location: "central",
          attribution: null,
          status: "pending",
          admin_notes: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
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
              order: vi.fn(() =>
                Promise.resolve({ data: mockSuggestions, error: null })
              ),
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
      expect(json.data).toHaveLength(1);
      expect(json.data[0].placeName).toBe("Test Place");
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
              order: vi.fn(() =>
                Promise.resolve({ data: null, error: { message: "DB error" } })
              ),
            })),
          })),
        })),
      } as never);

      const request = createRequest("GET", {
        headers: { Authorization: "Bearer valid-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Failed to fetch suggestions");
    });
  });

  describe("POST /api/suggestions", () => {
    it("should accept anonymous submissions (no auth required)", async () => {
      const createdSuggestion = {
        id: "sug-anon",
        user_id: null,
        place_name: "Anonymous Place",
        comment: null,
        location: null,
        attribution: "A Visitor",
        status: "pending",
        admin_notes: null,
        converted_story_id: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: createdSuggestion, error: null })
              ),
            })),
          })),
        })),
      } as never);

      const request = createRequest("POST", {
        body: { placeName: "Anonymous Place", attribution: "A Visitor" },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.placeName).toBe("Anonymous Place");
      expect(json.data.userId).toBeNull();
    });

    it("should return 400 for invalid JSON body", async () => {
      const url = new URL("http://localhost:3000/api/suggestions");
      const request = new NextRequest(url, {
        method: "POST",
        body: "not-json",
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid request body");
    });

    it("should return 400 when placeName is missing", async () => {
      const request = createRequest("POST", {
        body: {},
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Place name must be between 3 and 100 characters");
    });

    it("should return 400 when placeName is too short", async () => {
      const request = createRequest("POST", {
        body: { placeName: "AB" },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Place name must be between 3 and 100 characters");
    });

    it("should return 400 when placeName is too long", async () => {
      const request = createRequest("POST", {
        body: { placeName: "A".repeat(101) },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should return 400 when comment is too long", async () => {
      const request = createRequest("POST", {
        body: { placeName: "Valid Place", comment: "A".repeat(501) },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Comment must not exceed 500 characters");
    });

    it("should return 400 for invalid location", async () => {
      const request = createRequest("POST", {
        body: { placeName: "Valid Place", location: "invalid" },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe(
        "Invalid location. Must be eastern, central, or western."
      );
    });

    it("should return 400 when attribution is too long", async () => {
      const request = createRequest("POST", {
        body: { placeName: "Valid Place", attribution: "A".repeat(101) },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Attribution must not exceed 100 characters");
    });

    it("should create suggestion successfully", async () => {
      const createdSuggestion = {
        id: "sug-new",
        user_id: "user-create-success",
        place_name: "New Place",
        comment: "Great spot",
        location: "central",
        attribution: "John Doe",
        status: "pending",
        admin_notes: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-create-success" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: createdSuggestion, error: null })
              ),
            })),
          })),
        })),
      } as never);

      const request = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: {
          placeName: "New Place",
          comment: "Great spot",
          location: "central",
          attribution: "John Doe",
        },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.placeName).toBe("New Place");
      expect(json.data.status).toBe("pending");
    });

    it("should use cookie session user_id when no Authorization header is sent", async () => {
      const createdSuggestion = {
        id: "sug-cookie",
        user_id: "user-cookie-session",
        place_name: "Cookie Place",
        comment: null,
        location: null,
        attribution: null,
        status: "pending",
        admin_notes: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: createdSuggestion, error: null })
          ),
        })),
      }));

      mockCreateServerClient.mockReturnValue({
        auth: {
          // Cookie-based session returns a valid user
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-cookie-session" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          insert: mockInsert,
        })),
      } as never);

      // NO Authorization header — user is authenticated via cookies only
      const request = createRequest("POST", {
        body: { placeName: "Cookie Place" },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.userId).toBe("user-cookie-session");
      // Verify insert was called with the cookie user's ID, not null
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-cookie-session" })
      );
    });

    it("should return 500 on database insert error", async () => {
      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-insert-error" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: null, error: { message: "Insert error" } })
              ),
            })),
          })),
        })),
      } as never);

      const request = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: { placeName: "Valid Place" },
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Failed to create suggestion");
    });

    it("should return 429 when rate limited", async () => {
      // First request - should succeed
      const createdSuggestion = {
        id: "sug-new",
        user_id: "user-rate-limit",
        place_name: "First Place",
        comment: null,
        location: null,
        attribution: null,
        status: "pending",
        admin_notes: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-rate-limit" } },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: createdSuggestion, error: null })
              ),
            })),
          })),
        })),
      } as never);

      const request1 = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: { placeName: "First Place" },
      });
      const response1 = await POST(request1);
      expect(response1.status).toBe(201);

      // Second request immediately after - should be rate limited
      const request2 = createRequest("POST", {
        headers: { Authorization: "Bearer valid-token" },
        body: { placeName: "Second Place" },
      });
      const response2 = await POST(request2);

      expect(response2.status).toBe(429);
      const json = await response2.json();
      expect(json.error).toContain("Rate limit exceeded");
    });
  });
});
