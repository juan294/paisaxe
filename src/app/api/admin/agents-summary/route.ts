import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { promises as fs } from "fs";
import path from "path";
import type {
  AgentHealthStatus,
  AgentStatus,
  SharedContextEntry,
  AgentActivityItem,
  AgentsDashboardData,
} from "@/types/agents-dashboard";

const AGENTS = [
  { flagKey: "coverage_agent_enabled", name: "Coverage", schedule: "Daily at 2:00 AM", reportFile: "docs/agents/coverage-report.md" },
  { flagKey: "security_agent_enabled", name: "Security", schedule: "Weekly Monday 9:00 AM", reportFile: "docs/agents/security-report.md" },
  { flagKey: "documentation_agent_enabled", name: "Documentation", schedule: "Weekly Sunday 6:00 AM", reportFile: "docs/agents/documentation-report.md" },
  { flagKey: "performance_agent_enabled", name: "Performance", schedule: "Weekly Saturday 10:00 AM", reportFile: "docs/agents/performance-report.md" },
  { flagKey: "qa_agent_enabled", name: "QA", schedule: "Weekly Sunday 8:00 AM", reportFile: "docs/agents/qa-report.md" },
  { flagKey: "localization_agent_enabled", name: "Localization", schedule: "Weekly Sunday 7:00 AM", reportFile: "docs/agents/localization-report.md" },
  { flagKey: "cost_analyst_agent_enabled", name: "Cost Analyst", schedule: "Daily at 3:00 AM", reportFile: "docs/agents/cost-analyst-report.md" },
];

// Map flag keys to display names for shared context parsing.
// Supports both full keys ("coverage_agent_enabled") and short forms ("coverage_agent").
const FLAG_TO_NAME: Record<string, string> = {};
for (const agent of AGENTS) {
  FLAG_TO_NAME[agent.flagKey] = agent.name;
  // Also map the short form without "_enabled" suffix
  const shortKey = agent.flagKey.replace(/_enabled$/, "");
  if (shortKey !== agent.flagKey) {
    FLAG_TO_NAME[shortKey] = agent.name;
  }
}

/**
 * Parse health status from report content.
 * Handles multiple formats found across agent reports:
 *   - "## Health Status: GREEN"
 *   - "Health Status: GREEN"
 *   - "## Health Status: GREEN — All Tests Passing"
 *   - "**Status**: HEALTHY"
 *   - "**Financial health: HEALTHY**"
 */
function parseHealth(content: string): AgentHealthStatus {
  // Normalize: strip emoji and extra whitespace
  const normalized = content.replace(/[\u{1F7E0}\u{1F7E2}\u{1F534}\u{2705}\u{26A0}\u{FE0F}]/gu, "").trim();

  // Pattern 1: "Health Status: GREEN/YELLOW/RED" (with optional markdown heading)
  const healthLine = normalized.match(/health\s*status\s*:\s*(green|yellow|red)/i);
  if (healthLine) {
    return healthLine[1].toLowerCase() as AgentHealthStatus;
  }

  // Pattern 2: "Status: HEALTHY" or "Financial health: HEALTHY"
  const healthyMatch = normalized.match(/(?:status|health)\s*:\s*healthy/i);
  if (healthyMatch) {
    return "green";
  }

  // Pattern 3: "Status: Complete" (localization report)
  const completeMatch = normalized.match(/\*\*status\s*:\*\*\s*complete/i);
  if (completeMatch) {
    return "green";
  }

  // Pattern 4: Infer from content when no explicit health line exists.
  // Check for negative indicators first (failures, errors).
  const hasFailures = /\d+\s+failure/i.test(normalized);
  const hasErrors = /typescript.*\d+\s+error/i.test(normalized);
  if (hasFailures || hasErrors) {
    return "yellow";
  }

  // If the report has substantive content (not just a header) and no negative
  // indicators, treat it as green — the agent completed successfully.
  const hasContent = normalized.length > 100 && /^#/m.test(normalized);
  if (hasContent) {
    return "green";
  }

  return "unknown";
}

/**
 * Extract a one-line health summary from the report.
 * Looks for the executive summary or first meaningful sentence after health status.
 */
