import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("PUT /api/admin/stories/[id]/status", () => {
  const mockParams = { params: Promise.resolve({ id: "story-123" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({
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

  it("should update status to approved", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

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
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

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
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

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
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

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
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

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
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });
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
});
