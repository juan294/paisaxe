import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Validate admin auth
  const auth = validateAdminAuth(request);
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
    const contentType = request.headers.get("content-type") || "";

    let imagePath: string;

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "File is required for upload" },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 5MB" },
          { status: 400 }
        );
      }

      // Generate unique filename
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${id}-${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("story-images")
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("story-images")
        .getPublicUrl(filename);

      imagePath = urlData.publicUrl;
    } else {
      // Handle JSON with URL
      const body = await request.json();
      const { imageUrl } = body;

      if (!imageUrl || typeof imageUrl !== "string") {
        return NextResponse.json(
          { error: "imageUrl is required" },
          { status: 400 }
        );
      }

      // Basic URL validation
      try {
        new URL(imageUrl);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }

      imagePath = imageUrl;
    }

    // Update story in database
    const { data, error } = await supabase
      .from("stories")
      .update({ image_path: imagePath })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: "Failed to update story image" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { id: data.id, image: imagePath },
    });
  } catch (error) {
    console.error("Admin image API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
