import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { readFile } from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ManifestImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  width: number;
  height: number;
  path: string;
  aspectRatio?: number;
  type?: "extracted" | "rendered";
}

interface Manifest {
  extractedAt: string;
  totalImages: number;
  totalPdfs: number;
  images: ManifestImage[];
}

interface ContentImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  width: number;
  height: number;
  aspectRatio: number;
  type: string;
  url: string;
  score: number;
}

/**
 * Score an image for hero suitability. Higher is better.
 * This matches the logic in scripts/map-story-images.ts
 */
function scoreImage(img: ManifestImage): number {
  let score = 0;

  // Prefer extracted (embedded photography) over page renders (includes text/chrome)
  if (img.type === "extracted") {
    score += 100;
  }

  // Prefer early pages (cover photos, hero images)
  if (img.pageNumber <= 1) {
    score += 50;
  } else if (img.pageNumber <= 3) {
    score += 30;
  } else if (img.pageNumber <= 5) {
    score += 10;
  }

  // Prefer landscape orientation (better for immersive view)
  if (img.width > img.height) {
    score += 20;
  }

  // Prefer larger images (more detail)
  const area = img.width * img.height;
  score += Math.min(area / 10000, 50); // Cap at 50 points for size

  // Prefer wider images
  if (img.width >= 1200) {
    score += 15;
  } else if (img.width >= 800) {
    score += 10;
  }

  return score;
}

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
      console.error("Error fetching story:", storyError);
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
      console.error("Error searching chunks:", chunksError);
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

    // Read manifest file
    let manifest: Manifest;
    try {
      const manifestPath = path.join(process.cwd(), "content", "images", "manifest.json");
      const manifestContent = await readFile(manifestPath, "utf-8");
      manifest = JSON.parse(manifestContent);
    } catch {
      console.error("Error reading manifest file");
      return NextResponse.json(
        { error: "Failed to read image manifest" },
        { status: 500 }
      );
    }

    // Find images matching the source PDF AND relevant pages
    const sourcePdf = story.source_pdf;
    const pdfBaseName = sourcePdf.replace(".pdf", "");

    const matchingImages = manifest.images.filter((img) => {
      // Check PDF match
      const pdfMatches = img.sourcePdf === sourcePdf ||
        img.sourcePdf.replace(".pdf", "") === pdfBaseName;

      if (!pdfMatches) return false;

      // Check page match - only include images from pages where story is mentioned
      return relevantPages.has(img.pageNumber);
    });

    // Score and sort images
    const scoredImages: ContentImage[] = matchingImages
      .map((img) => ({
        filename: img.filename,
        sourcePdf: img.sourcePdf,
        pageNumber: img.pageNumber,
        width: img.width,
        height: img.height,
        aspectRatio: img.aspectRatio || img.width / img.height,
        type: img.type || "unknown",
        url: `/api/content-images/${img.path}`,
        score: scoreImage(img),
      }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      data: {
        images: scoredImages,
        total: scoredImages.length,
      }
    });
  } catch (error) {
    console.error("Content images API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
