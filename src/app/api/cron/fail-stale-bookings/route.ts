import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateCsrfForAdminFallback } from "@/lib/csrf";
import { ALLOWED_ORIGINS } from "@/lib/proxy/cors";

/**
 * GET|POST /api/cron/fail-stale-bookings
 *
 * Marks pending_bookings rows stuck in 'initiating' status for longer than
 * STALE_INITIATING_MINUTES minutes as 'orphaned' (BE-H2) — NOT 'failed'. A
 * hung fetch (now guarded by a 15-second AbortSignal.timeout) could
 * previously leave them stuck indefinitely, causing 409 Conflict errors on
 * retry (BE-H4). Stale rows may be from a timeout where the call actually
 * reached the venue, so they're marked 'orphaned' (needs attention) rather
 * than the terminal 'failed' (definitely didn't happen) — a late webhook can
 * still reconcile an orphaned row via its booking_id fallback lookup (see
 * src/app/api/webhooks/elevenlabs/route.ts).
 *
 * Runs every 5 minutes via Vercel Cron (see vercel.json).
 */

const STALE_INITIATING_MINUTES = 5;

async function failStaleBookings(): Promise<NextResponse> {
  const start = Date.now();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "fail_stale_initiating_bookings",
    { p_stale_minutes: STALE_INITIATING_MINUTES }
  );

  if (error) {
    logger.error("[CRON_FAILURE]", { job: "fail-stale-bookings", error: error.message });
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
    // BE-H2: ERROR, not WARN — these rows need an operator to look at them
    // (the call may have actually reached the venue), so this must alert
    // rather than blend into routine log noise.
    logger.error("[CRON_ORPHAN_STALE_BOOKINGS]", {
      stale_minutes: STALE_INITIATING_MINUTES,
      orphaned_count: failed_count,
    });
  }

  logger.info("[CRON_SUCCESS]", { job: "fail-stale-bookings", duration_ms: Date.now() - start });
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
    // BE-H5/SE-M1: admin-cookie fallback is exactly the CSRF attack surface —
    // require a valid CSRF token + Origin before trusting the session cookie.
    if (!validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
    // BE-M1: webhook secret was absent/wrong but admin auth succeeded — log for ops visibility
    logger.warn("[CRON_AUTH_FALLBACK]", { source: "webhook", fellBackTo: "admin_auth" });
  }

  return failStaleBookings();
}
