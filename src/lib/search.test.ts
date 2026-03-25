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

// Mock rerank module
vi.mock("./rerank", () => ({
  rerankChunks: vi.fn(),
}));

import { searchChunks, getRelatedImages, search, keywordSearch } from "./search";
import { supabase } from "./supabase";
import { rerankChunks } from "./rerank";

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
    it("should fetch 10 candidates, rerank to top 3, and look up images when query text is provided", async () => {
      // Simulate 10 chunks returned from vector search
      const mockDbChunks = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk-${i}`,
        content: `Content ${i}`,
        source_pdf: `guide-${i}.pdf`,
        page_number: i + 1,
        section_title: null,
        image_refs: [`img${i}.jpg`],
        similarity: 0.9 - i * 0.02,
      }));

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockDbChunks,
        error: null,
      } as never);

      // Reranker returns the best 3 (chunks 5, 2, 8 in reranked order)
      const rerankedChunks = [
        { id: "chunk-5", content: "Content 5", sourcePdf: "guide-5.pdf", pageNumber: 6, sectionTitle: undefined, imageRefs: ["img5.jpg"], similarity: 0.8 },
        { id: "chunk-2", content: "Content 2", sourcePdf: "guide-2.pdf", pageNumber: 3, sectionTitle: undefined, imageRefs: ["img2.jpg"], similarity: 0.86 },
        { id: "chunk-8", content: "Content 8", sourcePdf: "guide-8.pdf", pageNumber: 9, sectionTitle: undefined, imageRefs: ["img8.jpg"], similarity: 0.74 },
      ];
      vi.mocked(rerankChunks).mockResolvedValueOnce(rerankedChunks);

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({
          data: [
            { id: "img-5", path: "img5.jpg", caption: null, source_pdf: "guide-5.pdf" },
            { id: "img-2", path: "img2.jpg", caption: null, source_pdf: "guide-2.pdf" },
            { id: "img-8", path: "img8.jpg", caption: null, source_pdf: "guide-8.pdf" },
          ],
          error: null,
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const embedding = new Array(1024).fill(0.1);
      const result = await search(embedding, 3, "best restaurants in Asturias");

      // Vector search should request 10 candidates
      expect(supabase.rpc).toHaveBeenCalledWith("match_chunks", expect.objectContaining({
        match_count: 10,
      }));

      // Reranker should be called with all 10 candidates and topK=3
      expect(rerankChunks).toHaveBeenCalledWith(
        "best restaurants in Asturias",
        expect.arrayContaining([expect.objectContaining({ id: "chunk-0" })]),
        3
      );

      // Result should contain the 3 reranked chunks
      expect(result.chunks).toHaveLength(3);
      expect(result.chunks[0].id).toBe("chunk-5");
      expect(result.images).toHaveLength(3);
    });

    it("should pass query text to rerankChunks for reranking", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          { id: "chunk-1", content: "Content", source_pdf: "guide.pdf", page_number: 1, section_title: null, image_refs: [], similarity: 0.8 },
        ],
        error: null,
      } as never);

      vi.mocked(rerankChunks).mockResolvedValueOnce([
        { id: "chunk-1", content: "Content", sourcePdf: "guide.pdf", pageNumber: 1, sectionTitle: undefined, imageRefs: [], similarity: 0.8 },
      ]);

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const embedding = new Array(1024).fill(0.1);
      await search(embedding, 3, "best hiking in Asturias");

      expect(rerankChunks).toHaveBeenCalledWith(
        "best hiking in Asturias",
        expect.any(Array),
        3
      );
    });

    it("should skip reranking when no query text is provided", async () => {
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

      // Without query text, reranking should not be called
      expect(rerankChunks).not.toHaveBeenCalled();
      expect(result.chunks).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });

    it("should handle chunks with null imageRefs (line 89 fallback)", async () => {
      // Covers the `chunk.imageRefs || []` branch at line 89 —
      // when a chunk has null/undefined imageRefs, the flatMap should
      // use an empty array instead, producing no image lookups.
      const mockChunks = [
        {
          id: "chunk-1",
          content: "Content with no images",
          source_pdf: "guide.pdf",
          page_number: 1,
          section_title: null,
          image_refs: null, // null imageRefs to trigger the || [] fallback
          similarity: 0.8,
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockChunks,
        error: null,
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const embedding = new Array(512).fill(0.1);
      const result = await search(embedding, 5);

      expect(result.chunks).toHaveLength(1);
      // With null imageRefs, no images should be fetched (empty refs list)
      expect(result.images).toEqual([]);
    });

    it("should use limit directly when no query text is provided", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as never);

      const embedding = new Array(1024).fill(0.1);
      await search(embedding, 5);

      // Without query text, vector search should use the exact limit
      expect(supabase.rpc).toHaveBeenCalledWith("match_chunks", expect.objectContaining({
        match_count: 5,
      }));
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
