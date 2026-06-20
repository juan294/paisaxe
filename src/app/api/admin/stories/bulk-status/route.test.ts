import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "./route";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
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
      data: [{ id: "550e8400-e29b-41d4-a716-446655440001" }, { id: "550e8400-e29b-41d4-a716-446655440002" }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({
        storyIds: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
        status: "approved",
      }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.updatedIds).toEqual([
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ]);
    expect(data.data.status).toBe("approved");

    expect(mockUpdate).toHaveBeenCalledWith({ curation_status: "approved" });
    expect(mockIn).toHaveBeenCalledWith("id", [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ]);
  });

  it("should successfully update stories to needs_curation", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "550e8400-e29b-41d4-a716-446655440003" }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["550e8400-e29b-41d4-a716-446655440003"], status: "needs_curation" }),
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
      body: JSON.stringify({ storyIds: ["550e8400-e29b-41d4-a716-446655440000"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.updatedIds).toEqual([]);
    expect(data.data.status).toBe("approved");
  });

  it("should return 500 on unexpected error (catch block)", async () => {
    // After BE-M2 (#570) a malformed body is a 400, so trigger the outer catch
    // via an unexpected error deeper in the handler (Supabase client throws).
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("Unexpected client error");
    });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({
        storyIds: ["11111111-1111-4111-8111-111111111111"],
        status: "approved",
      }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORIES_BULK_STATUS_UNHANDLED_ERROR]", {
      error: expect.any(Error),
    });
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("returns 400 when the body is malformed JSON (BE-M2 #570)", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: "not valid json",
    });
    vi.spyOn(request, "json").mockRejectedValue(new Error("Unexpected parse error"));

    const response = await PUT(request);
    expect(response.status).toBe(400);
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
      body: JSON.stringify({ storyIds: ["550e8400-e29b-41d4-a716-446655440000"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORIES_BULK_STATUS_UPDATE_FAILED]", {
      story_ids_count: 1,
      status: "approved",
      error: { message: "Database error" },
    });
  });

  // -----------------------------------------------------------------------
  // Zod validation tests (BE-M1 / issue #407)
  // -----------------------------------------------------------------------

  it("should return 400 with Zod errors when storyIds contains non-UUID values", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["not-a-uuid"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it("should return 400 when storyIds field is missing entirely", async () => {
    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    // Missing storyIds falls through to the backward-compatible error message
    expect(data.error ?? data.errors).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // SE-M4 audit log tests (issue #415)
  // -----------------------------------------------------------------------

  it("should emit audit log entry on successful bulk status change", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "550e8400-e29b-41d4-a716-446655440000" }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    mockValidateAdminAuth.mockResolvedValue({ valid: true, userId: "admin-user-id" });

    const request = new NextRequest("http://localhost/api/admin/stories/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ storyIds: ["550e8400-e29b-41d4-a716-446655440000"], status: "approved" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("[ADMIN_AUDIT]"),
      expect.anything()
    );
    expect(logger.info).toHaveBeenCalledWith("[ADMIN_AUDIT]", {
      event: "bulk_status_change",
      actor: "admin-user-id",
      story_ids_count: 1,
      status: "approved",
    });
  });
});
