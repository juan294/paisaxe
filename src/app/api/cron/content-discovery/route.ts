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

/** Postgres advisory lock ID — unique per cron route. */
const LOCK_ID = 1003;

/** Core discovery logic shared by GET (Vercel Cron) and POST (pg_cron/admin). */
async function discoverContent(): Promise<NextResponse> {
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

  // Acquire advisory lock to prevent concurrent runs
  const { data: locked, error: lockError } = await supabaseAdmin.rpc(
    "pg_try_advisory_lock",
    { lockid: LOCK_ID }
  );
  if (lockError || !locked) {
    return NextResponse.json(
      { status: "skipped", reason: "concurrent run in progress" },
      { status: 409 }
    );
  }

  const supabase = supabaseAdmin as unknown as DiscoverySupabaseClient;

  try {
    const result = await runDiscovery({
      supabase,
      googleApiKey,
      anthropicApiKey,
    });

    return NextResponse.json({
      success: true,
      discoveredAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Content discovery error:", error);
    return NextResponse.json(
      {
        error: "Discovery failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await supabaseAdmin.rpc("pg_advisory_unlock", { lockid: LOCK_ID });
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
  }
  return discoverContent();
}
