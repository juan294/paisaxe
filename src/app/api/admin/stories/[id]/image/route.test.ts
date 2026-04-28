import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

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

describe("PUT /api/admin/stories/[id]/image", () => {
  const mockParams = { params: Promise.resolve({ id: "story-123" }) };

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not fetch external image for blur generation")
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
});
