import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing search module
vi.mock("./supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        textSearch: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

import { searchChunks, getRelatedImages, search, keywordSearch } from "./search";
import { supabase } from "./supabase";

describe("search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchChunks", () => {
    it("should search chunks with vector embedding", async () => {
      const mockData = [
        {
          id: "chunk-1",
          content: "Asturias content",
          source_pdf: "guide.pdf",
          page_number: 1,
          section_title: "Introduction",
          image_refs: ["img1.jpg"],
          similarity: 0.9,
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null,
      } as never);

      const embedding = new Array(512).fill(0.1);
      const results = await searchChunks(embedding, 5);

      expect(supabase.rpc).toHaveBeenCalledWith("match_chunks", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "chunk-1",
        content: "Asturias content",
        sourcePdf: "guide.pdf",
        pageNumber: 1,
        sectionTitle: "Introduction",
        imageRefs: ["img1.jpg"],
        similarity: 0.9,
      });
    });

    it("should return empty array on error", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      } as never);

      const embedding = new Array(512).fill(0.1);
      const results = await searchChunks(embedding);

      expect(results).toEqual([]);
    });
  });

  describe("getRelatedImages", () => {
    it("should return empty array for empty imageRefs", async () => {
      const results = await getRelatedImages([]);
      expect(results).toEqual([]);
    });

    it("should fetch images by refs", async () => {
      const mockImages = [
        {
          id: "img-1",
          path: "/images/test.jpg",
          caption: "Test image",
          source_pdf: "guide.pdf",
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({ data: mockImages, error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const results = await getRelatedImages(["/images/test.jpg"]);

      expect(supabase.from).toHaveBeenCalledWith("images");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "img-1",
        path: "/images/test.jpg",
        caption: "Test image",
        sourcePdf: "guide.pdf",
      });
    });

    it("should return empty array on error", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "Error" },
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const results = await getRelatedImages(["test.jpg"]);
      expect(results).toEqual([]);
    });
  });

  describe("search", () => {
    it("should combine chunk search with image lookup", async () => {
      const mockChunks = [
        {
          id: "chunk-1",
          content: "Content",
          source_pdf: "guide.pdf",
          page_number: 1,
          section_title: null,
          image_refs: ["img1.jpg"],
          similarity: 0.8,
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockChunks,
        error: null,
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({
          data: [{ id: "img-1", path: "img1.jpg", caption: null, source_pdf: "guide.pdf" }],
          error: null,
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const embedding = new Array(512).fill(0.1);
      const result = await search(embedding, 5);

      expect(result.chunks).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });
  });

  describe("keywordSearch", () => {
    it("should search chunks by keyword", async () => {
      const mockData = [
        {
          id: "chunk-1",
          content: "Oviedo is the capital",
          source_pdf: "guide.pdf",
          page_number: 1,
          section_title: "Oviedo",
          image_refs: [],
        },
      ];

      const mockTextSearch = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValueOnce({ data: mockData, error: null }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        textSearch: mockTextSearch,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const results = await keywordSearch("Oviedo", 5);

      expect(supabase.from).toHaveBeenCalledWith("chunks");
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("Oviedo is the capital");
    });

    it("should return empty array on error", async () => {
      const mockTextSearch = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "Search error" },
        }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        textSearch: mockTextSearch,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const results = await keywordSearch("test");
      expect(results).toEqual([]);
    });
  });
});
