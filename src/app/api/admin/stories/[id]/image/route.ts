import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  optimizeSingleImage,
  validateImageBuffer,
} from "@/lib/image-optimization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Increase size limit since we're optimizing on server (10MB max)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    const supabase = createAdminClient();
    const contentType = request.headers.get("content-type") || "";

    let imagePath: string;
    let imageSource: string | null = null;
    let blurDataUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload with optimization
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const sourceValue = formData.get("imageSource");
      if (sourceValue && typeof sourceValue === "string") {
        imageSource = sourceValue;
      }

      if (!file) {
        return NextResponse.json(
          { error: "File is required for upload" },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
      ];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF" },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 10MB" },
          { status: 400 }
        );
      }

      // Read file into buffer
      const arrayBuffer = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Validate image data
      const validation = await validateImageBuffer(inputBuffer);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid image data" },
          { status: 400 }
        );
      }

      // Optimize image and generate blur placeholder
      const { buffer: optimizedBuffer, blurDataUrl: generatedBlur } =
        await optimizeSingleImage(inputBuffer, 2048);

      blurDataUrl = generatedBlur;

      // Generate unique filename with .avif extension
      const filename = `${id}-${Date.now()}.avif`;

      // Upload optimized image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("story-images")
        .upload(filename, optimizedBuffer, {
          contentType: "image/avif",
          cacheControl: "31536000", // 1 year - Smart CDN auto-invalidates on change
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

      // Log optimization stats
      const originalSize = file.size;
      const optimizedSize = optimizedBuffer.length;
      const savings = Math.round((1 - optimizedSize / originalSize) * 100);
      console.log(
        `Image optimized: ${file.name} (${Math.round(originalSize / 1024)}KB -> ${Math.round(optimizedSize / 1024)}KB, ${savings}% reduction)`
      );
    } else {
      // Handle JSON with URL (no optimization for external URLs)
      const body = await request.json();
      const { imageUrl, imageSource: bodyImageSource } = body;

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
      if (bodyImageSource && typeof bodyImageSource === "string") {
        imageSource = bodyImageSource;
      }

      // For external URLs, try to fetch and generate blur placeholder
      try {
        const response = await fetch(imageUrl, {
          headers: { Accept: "image/*" },
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);

          // Only generate blur if it's a valid image
          const validation = await validateImageBuffer(imageBuffer);
          if (validation.valid) {
            const { generateBlurPlaceholder } = await import(
              "@/lib/image-optimization"
            );
            blurDataUrl = await generateBlurPlaceholder(imageBuffer);
          }
        }
      } catch (fetchError) {
        // Non-fatal - just log and continue without blur placeholder
        console.warn(
          "Could not fetch external image for blur generation:",
          fetchError
        );
      }
    }

    // Update story in database
    const updateData: {
      image_path: string;
      image_source?: string;
      blur_data_url?: string;
    } = {
      image_path: imagePath,
    };

    if (imageSource !== null) {
      updateData.image_source = imageSource;
    }

    if (blurDataUrl !== null) {
      updateData.blur_data_url = blurDataUrl;
    }

    const { data, error } = await supabase
      .from("stories")
      .update(updateData)
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
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        image: imagePath,
        imageSource: data.image_source || undefined,
        blurDataUrl: blurDataUrl || undefined,
      },
    });
  } catch (error) {
    console.error("Admin image API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
