/**
 * Content Discovery Cron Endpoint
 *
 * GET  /api/cron/content-discovery — Vercel Cron (Authorization: Bearer <CRON_SECRET>)
 * POST /api/cron/content-discovery — pg_cron / admin (x-webhook-secret or session)
 *
 * Discovers new Asturias places via Google Places API and creates pending stories.
 *
 * Refs #41
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import { runDiscovery, type DiscoverySupabaseClient } from "@/lib/content-discovery";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { acquireCronJobLease, releaseCronJobLease } from "@/lib/cron-job-lock";

const LOCK_KEY = "content-discovery";
const LOCK_LEASE_SECONDS = 20 * 60;

/** Core discovery logic shared by GET (Vercel Cron) and POST (pg_cron/admin). */
async function discoverContent(): Promise<NextResponse> {
  const start = Date.now();
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!googleApiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_PLACES_API_KEY environment variable" },
      { status: 500 }
    );
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY environment variable" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createAdminClient();
  let lockToken: string | null = null;

  const lease = await acquireCronJobLease(supabaseAdmin, LOCK_KEY, LOCK_LEASE_SECONDS);
  if (!lease.acquired) {
    if (lease.error) {
      logger.error("[CONTENT_DISCOVERY_LOCK_FAILED]", { error: lease.error });
    }
    return NextResponse.json(
      { status: "skipped", reason: "concurrent run in progress" },
      { status: 409 }
    );
  }
  lockToken = lease.token;

  const supabase = supabaseAdmin as unknown as DiscoverySupabaseClient;

  try {
    const result = await runDiscovery({
      supabase,
      googleApiKey,
      anthropicApiKey,
    });

    logger.info("[CRON_SUCCESS]", { job: "content-discovery", duration_ms: Date.now() - start });
    return NextResponse.json({
      success: true,
      discoveredAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    logger.error("[CRON_FAILURE]", { job: "content-discovery", error: error instanceof Error ? error.message : "Unknown error" });
    logger.error("Content discovery error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: "Discovery failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    try {
      await releaseCronJobLease(supabaseAdmin, LOCK_KEY, lockToken);
    } catch (error) {
      logger.error("[CONTENT_DISCOVERY_LOCK_RELEASE_FAILED]", { error });
    }
  }
}

/** Vercel Cron handler — triggered via GET with Authorization: Bearer <CRON_SECRET>. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return discoverContent();
}

/** pg_cron / admin handler — triggered via POST with x-webhook-secret or admin session. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(request)) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
    // BE-M1: webhook secret was absent/wrong but admin auth succeeded — log for ops visibility
    logger.warn("[CRON_AUTH_FALLBACK]", { source: "webhook", fellBackTo: "admin_auth" });
  }
  return discoverContent();
}
