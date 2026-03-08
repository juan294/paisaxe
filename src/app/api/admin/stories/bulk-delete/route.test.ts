import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "./route";
import { NextRequest } from "next/server";

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

describe("DELETE /api/admin/stories/bulk-delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAdminAuth.mockResolvedValue({ valid: true });
  });

  it("should return 401 if not authenticated", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ storyIds: ["1"] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it("should return 400 if storyIds is not an array", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ storyIds: "not-array" }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Story IDs array is required");
  });

  it("should return 400 if storyIds is empty", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ storyIds: [] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("should successfully delete stories", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "1" }, { id: "2" }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ storyIds: ["1", "2"] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.deletedIds).toEqual(["1", "2"]);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockIn).toHaveBeenCalledWith("id", ["1", "2"]);
  });

  it("should handle null data response gracefully", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ storyIds: ["1", "2"] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.deletedIds).toEqual([]);
  });

  it("should return 500 on unexpected error (catch block)", async () => {
    // Make request.json() throw to trigger the outer catch block
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: "not valid json",
    });
    vi.spyOn(request, "json").mockRejectedValue(new Error("Unexpected parse error"));

    const response = await DELETE(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("should return 500 on database error", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ storyIds: ["1"] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(500);
  });
});
