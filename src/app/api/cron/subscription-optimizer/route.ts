import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import pathModule from "path";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import { SERVICE_REGISTRY } from "@/config/service-registry";
import {
  analyzeSubscriptions,
  generateReport,
  generateSharedContextEntry,
  type UsageMetricsInput,
} from "@/lib/subscription-optimizer";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/** Postgres advisory lock ID — unique per cron route. */
const LOCK_ID = 1002;

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

/** Core analysis logic shared by GET (Vercel Cron) and POST (pg_cron/admin). */
async function runOptimizer(usageMetrics: UsageMetricsInput): Promise<NextResponse> {
  const supabase = createAdminClient();

  // Acquire advisory lock to prevent concurrent runs
  const { data: locked, error: lockError } = await supabase.rpc(
    "pg_try_advisory_lock",
    { lockid: LOCK_ID }
  );
  if (lockError || !locked) {
    return NextResponse.json(
      { status: "skipped", reason: "concurrent run in progress" },
      { status: 409 }
    );
  }

  try {
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
    logger.error("Subscription optimizer error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: "Analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await supabase.rpc("pg_advisory_unlock", { lockid: LOCK_ID });
  }
}

/** Vercel Cron handler — triggered via GET with Authorization: Bearer <CRON_SECRET>. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runOptimizer(DEFAULT_USAGE_METRICS);
}

/** pg_cron / admin handler — triggered via POST with x-webhook-secret or admin session. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(request)) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
  }

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

  return runOptimizer(usageMetrics);
}
