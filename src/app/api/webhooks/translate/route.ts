import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { translateStory } from "@/lib/translate-story";
import { translateWebhookSchema } from "@/lib/schemas";

/**
 * Zod schema for the translate webhook payload.
 * Validates expected shape and warns on unexpected fields.
 */
const TranslateWebhookSchema = z
  .object({
    storyId: z.string().min(1),
    locales: z.array(z.string()).optional(),
    forceRetranslate: z.boolean().optional(),
  })
  .strict();

function buildTranslateEventKey(
  storyId: string,
  locales?: string[],
  forceRetranslate?: boolean
) {
  const localeKey = locales && locales.length > 0
    ? [...locales].sort().join(",")
    : "all";

  return `${storyId}:${forceRetranslate ? "force" : "default"}:${localeKey}`;
}

/**
 * POST /api/webhooks/translate
 *
 * Background webhook for auto-translation on story approval.
 * Called by database trigger via pg_net when a story is approved.
 *
 * Security: Validates webhook secret header.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createAdminClient();
  let eventKey: string | undefined;

  try {
    const secret = request.headers.get("x-webhook-secret");
    const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

    // Use constant-time comparison to prevent timing attacks
    if (
      !secret ||
      !expectedSecret ||
      secret.length !== expectedSecret.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
    ) {
      logger.error("[TRANSLATE_WEBHOOK_UNAUTHORIZED]");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parsed = translateWebhookSchema.safeParse(rawBody);

    if (!parsed.success) {
      logger.error("[TRANSLATE_WEBHOOK_INVALID_PAYLOAD]", {
        raw_body: rawBody,
        field_errors: parsed.error.flatten().fieldErrors,
      });
      return NextResponse.json(
        {
          error: "Bad request: invalid payload",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Zod schema validation — warn on unexpected fields (after signature + basic shape check)
    const parseResult = TranslateWebhookSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const unknownFields = parseResult.error.issues.flatMap((i) =>
        "keys" in i && Array.isArray(i.keys)
          ? (i.keys as string[])
          : i.path.length > 0
          ? [i.path.join(".")]
          : []
      );
      logger.warn("[WEBHOOK_UNKNOWN_SHAPE]", { webhook: "translate", fields: unknownFields });
    }

    const { storyId, locales, forceRetranslate } = parsed.data;
    eventKey = buildTranslateEventKey(
      storyId,
      locales,
      forceRetranslate
    );
    const { data: rpcStatus, error: rpcError } = await supabase.rpc(
      "process_translate_event_idempotent",
      {
        p_event_key: eventKey,
        p_story_id: storyId,
      }
    );

    if (rpcError) {
      logger.error("[TRANSLATE_WEBHOOK_RPC_FAILURE]", {
        story_id: storyId,
        error: rpcError.message,
      });
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (rpcStatus === "duplicate") {
      return NextResponse.json(
        {
          success: true,
          status: "duplicate",
          storyId,
        },
        { status: 200 }
      );
    }

    // Run translation (this may take a few seconds)
    const result = await translateStory(storyId, {
      locales: locales as import("@/types/immersive").StoryLocale[] | undefined,
      forceRetranslate,
    });

    if (!result.success) {
      const { error: releaseError } = await supabase
        .from("translate_webhook_events")
        .delete()
        .eq("event_key", eventKey);

      if (releaseError) {
        logger.error("[TRANSLATE_WEBHOOK_CLAIM_RELEASE_FAILED]", {
          story_id: storyId,
          event_key: eventKey,
          error: releaseError,
        });
      }

      logger.error("[TRANSLATE_WEBHOOK_TRANSLATION_FAILED]", {
        story_id: storyId,
        error: result.error,
      });
    }

    return NextResponse.json(
      {
        success: result.success,
        status: rpcStatus,
        storyId,
        successCount: result.successCount,
        failedCount: result.failedCount,
        error: result.error,
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    if (eventKey) {
      const { error: releaseError } = await supabase
        .from("translate_webhook_events")
        .delete()
        .eq("event_key", eventKey);

      if (releaseError) {
        logger.error("[TRANSLATE_WEBHOOK_CLAIM_RELEASE_FAILED]", {
          event_key: eventKey,
          error: releaseError,
        });
      }
    }

    logger.error("[TRANSLATE_WEBHOOK_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
