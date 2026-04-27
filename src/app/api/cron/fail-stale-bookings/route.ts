import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase";

/**
 * GET|POST /api/cron/fail-stale-bookings
 *
 * Fails pending_bookings rows stuck in 'initiating' status for longer than
 * STALE_INITIATING_MINUTES minutes. These rows are created before the
 * ElevenLabs outbound call is placed. A hung fetch (now guarded by a 15-second
 * AbortSignal.timeout) could previously leave them stuck indefinitely, causing
 * 409 Conflict errors on retry (BE-H4).
 *
 * Runs every 5 minutes via Vercel Cron (see vercel.json).
 */

const STALE_INITIATING_MINUTES = 5;

async function failStaleBookings(): Promise<NextResponse> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "fail_stale_initiating_bookings",
    { p_stale_minutes: STALE_INITIATING_MINUTES }
  );

  if (error) {
    logger.error("[CRON_FAIL_STALE_BOOKINGS_FAILED]", {
      stale_minutes: STALE_INITIATING_MINUTES,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fail stale bookings" },
      { status: 500 }
    );
  }

  const failed_count = typeof data === "number" ? data : 0;

  if (failed_count > 0) {
    logger.warn("[CRON_FAIL_STALE_BOOKINGS]", {
      stale_minutes: STALE_INITIATING_MINUTES,
      failed_count,
    });
  }

  return NextResponse.json({
    status: "ok",
    failed_count,
    stale_minutes: STALE_INITIATING_MINUTES,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return failStaleBookings();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(request)) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
  }

  return failStaleBookings();
}
