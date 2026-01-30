/**
 * Image optimization utilities using Sharp
 *
 * This module provides server-side image optimization for uploaded images:
 * - Resize to multiple sizes for responsive images
 * - Convert to modern formats (AVIF, WebP) for better compression
 * - Generate blur placeholders for progressive loading
 *
 * Quality settings are optimized for photography/tourism imagery
 * where visual quality matters.
 */

import sharp from "sharp";

/**
 * Output formats and their quality settings
 * AVIF quality 68 ≈ JPEG quality 80-85 at ~50% file size
 * WebP quality 80 ≈ JPEG quality 80
 */
export const FORMAT_SETTINGS = {
  avif: {
    quality: 68,
    effort: 4, // Balance between speed and compression (0-9)
    chromaSubsampling: "4:2:0" as const,
  },
  webp: {
    quality: 80,
    effort: 4,
  },
  jpeg: {
    quality: 82,
    mozjpeg: true, // Better compression
    progressive: true,
  },
} as const;

/**
 * Target widths for responsive images
 * Mobile (640) -> Tablet (1200) -> Desktop (2048)
 */
export const IMAGE_SIZES = [640, 1200, 2048] as const;

export type ImageFormat = "avif" | "webp" | "jpeg";
export type ImageSize = (typeof IMAGE_SIZES)[number];

export interface OptimizedImage {
  buffer: Buffer;
  format: ImageFormat;
  width: number;
  height: number;
  size: number;
}

export interface ImageOptimizationResult {
  /** Optimized image variants keyed by `{format}-{width}` */
  variants: Map<string, OptimizedImage>;
  /** Base64 data URL for blur placeholder */
  blurDataUrl: string;
  /** Original image dimensions */
  originalWidth: number;
  originalHeight: number;
}

/**
 * Optimize an image buffer for web delivery
 *
 * Creates multiple size variants in AVIF and WebP formats,
 * plus a blur placeholder for progressive loading.
 *
 * @param inputBuffer - Raw image buffer (JPEG, PNG, WebP, or GIF)
 * @returns Optimized variants and blur placeholder
 */
export async function optimizeImage(
  inputBuffer: Buffer
): Promise<ImageOptimizationResult> {
  // Get original dimensions
  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width || 2048;
  const originalHeight = metadata.height || 1365;

  // Generate blur placeholder first (fast operation)
  const blurDataUrl = await generateBlurPlaceholder(inputBuffer);

  // Generate all variants
  const variants = new Map<string, OptimizedImage>();

  for (const targetWidth of IMAGE_SIZES) {
    // Skip sizes larger than original to avoid upscaling
    if (targetWidth > originalWidth) continue;

    // Generate AVIF variant
    const avifResult = await processVariant(inputBuffer, targetWidth, "avif");
    variants.set(`avif-${targetWidth}`, avifResult);

    // Generate WebP variant (fallback for older browsers)
    const webpResult = await processVariant(inputBuffer, targetWidth, "webp");
    variants.set(`webp-${targetWidth}`, webpResult);
  }

  return {
    variants,
    blurDataUrl,
    originalWidth,
    originalHeight,
  };
}

/**
 * Process a single image variant
 */
async function processVariant(
  inputBuffer: Buffer,
  targetWidth: number,
  format: ImageFormat
): Promise<OptimizedImage> {
  let pipeline = sharp(inputBuffer).resize(targetWidth, null, {
    withoutEnlargement: true,
    fit: "inside",
  });

  let buffer: Buffer;

  switch (format) {
    case "avif":
      buffer = await pipeline.avif(FORMAT_SETTINGS.avif).toBuffer();
      break;
    case "webp":
      buffer = await pipeline.webp(FORMAT_SETTINGS.webp).toBuffer();
      break;
    case "jpeg":
      buffer = await pipeline.jpeg(FORMAT_SETTINGS.jpeg).toBuffer();
      break;
  }

  const resultMetadata = await sharp(buffer).metadata();

  return {
    buffer,
    format,
    width: resultMetadata.width || targetWidth,
    height: resultMetadata.height || 0,
    size: buffer.length,
  };
}

