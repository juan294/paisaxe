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
    expect(data.data.agents).toHaveLength(8);
    expect(data.data.agents[0].health).toBe("green");
    expect(data.data.agents[0].lastRun).toBe(mockDate.toISOString());
    expect(data.data.agents[0].healthSummary).toContain("All systems operational");
    expect(data.data.recentActivity).toHaveLength(8);
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
    expect(data.data.agents).toHaveLength(8);
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

  it("should infer green health for coverage reports without explicit health status", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        return [
          "# Test Coverage Report",
          "",
          "> Last updated: 2026-02-06",
          "",
          "## Summary",
          "",
          "- **Total tests:** 2754 passed, 1 skipped",
          "- **TypeScript:** No errors",
          "- **Statement coverage:** 66.91%",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    expect(coverageAgent.health).toBe("green");
  });

  it("should infer green health for documentation reports without explicit health status", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("documentation-report.md")) {
        return [
          "# Documentation Freshness Report",
          "> Auto-generated on 2026-02-06",
          "",
          "## Changes Made This Run",
          "",
          "### Features Documentation",
          "Added MCP tools documentation.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const docAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "documentation_agent_enabled"
    );
    expect(docAgent.health).toBe("green");
  });

  it("should detect yellow health for coverage reports with failures", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        return [
          "# Test Coverage Report",
          "",
          "## Summary",
          "",
          "- **Total tests:** 2750 passed, 4 failures",
          "- **TypeScript:** 3 errors",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    expect(coverageAgent.health).toBe("yellow");
  });

  it("should resolve short agent names in shared context entries", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) {
        return [
          "<!-- ENTRY:START agent=coverage_agent timestamp=2026-02-06T16:00:00Z -->",
          "Test coverage at 67%.",
          "<!-- ENTRY:END -->",
          "",
          "<!-- ENTRY:START agent=localization_agent timestamp=2026-02-06T15:00:00Z -->",
          "100% translation coverage.",
          "<!-- ENTRY:END -->",
        ].join("\n");
      }
      throw new Error("ENOENT");
    });

    const response = await GET();
    const data = await response.json();

    expect(data.data.sharedContext).toHaveLength(2);
    expect(data.data.sharedContext[0].agentName).toBe("Coverage");
    expect(data.data.sharedContext[1].agentName).toBe("Localization");
  });

  it("should include subscription optimizer in agents list", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const response = await GET();
    const data = await response.json();

    const optimizer = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "subscription_optimizer_enabled"
    );
    expect(optimizer).toBeDefined();
    expect(optimizer.name).toBe("Subscription Optimizer");
    expect(optimizer.schedule).toBe("Weekly Sunday 4:00 AM");
    expect(optimizer.reportFile).toBe("docs/agents/subscription-optimizer-report.md");
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
