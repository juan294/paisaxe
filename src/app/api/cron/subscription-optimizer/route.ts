import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import pathModule from "path";
import { validateAdminAuth } from "@/lib/admin-auth";
import { SERVICE_REGISTRY } from "@/config/service-registry";
import {
  analyzeSubscriptions,
  generateReport,
  generateSharedContextEntry,
  type UsageMetricsInput,
} from "@/lib/subscription-optimizer";

/**
 * Default usage metrics when none are provided.
 * These represent conservative estimates for the current project state.
 * In production, these could be fetched from analytics APIs.
 */
const DEFAULT_USAGE_METRICS: UsageMetricsInput = {
  voiceMinutes: 15,
  visitors: 5000,
  chatConversations: 200,
  voiceConversations: 30,
  posthogEvents: 10000,
  supabaseStorageGb: 1.5,
  periodDays: 30,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: verify webhook secret (pg_cron) OR admin session (manual trigger)
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

  const hasValidSecret =
    !!secret &&
    !!expectedSecret &&
    secret.length === expectedSecret.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret));

  if (!hasValidSecret) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
  }

  try {
    // Use provided usage metrics or fall back to defaults
    let usageMetrics = DEFAULT_USAGE_METRICS;
    try {
      const body = await request.json();
      if (body?.usageMetrics) {
        usageMetrics = { ...DEFAULT_USAGE_METRICS, ...body.usageMetrics };
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    const result = analyzeSubscriptions({
      services: SERVICE_REGISTRY,
      usageMetrics,
      dismissedFeatures: [],
    });

    const markdownReport = generateReport(result);

    // Persist report to disk so the agents-summary API can read it
    const projectRoot = process.cwd();
    const reportPath = pathModule.join(
      projectRoot,
      "docs/agents/subscription-optimizer-report.md"
    );
    try {
      await fs.writeFile(reportPath, markdownReport, "utf-8");
    } catch {
      // Serverless environments may not have write access — continue gracefully
    }

    // Append shared context entry for cross-agent insights
    const sharedContextPath = pathModule.join(projectRoot, "docs/agents/shared-context.md");
    try {
      const contextEntry = generateSharedContextEntry(result);
      let existing = "";
      try {
        existing = await fs.readFile(sharedContextPath, "utf-8");
      } catch {
        // File doesn't exist yet — will be created
        existing = "# Agent Shared Context\n> Cross-agent intelligence — agents read this before running and write findings after finishing.\n> Pruned automatically to keep the last 3 entries per agent.\n";
      }
      // Prepend new entry after the header (first 3 lines)
      const headerEnd = existing.indexOf("\n\n");
      const header = headerEnd >= 0 ? existing.slice(0, headerEnd) : existing;
      const body = headerEnd >= 0 ? existing.slice(headerEnd + 2) : "";
      await fs.writeFile(
        sharedContextPath,
        `${header}\n\n${contextEntry}\n\n${body}`,
        "utf-8"
      );
    } catch {
      // Non-critical — don't fail the run if shared context write fails
    }

    // Count actionable items (anything other than "keep")
    const actionableCount = result.recommendations.filter(
      (r) => r.action !== "keep"
    ).length;

    return NextResponse.json({
      success: true,
      analyzedAt: result.analyzedAt,
      totalMonthlySpend: result.totalMonthlySpend,
      servicesAnalyzed: result.recommendations.length,
      actionableItems: actionableCount,
      recommendations: result.recommendations.map((r) => ({
        service: r.serviceName,
        action: r.action,
        reason: r.reason,
      })),
      report: markdownReport,
    });
  } catch (error) {
    console.error("Subscription optimizer error:", error);
    return NextResponse.json(
      {
        error: "Analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
