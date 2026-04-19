import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { translateStory } from "@/lib/translate-story";
import { translateWebhookSchema } from "@/lib/schemas";


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

    const rawBody: unknown = await request.json();
    const parsed = translateWebhookSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.error("[translate-webhook] Bad request: invalid payload", rawBody);
      return NextResponse.json(
        {
          error: "Bad request: invalid payload",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { storyId, locales, forceRetranslate } = parsed.data;

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
