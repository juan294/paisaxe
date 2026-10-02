import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { translateWebhookSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase-admin";
import { translateStory } from "@/lib/translate-story";
import type { StoryLocale } from "@/types/immersive";
import { TRANSLATE_JOB_BATCH_SIZE } from "./config";

// BE-H6: Reduced lease to 3 minutes (180s). The configured batch fits within
// maxDuration below, and the shorter lease reclaims crashed handlers faster
// than the old 10-minute lease.
const TRANSLATE_JOB_LEASE_SECONDS = 3 * 60; // 180 seconds

// BE-M3 (#784): explicit ceiling for this route, replacing Vercel's implicit
// project default. The batch-size/lease-second tuning above was already
// assuming a 60s budget ("well within Vercel's 60s function timeout") but
// nothing declared or enforced that assumption — this makes it explicit.
// Worst-case batch duration = TRANSLATE_JOB_BATCH_SIZE (3) *
// TRANSLATE_JOB_PER_JOB_MAX_SECONDS (15s) = 45s, so 60s keeps a 15s margin
// and remains the binding constraint that the batch size was tuned against,
// not a new, looser ceiling.
//
// Per PE-H5 (#808), Vercel's currently documented default (Fluid Compute, on
// by default) is 300s across all plan tiers — so 60s here is a deliberately
// LOWER, explicit ceiling than that implicit default, consistent with the
// existing tuning, rather than a relaxation of it. This could not be
// confirmed against this project's actual dashboard setting (`vercel project
// inspect` does not surface Function Max Duration); flagging for human
// confirmation via Settings > Functions > Function Max Duration. If that
// setting differs from 60s, TRANSLATE_JOB_BATCH_SIZE should be reconfirmed
// against it, not just this constant.
export const maxDuration = 60;

const StrictTranslateWebhookSchema = z
  .object({
    storyId: z.string().uuid(),
    locales: z.array(z.enum(["en", "fr", "de", "pt", "ast"])).optional(),
    forceRetranslate: z.boolean().optional(),
  })
  .strict();

const TranslateRecoverySchema = z
  .object({
    eventKey: z.string().min(1),
  })
  .strict();

type TranslateWebhookPayload = z.infer<typeof translateWebhookSchema>;
type TranslateRecoveryPayload = z.infer<typeof TranslateRecoverySchema>;

interface ClaimedTranslateJob {
  event_key: string;
  story_id: string;
  locales: StoryLocale[] | null;
  force_retranslate: boolean | null;
}

function buildTranslateEventKey(
  storyId: string,
  locales?: string[],
  forceRetranslate?: boolean
) {
  const localeKey =
    locales && locales.length > 0 ? [...locales].sort().join(",") : "all";

  return `${storyId}:${forceRetranslate ? "force" : "default"}:${localeKey}`;
}

function getUnknownFields(error: z.ZodError) {
  return error.issues.flatMap((issue) =>
    "keys" in issue && Array.isArray(issue.keys)
      ? (issue.keys as string[])
      : issue.path.length > 0
        ? [issue.path.join(".")]
        : []
  );
}

function parseRequestBody(
  rawBody: unknown
): { mode: "direct"; payload: TranslateWebhookPayload } | { mode: "recovery"; payload: TranslateRecoveryPayload } | null {
  const recoveryParsed = TranslateRecoverySchema.safeParse(rawBody);
  if (recoveryParsed.success) {
    return { mode: "recovery", payload: recoveryParsed.data };
  }

  const directParsed = translateWebhookSchema.safeParse(rawBody);
  if (directParsed.success) {
    return { mode: "direct", payload: directParsed.data };
  }

  return null;
}

async function failTranslateJob(
  supabase: ReturnType<typeof createAdminClient>,
  eventKey: string,
  errorMessage: string
) {
  const { error } = await supabase.rpc("fail_translate_webhook_event", {
    p_event_key: eventKey,
    p_error: errorMessage,
  });

  if (error) {
    logger.error("[TRANSLATE_WEBHOOK_FAIL_MARK_FAILED]", {
      event_key: eventKey,
      error: error.message,
    });
  }
}

async function processClaimedJob(
  supabase: ReturnType<typeof createAdminClient>,
  job: ClaimedTranslateJob
) {
  const result = await translateStory(job.story_id, {
    locales: job.locales ?? undefined,
    forceRetranslate: job.force_retranslate ?? false,
  });

  if (!result.success) {
    const errorMessage = result.error ?? "Translation failed";
    await failTranslateJob(supabase, job.event_key, errorMessage);
    logger.error("[TRANSLATE_WEBHOOK_TRANSLATION_FAILED]", {
      story_id: job.story_id,
      event_key: job.event_key,
      error: errorMessage,
    });
    return {
      ok: false as const,
      result,
      errorMessage,
    };
  }

  const { error: completeError } = await supabase.rpc(
    "complete_translate_webhook_event",
    {
      p_event_key: job.event_key,
    }
  );

  if (completeError) {
    logger.error("[TRANSLATE_WEBHOOK_COMPLETE_FAILED]", {
      story_id: job.story_id,
      event_key: job.event_key,
      error: completeError.message,
    });
    return {
      ok: false as const,
      result,
      errorMessage: "Database error",
      databaseError: true,
    };
  }

  return {
    ok: true as const,
    result,
  };
}

/**
 * POST /api/webhooks/translate
 *
 * Background webhook for auto-translation on story approval.
 * Jobs are durably enqueued, claimed with a lease, and processed by a
 * row-level leased claims so bulk approvals do not fan out unbounded work.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = request.headers.get("x-webhook-secret");
    const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

    // DO-H6: safeEqual compares byte length before timingSafeEqual.
    if (!secret || !expectedSecret || !safeEqual(secret, expectedSecret)) {
      logger.error("[TRANSLATE_WEBHOOK_UNAUTHORIZED]");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const rawBody: unknown = await request.json();
    const parsed = parseRequestBody(rawBody);

    if (!parsed) {
      const directError = translateWebhookSchema.safeParse(rawBody);
      const fieldErrors = directError.success
        ? {}
        : directError.error.flatten().fieldErrors;

      logger.error("[TRANSLATE_WEBHOOK_INVALID_PAYLOAD]", {
        raw_body: rawBody,
        field_errors: fieldErrors,
      });

      return NextResponse.json(
        {
          error: "Bad request: invalid payload",
          errors: fieldErrors,
        },
        { status: 400 }
      );
    }

    if (parsed.mode === "direct") {
      const shapeResult = StrictTranslateWebhookSchema.safeParse(rawBody);
      if (!shapeResult.success) {
        logger.warn("[WEBHOOK_UNKNOWN_SHAPE]", {
          webhook: "translate",
          fields: getUnknownFields(shapeResult.error),
        });
      }
    }

    let requestedEventKey: string;
    let requestedStoryId: string | undefined;
    let enqueueStatus: string | undefined;

    if (parsed.mode === "direct") {
      const { storyId, locales, forceRetranslate } = parsed.payload;
      requestedStoryId = storyId;
      requestedEventKey = buildTranslateEventKey(
        storyId,
        locales,
        forceRetranslate
      );

      const { data, error } = await supabase.rpc(
        "enqueue_translate_webhook_event",
        {
          p_event_key: requestedEventKey,
          p_story_id: storyId,
          p_locales: locales ?? null,
          p_force_retranslate: forceRetranslate ?? false,
        }
      );

      if (error) {
        logger.error("[TRANSLATE_WEBHOOK_RPC_FAILURE]", {
          story_id: storyId,
          event_key: requestedEventKey,
          error: error.message,
        });
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      enqueueStatus = data ?? "queued";
    } else {
      requestedEventKey = parsed.payload.eventKey;
    }

    const { data: claimedJobs, error: claimError } = await supabase.rpc(
      "claim_next_translate_webhook_event",
      {
        p_event_key: requestedEventKey,
        p_lease_seconds: TRANSLATE_JOB_LEASE_SECONDS,
        p_batch_size: TRANSLATE_JOB_BATCH_SIZE,
      }
    );

    if (claimError) {
      logger.error("[TRANSLATE_WEBHOOK_CLAIM_FAILURE]", {
        event_key: requestedEventKey,
        error: claimError.message,
      });
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const jobs = (claimedJobs ?? []) as ClaimedTranslateJob[];

    if (jobs.length === 0) {
      if (enqueueStatus === "duplicate") {
        return NextResponse.json(
          {
            success: true,
            status: "duplicate",
            eventKey: requestedEventKey,
            storyId: requestedStoryId,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          status: "queued",
          eventKey: requestedEventKey,
          storyId: requestedStoryId,
        },
        { status: 202 }
      );
    }

    let preferredResponse:
      | {
          success: boolean;
          status: "processed";
          storyId: string;
          successCount?: number;
          failedCount?: number;
          error?: string;
        }
      | undefined;
    let preferredStatus = 200;

    for (const job of jobs) {
      try {
        const processed = await processClaimedJob(supabase, job);

        if (job.event_key !== requestedEventKey) {
          continue;
        }

        if (!processed.ok) {
          if (processed.databaseError) {
            return NextResponse.json(
              { error: "Database error" },
              { status: 500 }
            );
          }

          preferredStatus = 500;
          preferredResponse = {
            success: false,
            status: "processed",
            storyId: job.story_id,
            successCount: processed.result.successCount,
            failedCount: processed.result.failedCount,
            error: processed.errorMessage,
          };
          continue;
        }

        preferredResponse = {
          success: true,
          status: "processed",
          storyId: job.story_id,
          successCount: processed.result.successCount,
          failedCount: processed.result.failedCount,
          error: processed.result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Internal server error";

        await failTranslateJob(supabase, job.event_key, errorMessage);

        if (job.event_key === requestedEventKey) {
          preferredStatus = 500;
          preferredResponse = {
            success: false,
            status: "processed",
            storyId: job.story_id,
            error: errorMessage,
          };
        }
      }
    }

    if (preferredResponse) {
      return NextResponse.json(preferredResponse, { status: preferredStatus });
    }

    if (enqueueStatus === "duplicate") {
      return NextResponse.json(
        {
          success: true,
          status: "duplicate",
          eventKey: requestedEventKey,
          storyId: requestedStoryId,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: "processed",
        eventKey: requestedEventKey,
        storyId: requestedStoryId,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[TRANSLATE_WEBHOOK_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
