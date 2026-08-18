import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";

interface WebhookPayload {
  table_name: string;
  operation: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Zod schema for the Supabase revalidation webhook payload.
 * Validates expected shape and warns on unexpected fields.
 */
const SupabaseWebhookSchema = z
  .object({
    table_name: z.string(),
    operation: z.string(),
    timestamp: z.string(),
    record: z.record(z.string(), z.unknown()).optional(),
    old_record: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

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

function isValidPayload(body: unknown): body is WebhookPayload {
  if (typeof body !== "object" || body === null) return false;
  const payload = body as Record<string, unknown>;
  return (
    typeof payload.table_name === "string" &&
    typeof payload.operation === "string" &&
    typeof payload.timestamp === "string"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = request.headers.get("x-webhook-secret");
    const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

    // Use constant-time comparison to prevent timing attacks.
    // DO-H6: safeEqual compares byte length before timingSafeEqual.
    if (!secret || !expectedSecret || !safeEqual(secret, expectedSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json(
        { error: "Bad request: missing required fields" },
        { status: 400 }
      );
    }

    // Zod schema validation — warn on unexpected fields (after signature + basic shape check)
    const parseResult = SupabaseWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      const unknownFields = parseResult.error.issues.flatMap((i) =>
        "keys" in i && Array.isArray(i.keys)
          ? (i.keys as string[])
          : i.path.length > 0
          ? [i.path.join(".")]
          : []
      );
      logger.warn("[WEBHOOK_UNKNOWN_SHAPE]", { webhook: "supabase", fields: unknownFields });
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
