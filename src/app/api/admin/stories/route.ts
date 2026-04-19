import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  rowToAdminStory,
  type AdminStoryRow,
  type CurationStatus,
} from "@/types/admin";
import type { StoryCategory } from "@/types/immersive";
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
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    // Get optional filter from query params
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") as CurationStatus | null;

    // Build query
    let query = supabase
      .from("stories")
      .select("*")
      .order("display_order", { ascending: true });

    // Apply filter if provided
    if (filter === "needs_curation" || filter === "approved") {
      query = query.eq("curation_status", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching stories:", error);
      return NextResponse.json(
        { error: "Failed to fetch stories" },
        { status: 500 }
      );
    }

    // Convert to admin stories
    const stories = (data as AdminStoryRow[]).map(rowToAdminStory);

    return NextResponse.json({ data: stories });
  } catch (error) {
    console.error("Admin stories API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

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
    const supabase = createAdminClient();

    // Generate slug from title if not provided
    const slug = body.slug?.trim() || generateSlug(body.title);

    // Check if slug already exists
    const { data: existingStory, error: slugCheckError } = await supabase
      .from("stories")
      .select("id, slug")
      .eq("slug", slug)
      .single();

    // PGRST116 means no rows found, which is expected
    if (slugCheckError && slugCheckError.code !== "PGRST116") {
      console.error("Error checking slug:", slugCheckError);
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
    let displayOrder = body.displayOrder;
    if (displayOrder === undefined) {
      const { data: maxOrderStory } = await supabase
        .from("stories")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

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
      console.error("Error creating story:", insertError);
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
        console.error("Error updating suggestion status:", updateSuggestionError);
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
    console.error("Admin create story API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
