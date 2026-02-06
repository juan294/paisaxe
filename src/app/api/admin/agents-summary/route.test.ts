import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

const { mockStat, mockReadFile } = vi.hoisted(() => ({
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const mockedPromises = {
    ...actual.promises,
    stat: mockStat,
    readFile: mockReadFile,
  };
  return {
    ...actual,
    default: { ...actual, promises: mockedPromises },
    promises: mockedPromises,
  };
});

import { validateAdminAuth } from "@/lib/admin-auth";
import { GET } from "./route";

describe("GET /api/admin/agents-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("should return agents summary with report data", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-01T10:00:00Z");

    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) {
        return "";
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll systems operational and healthy.";
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.overallHealth).toBe("green");
    expect(data.data.agents).toHaveLength(7);
    expect(data.data.agents[0].health).toBe("green");
    expect(data.data.agents[0].lastRun).toBe(mockDate.toISOString());
    expect(data.data.agents[0].healthSummary).toContain("All systems operational");
    expect(data.data.recentActivity).toHaveLength(7);
  });

  it("should handle missing report files gracefully", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.agents).toHaveLength(7);
    for (const agent of data.data.agents) {
      expect(agent.health).toBe("unknown");
      expect(agent.lastRun).toBeNull();
      expect(agent.healthSummary).toBe("Report not found.");
    }
    expect(data.data.recentActivity).toHaveLength(0);
    expect(data.data.sharedContext).toEqual([]);
  });

  it("should parse shared context entries", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) {
        return [
          "<!-- ENTRY:START agent=coverage_agent_enabled timestamp=2026-02-01T10:00:00Z -->",
          "Coverage is at 85%.",
          "<!-- ENTRY:END -->",
        ].join("\n");
      }
      throw new Error("ENOENT");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.sharedContext).toHaveLength(1);
    expect(data.data.sharedContext[0].agentName).toBe("Coverage");
    expect(data.data.sharedContext[0].content).toBe("Coverage is at 85%.");
  });

  it("should compute overall health as red when any agent is red", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    let callCount = 0;
    mockStat.mockResolvedValue({ mtime: new Date("2026-02-01T10:00:00Z") });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) {
        return "";
      }
      callCount++;
      if (callCount === 1) {
        return "## Health Status: RED\n\nCritical failure detected.";
      }
      return "## Health Status: GREEN\n\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.overallHealth).toBe("red");
  });

  it("should set Cache-Control header", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=120, stale-while-revalidate=300"
    );
  });
});
