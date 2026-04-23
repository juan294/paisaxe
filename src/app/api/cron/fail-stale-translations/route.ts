import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase";

const LOCK_ID = 1006;
const STALE_TRANSLATION_WINDOW_MS = 30 * 60 * 1000;

async function failStaleTranslations(): Promise<NextResponse> {
  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - STALE_TRANSLATION_WINDOW_MS
  ).toISOString();

  const { data: locked, error: lockError } = await supabase.rpc(
    "pg_try_advisory_lock",
    { lockid: LOCK_ID }
  );

  if (lockError || !locked) {
    logger.warn("[CRON_FAIL_STALE_TRANSLATIONS_SKIPPED]", {
      reason: "lock_held",
      error: lockError?.message,
    });
    return NextResponse.json(
      { status: "skipped", reason: "lock_held" },
      { status: 409 }
    );
  }

  try {
    const { data, error } = await supabase.rpc(
      "fail_stale_story_translations",
      { p_cutoff: cutoff }
    );

    if (error) {
      logger.error("[CRON_FAIL_STALE_TRANSLATIONS_FAILED]", {
        cutoff,
        error: error.message,
      });
      return NextResponse.json(
        { error: "Failed to fail stale translations" },
        { status: 500 }
      );
    }

    logger.info("[CRON_FAIL_STALE_TRANSLATIONS]", {
      cutoff,
      failed_count: data ?? 0,
    });

    return NextResponse.json({
      status: "ok",
      failed_count: data ?? 0,
      cutoff,
    });
  } finally {
    await supabase.rpc("pg_advisory_unlock", { lockid: LOCK_ID });
  }
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
  }

  return failStaleTranslations();
}
