import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { StorySuggestionRow } from "@/types/suggestions";

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

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({
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
                    return Promise.resolve({
                      data: createMockSuggestion({ status: "reviewed", admin_notes: "Reviewed" }),
                      error: null,
                    });
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
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
  }),
}));

// Import after mocks
import { PUT, DELETE } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/suggestions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
