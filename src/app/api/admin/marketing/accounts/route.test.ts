import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("Marketing Accounts API", () => {
  const mockAccount = {
    id: "acc-1",
    platform: "x",
    account_name: "Paisaxe",
    account_handle: "@paisaxe",
    credentials: { accessToken: "secret" },
    platform_user_id: "12345",
    is_active: true,
    last_sync_at: "2025-01-15T10:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-10T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/marketing/accounts", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const response = await GET();
      expect(response.status).toBe(401);
    });

    it("should return accounts without credentials", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [mockAccount], error: null }),
        }),
      });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].platform).toBe("x");
      // Should NOT include credentials in response
      expect(data.data[0]).not.toHaveProperty("credentials");
    });
  });

  describe("POST /api/admin/marketing/accounts", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          accountName: "Test",
          credentials: { accessToken: "token" },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when required fields are missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({ platform: "x" }), // Missing accountName and credentials
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 for invalid platform", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "invalid",
          accountName: "Test",
          credentials: { accessToken: "token" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid platform");
    });

    it("should return 400 when accessToken is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          accountName: "Test",
          credentials: { refreshToken: "token" }, // Missing accessToken
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("accessToken");
    });

    it("should create account successfully", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
        }),
      });
      const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          accountName: "Paisaxe",
          accountHandle: "@paisaxe",
          credentials: { accessToken: "token" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.platform).toBe("x");
      // Should NOT include credentials in response
      expect(data.data).not.toHaveProperty("credentials");
    });
  });

  describe("DELETE /api/admin/marketing/accounts", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x",
        { method: "DELETE" }
      );

      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when platform is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts",
        { method: "DELETE" }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("platform");
    });

    it("should deactivate account successfully", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x",
        { method: "DELETE" }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        is_active: false,
        credentials: null,
      });
    });
  });
});
