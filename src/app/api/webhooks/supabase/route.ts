import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { getUnknownFields } from "@/lib/webhook-schema-utils";

/**
 * Zod schema for the Supabase revalidation webhook payload.
 *
 * BE-H3 (#778): two variants of the same shape, mirroring the pattern in
 * src/app/api/webhooks/translate/route.ts (StrictTranslateWebhookSchema):
 *   - `SupabaseWebhookSchema` (`.passthrough()`) is the ENFORCED schema —
 *     safeParse'd, gated on (400 on failure), and its `.data` is the only
 *     thing read below. table_name/operation/timestamp are the only fields
 *     the handler actually reads (table_name for the revalidation lookup;
 *     operation/timestamp are required for typed-payload confidence but
 *     never branched on), so those three stay required — matching what
 *     the previous manual `isValidPayload` type guard already enforced.
 *     `record`/`old_record` are unused by this handler and stay optional
 *     and untyped-permissive so a future Supabase payload change there
 *     can't cause a real revalidation event to be hard-rejected.
 *   - `StrictSupabaseWebhookSchema` (`.strict()`) is an OBSERVABILITY-ONLY
 *     probe — never gates the request, only logs `[WEBHOOK_UNKNOWN_SHAPE]`
 *     on unrecognized top-level fields.
 */
const SupabaseWebhookShape = z.object({
  table_name: z.string(),
  operation: z.string(),
  timestamp: z.string(),
  record: z.record(z.string(), z.unknown()).optional(),
  old_record: z.record(z.string(), z.unknown()).optional(),
});

const SupabaseWebhookSchema = SupabaseWebhookShape.passthrough();
const StrictSupabaseWebhookSchema = SupabaseWebhookShape.strict();

/**
 * Revalidation map: defines which paths to revalidate when a given table changes.
 *
 * - stories: Bust the immersive page and sitemap caches when stories are edited
 * - feature_flags: Bust the feature flags API cache when flags change
 */
const REVALIDATION_MAP: Record<string, string[]> = {
  stories: ["/immersive", "/sitemap.xml"],
  feature_flags: ["/api/feature-flags"],
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = request.headers.get("x-webhook-secret");
    const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

    // Use constant-time comparison to prevent timing attacks.
    // DO-H6: safeEqual compares byte length before timingSafeEqual.
    if (!secret || !expectedSecret || !safeEqual(secret, expectedSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();

    // BE-H3 (#778): enforce the passthrough schema and consume `.data`
    // exclusively below — this used to safeParse, warn on failure, and then
    // read the raw unvalidated `body` regardless of the parse outcome (via
    // a separate, redundant `isValidPayload` manual type guard).
    const parseResult = SupabaseWebhookSchema.safeParse(rawBody);
    if (!parseResult.success) {
      logger.error("[SUPABASE_WEBHOOK_INVALID_PAYLOAD]", {
        field_errors: parseResult.error.flatten().fieldErrors,
      });
      return NextResponse.json(
        { error: "Bad request: missing required fields" },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    // Observability-only: never gates the request, just logs shape drift.
    const shapeResult = StrictSupabaseWebhookSchema.safeParse(rawBody);
    if (!shapeResult.success) {
      logger.warn("[WEBHOOK_UNKNOWN_SHAPE]", {
        webhook: "supabase",
        fields: getUnknownFields(shapeResult.error),
      });
    }

    const { table_name } = body;
    const pathsToRevalidate = REVALIDATION_MAP[table_name] ?? [];

    for (const path of pathsToRevalidate) {
      revalidatePath(path);
    }

    return NextResponse.json(
      { success: true, revalidated: pathsToRevalidate },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[webhook] Error processing webhook:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
