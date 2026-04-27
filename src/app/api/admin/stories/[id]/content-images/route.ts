import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ContentImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  url: string;
  score: number;
  caption: string | null;
}

/**
 * Score an image for hero suitability. Higher is better.
 */
function scoreImage(pageNumber: number, url: string): number {
  let score = 0;

  // Prefer early pages (cover photos, hero images)
  if (pageNumber <= 1) {
    score += 50;
  } else if (pageNumber <= 3) {
    score += 30;
  } else if (pageNumber <= 5) {
    score += 10;
  }

  // Prefer extracted images (embedded photography) over page renders
  if (url.includes("_img_")) {
    score += 100;
  }

  return score;
}

/**
 * GET /api/admin/stories/[id]/content-images
 *
 * Returns images from Supabase Storage that are related to the story's source PDF.
 * Images are scored and sorted by suitability for use as hero images.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Story ID is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    // Fetch story to get source_pdf and title
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id, title, source_pdf")
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

    // If story has no source PDF, return empty array
    if (!story.source_pdf) {
      return NextResponse.json({
        data: { images: [], total: 0 }
      });
    }

    // Search chunks for pages mentioning the story title
    const { data: chunks, error: chunksError } = await supabase
      .from("chunks")
      .select("page_number")
      .eq("source_pdf", story.source_pdf)
      .ilike("content", `%${story.title}%`);

    if (chunksError) {
      logger.error("Error searching chunks:", { error: chunksError.message });
      return NextResponse.json(
        { error: "Failed to search chunks" },
        { status: 500 }
      );
    }

    // Get unique page numbers from matching chunks
    const relevantPages = new Set<number>();
    if (chunks) {
      for (const chunk of chunks) {
        if (chunk.page_number !== null) {
          relevantPages.add(chunk.page_number);
        }
      }
    }

    // If no chunks mention the story, return empty array
    if (relevantPages.size === 0) {
      return NextResponse.json({
        data: { images: [], total: 0 }
      });
    }

    // Query images from database that match the source PDF and relevant pages
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("path, caption, source_pdf, page_number")
      .eq("source_pdf", story.source_pdf)
      .in("page_number", Array.from(relevantPages));

    if (imagesError) {
      logger.error("Error fetching images:", { error: imagesError.message });
      return NextResponse.json(
        { error: "Failed to fetch images" },
        { status: 500 }
      );
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        data: { images: [], total: 0 }
      });
    }

    // Score and sort images
    const scoredImages: ContentImage[] = images
      .map((img) => {
        // Extract filename from URL
        const filename = img.path.split("/").pop() || "";

        return {
          filename,
          sourcePdf: img.source_pdf,
          pageNumber: img.page_number,
          url: img.path, // Already a full Supabase Storage URL
          score: scoreImage(img.page_number, img.path),
          caption: img.caption,
        };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      data: {
        images: scoredImages,
        total: scoredImages.length,
      }
    });
  } catch (error) {
    logger.error("Content images API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
