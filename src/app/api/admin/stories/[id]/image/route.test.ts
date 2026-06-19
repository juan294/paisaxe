import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

const dns = vi.hoisted(() => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("node:dns/promises", () => ({
  default: { lookup: dns.lookup },
  lookup: dns.lookup,
}));

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock image optimization
vi.mock("@/lib/image-optimization", () => ({
  optimizeSingleImage: vi.fn().mockResolvedValue({
    buffer: Buffer.from("optimized image"),
    format: "avif",
    blurDataUrl: "data:image/webp;base64,mockblur",
  }),
  validateImageBuffer: vi.fn().mockResolvedValue({
    valid: true,
    format: "jpeg",
  }),
  generateBlurPlaceholder: vi.fn().mockResolvedValue("data:image/webp;base64,mockblur"),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { validateImageBuffer } from "@/lib/image-optimization";

/**
 * Create a mock File object with arrayBuffer() method for Node.js test environment.
 * The native File object in jsdom doesn't have arrayBuffer() like browser File API.
 */
function createMockFile(content: string | Uint8Array, name: string, type: string): File {
  const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const blob = new Blob([data as BlobPart], { type });

  // Create a File-like object with arrayBuffer method
  const file = new File([blob], name, { type });

  // Create a proper ArrayBuffer from the Uint8Array data
  const arrayBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(arrayBuffer).set(data);

  // Manually add arrayBuffer method since jsdom File doesn't have it
  (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async (): Promise<ArrayBuffer> => {
    return arrayBuffer;
  };

  return file;
}

function setupStoryUpdateMock(imagePath = "https://example.com/image.jpg") {
  const mockSingle = vi.fn().mockResolvedValue({
    data: { id: "story-123", image_path: imagePath, image_source: null },
    error: null,
  });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

  vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

  return { mockUpdate };
}

function createJsonImageRequest(imageUrl: string) {
  return new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });
}

describe("PUT /api/admin/stories/[id]/image", () => {
  const mockParams = { params: Promise.resolve({ id: "story-123" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    dns.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  describe("authentication", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("should return 400 when story ID is empty", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories//image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Story ID is required");
    });
  });

  describe("URL-based image update", () => {
    it("should update image with valid URL", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/new-image.jpg" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/new-image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.image).toBe("https://example.com/new-image.jpg");
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://example.com/new-image.jpg" });
    });

    it("should return 400 when imageUrl is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("imageUrl is required");
    });

    it("should return 400 when imageUrl is not a string", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: 123 }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("imageUrl is required");
    });

    it("should return 400 for invalid URL format", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "not-a-valid-url" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid URL format");
    });
  });

  describe("URL-based image update with imageSource", () => {
    it("should include imageSource in update when provided", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/img.jpg", image_source: "unsplash" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/img.jpg", imageSource: "unsplash" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.imageSource).toBe("unsplash");
      expect(mockUpdate).toHaveBeenCalledWith({
        image_path: "https://example.com/img.jpg",
        image_source: "unsplash",
      });
    });

    it("should not include imageSource when not provided", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/img.jpg" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/img.jpg" }),
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        image_path: "https://example.com/img.jpg",
      });
    });

    it("should not include imageSource when it is not a string", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/img.jpg" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/img.jpg", imageSource: 123 }),
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        image_path: "https://example.com/img.jpg",
      });
    });
  });

  describe("FormData file upload", () => {
    const setupStorageMocks = (uploadError: { message: string } | null = null) => {
      const mockUpload = vi.fn().mockResolvedValue({ error: uploadError });
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: "https://storage.example.com/story-123-12345.avif" },
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://storage.example.com/story-123-12345.avif", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({
        from: mockFrom,
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      } as never);

      return { mockUpload, mockGetPublicUrl, mockUpdate, mockFrom };
    };

    // Helper: create a NextRequest with multipart content-type and a mocked formData() method
    const createFormDataRequest = (formData: FormData) => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "multipart/form-data; boundary=----formdata" },
      });
      // Override formData() to avoid jsdom/Node timeout issues with actual FormData bodies
      vi.spyOn(request, "formData").mockResolvedValue(formData);
      return request;
    };

    it("should upload file successfully with optimization", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpload, mockGetPublicUrl } = setupStorageMocks();

      const formData = new FormData();
      const mockFile = createMockFile("image content", "test.jpg", "image/jpeg");
      formData.append("file", mockFile);

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockUpload).toHaveBeenCalled();
      expect(mockGetPublicUrl).toHaveBeenCalled();
      // Now outputs AVIF instead of original format
      expect(data.data.image).toBe("https://storage.example.com/story-123-12345.avif");
      // Should also have blur placeholder
      expect(data.data.blurDataUrl).toBe("data:image/webp;base64,mockblur");
    });

    it("should return 400 when no file in FormData", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      setupStorageMocks();

      const formData = new FormData();
      // No file appended

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("File is required for upload");
    });

    it("should return 400 for invalid file type", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      setupStorageMocks();

      const formData = new FormData();
      const mockFile = createMockFile("content", "test.txt", "text/plain");
      formData.append("file", mockFile);

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      // Now includes AVIF in the allowed list
      expect(data.error).toBe("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF");
    });

    it("should return 400 for oversized file (over 10MB)", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      setupStorageMocks();

      const formData = new FormData();
      // Create a file > 10MB (the new limit)
      const largeContent = new Uint8Array(11 * 1024 * 1024);
      const mockFile = createMockFile(largeContent, "large.jpg", "image/jpeg");
      formData.append("file", mockFile);

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      // New limit is 10MB
      expect(data.error).toBe("File too large. Maximum size is 10MB");
    });

    it("should return 400 for invalid image data", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      setupStorageMocks();

      // Mock validateImageBuffer to return invalid
      vi.mocked(validateImageBuffer).mockResolvedValueOnce({
        valid: false,
        error: "Corrupt image data",
      });

      const formData = new FormData();
      const mockFile = createMockFile("corrupt data", "test.jpg", "image/jpeg");
      formData.append("file", mockFile);

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Corrupt image data");
    });

    it("should return default error message when validation fails without error text", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      setupStorageMocks();

      // Mock validateImageBuffer to return invalid without error message
      vi.mocked(validateImageBuffer).mockResolvedValueOnce({
        valid: false,
      });

      const formData = new FormData();
      const mockFile = createMockFile("corrupt data", "test.jpg", "image/jpeg");
      formData.append("file", mockFile);

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid image data");
    });

    it("should return 500 on storage upload error", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      setupStorageMocks({ message: "Storage error" });

      const formData = new FormData();
      const mockFile = createMockFile("image content", "test.jpg", "image/jpeg");
      formData.append("file", mockFile);

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to upload image");
    });

    it("should include imageSource from FormData when provided", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpdate } = setupStorageMocks();

      const formData = new FormData();
      const mockFile = createMockFile("image content", "test.png", "image/png");
      formData.append("file", mockFile);
      formData.append("imageSource", "photographer-credit");

      const request = createFormDataRequest(formData);
      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ image_source: "photographer-credit" })
      );
    });
  });

  describe("external URL blur placeholder generation", () => {
    it("should generate blur placeholder when fetching external image succeeds", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/image.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      // Mock global fetch for external image
      const mockImageBuffer = new ArrayBuffer(8);
      const mockFetchResponse = {
        ok: true,
        headers: new Headers({}), // no content-length → no size rejection
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse as unknown as Response);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
        expect.objectContaining({
          headers: { Accept: "image/*" },
          signal: expect.anything(),
        })
      );

      // Should include blur_data_url in update
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ blur_data_url: "data:image/webp;base64,mockblur" })
      );

      fetchSpy.mockRestore();
    });

    it("should skip blur generation when external image fetch fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/image.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      // Mock fetch to throw
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      // Route uses pino logger.warn (not console.warn)
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Could not fetch external image for blur generation"),
        expect.anything()
      );

      // Should NOT include blur_data_url in update since fetch failed
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://example.com/image.jpg" });

      fetchSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("should skip blur generation when external image response is not ok", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/image.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      // Mock fetch to return non-ok response
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      // Should NOT include blur_data_url
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://example.com/image.jpg" });

      fetchSpy.mockRestore();
    });

    it("should skip blur generation when image validation fails for external image", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/image.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      // Mock validateImageBuffer to return invalid for this test
      vi.mocked(validateImageBuffer).mockResolvedValueOnce({
        valid: false,
        error: "Not a valid image",
      });

      // Mock fetch to return ok response with image data
      const mockImageBuffer = new ArrayBuffer(8);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({}),
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
      } as unknown as Response);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      // Should NOT include blur_data_url since validation failed
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://example.com/image.jpg" });

      fetchSpy.mockRestore();
    });
  });

  describe("SE-M1: SSRF hardening on external imageUrl", () => {
    it("should return 400 when imageUrl uses http:// (non-https scheme)", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "http://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Only https:// URLs are allowed");
    });

    it("should return 400 when imageUrl uses ftp:// scheme", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "ftp://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Only https:// URLs are allowed");
    });

    it("should return 400 when imageUrl points to loopback 127.0.0.1", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://127.0.0.1/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should return 400 when imageUrl points to localhost", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://localhost/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should return 400 when imageUrl points to 10.x private range", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://10.0.0.1/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should return 400 when imageUrl points to 172.16.x private range", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://172.16.0.1/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should return 400 when imageUrl points to 192.168.x private range", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://192.168.1.1/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should return 400 when imageUrl points to IPv6 loopback ::1", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://[::1]/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it.each([
      "https://169.254.169.254/latest/meta-data",
      "https://100.64.0.1/image.jpg",
      "https://192.0.2.10/image.jpg",
      "https://198.51.100.10/image.jpg",
      "https://224.0.0.1/image.jpg",
    ])("should return 400 for private, link-local, multicast, or reserved IP literal %s", async (imageUrl) => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should reject a public hostname when DNS resolves to a private IP before fetch", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      dns.lookup.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://cdn.example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
      expect(dns.lookup).toHaveBeenCalledWith("cdn.example.com", { all: true, verbatim: true });
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("should reject a public hostname when any DNS answer is private before fetch", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      dns.lookup.mockResolvedValueOnce([
        { address: "93.184.216.34", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ]);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({}),
        body: new ReadableStream<Uint8Array>(),
      } as unknown as Response);

      const response = await PUT(
        createJsonImageRequest("https://cdn.example.com/image.jpg"),
        mockParams
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("should reject external image URLs when hostname DNS validation fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      dns.lookup.mockRejectedValueOnce(new Error("ENOTFOUND"));
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://missing.example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Remote image host could not be validated");
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("should disable automatic redirects and reject redirect responses when fetching external images for blur generation", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpdate } = setupStoryUpdateMock();

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 302,
        headers: new Headers({ location: "https://127.0.0.1/private.jpg" }),
      } as Response);

      const response = await PUT(
        createJsonImageRequest("https://example.com/image.jpg"),
        mockParams
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Remote image redirects are not allowed");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
        expect.objectContaining({ redirect: "manual" })
      );
      expect(mockUpdate).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("should reject oversized streamed image bodies when content-length is missing", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpdate } = setupStoryUpdateMock();

      const chunk = new Uint8Array(1024 * 1024);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < 11; i += 1) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({}),
        body: stream,
        arrayBuffer: vi.fn().mockRejectedValue(new Error("arrayBuffer should not be used")),
      } as unknown as Response);

      const response = await PUT(
        createJsonImageRequest("https://example.com/streamed-huge.jpg"),
        mockParams
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Image too large (max 10MB)");
      expect(mockUpdate).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("SE-M1: fetch with timeout — response body too large (>10MB content-length) is rejected at 400", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      // Mock fetch to return a response with large content-length
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": String(11 * 1024 * 1024) }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      } as unknown as Response);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/huge.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Image too large (max 10MB)");

      fetchSpy.mockRestore();
    });

    it("SE-M1: fetch is called with AbortSignal timeout for external URLs", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/image.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "100" }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as Response);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      await PUT(request, mockParams);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
        expect.objectContaining({
          signal: expect.anything(),
        })
      );

      fetchSpy.mockRestore();
    });

    it.each([
      ["fc00::1", "fc00::/7 private"],
      ["fe80::1", "fe80::/10 link-local"],
      ["ff02::1", "ff00::/8 multicast"],
    ])("should return 400 for IPv6 %s (%s) literal URL (covers firstIpv6Hextet + isUnsafeIpv6 branches)", async (ipv6, _label) => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: `https://[${ipv6}]/image.jpg` }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it.each([
      ["::ffff:10.0.0.1", "private class A"],
      ["::ffff:192.168.1.1", "private class C"],
      ["::ffff:127.0.0.1", "loopback"],
    ])("should return 400 when DNS resolves to IPv6-mapped IPv4 %s (%s) — covers isUnsafeIpv6 line 71", async (address, _label) => {
      // Line 71 is reached via DNS path: DNS can return IPv4-mapped IPv6 in decimal form
      // (::ffff:10.0.0.1), which the URL parser does NOT normalize. isUnsafeIpv6 regex matches.
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      dns.lookup.mockResolvedValueOnce([{ address, family: 6 }]);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://cdn.example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    // parseIpv4Octets lines 35, 38, 42-44 are architecturally unreachable through this route:
    // isUnsafeIpv4 is only called (a) from isUnsafeIpAddress when isIP returns 4 (guaranteeing
    // valid 4-octet address), and (b) from the ::ffff: DNS regex match which enforces digit-only
    // octets. There is no code path that feeds an invalid string to parseIpv4Octets.
    // Similarly, isUnsafeIpv4 line 49 (`if (!octets) return false`) is unreachable for the
    // same reason — parseIpv4Octets always returns a valid array when called from this route.

    it("should return 400 when DNS resolves to 0.x.x.x (isUnsafeIpv4 a===0 branch, line 53)", async () => {
      // Line 53: `a === 0 ||` — the 0.0.0.0/8 block is reserved per RFC 1122 section 3.2.1.3.
      // DNS returning 0.0.0.1 is the only way to exercise this branch.
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      dns.lookup.mockResolvedValueOnce([{ address: "0.0.0.1", family: 4 }]);

      const request = createJsonImageRequest("https://cdn.example.com/image.jpg");
      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Private or reserved IP addresses are not allowed");
    });

    it("should allow URL when DNS resolves to non-private IPv6 (covers firstIpv6Hextet null return path)", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      // "::2" is not in any blocked range: firstIpv6Hextet returns null (empty first hextet)
      // so isUnsafeIpv6 returns false, and the address is allowed through DNS check
      dns.lookup.mockResolvedValueOnce([{ address: "::2", family: 6 }]);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://cdn.example.com/image.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://cdn.example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://cdn.example.com/image.jpg" });

      fetchSpy.mockRestore();
    });
  });

  describe("content-type fallback", () => {
    it("should default to empty string when content-type header is missing and handle body parsing error", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn() } as never);

      // Request with NO body — content-type is null, triggering || "" fallback
      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        // No body, no content-type => content-type is null => falls to "" via || ""
      });

      const response = await PUT(request, mockParams);

      // Falls into the JSON path (non-multipart), request.json() throws => caught by outer catch
      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe("Internal server error");
    });
  });

  describe("database errors", () => {
    it("should return 404 when story not found", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/nonexistent/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "nonexistent" }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Story not found");
    });

    it("should return 500 when database update fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update story image");
    });

    it("should return 500 on unexpected error", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("Unexpected");
      });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
      });

      const response = await PUT(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  it("should use logger.error (not console.error) on unhandled PUT error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected DB failure");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/image", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrl: "https://example.com/image.jpg" }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "story-123" }) });
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  describe("readRemoteImageBufferWithLimit — uncovered paths (lines 140, 168-169)", () => {
    // Line 140: response has no body stream (!response.body) but arrayBuffer.byteLength > maxBytes.
    // The RemoteImageTooLargeError is thrown from the no-body branch.
    // In Vitest's ESM environment, the instanceof check in the catch block correctly identifies
    // the error, but requires the DB mock to be set up so the route can reach that return point.
    it("rejects when response body is null and arrayBuffer exceeds the 10MB limit (line 140)", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      // Set up DB mock — required so the route doesn't fail with TypeError when supabase is undefined
      // in case the non-fatal path is taken (covers both instanceof success and failure outcomes).
      const { mockUpdate } = setupStoryUpdateMock("https://example.com/huge-no-stream.jpg");

      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB > MAX_REMOTE_SIZE (10MB)
      const arrayBufferMock = vi.fn().mockResolvedValue(largeBuffer);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({}),
        body: null, // no body stream → falls into `if (!response.body)` branch
        arrayBuffer: arrayBufferMock,
      } as unknown as Response);

      const request = createJsonImageRequest("https://example.com/huge-no-stream.jpg");
      const response = await PUT(request, mockParams);

      // Verify that response.arrayBuffer() was called — confirming line 140 was reached
      expect(arrayBufferMock).toHaveBeenCalled();

      // RemoteImageTooLargeError is thrown at line 140 and caught by the inner catch.
      // The instanceof check returns true → route returns 400 without reaching the DB update.
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Image too large (max 10MB)");
      expect(mockUpdate).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    // Lines 168-169: response.body is a ReadableStream that reads within the size limit
    // (normal successful streaming path — return Buffer.concat(...))
    it("reads streamed response body within size limit and generates blur (lines 168-169)", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", image_path: "https://example.com/small.jpg", image_source: null },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const smallChunk = new Uint8Array(8); // 8 bytes — well within 10MB limit
      const bodyStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(smallChunk);
          controller.close();
        },
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({}),
        body: bodyStream, // has a body stream → uses reader path
      } as unknown as Response);

      const request = createJsonImageRequest("https://example.com/small.jpg");
      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      // validateImageBuffer mock returns valid: true, so blur should be generated
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ blur_data_url: "data:image/webp;base64,mockblur" })
      );

      fetchSpy.mockRestore();
    });
  });

  describe("fetch timeout abort callback (line 322)", () => {
    // Line 322: `fetchController.abort()` inside the setTimeout callback that fires
    // after FETCH_TIMEOUT_MS (8000ms) when the external image fetch hangs.
    it("aborts the external image fetch after 8 seconds timeout (line 322)", async () => {
      vi.useFakeTimers();
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const { mockUpdate } = setupStoryUpdateMock("https://example.com/slow.jpg");

      // Mock fetch to hang until the signal is aborted, then reject
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = (options as RequestInit)?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The user aborted a request.", "AbortError"));
            });
          }
        });
      });

      const request = createJsonImageRequest("https://example.com/slow.jpg");
      const responsePromise = PUT(request, mockParams);

      // Advance past FETCH_TIMEOUT_MS (8000ms) — the setTimeout fires and calls
      // fetchController.abort() (line 322), which triggers the AbortSignal event,
      // which rejects our mocked fetch with an AbortError.
      await vi.advanceTimersByTimeAsync(8001);

      const response = await responsePromise;

      // Abort during blur generation is non-fatal — route continues to DB update
      expect(response.status).toBe(200);
      // No blur placeholder since fetch was aborted before buffer was read
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://example.com/slow.jpg" });
      // The abort error is logged as a warning (non-fatal path)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Could not fetch external image for blur generation"),
        expect.anything()
      );

      fetchSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe("V8 sub-expression gap closers", () => {
    describe("isUnsafeIpv6 — first hextet below 0xfc00 (line 88 left-AND short-circuit)", () => {
      // Line 88: `(first >= 0xfc00 && first <= 0xfdff) ||`
      // When first < 0xfc00, the left operand of `&&` is FALSE and the entire sub-expression
      // short-circuits on the left side (not the right). All existing tests have first >= 0xfc00.
      // A public IPv6 like 2001::1 (first=0x2001) exercises the left-side-false path.
      it("allows URL when DNS resolves to public IPv6 with first hextet < 0xfc00", async () => {
        vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
        dns.lookup.mockResolvedValueOnce([{ address: "2001::1", family: 6 }]);
        setupStoryUpdateMock("https://cdn.example.com/image.jpg");
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

        const request = createJsonImageRequest("https://cdn.example.com/image.jpg");
        const response = await PUT(request, mockParams);

        expect(response.status).toBe(200);

        fetchSpy.mockRestore();
      });
    });

    describe("validateRemoteImageUrl DNS catch — String(error) branch (line 123)", () => {
      // Line 123: `error: error instanceof Error ? error.message : String(error),`
      // Existing test rejects with `new Error("ENOTFOUND")` which always takes the
      // `error.message` arm. Rejecting with a plain string covers String(error).
      it("uses String(error) when DNS lookup rejects with a non-Error value", async () => {
        vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
        dns.lookup.mockRejectedValueOnce("ENOTFOUND_string");

        const request = createJsonImageRequest("https://unknown.cdn.example.com/image.jpg");
        const response = await PUT(request, mockParams);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Remote image host could not be validated");
        expect(logger.warn).toHaveBeenCalledWith(
          "Could not validate remote image host:",
          expect.objectContaining({ error: "ENOTFOUND_string" })
        );
      });
    });

    describe("readRemoteImageBufferWithLimit — undefined chunk skipped (line 153)", () => {
      // Line 153: `if (!value) continue;`
      // The standard ReadableStream never yields a falsy chunk value between done=false reads,
      // but the guard exists for defensive correctness. Exercise it with a custom reader stub.
      it("skips undefined values yielded by the stream reader before reading real chunks", async () => {
        vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
        setupStoryUpdateMock("https://example.com/chunky.jpg");

        let step = 0;
        const customBody = {
          getReader: () => ({
            read: async () => {
              step++;
              if (step === 1) return { done: false as const, value: undefined as unknown as Uint8Array };
              if (step === 2) return { done: false as const, value: new Uint8Array(4) };
              return { done: true as const, value: undefined as unknown as Uint8Array };
            },
            releaseLock: () => {},
          }),
        };

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({}),
          body: customBody as unknown as ReadableStream<Uint8Array>,
        } as unknown as Response);

        const request = createJsonImageRequest("https://example.com/chunky.jpg");
        const response = await PUT(request, mockParams);

        expect(response.status).toBe(200);

        fetchSpy.mockRestore();
      });
    });

    describe("outer catch block — String(error) branch (line 429)", () => {
      // Line 429: `logger.error("Admin image API error:", { error: error instanceof Error ? error.message : String(error) })`
      // The existing "content-type fallback" test throws a SyntaxError (instanceof Error),
      // always taking the `error.message` arm. Throwing a plain string covers String(error).
      it("uses String(error) when a non-Error value is thrown inside the main try block", async () => {
        vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
        vi.mocked(createAdminClient).mockImplementationOnce(() => {
          throw "plain-string-thrown";
        });

        const request = createJsonImageRequest("https://example.com/image.jpg");
        const response = await PUT(request, mockParams);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Internal server error");
        expect(logger.error).toHaveBeenCalledWith(
          "Admin image API error:",
          expect.objectContaining({ error: "plain-string-thrown" })
        );
      });
    });
  });
});
