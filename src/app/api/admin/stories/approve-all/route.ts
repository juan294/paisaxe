import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

// BE-H3: cap bulk fan-out so a large approval batch does not create unbounded
// concurrent HTTP calls to the translate webhook.
const WEBHOOK_FAN_OUT_CONCURRENCY = 5;

/**
 * Fires a single translate-webhook ping for a story, swallowing errors so a
 * network hiccup never blocks the approve-all response.  Jobs are durably
 * enqueued in the DB by the trigger; this call is best-effort to wake the
 * worker quickly.
 */
async function pingTranslateWebhook(storyId: string): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  const secret = process.env.WEBHOOK_SECRET?.trim() ?? "";

  if (!baseUrl) {
    return;
  }

  try {
    await fetch(`${baseUrl}/api/webhooks/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({ storyId }),
    });
  } catch (err) {
    // Non-fatal: job is durably enqueued; cron will retry if the ping is missed.
    logger.error("[APPROVE_ALL_WEBHOOK_PING_FAILED]", {
      story_id: storyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Runs `tasks` with at most `concurrency` running in parallel.
 */
async function runWithConcurrencyLimit(
  tasks: (() => Promise<void>)[],
  concurrency: number
): Promise<void> {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        await task();
      }
    }
  });
  await Promise.all(workers);
}

export async function POST(_request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    // Update all stories with needs_curation status to approved
    const { data, error } = await supabase
      .from("stories")
      .update({ curation_status: "approved" })
      .eq("curation_status", "needs_curation")
      .select("id");

    if (error) {
      console.error("Approve all error:", error);
      return NextResponse.json(
        { error: "Failed to approve stories" },
        { status: 500 }
      );
    }

    const approvedIds = data?.map((s) => s.id) || [];

    // BE-H3: fan out webhook pings with a concurrency cap to avoid unbounded
    // concurrent HTTP calls when a large batch is approved.  The DB trigger has
    // already durably enqueued translation jobs, so these pings are best-effort
    // worker wake-ups.  Errors are logged but do not fail the request.
    if (approvedIds.length > 0) {
      const pingTasks = approvedIds.map(
        (id) => () => pingTranslateWebhook(id)
      );
      await runWithConcurrencyLimit(pingTasks, WEBHOOK_FAN_OUT_CONCURRENCY);
    }

    return NextResponse.json({
      data: {
        approvedCount: approvedIds.length,
        approvedIds,
      },
    });
  } catch (error) {
    console.error("Admin approve-all API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
