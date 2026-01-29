import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "crypto";

interface WebhookPayload {
  table_name: string;
  operation: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  timestamp: string;
}

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
    const expectedSecret = process.env.WEBHOOK_SECRET;

    // Use constant-time comparison to prevent timing attacks
    if (
      !secret ||
      !expectedSecret ||
      secret.length !== expectedSecret.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json(
        { error: "Bad request: missing required fields" },
        { status: 400 }
      );
    }

    const { table_name, operation } = body;
    const pathsToRevalidate = REVALIDATION_MAP[table_name] ?? [];

    for (const path of pathsToRevalidate) {
      revalidatePath(path);
    }

    console.log(
      `[webhook] ${table_name}.${operation} — revalidated: ${
        pathsToRevalidate.length > 0 ? pathsToRevalidate.join(", ") : "none"
      }`
    );

    return NextResponse.json(
      { success: true, revalidated: pathsToRevalidate },
      { status: 200 }
    );
  } catch (error) {
    console.error("[webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
