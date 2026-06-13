import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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
const REMOTE_IMAGE_TOO_LARGE_ERROR = "Image too large (max 10MB)";

class RemoteImageTooLargeError extends Error {
  constructor() {
    super(REMOTE_IMAGE_TOO_LARGE_ERROR);
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function parseIpv4Octets(address: string): number[] | null {
  const octets = address.split(".");
  if (octets.length !== 4) return null;

  const parsed = octets.map((octet) => {
    if (!/^\d{1,3}$/.test(octet)) return Number.NaN;
    return Number(octet);
  });

  return parsed.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? parsed
    : null;
}

function isUnsafeIpv4(address: string): boolean {
  const octets = parseIpv4Octets(address);
  if (!octets) return false;

  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a >= 224 && a <= 239) ||
    a >= 240
  );
}

function firstIpv6Hextet(address: string): number | null {
  const [first] = address.split(":");
  if (!first || !/^[0-9a-f]{1,4}$/i.test(first)) return null;
  return parseInt(first, 16);
}

function isUnsafeIpv6(address: string): boolean {
  const host = normalizeHostname(address);
  const mappedIpv4 = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4) return isUnsafeIpv4(mappedIpv4[1]);

  if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }

  const first = firstIpv6Hextet(host);
  if (first === null) return false;

  return (
    (first >= 0xfc00 && first <= 0xfdff) ||
    (first >= 0xfe80 && first <= 0xfebf) ||
    (first >= 0xff00 && first <= 0xffff) ||
    host.startsWith("2001:db8:")
  );
}

function isUnsafeIpAddress(address: string): boolean {
  const host = normalizeHostname(address);
  const ipVersion = isIP(host);

  if (ipVersion === 4) return isUnsafeIpv4(host);
  if (ipVersion === 6) return isUnsafeIpv6(host);

  return false;
}

async function validateRemoteImageUrl(parsedUrl: URL): Promise<string | null> {
  if (parsedUrl.protocol !== "https:") {
    return "Only https:// URLs are allowed";
  }

  const hostname = normalizeHostname(parsedUrl.hostname);
  if (hostname === "localhost" || isUnsafeIpAddress(hostname)) {
    return "Private or reserved IP addresses are not allowed";
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isUnsafeIpAddress(address))) {
      return "Private or reserved IP addresses are not allowed";
    }
  } catch (error) {
    logger.warn("Could not validate remote image host:", {
      hostname,
      error: error instanceof Error ? error.message : String(error),
    });
    return "Remote image host could not be validated";
  }

  return null;
}

async function readRemoteImageBufferWithLimit(
  response: Response,
  maxBytes: number,
  abortFetch: () => void
): Promise<Buffer> {
  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      abortFetch();
      throw new RemoteImageTooLargeError();
    }
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        abortFetch();
        await reader.cancel().catch(() => undefined);
        throw new RemoteImageTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes
  );
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

      const remoteValidationError = await validateRemoteImageUrl(parsedUrl);
      if (remoteValidationError) {
        return NextResponse.json(
          { error: remoteValidationError },
          { status: 400 }
        );
      }

      imagePath = imageUrl;
      if (bodyImageSource && typeof bodyImageSource === "string") {
        imageSource = bodyImageSource;
      }

      // For external URLs, try to fetch and generate blur placeholder
      const fetchController = new AbortController();
      const fetchTimeout = setTimeout(() => {
        fetchController.abort();
      }, FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(imageUrl, {
          headers: { Accept: "image/*" },
          redirect: "manual",
          signal: fetchController.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          return NextResponse.json(
            { error: "Remote image redirects are not allowed" },
            { status: 400 }
          );
        }

        if (response.ok) {
          const contentLength = response.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > MAX_REMOTE_SIZE) {
            return NextResponse.json(
              { error: REMOTE_IMAGE_TOO_LARGE_ERROR },
              { status: 400 }
            );
          }
        }

        if (response.ok) {
          const imageBuffer = await readRemoteImageBufferWithLimit(
            response,
            MAX_REMOTE_SIZE,
            () => fetchController.abort()
          );

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
        if (fetchError instanceof RemoteImageTooLargeError) {
          return NextResponse.json(
            { error: fetchError.message },
            { status: 400 }
          );
        }

        // Non-fatal - just log and continue without blur placeholder
        logger.warn("Could not fetch external image for blur generation:", {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
      } finally {
        clearTimeout(fetchTimeout);
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
