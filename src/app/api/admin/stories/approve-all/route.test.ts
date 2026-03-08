import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
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

describe("POST /api/admin/stories/approve-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAdminAuth.mockResolvedValue({ valid: true });
  });

  it("should return 401 if not authenticated", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const request = new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should approve all pending stories", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "1" }, { id: "2" }, { id: "3" }],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.approvedCount).toBe(3);
    expect(data.data.approvedIds).toEqual(["1", "2", "3"]);

    expect(mockUpdate).toHaveBeenCalledWith({ curation_status: "approved" });
    expect(mockEq).toHaveBeenCalledWith("curation_status", "needs_curation");
  });

  it("should handle null data response gracefully", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.approvedCount).toBe(0);
    expect(data.data.approvedIds).toEqual([]);
  });

  it("should return success with 0 count when no pending stories", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.approvedCount).toBe(0);
    expect(data.data.approvedIds).toEqual([]);
  });

  it("should return 500 on unexpected error (catch block)", async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const request = new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("should return 500 on database error", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to approve stories");
  });
});
