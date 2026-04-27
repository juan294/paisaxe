import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  optimizeSingleImage,
  validateImageBuffer,
} from "@/lib/image-optimization";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Increase size limit since we're optimizing on server (10MB max)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REMOTE_SIZE = 10 * 1024 * 1024; // 10MB cap for fetched remote images
const FETCH_TIMEOUT_MS = 8_000;

/** Block private/loopback hostnames and IP ranges to prevent SSRF. */
function isPrivateHostname(hostname: string): boolean {
  // Strip IPv6 brackets: [::1] → ::1
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // Loopback names
  if (host === "localhost") return true;

  // IPv6 loopback
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;

  // IPv4: parse octets
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number);
    if (a === 127) return true;                               // 127.x.x.x loopback
    if (a === 10) return true;                                // 10.x.x.x private
    if (a === 172 && b >= 16 && b <= 31) return true;        // 172.16–31.x.x private
    if (a === 192 && b === 168) return true;                  // 192.168.x.x private
    if (a === 169 && b === 254) return true;                  // 169.254.x.x link-local
    if (a === 0) return true;                                 // 0.0.0.0/8 reserved
    if (a === 100 && b >= 64 && b <= 127) return true;       // 100.64–127.x CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true;    // 198.18–19.x benchmarking
    if (a === 203 && b === 0 && c === 113) return true;      // 203.0.113.x documentation
    if (a === 240) return true;                               // 240.x.x.x reserved
    if (a === 255) return true;                               // 255.255.255.255 broadcast
  }

  // IPv6 private/reserved prefixes
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // ULA fc00::/7
  if (host.startsWith("fe80")) return true;                         // link-local fe80::/10

  return false;
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
        logger.error("Upload error:", { error: uploadError.message });
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
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }

      // SSRF hardening: only allow https:// scheme
      if (parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Only https:// URLs are allowed" },
          { status: 400 }
        );
      }

      // SSRF hardening: block private/loopback IPs
      if (isPrivateHostname(parsedUrl.hostname)) {
        return NextResponse.json(
          { error: "Private or reserved IP addresses are not allowed" },
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
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (response.ok) {
          const contentLength = response.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > MAX_REMOTE_SIZE) {
            return NextResponse.json(
              { error: "Image too large (max 10MB)" },
              { status: 400 }
            );
          }
        }

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
        logger.warn("Could not fetch external image for blur generation:", {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
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
      logger.error("Update error:", { error: error.message });
      return NextResponse.json(
        { error: "Failed to update story image" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Revalidate the immersive page cache so image updates appear immediately
    revalidatePath("/immersive");

    return NextResponse.json({
      data: {
        id: data.id,
        image: imagePath,
        imageSource: data.image_source || undefined,
        blurDataUrl: blurDataUrl || undefined,
      },
    });
  } catch (error) {
    logger.error("Admin image API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
