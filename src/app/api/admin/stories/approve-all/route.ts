import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

// BE-H3: cap bulk fan-out so a large approval batch does not create unbounded
// concurrent HTTP calls to the translate webhook.
const WEBHOOK_FAN_OUT_CONCURRENCY = 5;

// PE-L2: bound each webhook ping so a hung endpoint can't hold this admin
// route open until the platform's default function timeout.
const WEBHOOK_PING_TIMEOUT_MS = 8_000;

/**
 * BE-L2: Resolves the base URL used to ping the translate webhook.
 *
 * `NEXT_PUBLIC_APP_URL` is the primary source. Vercel's `VERCEL_URL` is a
 * bare hostname with no scheme (e.g. "my-app-abc123.vercel.app") — passing
 * it directly to `fetch()` throws `TypeError: Failed to parse URL`, so it
 * must be prefixed with `https://` to be usable. The fallback is restricted
 * to `VERCEL_ENV === "production"` because Preview deployments share
 * production Supabase (see docs/operations); enabling the fallback there
 * would let a preview's approve-all POST to its own (shared-DB) webhook
 * handler using a preview hostname never intended for that traffic.
 */
function resolveWebhookBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl && process.env.VERCEL_ENV === "production") {
    return `https://${vercelUrl}`;
  }

  return "";
}

/**
 * Fires a single translate-webhook ping for a story, swallowing errors so a
 * network hiccup never blocks the approve-all response.  Jobs are durably
 * enqueued in the DB by the trigger; this call is best-effort to wake the
 * worker quickly.
 */
async function pingTranslateWebhook(storyId: string, baseUrl: string): Promise<void> {
  const secret = process.env.WEBHOOK_SECRET?.trim() ?? "";

  try {
    await fetch(`${baseUrl}/api/webhooks/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({ storyId }),
      signal: AbortSignal.timeout(WEBHOOK_PING_TIMEOUT_MS),
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
      logger.error("Approve all error:", { error: error.message });
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
      const baseUrl = resolveWebhookBaseUrl();
      if (!baseUrl) {
        // BE-L2: log once for the whole batch, not once per loop iteration.
        logger.warn("[APPROVE_ALL_WEBHOOK_BASE_URL_MISSING]", {
          approved_count: approvedIds.length,
        });
      } else {
        const pingTasks = approvedIds.map(
          (id) => () => pingTranslateWebhook(id, baseUrl)
        );
        await runWithConcurrencyLimit(pingTasks, WEBHOOK_FAN_OUT_CONCURRENCY);
      }
    }

    return NextResponse.json({
      data: {
        approvedCount: approvedIds.length,
        approvedIds,
      },
    });
  } catch (error) {
    logger.error("Admin approve-all API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
