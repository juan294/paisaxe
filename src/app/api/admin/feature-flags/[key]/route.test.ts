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

describe("PUT /api/admin/feature-flags/[key]", () => {
  const mockParams = { params: Promise.resolve({ key: "contextual_prompts" }) };

  const mockUpdatedRow = {
    id: "flag-1",
    flag_key: "contextual_prompts",
    enabled: true,
    label: "Contextual Prompts",
    description: "Enable contextual prompts",
    config: {},
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });

    const response = await PUT(request, mockParams);
    expect(response.status).toBe(401);
  });

  it("should update flag and return updated flag on success", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const mockSingle = vi.fn().mockResolvedValue({ data: mockUpdatedRow, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.flagKey).toBe("contextual_prompts");
    expect(data.data.enabled).toBe(true);
    expect(data.data.label).toBe("Contextual Prompts");
    expect(mockFrom).toHaveBeenCalledWith("feature_flags");
    expect(mockUpdate).toHaveBeenCalledWith({ enabled: true });
    expect(mockEq).toHaveBeenCalledWith("flag_key", "contextual_prompts");
  });

  it("should return 400 if enabled is not a boolean", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: "yes" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("enabled must be a boolean");
  });

  it("should return 400 if enabled is missing", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({}),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("enabled must be a boolean");
  });

  it("should disable a flag when enabled is false", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const disabledRow = { ...mockUpdatedRow, enabled: false };
    const mockSingle = vi.fn().mockResolvedValue({ data: disabledRow, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.enabled).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith({ enabled: false });
  });

  it("should return 404 when flag is not found", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/nonexistent_flag", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });

    const response = await PUT(request, { params: Promise.resolve({ key: "nonexistent_flag" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Feature flag not found");
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

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update feature flag");
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
