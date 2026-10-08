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

vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:https")>();
  const { EventEmitter } = await import("node:events");
  const { Readable } = await import("node:stream");
  const mockRequest = (url: URL, options: import("node:https").RequestOptions, respond: (response: import("node:http").IncomingMessage) => void) => {
    const req = Object.assign(new EventEmitter(), {
      end() {
        options.lookup!(url.hostname, {}, (error) => {
          if (error) req.destroy(error);
          else {
            const response = Object.assign(Readable.from([Buffer.from("image fixture")]), {
              statusCode: 200,
              headers: { "content-type": "image/jpeg" },
            });
            respond(response as import("node:http").IncomingMessage);
            response.on("end", () => req.emit("close"));
          }
        });
      },
      destroy(error: Error) { req.emit("error", error); req.emit("close"); return req; },
    });
    return req;
  };
  return { ...actual, request: mockRequest, default: { request: mockRequest } };
});

// Mock dependencies
vi.mock("@/lib/supabase-admin", () => ({
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

import { createAdminClient } from "@/lib/supabase-admin";
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
      expect(mockUpdate).toHaveBeenCalledWith({ image_path: "https://example.com/new-image.jpg", blur_data_url: "data:image/webp;base64,mockblur" });
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
        blur_data_url: "data:image/webp;base64,mockblur",
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
        blur_data_url: "data:image/webp;base64,mockblur",
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
        blur_data_url: "data:image/webp;base64,mockblur",
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
      const { mockUpload, mockGetPublicUrl, mockUpdate } = setupStorageMocks();
      const denied = await PUT(createJsonImageRequest("https://127.0.0.1/private.jpg"), mockParams);
      expect(denied.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();

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

  describe("remote import denial and recovery", () => {
    it.each(["::ffff:7f00:1", "::ffff:93.184.216.34", "10.0.0.5", "fe80::1"])("rejects unsafe DNS answer %s without a write, then accepts a valid retry", async (address) => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpdate } = setupStoryUpdateMock();
      dns.lookup.mockResolvedValueOnce([{ address, family: address.includes(":") ? 6 : 4 }]);
      const denied = await PUT(createJsonImageRequest("https://cdn.example.com/image.jpg"), mockParams);
      expect(denied.status).toBe(400);
      expect((await denied.json()).error).toBe("Private or reserved IP addresses are not allowed");
      expect(mockUpdate).not.toHaveBeenCalled();
      const retry = await PUT(createJsonImageRequest("https://cdn.example.com/image.jpg"), mockParams);
      expect(retry.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledOnce();
    });

    it.each(["http://example.com/a.jpg", "ftp://example.com/a.jpg", "https://127.0.0.1/a.jpg", "https://[::1]/a.jpg", "https://localhost/a.jpg"])("rejects forbidden URL %s without DNS or a write", async (url) => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpdate } = setupStoryUpdateMock();
      const response = await PUT(createJsonImageRequest(url), mockParams);
      expect(response.status).toBe(400);
      expect(dns.lookup).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects invalid image bytes without saving the URL, then accepts a valid retry", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      const { mockUpdate } = setupStoryUpdateMock();
      vi.mocked(validateImageBuffer).mockResolvedValueOnce({ valid: false, error: "Corrupt image data" });
      const response = await PUT(createJsonImageRequest("https://example.com/a.jpg"), mockParams);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Corrupt image data");
      expect(mockUpdate).not.toHaveBeenCalled();
      expect((await PUT(createJsonImageRequest("https://example.com/a.jpg"), mockParams)).status).toBe(200);
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

});
