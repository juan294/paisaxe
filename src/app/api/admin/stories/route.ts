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

      // Shared story column values used by both the direct insert and the
      // atomic conversion RPC.
      const storyValues = {
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
      };

      type NewStoryRow = {
        id: string;
        slug: string;
        title: string;
        category: string;
        display_order: number;
        curation_status: string;
        created_at: string;
      };

      let newStory: NewStoryRow;

      if (body.suggestionId) {
        // BE-M4: a conversion creates the story AND marks the suggestion as
        // converted. These two writes MUST be atomic — a partial failure used
        // to leave a story created but the suggestion unmarked. The RPC wraps
        // both in a single transaction and returns the new story row.
        const { data: rpcStory, error: rpcError } = await supabase.rpc(
          "create_story_from_suggestion",
          {
            p_suggestion_id: body.suggestionId,
            p_title: storyValues.title,
            p_slug: storyValues.slug,
            p_subtitle: storyValues.subtitle,
            p_description: storyValues.description,
            p_category: storyValues.category,
            p_location: storyValues.location,
            p_duration: storyValues.duration,
            p_source_pdf: storyValues.source_pdf,
            p_best_months: storyValues.best_months,
            p_metadata: storyValues.metadata,
            p_display_order: storyValues.display_order,
            p_source_type: storyValues.source_type,
          }
        );

        if (rpcError || !rpcStory) {
          logger.error("[ADMIN_STORIES_CONVERT_FAILED]", {
            slug,
            suggestion_id: body.suggestionId,
            error: rpcError,
          });
          return NextResponse.json(
            { error: "Failed to create story" },
            { status: 500 }
          );
        }

        newStory = rpcStory as NewStoryRow;
      } else {
        // Insert the new story (non-conversion path)
        const { data: insertedStory, error: insertError } = await supabase
          .from("stories")
          .insert(storyValues)
          .select("id, slug, title, category, display_order, curation_status, created_at")
          .single();

        if (insertError || !insertedStory) {
          logger.error("[ADMIN_STORIES_CREATE_FAILED]", { slug, error: insertError });
          return NextResponse.json(
            { error: "Failed to create story" },
            { status: 500 }
          );
        }

        newStory = insertedStory;
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