function parseHealthSummary(content: string): string {
  // Try executive summary first
  const execMatch = content.match(/##\s*Executive\s*Summary\s*\n+(.+)/i);
  if (execMatch) {
    return extractFirstSentence(execMatch[1]);
  }

  // Try line right after health status (strip emojis so \w+ can match the status word)
  const stripped = content.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, "");
  const afterHealth = stripped.match(/health\s*status\s*:\s*\w+[^\n]*\n+(.+)/i);
  if (afterHealth) {
    const clean = afterHealth[1].replace(/\*+/g, "").replace(/^[-#>\s]+/, "").trim();
    if (clean.length > 5) {
      return extractFirstSentence(clean);
    }
  }

  // Try summary section
  const summaryMatch = content.match(/##\s*Summary\s*\n+(.+)/i);
  if (summaryMatch) {
    return extractFirstSentence(summaryMatch[1]);
  }

  // Fallback: first non-empty paragraph after any ## heading that isn't a table or code
  const fallback = content.match(/^##\s+.+\n+(?:>[^\n]*\n+)?([^#|`\n][^\n]{10,})/m);
  if (fallback) {
    return extractFirstSentence(fallback[1]);
  }

  return "No summary available.";
}

function extractFirstSentence(raw: string): string {
  const clean = raw.replace(/\*+/g, "").replace(/^[-|>\s]+/, "").trim();
  const firstSentence = clean.split(/\.\s/)[0];
  if (firstSentence.length > 120) return firstSentence.slice(0, 117) + "...";
  return firstSentence.endsWith(".") ? firstSentence : firstSentence + ".";
}

/**
 * Parse shared context entries from shared-context.md.
 * Format: <!-- ENTRY:START agent=flag_key timestamp=ISO -->
 */
function parseSharedContext(content: string): SharedContextEntry[] {
  const entries: SharedContextEntry[] = [];
  const entryRegex = /<!--\s*ENTRY:START\s+agent=(\S+)\s+timestamp=(\S+)\s*-->([\s\S]*?)(?=<!--\s*ENTRY:(?:START|END)|$)/g;

  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const agentFlag = match[1];
    const timestamp = match[2];
    let entryContent = match[3].replace(/<!--\s*ENTRY:END\s*-->/g, "").trim();

    // Clean up the content — remove trailing markers
    entryContent = entryContent.replace(/<!--[^>]*-->/g, "").trim();

    if (entryContent) {
      entries.push({
        agentFlag,
        agentName: FLAG_TO_NAME[agentFlag] || agentFlag,
        timestamp,
        content: entryContent,
      });
    }
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Build activity timeline from agent statuses.
 */
function buildActivity(agents: AgentStatus[]): AgentActivityItem[] {
  return agents
    .filter((a) => a.lastRun)
    .map((a) => ({
      agentName: a.name,
      timestamp: a.lastRun!,
      summary: a.healthSummary,
      health: a.health,
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Compute overall health from all agents.
 */
function computeOverallHealth(agents: AgentStatus[]): AgentHealthStatus {
  if (agents.some((a) => a.health === "red")) return "red";
  if (agents.some((a) => a.health === "yellow" || a.health === "unknown")) return "yellow";
  return "green";
}

export async function GET() {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const projectRoot = process.cwd();
    const agentStatuses: AgentStatus[] = [];

    for (const agent of AGENTS) {
      const filePath = path.join(projectRoot, agent.reportFile);
      let lastRun: string | null = null;
      let health: AgentHealthStatus = "unknown";
      let healthSummary = "Report not found.";

      try {
        const stats = await fs.stat(filePath);
        lastRun = stats.mtime.toISOString();

        const content = await fs.readFile(filePath, "utf-8");
        health = parseHealth(content);
        healthSummary = parseHealthSummary(content);
      } catch {
        // File doesn't exist or can't be read
      }

      agentStatuses.push({
        flagKey: agent.flagKey,
        name: agent.name,
        schedule: agent.schedule,
        reportFile: agent.reportFile,
        lastRun,
        health,
        healthSummary,
      });
    }

    // Parse shared context
    let sharedContext: SharedContextEntry[] = [];
    try {
      const sharedContextPath = path.join(projectRoot, "docs/agents/shared-context.md");
      const sharedContextContent = await fs.readFile(sharedContextPath, "utf-8");
      sharedContext = parseSharedContext(sharedContextContent);
    } catch {
      // shared-context.md doesn't exist yet
    }

    const data: AgentsDashboardData = {
      overallHealth: computeOverallHealth(agentStatuses),
      agents: agentStatuses,
      sharedContext,
      recentActivity: buildActivity(agentStatuses),
    };

    return NextResponse.json({ data }, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error building agents summary:", error);
    return NextResponse.json(
      { error: "Failed to build agents summary" },
      { status: 500 }
    );
  }
}
