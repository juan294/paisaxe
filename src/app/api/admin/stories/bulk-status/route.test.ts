import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "./route";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger,
}));

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

// Mock supabase
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";

const mockValidateAdminAuth = validateAdminAuth as ReturnType<typeof vi.fn>;
const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>;

describe("PUT /api/admin/stories/bulk-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAdminAuth.mockResolvedValue({ valid: true });
  });

  it("should return 401 if not authenticated", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["1"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("should return 400 if storyIds is not an array", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: "not-array", status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Story IDs array is required");
  });

  it("should return 400 if storyIds is empty", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: [], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid status", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["1", "2"], status: "invalid" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid status");
  });

  it("should successfully update stories to approved", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "1" }, { id: "2" }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["1", "2"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.updatedIds).toEqual(["1", "2"]);
    expect(data.data.status).toBe("approved");

    expect(mockUpdate).toHaveBeenCalledWith({ curation_status: "approved" });
    expect(mockIn).toHaveBeenCalledWith("id", ["1", "2"]);
  });

  it("should successfully update stories to needs_curation", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "3" }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["3"], status: "needs_curation" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.status).toBe("needs_curation");
  });

  it("should handle null data response gracefully", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["1"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.updatedIds).toEqual([]);
    expect(data.data.status).toBe("approved");
  });

  it("should return 500 on unexpected error (catch block)", async () => {
    // Make request.json() throw to trigger the outer catch block
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: "not valid json",
    });
    vi.spyOn(request, "json").mockRejectedValue(new Error("Unexpected parse error"));

    const response = await PUT(request);
    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORIES_BULK_STATUS_UNHANDLED_ERROR]", {
      error: expect.any(Error),
    });
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("should return 500 on database error", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["1"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORIES_BULK_STATUS_UPDATE_FAILED]", {
      story_ids_count: 1,
      status: "approved",
      error: { message: "Database error" },
    });
  });
});
