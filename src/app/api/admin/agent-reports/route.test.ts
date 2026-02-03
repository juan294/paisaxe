import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

// Mock fs - the stat function reads actual files, which is fine for testing
// We just need to ensure auth is checked and the response format is correct
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: actual,
    promises: {
      ...actual.promises,
      // Always reject to simulate files not existing
      stat: vi.fn().mockRejectedValue(new Error("ENOENT")),
    },
  };
});

import { GET } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

const mockValidateAdminAuth = vi.mocked(validateAdminAuth);

describe("Agent Reports API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/agent-reports", () => {
    it("should return 401 when not authenticated as admin", async () => {
      mockValidateAdminAuth.mockResolvedValue({
        valid: false,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      });

      const response = await GET();

      expect(response.status).toBe(401);
    });

    it("should return lastRuns object when authenticated", async () => {
      mockValidateAdminAuth.mockResolvedValue({
        valid: true,
        userId: "admin-123",
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.lastRuns).toBeDefined();
      expect(typeof json.lastRuns).toBe("object");
    });

    it("should return empty lastRuns when no report files exist", async () => {
      mockValidateAdminAuth.mockResolvedValue({
        valid: true,
        userId: "admin-123",
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      // All files mock-rejected with ENOENT, so lastRuns should be empty
      expect(json.lastRuns).toEqual({});
    });
  });
});
