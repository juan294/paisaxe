import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock dependencies
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("PUT /api/admin/stories/[id]/image-source", () => {
  const mockParams = { params: Promise.resolve({ id: "story-123" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        body: JSON.stringify({ imageSource: "Test Source" }),
      });

      const response = await PUT(request, mockParams);
      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("should return 400 when story ID is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories//image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: "Test Source" }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Story ID is required");
    });

    it("should return 400 when imageSource is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("imageSource is required and must be a string");
    });

    it("should return 400 when imageSource is not a string", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: 123 }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("imageSource is required and must be a string");
    });
  });

  describe("successful update", () => {
    it("should update image source successfully", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_source: "Turismo Asturias" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: "Turismo Asturias" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe("story-123");
      expect(data.data.imageSource).toBe("Turismo Asturias");
      expect(mockUpdate).toHaveBeenCalledWith({ image_source: "Turismo Asturias" });
      expect(mockEq).toHaveBeenCalledWith("id", "story-123");
    });

    it("should allow empty string as imageSource", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_source: "" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: "" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.imageSource).toBe("");
    });
  });

  describe("database errors", () => {
    it("should return 404 when story not found", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/nonexistent/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: "Test Source" }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "nonexistent" }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Story not found");
    });

    it("should return 500 when database update fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: "Test Source" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update image source");
    });

    it("should return 500 on unexpected error", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("Unexpected");
      });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageSource: "Test Source" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  it("should use logger.error (not console.error) on unhandled PUT error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected DB failure");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageSource: "Test Source" }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "story-123" }) });
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
