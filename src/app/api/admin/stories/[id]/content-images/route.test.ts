import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";

const mockImages = [
  {
    path: "https://supabase.co/storage/v1/object/public/pdf-images/test-pdf/test-pdf_page1_img_p0_1.png",
    caption: "Beautiful landscape",
    source_pdf: "test-pdf.pdf",
    page_number: 1,
  },
  {
    path: "https://supabase.co/storage/v1/object/public/pdf-images/test-pdf/test-pdf_page2_img_p1_1.png",
    caption: "Mountain view",
    source_pdf: "test-pdf.pdf",
    page_number: 2,
  },
  {
    path: "https://supabase.co/storage/v1/object/public/pdf-images/test-pdf/test-pdf_page3_full.png",
    caption: "City panorama",
    source_pdf: "test-pdf.pdf",
    page_number: 3,
  },
];

// Helper to create mock Supabase client with configurable behavior
function createMockSupabase(options: {
  story?: { id: string; title: string; source_pdf: string | null } | null;
  storyError?: { message: string } | null;
  chunks?: { page_number: number }[];
  chunksError?: { message: string } | null;
  images?: typeof mockImages;
  imagesError?: { message: string } | null;
}) {
  const { story, storyError, chunks = [], chunksError, images = [], imagesError } = options;

  // Mock for images query
  const imagesResult = Promise.resolve({
    data: imagesError ? null : images,
    error: imagesError || null,
  });
  const mockImagesIn = vi.fn().mockReturnValue(imagesResult);
  const mockImagesEq = vi.fn().mockReturnValue({ in: mockImagesIn });
  const mockImagesSelect = vi.fn().mockReturnValue({ eq: mockImagesEq });

  // Mock for chunks query
  const chunksResult = Promise.resolve({
    data: chunksError ? null : chunks,
    error: chunksError || null,
  });
  const mockChunksIlike = vi.fn().mockReturnValue(chunksResult);
  const mockChunksEq = vi.fn().mockReturnValue({ ilike: mockChunksIlike });
  const mockChunksSelect = vi.fn().mockReturnValue({ eq: mockChunksEq });

  // Mock for story query
  const mockStorySingle = vi.fn().mockResolvedValue({
    data: story,
    error: storyError || null,
  });
  const mockStoryEq = vi.fn().mockReturnValue({ single: mockStorySingle });
  const mockStorySelect = vi.fn().mockReturnValue({ eq: mockStoryEq });

  // Track which table is being queried
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "stories") {
      return { select: mockStorySelect };
    } else if (table === "chunks") {
      return { select: mockChunksSelect };
    } else if (table === "images") {
      return { select: mockImagesSelect };
    }
    return { select: vi.fn() };
  });

  return { from: mockFrom };
}

