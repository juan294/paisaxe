/**
 * Content Discovery Cron Endpoint
 *
 * POST /api/cron/content-discovery
 *
 * Triggered by Vercel Cron or manual admin call. Discovers new
 * Asturias places via Google Places API and creates pending stories.
 *
 * Auth: webhook secret (for cron) OR admin session (for manual).
 *
 * Refs #41
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { validateAdminAuth } from "@/lib/admin-auth";
import { runDiscovery, type DiscoverySupabaseClient } from "@/lib/content-discovery";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: verify webhook secret (cron) OR admin session (manual trigger)
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Validate required env vars
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey) as unknown as DiscoverySupabaseClient;

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
  }
}
