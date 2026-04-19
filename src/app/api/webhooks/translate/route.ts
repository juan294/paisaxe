import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { translateStory } from "@/lib/translate-story";

interface TranslateWebhookPayload {
  storyId: string;
  /** Optional: specific locales to translate */
  locales?: string[];
  /** Optional: force retranslate even if translations exist */
  forceRetranslate?: boolean;
}

function isValidPayload(body: unknown): body is TranslateWebhookPayload {
  if (typeof body !== "object" || body === null) return false;
  const payload = body as Record<string, unknown>;
  return typeof payload.storyId === "string" && payload.storyId.length > 0;
}

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

/**
 * POST /api/webhooks/translate
 *
 * Background webhook for auto-translation on story approval.
 * Called by database trigger via pg_net when a story is approved.
 *
 * Security: Validates webhook secret header.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
      console.error("[translate-webhook] Unauthorized: invalid or missing secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (!isValidPayload(body)) {
      console.error("[translate-webhook] Bad request: invalid payload", body);
      return NextResponse.json(
        { error: "Bad request: storyId is required" },
        { status: 400 }
      );
    }

    // Zod schema validation — warn on unexpected fields (after signature + basic shape check)
    const parseResult = TranslateWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      const unknownFields = parseResult.error.issues.flatMap((i) =>
        "keys" in i && Array.isArray(i.keys)
          ? (i.keys as string[])
          : i.path.length > 0
          ? [i.path.join(".")]
          : []
      );
      console.warn("[WEBHOOK_UNKNOWN_SHAPE]", { webhook: "translate", fields: unknownFields });
    }

    const { storyId, locales, forceRetranslate } = body;

    // Run translation (this may take a few seconds)
    const result = await translateStory(storyId, {
      locales: locales as import("@/types/immersive").StoryLocale[] | undefined,
      forceRetranslate,
    });

    if (!result.success) {
      console.error(
        `[translate-webhook] Translation failed for story ${storyId}: ${result.error}`
      );
    }

    return NextResponse.json(
      {
        success: result.success,
        storyId,
        successCount: result.successCount,
        failedCount: result.failedCount,
        error: result.error,
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    console.error("[translate-webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
