import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, PATCH, DELETE } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

// AR-M3 (#626): route now uses the withAdmin wrapper. Provide a faithful mock
// that calls the mocked validateAdminAuth and, on success, invokes the handler
// with the mocked admin client — preserving the existing test contract.
vi.mock("@/lib/admin-auth", async () => {
  const { createAdminClient } = await import("@/lib/supabase");
  const validateAdminAuth = vi.fn();
  return {
    validateAdminAuth,
    withAdmin: async (
      handler: (supabase: unknown) => Promise<unknown>,
      _request?: unknown
    ) => {
      const auth = await (validateAdminAuth as () => Promise<{ valid: boolean; error?: unknown }>)();
      if (!auth.valid) {
        return auth.error;
      }
      return handler((createAdminClient as () => unknown)());
    },
  };
});

vi.mock("@/lib/encryption", () => ({
  encryptJson: vi.fn((data) => `encrypted:${JSON.stringify(data)}`),
  isEncryptionConfigured: vi.fn(() => true),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("Marketing Accounts API", () => {
  const mockAccount = {
    id: "acc-1",
    platform: "x",
    account_name: "Paisaxe",
    account_handle: "@paisaxe",
    // Use encrypted format (actual encryption is mocked)
    credentials: { encrypted: "encrypted-credentials" },
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

      const response = await GET(
        new NextRequest("http://localhost:3000/api/admin/marketing/accounts")
      );
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

      const response = await GET(
        new NextRequest("http://localhost:3000/api/admin/marketing/accounts")
      );
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

    it("should return 500 when database update fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockEq = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x",
        { method: "DELETE" }
      );

      const response = await DELETE(request);
      expect(response.status).toBe(500);
    });
  });

  describe("PATCH /api/admin/marketing/accounts", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x&action=pause",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when platform is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?action=pause",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("platform");
    });

    it("should return 400 when action is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("action");
    });

    it("should return 400 for invalid action value", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x&action=invalid",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("action");
    });

    it("should pause account successfully", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...mockAccount, is_active: false },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x&action=pause",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.isActive).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it("should resume account successfully", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...mockAccount, is_active: true },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x&action=resume",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.isActive).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: true });
    });

    it("should return 500 when database update fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x&action=pause",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(500);
    });
  });

  describe("error paths", () => {
    it("GET should return 500 when database fetch fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
        }),
      });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/admin/marketing/accounts")
      );
      expect(response.status).toBe(500);
    });

    it("GET should return 500 on unexpected exception", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      // #626: createAdminClient is now invoked by withAdmin (outside the
      // handler try). To exercise the handler's 500 catch, return a client that
      // throws when its query methods are used inside the handler.
      vi.mocked(createAdminClient).mockReturnValue({
        from: () => {
          throw new Error("Connection failed");
        },
        rpc: () => {
          throw new Error("Connection failed");
        },
      } as never);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/admin/marketing/accounts")
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("POST should return 500 when database upsert fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Upsert failed" } }),
        }),
      });
      const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          accountName: "Test",
          credentials: { accessToken: "token" },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it("POST should return 500 on unexpected exception", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      // #626: createAdminClient is now invoked by withAdmin (outside the
      // handler try). To exercise the handler's 500 catch, return a client that
      // throws when its query methods are used inside the handler.
      vi.mocked(createAdminClient).mockReturnValue({
        from: () => {
          throw new Error("Connection failed");
        },
        rpc: () => {
          throw new Error("Connection failed");
        },
      } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          accountName: "Test",
          credentials: { accessToken: "token" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("POST should return 500 when encryption is not configured", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const { isEncryptionConfigured } = await import("@/lib/encryption");
      vi.mocked(isEncryptionConfigured).mockReturnValue(false);

      const request = new NextRequest("http://localhost:3000/api/admin/marketing/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "x",
          accountName: "Test",
          credentials: { accessToken: "token" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("encryption");

      // Restore mock
      vi.mocked(isEncryptionConfigured).mockReturnValue(true);
    });

    it("PATCH should return 500 on unexpected exception", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      // #626: createAdminClient is now invoked by withAdmin (outside the
      // handler try). To exercise the handler's 500 catch, return a client that
      // throws when its query methods are used inside the handler.
      vi.mocked(createAdminClient).mockReturnValue({
        from: () => {
          throw new Error("Connection failed");
        },
        rpc: () => {
          throw new Error("Connection failed");
        },
      } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x&action=pause",
        { method: "PATCH" }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DELETE should return 500 on unexpected exception", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      // #626: createAdminClient is now invoked by withAdmin (outside the
      // handler try). To exercise the handler's 500 catch, return a client that
      // throws when its query methods are used inside the handler.
      vi.mocked(createAdminClient).mockReturnValue({
        from: () => {
          throw new Error("Connection failed");
        },
        rpc: () => {
          throw new Error("Connection failed");
        },
      } as never);

      const request = new NextRequest(
        "http://localhost:3000/api/admin/marketing/accounts?platform=x",
        { method: "DELETE" }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
