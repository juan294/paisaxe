import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { acquireCronJobLease, releaseCronJobLease } from "@/lib/cron-job-lock";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateCsrfForAdminFallback } from "@/lib/csrf";
import { ALLOWED_ORIGINS } from "@/lib/proxy/cors";
import { reconcileBookings } from "@/lib/booking/reconcile";

/**
 * GET|POST /api/cron/reconcile-bookings
 *
 * Experience bookings (PayPal hackathon plan, Phase 4): resolves every
 * uncertain PayPal payment with nobody present. See src/lib/booking/reconcile.ts
 * for the steps. A lease keeps two runs from overlapping; a second caller gets
 * 409. PayPal unreachable, or any item that failed, answers 500 with
 * [CRON_FAILURE]; every state an item did not finish is left for the next run.
 *
 * Runs every 5 minutes via Vercel Cron (see vercel.json).
 */

const JOB = "reconcile-bookings";
const LOCK_LEASE_SECONDS = 10 * 60;

async function runReconciliation(): Promise<NextResponse> {
  const start = Date.now();
  const supabase = createAdminClient();

  const lease = await acquireCronJobLease(supabase, JOB, LOCK_LEASE_SECONDS);
  if (!lease.acquired) {
    if (lease.error) {
      logger.error("[CRON_FAILURE]", { job: JOB, error: lease.error });
      return NextResponse.json({ error: "Failed to acquire the reconciliation lease" }, { status: 500 });
    }
    return NextResponse.json({ status: "skipped", reason: "concurrent run in progress" }, { status: 409 });
  }

  try {
    const summary = await reconcileBookings(supabase);
    if (summary.errors > 0) {
      logger.error("[CRON_FAILURE]", { job: JOB, duration_ms: Date.now() - start, ...summary });
      return NextResponse.json({ error: "Some bookings could not be reconciled", ...summary }, { status: 500 });
    }
    logger.info("[CRON_SUCCESS]", { job: JOB, duration_ms: Date.now() - start, ...summary });
    return NextResponse.json({ status: "ok", ...summary });
  } catch (error) {
    logger.error("[CRON_FAILURE]", { job: JOB, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  } finally {
    try {
      await releaseCronJobLease(supabase, JOB, lease.token);
    } catch (error) {
      logger.error("[RECONCILE_BOOKINGS_LOCK_RELEASE_FAILED]", { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runReconciliation();
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

  return runReconciliation();
}
