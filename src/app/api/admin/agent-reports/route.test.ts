import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { Stats } from "fs";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

// Create the stat mock using vi.hoisted so it's available during vi.mock factory
const { mockStat } = vi.hoisted(() => ({
  mockStat: vi.fn(),
}));

// Mock fs - the route uses `import { promises as fs } from "fs"`
vi.mock("node:fs/promises", () => ({
  stat: mockStat,
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...actual.promises,
        stat: mockStat,
      },
    },
    promises: {
      ...actual.promises,
      stat: mockStat,
    },
  };
});

import { GET } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

const mockValidateAdminAuth = vi.mocked(validateAdminAuth);

describe("Agent Reports API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: files don't exist
    mockStat.mockRejectedValue(new Error("ENOENT"));
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

    it("should return lastRuns with ISO dates when report files exist", async () => {
      mockValidateAdminAuth.mockResolvedValue({
        valid: true,
        userId: "admin-123",
      });

      const mockMtime = new Date("2026-03-01T10:00:00.000Z");
      mockStat.mockImplementation(async (filePath: string) => {
        const pathStr = String(filePath);
        if (pathStr.includes("coverage-report.md") || pathStr.includes("security-report.md")) {
          return { mtime: mockMtime } as Stats;
        }
        throw new Error("ENOENT");
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.lastRuns.coverage_agent_enabled).toBe("2026-03-01T10:00:00.000Z");
      expect(json.lastRuns.security_agent_enabled).toBe("2026-03-01T10:00:00.000Z");
      // Other files should not be in the response
      expect(json.lastRuns.qa_agent_enabled).toBeUndefined();
    });
  });
});
