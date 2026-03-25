import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { StorySuggestionRow } from "@/types/suggestions";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
}));

// Create mock functions
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockGetUserById = vi.fn();

const createMockData = (): StorySuggestionRow[] => [
  {
    id: "suggestion-1",
    user_id: "user-1",
    place_name: "Covadonga Lakes",
    comment: "Beautiful place!",
    location: "eastern",
    status: "pending",
    admin_notes: null,
    converted_story_id: null,
    attribution: "John Doe",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "suggestion-2",
    user_id: "user-2",
    place_name: "Playa de Gulpiyuri",
    comment: null,
    location: "central",
    status: "reviewed",
    admin_notes: "Good suggestion",
    converted_story_id: null,
    attribution: null,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  },
];

// Mock Supabase with fluent API
const mockCreateAdminClient = vi.fn();

const defaultSupabaseClient = () => ({
  from: () => ({
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        order: (...orderArgs: unknown[]) => {
          mockOrder(...orderArgs);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return Promise.resolve({
                data: createMockData().filter((s) => s.status === eqArgs[1]),
                error: null,
              });
            },
            then: (resolve: (result: { data: StorySuggestionRow[]; error: null }) => void) => {
              resolve({ data: createMockData(), error: null });
            },
          };
        },
      };
    },
  }),
  auth: {
    admin: {
      getUserById: (...args: unknown[]) => {
        mockGetUserById(...args);
        const userId = args[0] as string;
        if (userId === "user-1") {
          return Promise.resolve({
            data: { user: { email: "user1@example.com" } },
          });
        }
        if (userId === "user-2") {
          return Promise.resolve({
            data: { user: { email: "user2@example.com" } },
          });
        }
        return Promise.resolve({ data: null });
      },
    },
  },
});

mockCreateAdminClient.mockImplementation(defaultSupabaseClient);

vi.mock("@/lib/supabase", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

// Import after mocks
import { GET } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockImplementation(defaultSupabaseClient);
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return 403 if not admin", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });

    it("should return suggestions with user emails", async () => {
      const request = new NextRequest("http://localhost/api/admin/suggestions");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should apply status filter when provided", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/suggestions?status=pending"
      );

      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("status", "pending");
    });

    it("should apply valid status filters only", async () => {
      const validStatuses = ["pending", "reviewed", "converted", "rejected"];

      for (const status of validStatuses) {
        mockEq.mockClear();
        const request = new NextRequest(
          `http://localhost/api/admin/suggestions?status=${status}`
        );

        await GET(request);

        expect(mockEq).toHaveBeenCalledWith("status", status);
      }
    });

    it("should not apply filter for invalid status", async () => {
      mockEq.mockClear();
      const request = new NextRequest(
        "http://localhost/api/admin/suggestions?status=invalid"
      );

      await GET(request);

      expect(mockEq).not.toHaveBeenCalled();
    });

    it("should fetch user emails for each suggestion", async () => {
      const request = new NextRequest("http://localhost/api/admin/suggestions");

      await GET(request);

      expect(mockGetUserById).toHaveBeenCalledWith("user-1");
      expect(mockGetUserById).toHaveBeenCalledWith("user-2");
    });

    it("should return 500 when Supabase query returns an error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockCreateAdminClient.mockReturnValueOnce({
        from: () => ({
          select: () => ({
            order: () => ({
              then: (resolve: (result: { data: null; error: { message: string } }) => void) => {
                resolve({ data: null, error: { message: "Database error" } });
              },
            }),
          }),
        }),
        auth: { admin: { getUserById: vi.fn() } },
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch suggestions");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching suggestions:",
        expect.objectContaining({ message: "Database error" })
      );

      consoleSpy.mockRestore();
    });

    it("should return 500 when an unexpected exception is thrown", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockCreateAdminClient.mockReturnValueOnce({
        from: () => {
          throw new Error("Unexpected failure");
        },
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Admin suggestions API error:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle suggestions where getUserById returns no email (line 55-56 branch)", async () => {
      // Create mock data with suggestions that have user_ids but no emails found
      const mockData: StorySuggestionRow[] = [
        {
          id: "suggestion-no-email",
          user_id: "user-no-email",
          place_name: "Picos de Europa",
          comment: "Amazing views",
          location: "eastern",
          status: "pending",
          admin_notes: null,
          converted_story_id: null,
          attribution: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockCreateAdminClient.mockReturnValueOnce({
        from: () => ({
          select: () => ({
            order: () => ({
              then: (resolve: (result: { data: StorySuggestionRow[]; error: null }) => void) => {
                resolve({ data: mockData, error: null });
              },
            }),
          }),
        }),
        auth: {
          admin: {
            getUserById: () =>
              Promise.resolve({ data: { user: null } }), // No user found
          },
        },
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
    });

    it("should handle suggestions with null user_id (anonymous)", async () => {
      const mockData: StorySuggestionRow[] = [
        {
          id: "suggestion-anon",
          user_id: null as unknown as string,
          place_name: "Playa de Torimbia",
          comment: "Great beach!",
          location: "western",
          status: "pending",
          admin_notes: null,
          converted_story_id: null,
          attribution: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockCreateAdminClient.mockReturnValueOnce({
        from: () => ({
          select: () => ({
            order: () => ({
              then: (resolve: (result: { data: StorySuggestionRow[]; error: null }) => void) => {
                resolve({ data: mockData, error: null });
              },
            }),
          }),
        }),
        auth: {
          admin: {
            getUserById: vi.fn(),
          },
        },
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
    });
  });
});
