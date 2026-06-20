import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { MarketingScheduleRow } from "@/types/marketing";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
}));

// Create mock functions
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSingle = vi.fn();

const createMockSchedule = (overrides?: Partial<MarketingScheduleRow>): MarketingScheduleRow => ({
  id: "schedule-1",
  platform: "x",
  day_of_week: null,
  time_utc: "14:00",
  content_type: "auto",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

// Shared state to control mock behavior per-test
let mockGetResult: { data: MarketingScheduleRow[] | null; error: { message: string; code?: string } | null } = {
  data: [createMockSchedule()],
  error: null,
};
let mockInsertResult: { data: MarketingScheduleRow | null; error: { message: string; code?: string } | null } = {
  data: createMockSchedule(),
  error: null,
};
let mockUpdateResult: { data: MarketingScheduleRow | null; error: { message: string; code?: string } | null } = {
  data: createMockSchedule({ time_utc: "15:00" }),
  error: null,
};
let mockDeleteResult: { error: { message: string; code?: string } | null } = {
  error: null,
};
let mockShouldThrow = false;

// Mock Supabase with proper chain structure
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: () => {
      if (mockShouldThrow) {
        throw new Error("Supabase connection failed");
      }
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            order: (...orderArgs: unknown[]) => {
              mockOrder(...orderArgs);
              return {
                order: (...orderArgs2: unknown[]) => {
                  mockOrder(...orderArgs2);
                  return {
                    order: (...orderArgs3: unknown[]) => {
                      mockOrder(...orderArgs3);
                      return {
                        eq: (...eqArgs: unknown[]) => {
                          mockEq(...eqArgs);
                          return Promise.resolve(mockGetResult);
                        },
                        then: (
                          resolve: (result: { data: MarketingScheduleRow[] | null; error: { message: string; code?: string } | null }) => void,
                        ) => {
                          resolve(mockGetResult);
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        insert: (...args: unknown[]) => {
          mockInsert(...args);
          return {
            select: () => ({
              single: () => {
                mockSingle();
                return Promise.resolve(mockInsertResult);
              },
            }),
          };
        },
        update: (...args: unknown[]) => {
          mockUpdate(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                select: () => ({
                  single: () => {
                    mockSingle();
                    return Promise.resolve(mockUpdateResult);
                  },
                }),
              };
            },
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return Promise.resolve(mockDeleteResult);
            },
          };
        },
      };
    },
  }),
}));

