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

  it("should parse optimizer report summary correctly", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-09T10:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("subscription-optimizer-report.md")) {
        return [
          "# Subscription Optimizer Report",
          "> Week of 2026-02-09",
          "> Total monthly spend: **$59.41**",
          "",
          "## Executive Summary",
          "Analyzed 11 services totaling $59.41/mo. 4 services flagged for review, 7 healthy.",
          "",
          "## Recommendations",
          "",
          "### [review] Anthropic Claude — REVIEW",
          "- **Plan**: Personal ($10.00/mo)",
          "- **Assessment**: 4 of 6 plan features are unused.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const optimizer = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "subscription_optimizer_enabled"
    );
    expect(optimizer.health).toBe("green");
    expect(optimizer.healthSummary).not.toBe("No summary available.");
    expect(optimizer.healthSummary).toContain("Analyzed 11 services");
  });

  it("should return 'unknown' health for short/empty reports without indicators", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        // Very short content, no heading, no health status — should be "unknown"
        return "Pending...";
      }
      return "## Health Status: GREEN\n\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    expect(coverageAgent.health).toBe("unknown");
  });

  it("should return 'No summary available.' when no summary patterns match", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        // Content that has a heading (so parseHealth returns green) but no
        // Executive Summary, no Summary, and no paragraph after ## heading
        return "# Report\n\n" + "x".repeat(101) + "\n\n| col1 | col2 |\n|---|---|\n| a | b |";
      }
      return "## Health Status: GREEN\n\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    // Health should be green (has heading + enough content)
    expect(coverageAgent.health).toBe("green");
  });

  it("should return 500 when an unexpected error occurs", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    // Make mockStat throw a non-ENOENT error that bypasses the try/catch inside the loop
    // We need to cause an error in the outer try block, not the per-agent try block
    // Override process.cwd to throw
    const originalCwd = process.cwd;
    process.cwd = () => { throw new Error("cwd failed"); };

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to build agents summary");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error building agents summary:",
      expect.any(Error)
    );

    process.cwd = originalCwd;
    consoleSpy.mockRestore();
  });

  it("should parse 'Status: HEALTHY' as green health (Pattern 2)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("cost-analyst-report.md")) {
        return [
          "# Cost Analyst Report",
          "",
          "**Financial health: HEALTHY**",
          "",
          "## Executive Summary",
          "All costs within budget.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const costAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "cost_analyst_agent_enabled"
    );
    expect(costAgent.health).toBe("green");
  });

  it("should parse '**Status:** Complete' as green health (Pattern 3)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("localization-report.md")) {
        return [
          "# Localization Report",
          "",
          "**Status:** Complete",
          "",
          "## Executive Summary",
          "All translations up to date.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const locAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "localization_agent_enabled"
    );
    expect(locAgent.health).toBe("green");
  });

  it("should use fallback heading paragraph for health summary when no standard summary patterns match", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        // No "Executive Summary", no health status line, no "Summary" heading.
        // Has a ## heading followed by a plain paragraph (not a table/code).
        return [
          "# Coverage Report",
          "",
          "## Results",
          "",
          "All 500 tests passed with no regressions detected in the suite.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    expect(coverageAgent.healthSummary).toContain("All 500 tests passed");
  });

  it("should truncate health summary sentences longer than 120 characters", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    const longSentence = "A".repeat(150);

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        return [
          "# Coverage Report",
          "",
          "## Executive Summary",
          "",
          longSentence,
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    // 117 chars + "..." = 120 chars total
    expect(coverageAgent.healthSummary).toHaveLength(120);
    expect(coverageAgent.healthSummary.endsWith("...")).toBe(true);
  });

  it("should compute overall health as yellow when any agent is unknown", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    // Some agents report unknown health (file not found), others green
    mockStat.mockImplementation(async (filePath: string) => {
      if (typeof filePath === "string" && filePath.includes("coverage-report.md")) {
        throw new Error("ENOENT"); // This agent will have "unknown" health
      }
      return { mtime: new Date("2026-02-01T10:00:00Z") };
    });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        throw new Error("ENOENT");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // One agent is unknown, so overall should be yellow
    expect(data.data.overallHealth).toBe("yellow");
  });

  it("should parse health summary from line after health status when no executive summary exists", async () => {
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
          "# Coverage Report",
          "",
          "## Health Status: GREEN",
          "",
          "All 2800 tests passing with comprehensive coverage across modules.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    expect(coverageAgent.healthSummary).toContain("All 2800 tests passing");
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

  it("should skip health summary line after health status when cleaned text is 5 chars or fewer", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockDate = new Date("2026-02-06T16:00:00Z");
    mockStat.mockResolvedValue({ mtime: mockDate });

    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) return "";
      if (filePath.includes("coverage-report.md")) {
        // Health status line followed by a very short line (<=5 chars after cleaning).
        // parseHealthSummary should skip this line and fall through to later patterns.
        return [
          "# Coverage Report",
          "",
          "## Health Status: GREEN",
          "",
          "---",
          "",
          "## Summary",
          "",
          "Detailed coverage results for all modules in the project.",
        ].join("\n");
      }
      return "## Health Status: GREEN\n\n## Executive Summary\nAll good.";
    });

    const response = await GET();
    const data = await response.json();

    const coverageAgent = data.data.agents.find(
      (a: { flagKey: string }) => a.flagKey === "coverage_agent_enabled"
    );
    // Should fall through to the ## Summary pattern instead of using the short "---" line
    expect(coverageAgent.healthSummary).toContain("Detailed coverage results");
  });

  it("should fall back to raw agent flag key when shared context has unknown agent", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) {
        return [
          "<!-- ENTRY:START agent=unknown_agent_flag timestamp=2026-02-06T16:00:00Z -->",
          "Some content from an unknown agent.",
          "<!-- ENTRY:END -->",
        ].join("\n");
      }
      throw new Error("ENOENT");
    });

    const response = await GET();
    const data = await response.json();

    expect(data.data.sharedContext).toHaveLength(1);
    // Should fall back to the raw flag key since it's not in FLAG_TO_NAME
    expect(data.data.sharedContext[0].agentName).toBe("unknown_agent_flag");
    expect(data.data.sharedContext[0].agentFlag).toBe("unknown_agent_flag");
  });

  it("should skip shared context entries with empty content between markers", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes("shared-context.md")) {
        return [
          "<!-- ENTRY:START agent=coverage_agent_enabled timestamp=2026-02-06T16:00:00Z -->",
          "Valid coverage entry with content.",
          "<!-- ENTRY:END -->",
          "",
          "<!-- ENTRY:START agent=security_agent_enabled timestamp=2026-02-06T15:00:00Z -->",
          "<!-- ENTRY:END -->",
          "",
          "<!-- ENTRY:START agent=qa_agent_enabled timestamp=2026-02-06T14:00:00Z -->",
          "   ",
          "<!-- ENTRY:END -->",
        ].join("\n");
      }
      throw new Error("ENOENT");
    });

    const response = await GET();
    const data = await response.json();

    // Only the first entry should be included; the other two have empty content
    expect(data.data.sharedContext).toHaveLength(1);
    expect(data.data.sharedContext[0].agentName).toBe("Coverage");
    expect(data.data.sharedContext[0].content).toBe("Valid coverage entry with content.");
  });
});
