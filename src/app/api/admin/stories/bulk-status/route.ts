import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { bulkStatusStoriesSchema } from "@/lib/schemas";
import { readJsonBody } from "@/lib/request-validation";

export async function PUT(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const bodyResult = await readJsonBody<{ storyIds?: unknown }>(request);
    if (!bodyResult.ok) {
      return bodyResult.error;
    }
    const body = bodyResult.data;

    // Zod schema validation (BE-M1)
    const parsed = bulkStatusStoriesSchema.safeParse(body);
    if (!parsed.success) {
      const hasStoryIds = Array.isArray(body?.storyIds);
      if (!hasStoryIds || (body.storyIds as unknown[]).length === 0) {
        return NextResponse.json(
          { error: "Story IDs array is required" },
          { status: 400 }
        );
      }
      // Surface field-level validation errors (UUID failures, invalid status, etc.)
      const flat = parsed.error.flatten();
      // Keep backward-compatible message for invalid status
      const statusErrors = flat.fieldErrors.status;
      if (statusErrors?.length) {
        return NextResponse.json(
          { error: "Invalid status. Must be 'needs_curation' or 'approved'" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { errors: flat.fieldErrors },
        { status: 400 }
      );
    }

    const { storyIds, status } = parsed.data;
    const supabase = createAdminClient();

    // Update all stories at once
    const { data, error } = await supabase
      .from("stories")
      .update({ curation_status: status })
      .in("id", storyIds)
      .select("id");

    if (error) {
      logger.error("[ADMIN_STORIES_BULK_STATUS_UPDATE_FAILED]", {
        story_ids_count: storyIds.length,
        status,
        error,
      });
      return NextResponse.json(
        { error: "Failed to update stories" },
        { status: 500 }
      );
    }

    // SE-M4: Audit log for admin mutations
    logger.info("[ADMIN_AUDIT]", {
      event: "bulk_status_change",
      actor: auth.userId,
      story_ids_count: storyIds.length,
      status,
    });

    return NextResponse.json({
      data: {
        updatedIds: data?.map((s) => s.id) || [],
        status,
      },
    });
  } catch (error) {
    logger.error("[ADMIN_STORIES_BULK_STATUS_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
