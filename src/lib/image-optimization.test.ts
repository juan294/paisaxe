import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sharp module
const mockSharpInstance = {
  metadata: vi.fn(),
  resize: vi.fn().mockReturnThis(),
  avif: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  blur: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
};

const mockSharp = vi.fn(() => mockSharpInstance);

vi.mock("sharp", () => ({
  default: mockSharp,
}));

describe("image-optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockSharpInstance.metadata.mockResolvedValue({
      width: 2048,
      height: 1365,
      format: "jpeg",
    });

    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from("optimized"));
  });

  describe("FORMAT_SETTINGS", () => {
    it("should export format settings with appropriate quality values", async () => {
      const { FORMAT_SETTINGS } = await import("./image-optimization");

      expect(FORMAT_SETTINGS.avif.quality).toBe(68);
      expect(FORMAT_SETTINGS.webp.quality).toBe(80);
      expect(FORMAT_SETTINGS.jpeg.quality).toBe(82);
    });

    it("should have effort settings for compression speed balance", async () => {
      const { FORMAT_SETTINGS } = await import("./image-optimization");

      expect(FORMAT_SETTINGS.avif.effort).toBe(4);
      expect(FORMAT_SETTINGS.webp.effort).toBe(4);
    });

    it("should enable mozjpeg for better JPEG compression", async () => {
      const { FORMAT_SETTINGS } = await import("./image-optimization");

      expect(FORMAT_SETTINGS.jpeg.mozjpeg).toBe(true);
      expect(FORMAT_SETTINGS.jpeg.progressive).toBe(true);
    });
  });

  describe("IMAGE_SIZES", () => {
    it("should export target widths for responsive images", async () => {
      const { IMAGE_SIZES } = await import("./image-optimization");

      expect(IMAGE_SIZES).toEqual([640, 1200, 2048]);
    });
  });

  describe("generateBlurPlaceholder", () => {
    it("should generate a base64 webp data URL", async () => {
      const { generateBlurPlaceholder } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      const result = await generateBlurPlaceholder(inputBuffer);

      expect(result).toMatch(/^data:image\/webp;base64,/);
    });

    it("should resize to 32x32 with blur", async () => {
      const { generateBlurPlaceholder } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      await generateBlurPlaceholder(inputBuffer);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(32, 32, {
        fit: "inside",
      });
      expect(mockSharpInstance.blur).toHaveBeenCalledWith(5);
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 20 });
    });
  });

  describe("validateImageBuffer", () => {
    it("should return valid for supported formats", async () => {
      const { validateImageBuffer } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      mockSharpInstance.metadata.mockResolvedValue({
        format: "jpeg",
        width: 100,
        height: 100,
      });

      const result = await validateImageBuffer(inputBuffer);

      expect(result.valid).toBe(true);
      expect(result.format).toBe("jpeg");
    });

    it("should return invalid for unsupported formats", async () => {
      const { validateImageBuffer } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      mockSharpInstance.metadata.mockResolvedValue({
        format: "bmp",
        width: 100,
        height: 100,
      });

      const result = await validateImageBuffer(inputBuffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported format");
    });

    it("should return invalid when format cannot be detected", async () => {
      const { validateImageBuffer } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      mockSharpInstance.metadata.mockResolvedValue({
        format: undefined,
        width: 100,
        height: 100,
      });

      const result = await validateImageBuffer(inputBuffer);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Unable to detect image format");
    });

    it("should return invalid on sharp error", async () => {
      const { validateImageBuffer } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      mockSharpInstance.metadata.mockRejectedValue(new Error("Invalid image"));

      const result = await validateImageBuffer(inputBuffer);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid image");
    });
  });

  describe("selectVariantForWidth", () => {
    it("should select smallest variant that covers viewport", async () => {
      const { selectVariantForWidth } = await import("./image-optimization");

      expect(selectVariantForWidth(320)).toBe("avif-640");
      expect(selectVariantForWidth(640)).toBe("avif-640");
      expect(selectVariantForWidth(800)).toBe("avif-1200");
      expect(selectVariantForWidth(1200)).toBe("avif-1200");
      expect(selectVariantForWidth(1920)).toBe("avif-2048");
    });

    it("should fall back to largest size for very large viewports", async () => {
      const { selectVariantForWidth } = await import("./image-optimization");

      expect(selectVariantForWidth(3840)).toBe("avif-2048");
    });

    it("should respect format parameter", async () => {
      const { selectVariantForWidth } = await import("./image-optimization");

      expect(selectVariantForWidth(800, "webp")).toBe("webp-1200");
      expect(selectVariantForWidth(800, "jpeg")).toBe("jpeg-1200");
    });
  });

  // COVERAGE GAP: Lines 130-131 — JPEG branch in processVariant (untestable)
  //
  // Why untestable in vitest/jsdom:
  //   `processVariant` is a module-private function (not exported). It is only called
  //   by `optimizeImage` (which hardcodes "avif" and "webp" formats on lines 91 and 95)
  //   and is NOT used by `optimizeSingleImage` (which calls sharp directly).
  //   Therefore, the `case "jpeg":` branch (lines 129-131) cannot be reached through
  //   any public API. ESM does not expose non-exported bindings, so we cannot import
  //   `processVariant` directly in tests.
  //
  // Recommendations to cover this code:
  //   1. Export `processVariant` (makes it testable but exposes internal API), or
  //   2. Remove the JPEG case entirely (it is dead code), or
  //   3. Accept the gap — the branch is structurally identical to the avif/webp cases
  //      and is covered by analogy.

  describe("optimizeSingleImage", () => {
    it("should optimize to AVIF format", async () => {
      const { optimizeSingleImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      const result = await optimizeSingleImage(inputBuffer);

      expect(result.format).toBe("avif");
      expect(mockSharpInstance.avif).toHaveBeenCalled();
    });

    it("should generate blur placeholder", async () => {
      const { optimizeSingleImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      const result = await optimizeSingleImage(inputBuffer);

      expect(result.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    });

    it("should resize to specified max width", async () => {
      const { optimizeSingleImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      await optimizeSingleImage(inputBuffer, 1200);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1200, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    });

    it("should not upscale smaller images", async () => {
      const { optimizeSingleImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      // Image is only 800px wide
      mockSharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: "jpeg",
      });

      await optimizeSingleImage(inputBuffer, 2048);

      // Should resize to original width, not 2048
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(800, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    });
  });

  describe("optimizeImage", () => {
    it("should generate multiple variants", async () => {
      const { optimizeImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      const result = await optimizeImage(inputBuffer);

      // Should have variants for each size in both AVIF and WebP
      // For a 2048px image, should have all 3 sizes
      expect(result.variants.size).toBeGreaterThan(0);
    });

    it("should include blur placeholder in result", async () => {
      const { optimizeImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      const result = await optimizeImage(inputBuffer);

      expect(result.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    });

    it("should report original dimensions", async () => {
      const { optimizeImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      mockSharpInstance.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: "jpeg",
      });

      const result = await optimizeImage(inputBuffer);

      expect(result.originalWidth).toBe(1920);
      expect(result.originalHeight).toBe(1080);
    });

    it("should skip sizes larger than original", async () => {
      const { optimizeImage } = await import("./image-optimization");
      const inputBuffer = Buffer.from("test image");

      // Small image - only 500px wide
      mockSharpInstance.metadata.mockResolvedValue({
        width: 500,
        height: 400,
        format: "jpeg",
      });

      const result = await optimizeImage(inputBuffer);

      // Should not have any variants (all sizes > 500px)
      // Actually, with IMAGE_SIZES = [640, 1200, 2048], none would be generated
      // for a 500px image
      expect(result.variants.size).toBe(0);
    });
  });

  describe("estimateOptimizedSizes", () => {
    it("should return original size and estimates", async () => {
      const { estimateOptimizedSizes } = await import("./image-optimization");
      const inputBuffer = Buffer.alloc(1000000); // 1MB buffer

      const result = await estimateOptimizedSizes(inputBuffer);

      expect(result.original).toBe(1000000);
      expect(result.optimized.length).toBeGreaterThan(0);
    });

    it("should estimate smaller sizes for optimized variants", async () => {
      const { estimateOptimizedSizes } = await import("./image-optimization");
      const inputBuffer = Buffer.alloc(1000000); // 1MB buffer

      const result = await estimateOptimizedSizes(inputBuffer);

      // All estimates should be smaller than original
      for (const estimate of result.optimized) {
        expect(estimate.estimatedSize).toBeLessThan(result.original);
      }
    });

    it("should include both AVIF and WebP estimates", async () => {
      const { estimateOptimizedSizes } = await import("./image-optimization");
      const inputBuffer = Buffer.alloc(1000000);

      const result = await estimateOptimizedSizes(inputBuffer);

      const formats = new Set(result.optimized.map((e) => e.format));
      expect(formats.has("avif")).toBe(true);
      expect(formats.has("webp")).toBe(true);
    });

    it("should skip sizes larger than original width", async () => {
      const { estimateOptimizedSizes } = await import("./image-optimization");
      const inputBuffer = Buffer.alloc(500000);

      // Small image — only 800px wide
      mockSharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: "jpeg",
      });

      const result = await estimateOptimizedSizes(inputBuffer);

      // IMAGE_SIZES = [640, 1200, 2048] — only 640 is <= 800
      const widths = result.optimized.map((e) => e.width);
      expect(widths.every((w) => w <= 800)).toBe(true);
      expect(widths).toContain(640);
      expect(widths).not.toContain(1200);
      expect(widths).not.toContain(2048);
    });
  });
});
