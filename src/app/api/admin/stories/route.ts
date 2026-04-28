import { NextRequest, NextResponse } from "next/server";
import { withAdmin, withAdminRead } from "@/lib/admin-auth";
import {
  rowToAdminStory,
  type AdminStoryRow,
  type CurationStatus,
} from "@/types/admin";
import type { StoryCategory } from "@/types/immersive";
import { logger } from "@/lib/logger";
import { createStorySchema } from "@/lib/schemas";

/**
 * Generate a URL-safe slug from a title.
 * Handles Spanish diacritics and special characters.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    // Normalize to decompose accented characters
    .normalize("NFD")
    // Remove diacritical marks
    .replace(/[\u0300-\u036f]/g, "")
    // Replace ñ with n (handle separately as NFD doesn't decompose ñ the same way)
    .replace(/ñ/g, "n")
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, "-")
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, "")
    // Remove multiple consecutive hyphens
    .replace(/-+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  return withAdminRead(async (supabase) => {
    try {
      // Get optional filter and pagination params from query params
      const { searchParams } = new URL(request.url);
      const filter = searchParams.get("filter") as CurationStatus | null;
      const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
      const offset = (page - 1) * pageSize;

      // Build query with exact count for pagination metadata
      let query = supabase
        .from("stories")
        .select("*", { count: "exact" })
        .order("display_order", { ascending: true })
        .range(offset, offset + pageSize - 1);

      // Apply filter if provided
      if (filter === "needs_curation" || filter === "approved") {
        query = query.eq("curation_status", filter);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error("[ADMIN_STORIES_FETCH_FAILED]", { error });
        return NextResponse.json(
          { error: "Failed to fetch stories" },
          { status: 500 }
        );
      }

      // Convert to admin stories
      const stories = (data as AdminStoryRow[]).map(rowToAdminStory);
      const total = count ?? 0;

      return NextResponse.json({ data: { stories, total, page, pageSize } });
    } catch (error) {
      logger.error("[ADMIN_STORIES_GET_UNHANDLED_ERROR]", { error });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async (supabase) => {
    try {
      const rawBody: unknown = await request.json();
      const parsed = createStorySchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request body", errors: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const body = parsed.data;

      // Generate slug from title if not provided
      const slug = body.slug?.trim() || generateSlug(body.title);

      // Check if slug already exists — maybeSingle() returns {data: null, error: null}
      // when no row is found, so any non-null error is a real DB error
      const { data: existingStory, error: slugCheckError } = await supabase
        .from("stories")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (slugCheckError) {
        logger.error("[ADMIN_STORIES_SLUG_CHECK_FAILED]", { slug, error: slugCheckError });
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

      // Get the next display_order if not provided
      // maybeSingle() returns {data: null, error: null} when the table is empty
      let displayOrder = body.displayOrder;
      if (displayOrder === undefined) {
        const { data: maxOrderStory } = await supabase
          .from("stories")
          .select("display_order")
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        displayOrder = (maxOrderStory?.display_order ?? 0) + 1;
      }

      // Insert the new story
      const { data: newStory, error: insertError } = await supabase
        .from("stories")
        .insert({
          title: body.title.trim(),
          slug,
          subtitle: body.subtitle?.trim() || null,
          description: body.description?.trim() || null,
          category: body.category,
          location: body.location || null,
          duration: body.duration || null,
          source_pdf: body.sourcePdf || null,
          best_months: body.bestMonths || null,
          metadata: body.metadata || {},
          display_order: displayOrder,
          curation_status: "needs_curation" as CurationStatus,
          is_active: true,
          source_type: body.sourceType || "curated",
          suggestion_id: body.suggestionId || null,
        })
        .select("id, slug, title, category, display_order, curation_status, created_at")
        .single();

      if (insertError || !newStory) {
        logger.error("[ADMIN_STORIES_CREATE_FAILED]", { slug, error: insertError });
        return NextResponse.json(
          { error: "Failed to create story" },
          { status: 500 }
        );
      }

      // If this is a conversion from a suggestion, update the suggestion status
      if (body.suggestionId) {
        const { error: updateSuggestionError } = await supabase
          .from("story_suggestions")
          .update({
            status: "converted",
            converted_story_id: newStory.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.suggestionId);

        if (updateSuggestionError) {
          // Log but don't fail - the story was created successfully
          logger.error("[ADMIN_STORIES_SUGGESTION_UPDATE_FAILED]", {
            suggestion_id: body.suggestionId,
            story_id: newStory.id,
            error: updateSuggestionError,
          });
        }
      }

      return NextResponse.json(
        {
          data: {
            id: newStory.id,
            slug: newStory.slug,
            title: newStory.title,
            category: newStory.category as StoryCategory,
            displayOrder: newStory.display_order,
            curationStatus: newStory.curation_status as CurationStatus,
            createdAt: newStory.created_at,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      logger.error("[ADMIN_STORIES_POST_UNHANDLED_ERROR]", { error });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
