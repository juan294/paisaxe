import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { MarketingPost } from "@/types/marketing";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
}));

// Create mock functions for posting service
const mockGetDrafts = vi.fn();
const mockCreateDraft = vi.fn();
const mockMarkAsPosted = vi.fn();
const mockDeleteDraft = vi.fn();
const mockUpdateDraft = vi.fn();

vi.mock("@/lib/posting-service", () => ({
  getDrafts: (...args: unknown[]) => mockGetDrafts(...args),
  createDraft: (...args: unknown[]) => mockCreateDraft(...args),
  markAsPosted: (...args: unknown[]) => mockMarkAsPosted(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
  updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
}));

// Mock Supabase for non-draft status queries
const mockSupabaseSelect = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseOrder = vi.fn();
const mockSupabaseLimit = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSupabaseSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockSupabaseEq(...eqArgs);
            return {
              order: (...orderArgs: unknown[]) => {
                mockSupabaseOrder(...orderArgs);
                return {
                  eq: (...eqArgs2: unknown[]) => {
                    mockSupabaseEq(...eqArgs2);
                    return {
                      limit: (...limitArgs: unknown[]) => {
                        return mockSupabaseLimit(...limitArgs);
                      },
                    };
                  },
                  limit: (...limitArgs: unknown[]) => {
                    return mockSupabaseLimit(...limitArgs);
                  },
                };
              },
            };
          },
        };
      },
    }),
  }),
}));

// Import after mocks
import { GET, POST, PATCH, DELETE } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/marketing/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock responses
    mockSupabaseLimit.mockReturnValue(Promise.resolve({ data: [], error: null }));
    mockGetDrafts.mockResolvedValue([]);
    mockCreateDraft.mockResolvedValue({
      success: true,
      post: {
        id: "post-1",
        platform: "x",
        content: "Test post",
        status: "draft",
      } as MarketingPost,
    });
    mockMarkAsPosted.mockResolvedValue({ success: true });
    mockDeleteDraft.mockResolvedValue({ success: true });
    mockUpdateDraft.mockResolvedValue({ success: true });
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/posts");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should fetch drafts when status is draft (default)", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(mockGetDrafts).toHaveBeenCalledWith(undefined);
    });

    it("should fetch drafts with platform filter", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?status=draft&platform=x"
      );
      await GET(request);

      expect(mockGetDrafts).toHaveBeenCalledWith("x");
    });

    it("should query database directly for non-draft status", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?status=posted"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetDrafts).not.toHaveBeenCalled();
      expect(mockSupabaseEq).toHaveBeenCalledWith("status", "posted");
      expect(data.data).toEqual([]);
    });

    it("should apply platform filter for non-draft queries", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?status=posted&platform=instagram"
      );
      await GET(request);

      expect(mockSupabaseEq).toHaveBeenCalledWith("status", "posted");
      expect(mockSupabaseEq).toHaveBeenCalledWith("platform", "instagram");
    });

    it("should return 500 when supabase query returns error", async () => {
      // Make limit() return an error for this test
      mockSupabaseLimit.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { message: "DB error" } })
      );

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?status=posted"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch posts");
    });

    it("should return empty array when supabase returns null data", async () => {
      mockSupabaseLimit.mockReturnValueOnce(
        Promise.resolve({ data: null, error: null })
      );

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?status=posted"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it("should return 500 on unexpected error", async () => {
      // Make limit() throw to trigger the outer catch block
      mockSupabaseLimit.mockReturnValueOnce(
        Promise.reject(new Error("Unexpected failure"))
      );

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?status=posted"
      );
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

      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ platform: "x", content: "Test" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when missing required fields", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ platform: "x" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when platform is missing", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ content: "Test content" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when platform is an invalid value", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ platform: "tiktok", content: "Test" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when content is empty", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ platform: "x", content: "" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should create draft successfully", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          content: "Test post content",
          hashtags: ["#Asturias"],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(mockCreateDraft).toHaveBeenCalledWith({
        platform: "x",
        content: "Test post content",
        hashtags: ["#Asturias"],
      });
    });

    it("should return 400 when createDraft fails", async () => {
      mockCreateDraft.mockResolvedValueOnce({
        success: false,
        error: "Validation failed",
        validationErrors: ["Content too long"],
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ platform: "x", content: "Test" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.validationErrors).toEqual(["Content too long"]);
    });

    it("should return 500 when createDraft throws", async () => {
      mockCreateDraft.mockRejectedValueOnce(new Error("DB connection lost"));

      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "POST",
        body: JSON.stringify({ platform: "x", content: "Test" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("PATCH", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/posts?id=post-1", {
        method: "PATCH",
        body: JSON.stringify({ content: "Updated" }),
      });
      const response = await PATCH(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when post ID is missing", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "PATCH",
        body: JSON.stringify({ content: "Updated" }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Post ID required");
    });

    it("should mark post as posted when action is mark-posted", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1&action=mark-posted",
        {
          method: "PATCH",
          body: JSON.stringify({
            platformPostId: "ext-123",
            postUrl: "https://x.com/post/123",
          }),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockMarkAsPosted).toHaveBeenCalledWith({
        postId: "post-1",
        platformPostId: "ext-123",
        postUrl: "https://x.com/post/123",
      });
    });

    it("should update draft when action is update (default)", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Updated content" }),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdateDraft).toHaveBeenCalledWith("post-1", {
        content: "Updated content",
      });
    });

    it("should return 400 when PATCH update body has invalid platform", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        {
          method: "PATCH",
          body: JSON.stringify({ platform: "tiktok" }),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 500 when markAsPosted fails", async () => {
      mockMarkAsPosted.mockResolvedValueOnce({
        success: false,
        error: "Post not found",
      });

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1&action=mark-posted",
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Post not found");
    });

    it("should return 500 when updateDraft fails", async () => {
      mockUpdateDraft.mockResolvedValueOnce({
        success: false,
        error: "Update failed",
      });

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Updated" }),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Update failed");
    });

    it("should return 500 when mark-posted throws", async () => {
      mockMarkAsPosted.mockRejectedValueOnce(new Error("Network error"));

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1&action=mark-posted",
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should return 500 when updateDraft throws", async () => {
      mockUpdateDraft.mockRejectedValueOnce(new Error("DB error"));

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Updated" }),
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle mark-posted with invalid JSON body gracefully", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1&action=mark-posted",
        {
          method: "PATCH",
          body: "not valid json",
        }
      );
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // .catch(() => ({})) provides empty object, so platformPostId and postUrl are undefined
      expect(mockMarkAsPosted).toHaveBeenCalledWith({
        postId: "post-1",
        platformPostId: undefined,
        postUrl: undefined,
      });
    });
  });

  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when post ID is missing", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/posts", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Post ID required");
    });

    it("should delete draft successfully", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteDraft).toHaveBeenCalledWith("post-1");
    });

    it("should return 500 when deleteDraft fails", async () => {
      mockDeleteDraft.mockResolvedValueOnce({
        success: false,
        error: "Delete failed",
      });

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Delete failed");
    });

    it("should return 500 when deleteDraft throws", async () => {
      mockDeleteDraft.mockRejectedValueOnce(new Error("DB connection lost"));

      const request = new NextRequest(
        "http://localhost/api/admin/marketing/posts?id=post-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
