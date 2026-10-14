import { parseImageProvenance, NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "@/lib/image-provenance";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminDeferred } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminDeferred(async (getClient) => {

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Story ID is required" },
        { status: 400 }
      );
    }

    try {
      const body = await request.json();
      const { imageSource } = body;

      if (typeof imageSource !== "string") {
        return NextResponse.json(
          { error: "imageSource is required and must be a string" },
          { status: 400 }
        );
      }

      const supabase = getClient();

      const provenance = parseImageProvenance(imageSource);
      const current = await supabase.from("stories").select("image_path, image_source").eq("id", id).single();
      if (current.error || !current.data) return NextResponse.json({ error: "Story not found" }, { status: 404 });
      const neutral = current.data.image_path === NEUTRAL_IMAGE && imageSource === NEUTRAL_CREDIT;
      const previous = parseImageProvenance(current.data.image_source);
      if (!neutral && (!provenance || provenance.assetUrl !== current.data.image_path || !previous || previous.replacementSha256 !== provenance.replacementSha256)) return NextResponse.json({ error: "A complete review of this photo is required; a credit alone cannot approve it" }, { status: 400 });

      // Keep attribution bound to the exact previously verified bytes.
      const { data, error } = await supabase
        .from("stories")
        .update({ image_source: imageSource })
        .eq("id", id)
        .select("id, image_source")
        .single();

      if (error) {
        logger.error("Update error:", { error: error.message });
        return NextResponse.json(
          { error: "Failed to update image source" },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      // Revalidate the immersive page cache so attribution updates appear immediately
      revalidatePath("/immersive");

      return NextResponse.json({
        data: {
          id: data.id,
          imageSource: data.image_source,
        },
      });
    } catch (error) {
      logger.error("Admin image source API error:", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

  }, request);
}
