import { NextRequest, NextResponse } from "next/server";
import { withAdminDeferred } from "@/lib/admin-auth";
import { bulkDeleteStoriesSchema } from "@/lib/schemas";
import { readJsonBody } from "@/lib/request-validation";
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

export async function POST(request: NextRequest) {
  return withAdminDeferred(async (getClient) => {

    try {
      const body = await readJsonBody(request);
      if (!body.ok) return body.error;
      const parsed = bulkDeleteStoriesSchema.safeParse(body.data);
      if (!parsed.success || new Set(parsed.data.storyIds).size !== parsed.data.storyIds.length) {
        return NextResponse.json({ error: "An explicit list of unique story IDs is required" }, { status: 400 });
      }
      const supabase = getClient();
      const approvedIds: string[] = [];
      // Bound URL length and response size. Every batch is restricted to the
      // frozen confirmation snapshot and rows that are still pending.
      for (let offset = 0; offset < parsed.data.storyIds.length; offset += 100) {
        const { data, error } = await supabase.from("stories")
          .update({ curation_status: "approved" })
          .eq("curation_status", "needs_curation")
          .in("id", parsed.data.storyIds.slice(offset, offset + 100))
          .select("id");
        if (error) {
          logger.error("Approve all error:", { error: error.message, approved_count: approvedIds.length });
          return NextResponse.json({ error: `Approval stopped after ${approvedIds.length} stories; refresh and review the remaining stories`, data: { approvedCount: approvedIds.length, approvedIds } }, { status: 500 });
        }
        approvedIds.push(...(data?.map(s => s.id) ?? []));
      }

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

  }, request);
}
