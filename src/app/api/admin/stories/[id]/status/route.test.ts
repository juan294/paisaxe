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

describe("PUT /api/admin/stories/[id]/status", () => {
  const mockParams = { params: Promise.resolve({ id: "story-123" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PUT(request, mockParams);
    expect(response.status).toBe(401);
  });

  it("should return 400 when story ID is empty", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories//status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Story ID is required");
  });

  it("should update status to approved", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "story-123", curation_status: "approved" },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.curationStatus).toBe("approved");
    expect(mockUpdate).toHaveBeenCalledWith({ curation_status: "approved" });
  });

  it("should update status to needs_curation", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "story-123", curation_status: "needs_curation" },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "needs_curation" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.curationStatus).toBe("needs_curation");
  });

  it("should return 400 for invalid status value", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "invalid_status" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid status. Must be 'needs_curation' or 'approved'");
  });

  it("should return 404 when story not found", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/nonexistent/status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
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

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update story status");
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should use logger.error (not console.error) on unhandled PUT error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected DB failure");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });
    const response = await PUT(request, mockParams);
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