describe("GET /api/admin/stories/[id]/content-images", () => {
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

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);

      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("should return 400 when story ID is empty", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest("http://localhost:3000/api/admin/stories//content-images");
      const response = await GET(request, { params: Promise.resolve({ id: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Story ID is required");
    });
  });

  describe("chunk-based filtering", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    });

    it("should only return images from pages where story title is mentioned", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Catedral de Oviedo", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: 3 },
        ],
        images: mockImages.filter(img => [1, 3].includes(img.page_number)),
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(2);
      expect(data.data.images.every((img: { pageNumber: number }) => [1, 3].includes(img.pageNumber))).toBe(true);
    });

    it("should return empty array when no chunks mention the story", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Unknown Place", source_pdf: "test-pdf.pdf" },
        chunks: [],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(0);
    });

    it("should skip chunks with null page_number", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: null as unknown as number },
        ],
        images: [mockImages[0]],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Only page 1 should be included, null page_number should be skipped
      expect(data.data.images).toHaveLength(1);
      expect(data.data.images[0].pageNumber).toBe(1);
    });

    it("should deduplicate pages when multiple chunks reference same page", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Playa de Gulpiyuri", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: 1 },
          { page_number: 2 },
        ],
        images: mockImages.filter(img => [1, 2].includes(img.page_number)),
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(2);
    });
  });

  describe("successful search", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    });

    it("should return images sorted by score (best first)", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: 2 },
          { page_number: 3 },
        ],
        images: mockImages,
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Scores should be in descending order
      for (let i = 1; i < data.data.images.length; i++) {
        expect(data.data.images[i - 1].score).toBeGreaterThanOrEqual(data.data.images[i].score);
      }
    });

    it("should return Supabase Storage URLs for images", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
        images: [mockImages[0]],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images[0].url).toContain("supabase.co/storage");
    });

    it("should include caption in response", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
        images: [mockImages[0]],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images[0]).toHaveProperty("caption");
      expect(data.data.images[0].caption).toBe("Beautiful landscape");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    });

    it("should return empty array when story has no source PDF", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: null },
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(0);
    });

    it("should return empty array when no images found in database", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
        images: [],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(0);
    });

    it("should return 404 when story not found", async () => {
      const mockClient = createMockSupabase({
        story: null,
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/nonexistent/content-images");
      const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Story not found");
    });
  });

  describe("score edge cases", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    });

    it("should score pages 4-5 with +10 points (medium priority)", async () => {
      const page5Image = {
        path: "https://supabase.co/storage/v1/object/public/pdf-images/test-pdf/test-pdf_page5_full.png",
        caption: "Page 5 image",
        source_pdf: "test-pdf.pdf",
        page_number: 5,
      };
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 5 }],
        images: [page5Image],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Page 5 (<=5) gets +10, not an _img_ URL so no +100 — score should be 10
      expect(data.data.images[0].score).toBe(10);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    });

    it("should return 500 when story database query fails", async () => {
      const mockClient = createMockSupabase({
        story: null,
        storyError: { message: "Database error" },
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch story");
    });

    it("should return 500 when chunks database query fails", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunksError: { message: "Database error" },
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to search chunks");
    });

    it("should return 500 on unexpected error (catch block)", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should return empty images when chunks data is null (line 112 falsy branch)", async () => {
      // Create a custom mock that returns null chunks data
      const mockStorySingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        error: null,
      });
      const mockStoryEq = vi.fn().mockReturnValue({ single: mockStorySingle });
      const mockStorySelect = vi.fn().mockReturnValue({ eq: mockStoryEq });

      const mockChunksIlike = vi.fn().mockResolvedValue({
        data: null, // null chunks data
        error: null,
      });
      const mockChunksEq = vi.fn().mockReturnValue({ ilike: mockChunksIlike });
      const mockChunksSelect = vi.fn().mockReturnValue({ eq: mockChunksEq });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "stories") return { select: mockStorySelect };
        if (table === "chunks") return { select: mockChunksSelect };
        return { select: vi.fn() };
      });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(0);
      expect(data.data.total).toBe(0);
    });

    it("should return empty images when images array is null (line 142 null check)", async () => {
      // Create mock where images query returns null data
      const mockStorySingle = vi.fn().mockResolvedValue({
        data: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        error: null,
      });
      const mockStoryEq = vi.fn().mockReturnValue({ single: mockStorySingle });
      const mockStorySelect = vi.fn().mockReturnValue({ eq: mockStoryEq });

      const mockChunksIlike = vi.fn().mockResolvedValue({
        data: [{ page_number: 1 }],
        error: null,
      });
      const mockChunksEq = vi.fn().mockReturnValue({ ilike: mockChunksIlike });
      const mockChunksSelect = vi.fn().mockReturnValue({ eq: mockChunksEq });

      const mockImagesIn = vi.fn().mockResolvedValue({
        data: null, // null images data
        error: null,
      });
      const mockImagesEq = vi.fn().mockReturnValue({ in: mockImagesIn });
      const mockImagesSelect = vi.fn().mockReturnValue({ eq: mockImagesEq });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "stories") return { select: mockStorySelect };
        if (table === "chunks") return { select: mockChunksSelect };
        if (table === "images") return { select: mockImagesSelect };
        return { select: vi.fn() };
      });

      vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(0);
      expect(data.data.total).toBe(0);
    });

    it("should score page 6+ images with 0 page points", async () => {
      const page10Image = {
        path: "https://supabase.co/storage/v1/object/public/pdf-images/test/test_page10_full.png",
        caption: null as unknown as string,
        source_pdf: "test-pdf.pdf",
        page_number: 10,
      };
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 10 }],
        images: [page10Image],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Page 10 gets 0 page points, not an _img_ URL so 0 total
      expect(data.data.images[0].score).toBe(0);
      expect(data.data.images[0].caption).toBeNull();
    });

    it("should return 500 when images database query fails", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
        imagesError: { message: "Database error" },
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch images");
    });
  });

  it("should use logger.error (not console.error) on unhandled GET error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected DB failure");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
    const response = await GET(request, { params: Promise.resolve({ id: "story-123" }) });
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
