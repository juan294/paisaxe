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
    vi.mocked(validateAdminAuth).mockResolvedValue({
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
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

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

  it("should return 400 if enabled is not a boolean (invalid type)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({ enabled: "yes" }),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("enabled must be a boolean");
  });

  it("should return 400 if neither enabled nor config is provided", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/contextual_prompts", {
      method: "PUT",
      body: JSON.stringify({}),
    });

    const response = await PUT(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Must provide enabled (boolean) or config (object)");
  });

  it("should disable a flag when enabled is false", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

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
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

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
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
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

  describe("config updates", () => {
    const mockVisitorVoiceRow = {
      id: "flag-voice",
      flag_key: "visitor_voice_agent",
      enabled: true,
      label: "Visitor Voice Agent",
      description: "Enable voice for whitelisted visitors",
      config: { whitelisted_emails: ["test@example.com"], agent_id: "agent-123" },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-15T00:00:00Z",
    };

    const mockVoiceParams = { params: Promise.resolve({ key: "visitor_voice_agent" }) };

    it("should update config only when enabled is not provided", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({ data: mockVisitorVoiceRow, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const newConfig = { whitelisted_emails: ["new@example.com"], agent_id: "new-agent" };
      const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/visitor_voice_agent", {
        method: "PUT",
        body: JSON.stringify({ config: newConfig }),
      });

      const response = await PUT(request, mockVoiceParams);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ config: newConfig });
    });

    it("should update both enabled and config when both are provided", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const updatedRow = { ...mockVisitorVoiceRow, enabled: false };
      const mockSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const newConfig = { whitelisted_emails: ["both@example.com"], agent_id: "both-agent" };
      const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/visitor_voice_agent", {
        method: "PUT",
        body: JSON.stringify({ enabled: false, config: newConfig }),
      });

      const response = await PUT(request, mockVoiceParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.enabled).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith({ enabled: false, config: newConfig });
    });

    it("should return 400 if config is not an object", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/visitor_voice_agent", {
        method: "PUT",
        body: JSON.stringify({ config: "invalid" }),
      });

      const response = await PUT(request, mockVoiceParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("config must be an object");
    });

  });
});
