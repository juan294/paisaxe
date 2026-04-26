import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { promises as fs } from "fs";
import path from "path";

// Map agent flag keys to their report files
const AGENT_REPORTS: Record<string, string> = {
  coverage_agent_enabled: "coverage-report.md",
  security_agent_enabled: "security-report.md",
  documentation_agent_enabled: "documentation-report.md",
  performance_agent_enabled: "performance-report.md",
  qa_agent_enabled: "qa-report.md",
  cost_analyst_agent_enabled: "cost-analyst-report.md",
};

export async function GET() {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  // Agent report files are gitignored and local-only (docs/agents/).
  // They don't exist in production builds, so skip filesystem reads there.
  // This also prevents Next.js from tracing docs/** into the function bundle.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ lastRuns: {} });
  }

  const lastRuns: Record<string, string> = {};
  const reportsDir = path.join(process.cwd(), "docs", "agents");

  for (const [flagKey, filename] of Object.entries(AGENT_REPORTS)) {
    try {
      const filePath = path.join(reportsDir, filename);
      const stats = await fs.stat(filePath);
      lastRuns[flagKey] = stats.mtime.toISOString();
    } catch {
      // File doesn't exist or can't be read - skip
    }
  }

  return NextResponse.json({ lastRuns });
}
