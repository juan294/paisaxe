import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json();
    const { imageSource } = body;

    if (typeof imageSource !== "string") {
      return NextResponse.json(
        { error: "imageSource is required and must be a string" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update just the image_source field
    const { data, error } = await supabase
      .from("stories")
      .update({ image_source: imageSource })
      .eq("id", id)
      .select("id, image_source")
      .single();

    if (error) {
      console.error("Update error:", error);
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
    console.error("Admin image source API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
