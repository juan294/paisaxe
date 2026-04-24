import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { VALID_CATEGORIES } from "@/types/immersive";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";

const VALID_LOCATIONS: StoryLocation[] = ["eastern", "central", "western"];

const VALID_DURATIONS: StoryDuration[] = ["day-trip", "weekend", "week"];

interface UpdateStoryBody {
  title?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  category?: StoryCategory;
  location?: StoryLocation | null;
  duration?: StoryDuration | null;
  sourcePdf?: string | null;
  bestMonths?: number[] | null;
  metadata?: Record<string, unknown>;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { id } = await params;
    const body: UpdateStoryBody = await request.json();

    // Validate category if provided
    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Validate location if provided (allow null to clear it)
    if (body.location !== undefined && body.location !== null && !VALID_LOCATIONS.includes(body.location)) {
      return NextResponse.json(
        { error: "Invalid location" },
        { status: 400 }
      );
    }

    // Validate duration if provided (allow null to clear it)
    if (body.duration !== undefined && body.duration !== null && !VALID_DURATIONS.includes(body.duration)) {
      return NextResponse.json(
        { error: "Invalid duration" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if slug is being changed and if it conflicts
    if (body.slug) {
      const { data: existingStory, error: slugCheckError } = await supabase
        .from("stories")
        .select("id, slug")
        .eq("slug", body.slug)
        .neq("id", id)
        .single();

      if (slugCheckError && slugCheckError.code !== "PGRST116") {
        logger.error("[ADMIN_STORY_SLUG_CHECK_FAILED]", {
          story_id: id,
          slug: body.slug,
          error: slugCheckError,
        });
        return NextResponse.json(
          { error: "Failed to validate slug" },
          { status: 500 }
        );
      }

      if (existingStory) {
        return NextResponse.json(
          { error: "A story with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Build update object (only include fields that are present in the request)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.slug !== undefined) updateData.slug = body.slug.trim();
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle?.trim() || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.sourcePdf !== undefined) updateData.source_pdf = body.sourcePdf?.trim() || null;
    if (body.bestMonths !== undefined) updateData.best_months = body.bestMonths;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // Update the story
    const { data: updatedStory, error: updateError } = await supabase
      .from("stories")
      .update(updateData)
      .eq("id", id)
      .select("id, slug, title, subtitle, description, category, location, duration, source_pdf, metadata, updated_at")
      .single();

    if (updateError) {
      logger.error("[ADMIN_STORY_UPDATE_FAILED]", { story_id: id, error: updateError });
      return NextResponse.json(
        { error: "Failed to update story" },
        { status: 500 }
      );
    }

    if (!updatedStory) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: updatedStory.id,
        slug: updatedStory.slug,
        title: updatedStory.title,
        subtitle: updatedStory.subtitle,
        description: updatedStory.description,
        category: updatedStory.category as StoryCategory,
        location: updatedStory.location as StoryLocation | null,
        duration: updatedStory.duration as StoryDuration | null,
        sourcePdf: updatedStory.source_pdf,
        metadata: updatedStory.metadata as Record<string, unknown> | null,
        updatedAt: updatedStory.updated_at,
      },
    });
  } catch (error) {
    logger.error("[ADMIN_STORY_UPDATE_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
