import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { validateAdminAuth } from "@/lib/admin-auth";
import { SERVICE_REGISTRY } from "@/config/service-registry";
import {
  analyzeSubscriptions,
  generateReport,
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
