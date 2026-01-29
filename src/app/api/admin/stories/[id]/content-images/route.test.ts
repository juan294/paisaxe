import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock dependencies - use vi.hoisted to ensure mockReadFile is available before hoisting
const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("fs/promises", () => {
  const mock = {
    readFile: mockReadFile,
    writeFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  };
  return {
    ...mock,
    default: mock,
  };
});

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

const mockManifest = {
  extractedAt: "2026-01-27T16:58:30.260Z",
  totalImages: 10,
  totalPdfs: 2,
  images: [
    {
      filename: "test-pdf_page1_img_p0_1.png",
      sourcePdf: "test-pdf.pdf",
      pageNumber: 1,
      width: 1200,
      height: 800,
      path: "test-pdf/test-pdf_page1_img_p0_1.png",
      aspectRatio: 1.5,
      type: "extracted",
    },
    {
      filename: "test-pdf_page2_img_p1_1.png",
      sourcePdf: "test-pdf.pdf",
      pageNumber: 2,
      width: 900,
      height: 600,
      path: "test-pdf/test-pdf_page2_img_p1_1.png",
      aspectRatio: 1.5,
      type: "extracted",
    },
    {
      filename: "test-pdf_page3_full.png",
      sourcePdf: "test-pdf.pdf",
      pageNumber: 3,
      width: 800,
      height: 1000,
      path: "test-pdf/test-pdf_page3_full.png",
      aspectRatio: 0.8,
      type: "rendered",
    },
    {
      filename: "test-pdf_page5_img.png",
      sourcePdf: "test-pdf.pdf",
      pageNumber: 5,
      width: 1000,
      height: 700,
      path: "test-pdf/test-pdf_page5_img.png",
      aspectRatio: 1.43,
      type: "extracted",
    },
    {
      filename: "other-pdf_page1.png",
      sourcePdf: "other-pdf.pdf",
      pageNumber: 1,
      width: 1000,
      height: 700,
      path: "other-pdf/other-pdf_page1.png",
      aspectRatio: 1.43,
      type: "extracted",
    },
  ],
};

// Helper to create mock Supabase client with configurable behavior
function createMockSupabase(options: {
  story?: { id: string; title: string; source_pdf: string | null } | null;
  storyError?: { message: string } | null;
  chunks?: { page_number: number }[];
  chunksError?: { message: string } | null;
}) {
  const { story, storyError, chunks = [], chunksError } = options;

  // Mock for chunks query - ilike returns a thenable (Promise-like)
  const chunksResult = Promise.resolve({
    data: chunksError ? null : chunks,
    error: chunksError || null,
  });
  const mockChunksIlike = vi.fn().mockReturnValue(chunksResult);
  const mockChunksEq = vi.fn().mockReturnValue({ ilike: mockChunksIlike });
  const mockChunksSelect = vi.fn().mockReturnValue({ eq: mockChunksEq });

  // Mock for story query (with single)
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

  describe("chunk-based filtering", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
    });

    it("should only return images from pages where story title is mentioned", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Catedral de Oviedo", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: 3 },
        ],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should only have images from pages 1 and 3
      expect(data.data.images).toHaveLength(2);
      expect(data.data.images.every((img: { pageNumber: number }) => [1, 3].includes(img.pageNumber))).toBe(true);
    });

    it("should search chunks using story title with case-insensitive matching", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Lagos de Covadonga", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 2 }],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should only have image from page 2
      expect(data.data.images).toHaveLength(1);
      expect(data.data.images[0].pageNumber).toBe(2);
    });

    it("should return empty array when no chunks mention the story", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Unknown Place", source_pdf: "test-pdf.pdf" },
        chunks: [], // No matching chunks
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.images).toHaveLength(0);
    });

    it("should deduplicate pages when multiple chunks reference same page", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Playa de Gulpiyuri", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: 1 }, // Same page mentioned in multiple chunks
          { page_number: 2 },
        ],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should have images from pages 1 and 2 (deduplicated)
      expect(data.data.images).toHaveLength(2);
    });
  });

  describe("successful search", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
    });

    it("should return images sorted by score (best first)", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [
          { page_number: 1 },
          { page_number: 2 },
          { page_number: 3 },
        ],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      // Scores should be in descending order
      for (let i = 1; i < data.data.images.length; i++) {
        expect(data.data.images[i - 1].score).toBeGreaterThanOrEqual(data.data.images[i].score);
      }
    });

    it("should include resolution info in response", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      const firstImage = data.data.images[0];
      expect(firstImage).toHaveProperty("width");
      expect(firstImage).toHaveProperty("height");
      expect(firstImage).toHaveProperty("aspectRatio");
      expect(firstImage.width).toBe(1200);
      expect(firstImage.height).toBe(800);
    });

    it("should return API path for content images", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(data.data.images[0].url).toContain("/api/content-images/");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
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

    it("should return empty array when no images match the source PDF", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "nonexistent.pdf" },
        chunks: [{ page_number: 1 }],
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

  describe("error handling", () => {
    beforeEach(() => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    });

    it("should return 500 when manifest file cannot be read", async () => {
      const mockClient = createMockSupabase({
        story: { id: "story-123", title: "Test Story", source_pdf: "test-pdf.pdf" },
        chunks: [{ page_number: 1 }],
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient as never);
      mockReadFile.mockRejectedValue(new Error("File not found"));

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to read image manifest");
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
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));

      const request = new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to search chunks");
    });
  });
});
