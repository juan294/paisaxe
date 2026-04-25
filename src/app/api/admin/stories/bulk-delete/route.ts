import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { bulkDeleteStoriesSchema } from "@/lib/schemas";

export async function DELETE(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body = await request.json();

    // Zod schema validation (BE-M1)
    const parsed = bulkDeleteStoriesSchema.safeParse(body);
    if (!parsed.success) {
      // Keep backward-compatible "Story IDs array is required" for empty/non-array,
      // and return Zod field-level errors for UUID violations.
      const hasStoryIds = Array.isArray(body?.storyIds);
      if (!hasStoryIds || body.storyIds.length === 0) {
        return NextResponse.json(
          { error: "Story IDs array is required" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { storyIds } = parsed.data;
    const supabase = createAdminClient();

    // Delete all stories at once
    const { data, error } = await supabase
      .from("stories")
      .delete()
      .in("id", storyIds)
      .select("id");

    if (error) {
      logger.error("[ADMIN_BULK_DELETE_FAILED]", { story_ids_count: storyIds.length, error });
      return NextResponse.json(
        { error: "Failed to delete stories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        deletedIds: data?.map((s) => s.id) || [],
      },
    });
  } catch (error) {
    logger.error("[ADMIN_BULK_DELETE_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
