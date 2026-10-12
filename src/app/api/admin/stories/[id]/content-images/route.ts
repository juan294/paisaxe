import { NextRequest, NextResponse } from "next/server";
import { withAdminDeferred } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/stories/[id]/content-images
 *
 * Retired guide-photo selector. Authenticated admins receive an explicit review requirement.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withAdminDeferred(async (getClient) => {

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Story ID is required" },
        { status: 400 }
      );
    }

    try {
      // Guide extraction metadata is not an image permission grant. Until a
      // reviewed image manifest exists, the selector offers no guide photos.
      const supabase = getClient();

      // Confirm the story exists without reading guide extraction metadata.
      const { data: story, error: storyError } = await supabase
        .from("stories")
        .select("id")
        .eq("id", id)
        .single();

      if (storyError) {
        logger.error("Error fetching story:", { error: storyError.message });
        return NextResponse.json(
          { error: "Failed to fetch story" },
          { status: 500 }
        );
      }

      if (!story) {
        return NextResponse.json(
          { error: "Story not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: { images: [], total: 0 }, reviewRequired: true });
    } catch (error) {
      logger.error("Content images API error:", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

  }, _request);
}