/**
 * Generate a blur placeholder data URL
 *
 * Creates a tiny (32x32) blurred version of the image,
 * encoded as a base64 WebP data URL.
 */
export async function generateBlurPlaceholder(
  inputBuffer: Buffer
): Promise<string> {
  const blurredBuffer = await sharp(inputBuffer)
    .resize(32, 32, { fit: "inside" })
    .blur(5) // Gaussian blur
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${blurredBuffer.toString("base64")}`;
}

/**
 * Optimize a single image to the primary display format
 *
 * Use this for quick optimization when you don't need multiple variants.
 * Returns an optimized AVIF at 2048px width (or original if smaller).
 */
export async function optimizeSingleImage(
  inputBuffer: Buffer,
  maxWidth: number = 2048
): Promise<{ buffer: Buffer; format: ImageFormat; blurDataUrl: string }> {
  const metadata = await sharp(inputBuffer).metadata();
  const targetWidth = Math.min(maxWidth, metadata.width || maxWidth);

  const optimized = await sharp(inputBuffer)
    .resize(targetWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    })
    .avif(FORMAT_SETTINGS.avif)
    .toBuffer();

  const blurDataUrl = await generateBlurPlaceholder(inputBuffer);

  return {
    buffer: optimized,
    format: "avif",
    blurDataUrl,
  };
}

/**
 * Get the best variant key for a given viewport width
 *
 * Used to select which pre-generated variant to serve.
 */
export function selectVariantForWidth(
  viewportWidth: number,
  format: ImageFormat = "avif"
): string {
  // Find the smallest size that covers the viewport
  for (const size of IMAGE_SIZES) {
    if (size >= viewportWidth) {
      return `${format}-${size}`;
    }
  }
  // Fall back to largest size
  return `${format}-${IMAGE_SIZES[IMAGE_SIZES.length - 1]}`;
}

/**
 * Validate that a buffer is a supported image format
 */
export async function validateImageBuffer(
  buffer: Buffer
): Promise<{ valid: boolean; format?: string; error?: string }> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.format) {
      return { valid: false, error: "Unable to detect image format" };
    }

    const supportedFormats = ["jpeg", "png", "webp", "gif", "avif", "tiff"];
    if (!supportedFormats.includes(metadata.format)) {
      return {
        valid: false,
        error: `Unsupported format: ${metadata.format}. Supported: ${supportedFormats.join(", ")}`,
      };
    }

    return { valid: true, format: metadata.format };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid image data",
    };
  }
}

/**
 * Calculate estimated file sizes for optimization preview
 *
 * Useful for showing users the expected savings before upload.
 */
export async function estimateOptimizedSizes(
  inputBuffer: Buffer
): Promise<{
  original: number;
  optimized: { format: ImageFormat; width: number; estimatedSize: number }[];
}> {
  const estimates: { format: ImageFormat; width: number; estimatedSize: number }[] = [];
  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width || 2048;

  for (const width of IMAGE_SIZES) {
    if (width > originalWidth) continue;

    // AVIF typically achieves 50-60% of WebP size
    // WebP typically achieves 70-80% of JPEG size
    // These are rough estimates based on photography content
    const scaleFactor = width / originalWidth;
    const pixelReduction = scaleFactor * scaleFactor;

    estimates.push({
      format: "avif",
      width,
      estimatedSize: Math.round(inputBuffer.length * pixelReduction * 0.15),
    });

    estimates.push({
      format: "webp",
      width,
      estimatedSize: Math.round(inputBuffer.length * pixelReduction * 0.25),
    });
  }

  return {
    original: inputBuffer.length,
    optimized: estimates,
  };
}
