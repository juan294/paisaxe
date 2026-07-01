import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { StorySuggestionRow } from "@/types/suggestions";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
}));

// Create mock functions
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

const createMockSuggestion = (overrides?: Partial<StorySuggestionRow>): StorySuggestionRow => ({
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
  ...overrides,
});

// Controllable mock result for single() — allows per-test override
let mockSingleResult: { data: StorySuggestionRow | null; error: { message: string; code?: string } | null } = {
  data: createMockSuggestion({ status: "reviewed", admin_notes: "Reviewed" }),
  error: null,
};

// Controllable mock result for delete eq() — allows per-test override
let mockDeleteEqResult: { error: { message: string; code?: string } | null } = {
  error: null,
};

// Flag to make createAdminClient throw (for catch block coverage)
let mockCreateAdminClientThrows = false;
// Optional override for the thrown value — lets tests exercise the
// `error instanceof Error ? error.message : String(error)` false branch.
let mockCreateAdminClientThrowValue: unknown = undefined;

// Mock Supabase
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => {
    if (mockCreateAdminClientThrows) {
      throw mockCreateAdminClientThrowValue !== undefined
        ? mockCreateAdminClientThrowValue
        : new Error("Supabase client creation failed");
    }
    return {
      from: () => ({
        update: (...args: unknown[]) => {
          mockUpdate(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                select: (...selectArgs: unknown[]) => {
                  mockSelect(...selectArgs);
                  return {
                    single: () => {
                      mockSingle();
                      return Promise.resolve(mockSingleResult);
                    },
                  };
                },
              };
            },
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return Promise.resolve(mockDeleteEqResult);
            },
          };
        },
      }),
    };
  },
}));

// Import after mocks
import { PUT, DELETE } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/suggestions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset controllable mock state to defaults
    mockSingleResult = {
      data: createMockSuggestion({ status: "reviewed", admin_notes: "Reviewed" }),
      error: null,
    };
    mockDeleteEqResult = { error: null };
    mockCreateAdminClientThrows = false;
    mockCreateAdminClientThrowValue = undefined;
  });

  describe("PUT", () => {
    const createRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "PUT",
        body: JSON.stringify(body),
      });

    const params = Promise.resolve({ id: "suggestion-1" });

    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return 400 for invalid request body", async () => {
      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "PUT",
        body: "invalid json",
      });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request body");
    });

    it("should return 400 for invalid status", async () => {
      const request = createRequest({ status: "invalid-status" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid status");
    });

    it("should return 400 when no updates provided", async () => {
      const request = createRequest({});

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No updates provided");
    });

    it("should update status successfully", async () => {
      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(mockUpdate).toHaveBeenCalledWith({ status: "reviewed" });
      expect(mockEq).toHaveBeenCalledWith("id", "suggestion-1");
    });

    it("should update admin notes successfully", async () => {
      const request = createRequest({ adminNotes: "This is a great suggestion!" });

      const response = await PUT(request, { params });
      await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ admin_notes: "This is a great suggestion!" });
    });

    it("should update both status and admin notes", async () => {
      const request = createRequest({
        status: "converted",
        adminNotes: "Converted to story",
      });

      await PUT(request, { params });

      expect(mockUpdate).toHaveBeenCalledWith({
        status: "converted",
        admin_notes: "Converted to story",
      });
    });

    it("should accept all valid statuses", async () => {
      const validStatuses = ["pending", "reviewed", "converted", "rejected"];

      for (const status of validStatuses) {
        mockUpdate.mockClear();
        const request = createRequest({ status });

        const response = await PUT(request, { params });

        expect(response.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalledWith({ status });
      }
    });

    it("should return 400 if id param is empty", async () => {
      const emptyParams = Promise.resolve({ id: "" });
      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params: emptyParams });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Suggestion ID is required");
    });

    it("should return 404 when suggestion not found (PGRST116)", async () => {
      mockSingleResult = {
        data: null,
        error: { message: "Row not found", code: "PGRST116" },
      };

      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Suggestion not found");
    });

    it("should return 500 on generic Supabase update error", async () => {
      mockSingleResult = {
        data: null,
        error: { message: "Database connection failed", code: "PGRST500" },
      };

      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update suggestion");
    });

    it("should return 500 on unexpected exception during update", async () => {
      mockCreateAdminClientThrows = true;

      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should stringify a non-Error thrown value during update", async () => {
      mockCreateAdminClientThrows = true;
      mockCreateAdminClientThrowValue = "raw string failure";

      const request = createRequest({ status: "reviewed" });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(logger.error).toHaveBeenCalledWith(
        "Admin suggestion update error:",
        { error: "raw string failure" }
      );
    });

    describe("Zod validation", () => {
      it("should return 400 for invalid status value (Zod catches it)", async () => {
        const request = createRequest({ status: "invalid-status-value" });

        const response = await PUT(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Invalid status");
      });

      it("should return 400 with Zod details for adminNotes exceeding max length", async () => {
        const request = createRequest({ adminNotes: "x".repeat(2001) });

        const response = await PUT(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid request");
        expect(data.details).toBeDefined();
      });

      it("should return 400 when body is empty object (no updates)", async () => {
        const request = createRequest({});

        const response = await PUT(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("No updates provided");
      });
    });
  });

  describe("DELETE", () => {
    const params = Promise.resolve({ id: "suggestion-1" });

    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should delete suggestion successfully", async () => {
      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual({ id: "suggestion-1", deleted: true });
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "suggestion-1");
    });

    it("should return 400 if id param is empty", async () => {
      const emptyParams = Promise.resolve({ id: "" });
      const request = new NextRequest("http://localhost/api/admin/suggestions/", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: emptyParams });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Suggestion ID is required");
    });

    it("should return 500 on Supabase delete error", async () => {
      mockDeleteEqResult = {
        error: { message: "Foreign key violation" },
      };

      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete suggestion");
    });

    it("should return 500 on unexpected exception during delete", async () => {
      mockCreateAdminClientThrows = true;

      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should stringify a non-Error thrown value during delete", async () => {
      mockCreateAdminClientThrows = true;
      mockCreateAdminClientThrowValue = "raw string failure";

      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(logger.error).toHaveBeenCalledWith(
        "Admin suggestion delete error:",
        { error: "raw string failure" }
      );
    });
  });

  it("should use logger.error (not console.error) on unhandled DELETE error", async () => {
    mockCreateAdminClientThrows = true;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
      method: "DELETE",
    });

    await DELETE(request, { params: Promise.resolve({ id: "suggestion-1" }) });
    consoleSpy.mockRestore();

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