// Import after mocks
import { GET, POST, PUT, DELETE } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/marketing/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shared mock state
    mockGetResult = { data: [createMockSchedule()], error: null };
    mockInsertResult = { data: createMockSchedule(), error: null };
    mockUpdateResult = { data: createMockSchedule({ time_utc: "15:00" }), error: null };
    mockDeleteResult = { error: null };
    mockShouldThrow = false;
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/schedule");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return all schedules", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should apply platform filter when provided", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?platform=x"
      );
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("platform", "x");
    });

    it("should not apply filter for invalid platform", async () => {
      mockEq.mockClear();
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?platform=invalid"
      );
      await GET(request);

      // Should not have called eq with platform
      const platformCalls = mockEq.mock.calls.filter(
        (call) => call[0] === "platform"
      );
      expect(platformCalls.length).toBe(0);
    });

    it("should return 500 when supabase query returns an error", async () => {
      mockGetResult = { data: null, error: { message: "Database error" } };
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch schedule");
    });

    it("should return 500 when an unexpected error is thrown", async () => {
      mockShouldThrow = true;
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when missing required fields", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 for invalid platform", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "tiktok", timeUtc: "14:00" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid platform");
    });

    it("should return 400 for invalid time format", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "2:00 PM" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid timeUtc format");
    });

    it("should return 400 for invalid content type", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          timeUtc: "14:00",
          contentType: "invalid",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid contentType");
    });

    it("should return 400 for dayOfWeek greater than 6", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00", dayOfWeek: 7 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid dayOfWeek");
    });

    it("should return 400 for negative dayOfWeek in POST", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00", dayOfWeek: -1 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid dayOfWeek");
    });

    it("should create schedule successfully", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          timeUtc: "14:00",
          contentType: "auto",
          dayOfWeek: 1,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(mockInsert).toHaveBeenCalledWith({
        platform: "x",
        day_of_week: 1,
        time_utc: "14:00",
        content_type: "auto",
        is_active: true,
      });
    });

    it("should accept all valid platforms", async () => {
      const validPlatforms = ["x", "instagram", "pinterest"];

      for (const platform of validPlatforms) {
        mockInsert.mockClear();
        const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
          method: "POST",
          body: JSON.stringify({ platform, timeUtc: "14:00" }),
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });

    it("should accept all valid content types", async () => {
      const validTypes = [
        "photo_caption",
        "reel_caption",
        "thread",
        "pin_description",
        "story_prompt",
        "auto",
      ];

      for (const contentType of validTypes) {
        mockInsert.mockClear();
        const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
          method: "POST",
          body: JSON.stringify({ platform: "x", timeUtc: "14:00", contentType }),
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });

    it("should accept valid dayOfWeek values 0-6", async () => {
      for (let day = 0; day <= 6; day++) {
        mockInsert.mockClear();
        const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
          method: "POST",
          body: JSON.stringify({ platform: "x", timeUtc: "14:00", dayOfWeek: day }),
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });

    it("should accept null dayOfWeek for every day", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00", dayOfWeek: null }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ day_of_week: null })
      );
    });

    it("should return 409 for unique constraint violation", async () => {
      mockInsertResult = { data: null, error: { message: "duplicate key", code: "23505" } };
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain("already exists");
    });

    it("should return 500 when insert returns a generic error", async () => {
      mockInsertResult = { data: null, error: { message: "Insert failed" } };
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create schedule");
    });

    it("should return 500 when an unexpected error is thrown in POST", async () => {
      mockShouldThrow = true;
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "POST",
        body: JSON.stringify({ platform: "x", timeUtc: "14:00" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("PUT", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ timeUtc: "15:00" }),
        }
      );
      const response = await PUT(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when id is missing", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "PUT",
        body: JSON.stringify({ timeUtc: "15:00" }),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("id query parameter required");
    });

    it("should return 400 when no valid fields to update", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({}),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No valid fields to update");
    });

    it("should return 400 for invalid timeUtc format", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ timeUtc: "invalid" }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid timeUtc format");
    });

    it("should return 400 for invalid contentType", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ contentType: "invalid" }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid contentType");
    });

    it("should return 400 for dayOfWeek greater than 6", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ dayOfWeek: 10 }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid dayOfWeek");
    });

    it("should return 400 for negative dayOfWeek", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ dayOfWeek: -1 }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid dayOfWeek");
    });

    it("should update schedule successfully", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ timeUtc: "15:00" }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(mockUpdate).toHaveBeenCalledWith({ time_utc: "15:00" });
      expect(mockEq).toHaveBeenCalledWith("id", "schedule-1");
    });

    it("should update contentType successfully", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ contentType: "photo_caption" }),
        }
      );
      const response = await PUT(request);

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ content_type: "photo_caption" });
    });

    it("should update isActive successfully", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ isActive: false }),
        }
      );
      const response = await PUT(request);

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it("should allow setting dayOfWeek to null", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ dayOfWeek: null }),
        }
      );
      const response = await PUT(request);

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ day_of_week: null });
    });

    it("should return 500 when update returns a database error", async () => {
      mockUpdateResult = { data: null, error: { message: "Update failed" } };
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ timeUtc: "15:00" }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update schedule");
    });

    it("should return 500 when an unexpected error is thrown in PUT", async () => {
      mockShouldThrow = true;
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        {
          method: "PUT",
          body: JSON.stringify({ timeUtc: "15:00" }),
        }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when id is missing", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/schedule", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("id query parameter required");
    });

    it("should delete schedule successfully", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "schedule-1");
    });

    it("should return 500 when delete returns a database error", async () => {
      mockDeleteResult = { error: { message: "Delete failed" } };
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete schedule");
    });

    it("should return 500 when an unexpected error is thrown in DELETE", async () => {
      mockShouldThrow = true;
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/schedule?id=schedule-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
