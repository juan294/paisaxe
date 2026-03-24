import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock supabase ───────────────────────────────────────────────────

// Individual Supabase query mocks are inlined per test for clarity

const mockFrom = vi.fn();

vi.mock("./supabase", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

// ─── Mock credentials ────────────────────────────────────────────────

const { mockGetDecryptedCredentials, mockValidateContent, mockCreatePlatformClient } = vi.hoisted(() => {
  return {
    mockGetDecryptedCredentials: vi.fn(),
    mockValidateContent: vi.fn(),
    mockCreatePlatformClient: vi.fn(() => ({ post: vi.fn() })),
  };
});

vi.mock("./credentials", () => ({
  getDecryptedCredentials: mockGetDecryptedCredentials,
}));

vi.mock("./platforms", () => ({
  validateContent: mockValidateContent,
  createPlatformClient: mockCreatePlatformClient,
}));

import {
  createDraft,
  getDrafts,
  markAsPosted,
  deleteDraft,
  updateDraft,
} from "./posting-service";

// Sample row returned by Supabase
const samplePostRow = {
  id: "post-1",
  account_id: "acc-1",
  platform: "x",
  content: "Hello Asturias!",
  media_urls: [],
  hashtags: ["#Asturias"],
  link_url: null,
  scheduled_for: null,
  posted_at: null,
  status: "draft",
  platform_post_id: null,
  post_url: null,
  error_message: null,
  engagement: {},
  story_id: null,
  content_theme: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("posting-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  // ─── createDraft ─────────────────────────────────────────────────

  describe("createDraft", () => {
    it("should create a draft post successfully", async () => {
      mockValidateContent.mockReturnValue({ valid: true, errors: [] });

      mockFrom.mockImplementation((table: string) => {
        if (table === "marketing_accounts") {
          return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "acc-1" }, error: null }) }) }) }) };
        }
        if (table === "marketing_posts") {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: samplePostRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await createDraft({
        platform: "x",
        content: "Hello Asturias!",
        hashtags: ["#Asturias"],
      });

      expect(result.success).toBe(true);
      expect(result.post).toBeDefined();
      expect(result.post!.id).toBe("post-1");
      expect(result.post!.platform).toBe("x");
      expect(result.post!.content).toBe("Hello Asturias!");
    });

    it("should return validation errors when content is invalid", async () => {
      mockValidateContent.mockReturnValue({
        valid: false,
        errors: ["Content exceeds 280 characters (350)"],
      });

      const result = await createDraft({
        platform: "x",
        content: "A".repeat(350),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Content validation failed");
      expect(result.validationErrors).toContain("Content exceeds 280 characters (350)");
    });

    it("should return error when no active account found", async () => {
      mockValidateContent.mockReturnValue({ valid: true, errors: [] });

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "Not found" } }),
            }),
          }),
        }),
      });

      const result = await createDraft({
        platform: "x",
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No active x account found");
    });

    it("should return error when database insert fails", async () => {
      mockValidateContent.mockReturnValue({ valid: true, errors: [] });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Account lookup
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { id: "acc-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        // Insert
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "DB error" } }),
            }),
          }),
        };
      });

      const result = await createDraft({
        platform: "x",
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to save draft to database");
    });

    it("should set status to scheduled when scheduledFor is provided", async () => {
      mockValidateContent.mockReturnValue({ valid: true, errors: [] });

      const scheduledRow = {
        ...samplePostRow,
        status: "scheduled",
        scheduled_for: "2026-02-10T12:00:00Z",
      };

      let insertPayload: Record<string, unknown> = {};
      mockFrom.mockImplementation((table: string) => {
        if (table === "marketing_accounts") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { id: "acc-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: (data: Record<string, unknown>) => {
            insertPayload = data;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: scheduledRow, error: null }),
              }),
            };
          },
        };
      });

      const result = await createDraft({
        platform: "x",
        content: "Hello",
        scheduledFor: "2026-02-10T12:00:00Z",
      });

      expect(result.success).toBe(true);
      expect(insertPayload.status).toBe("scheduled");
      expect(insertPayload.scheduled_for).toBe("2026-02-10T12:00:00Z");
    });
  });

  // ─── getDrafts ───────────────────────────────────────────────────

  describe("getDrafts", () => {
    it("should fetch drafts successfully", async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => Promise.resolve({ data: [samplePostRow], error: null }));

      mockFrom.mockReturnValue(chain);

      const result = await getDrafts();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("post-1");
      expect(result[0].platform).toBe("x");
    });

    it("should filter by platform when provided", async () => {
      // The chain must be thenable so `await query` works after .eq("platform", ...)
      const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      // Make the chain thenable (await-able)
      chain.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve);

      mockFrom.mockReturnValue(chain);

      await getDrafts("instagram");

      // First eq call is for status, second for platform
      expect(chain.eq).toHaveBeenCalledTimes(2);
      expect(chain.eq).toHaveBeenCalledWith("platform", "instagram");
    });

    it("should use fallback defaults when row fields are null", async () => {
      const rowWithNulls = {
        ...samplePostRow,
        media_urls: null,
        hashtags: null,
        engagement: null,
      };

      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => Promise.resolve({ data: [rowWithNulls], error: null }));

      mockFrom.mockReturnValue(chain);

      const result = await getDrafts();

      expect(result).toHaveLength(1);
      expect(result[0].mediaUrls).toEqual([]);
      expect(result[0].hashtags).toEqual([]);
      expect(result[0].engagement).toEqual({});
    });

    it("should return empty array on database error", async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => Promise.resolve({ data: null, error: { message: "DB error" } }));

      mockFrom.mockReturnValue(chain);

      const result = await getDrafts();
      expect(result).toEqual([]);
    });
  });

  // ─── markAsPosted ────────────────────────────────────────────────

  describe("markAsPosted", () => {
    it("should mark a post as posted successfully", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      });

      const result = await markAsPosted({
        postId: "post-1",
        platformPostId: "ext-123",
        postUrl: "https://x.com/post/123",
      });

      expect(result.success).toBe(true);
    });

    it("should handle optional fields", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      });

      const result = await markAsPosted({ postId: "post-1" });

      expect(result.success).toBe(true);
    });

    it("should return error on database failure", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: { message: "DB error" } }),
        }),
      });

      const result = await markAsPosted({ postId: "post-1" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update post status");
    });
  });

  // ─── deleteDraft ─────────────────────────────────────────────────

  describe("deleteDraft", () => {
    it("should delete a draft successfully", async () => {
      mockFrom.mockReturnValue({
        delete: () => ({
          eq: () => ({
            in: () => Promise.resolve({ error: null }),
          }),
        }),
      });

      const result = await deleteDraft("post-1");

      expect(result.success).toBe(true);
    });

    it("should return error on database failure", async () => {
      mockFrom.mockReturnValue({
        delete: () => ({
          eq: () => ({
            in: () => Promise.resolve({ error: { message: "DB error" } }),
          }),
        }),
      });

      const result = await deleteDraft("post-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete draft");
    });
  });

  // ─── updateDraft ─────────────────────────────────────────────────

  describe("updateDraft", () => {
    it("should update draft content successfully", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => ({
            in: () => Promise.resolve({ error: null }),
          }),
        }),
      });

      const result = await updateDraft("post-1", { content: "Updated content" });

      expect(result.success).toBe(true);
    });

    it("should update multiple fields", async () => {
      let capturedUpdate: Record<string, unknown> = {};
      mockFrom.mockReturnValue({
        update: (data: Record<string, unknown>) => {
          capturedUpdate = data;
          return {
            eq: () => ({
              in: () => Promise.resolve({ error: null }),
            }),
          };
        },
      });

      await updateDraft("post-1", {
        content: "New content",
        hashtags: ["#NewTag"],
        linkUrl: "https://example.com",
        mediaUrls: ["https://example.com/img.jpg"],
      });

      expect(capturedUpdate.content).toBe("New content");
      expect(capturedUpdate.hashtags).toEqual(["#NewTag"]);
      expect(capturedUpdate.link_url).toBe("https://example.com");
      expect(capturedUpdate.media_urls).toEqual(["https://example.com/img.jpg"]);
    });

    it("should set status to scheduled when scheduledFor is provided", async () => {
      let capturedUpdate: Record<string, unknown> = {};
      mockFrom.mockReturnValue({
        update: (data: Record<string, unknown>) => {
          capturedUpdate = data;
          return {
            eq: () => ({
              in: () => Promise.resolve({ error: null }),
            }),
          };
        },
      });

      await updateDraft("post-1", { scheduledFor: "2026-03-01T10:00:00Z" });

      expect(capturedUpdate.scheduled_for).toBe("2026-03-01T10:00:00Z");
      expect(capturedUpdate.status).toBe("scheduled");
    });

    it("should set status back to draft when scheduledFor is cleared", async () => {
      let capturedUpdate: Record<string, unknown> = {};
      mockFrom.mockReturnValue({
        update: (data: Record<string, unknown>) => {
          capturedUpdate = data;
          return {
            eq: () => ({
              in: () => Promise.resolve({ error: null }),
            }),
          };
        },
      });

      await updateDraft("post-1", { scheduledFor: "" });

      expect(capturedUpdate.scheduled_for).toBe("");
      expect(capturedUpdate.status).toBe("draft");
    });

    it("should return error on database failure", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => ({
            in: () => Promise.resolve({ error: { message: "DB error" } }),
          }),
        }),
      });

      const result = await updateDraft("post-1", { content: "Fail" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update draft");
    });
  });
});
