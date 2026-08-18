import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateCsrfForAdminFallback } from "@/lib/csrf";
import { ALLOWED_ORIGINS } from "@/lib/proxy/cors";

const STALE_TRANSLATION_WINDOW_MS = 30 * 60 * 1000;

async function failStaleTranslations(): Promise<NextResponse> {
  const start = Date.now();
  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - STALE_TRANSLATION_WINDOW_MS
  ).toISOString();

  const { data, error } = await supabase.rpc(
    "fail_stale_story_translations_locked",
    { p_cutoff: cutoff }
  );

  if (error) {
    logger.error("[CRON_FAILURE]", { job: "fail-stale-translations", error: error.message });
    logger.error("[CRON_FAIL_STALE_TRANSLATIONS_FAILED]", {
      cutoff,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fail stale translations" },
      { status: 500 }
    );
  }

  // The RPC returns -1 when another cron invocation holds the
  // transaction-scoped advisory lock; surface that as 409 to keep the
  // existing response contract intact.
  if (data === -1) {
    logger.warn("[CRON_FAIL_STALE_TRANSLATIONS_SKIPPED]", {
      reason: "lock_held",
    });
    return NextResponse.json(
      { status: "skipped", reason: "lock_held" },
      { status: 409 }
    );
  }

  const failed_count = typeof data === "number" ? data : 0;

  logger.info("[CRON_FAIL_STALE_TRANSLATIONS]", {
    cutoff,
    failed_count,
  });

  logger.info("[CRON_SUCCESS]", { job: "fail-stale-translations", duration_ms: Date.now() - start });
  return NextResponse.json({
    status: "ok",
    failed_count,
    cutoff,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return failStaleTranslations();
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

  return failStaleTranslations();
}
