import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock voyageai module
const mockRerank = vi.fn();
vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn(function () {
    return { rerank: mockRerank };
  }),
}));

import type { Chunk } from "@/types";

describe("rerank", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRerank.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rerankChunks", () => {
    const makeChunks = (count: number): Chunk[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `chunk-${i}`,
        content: `Content about topic ${i}`,
        sourcePdf: `guide-${i}.pdf`,
        pageNumber: i + 1,
        sectionTitle: `Section ${i}`,
        imageRefs: [`img${i}.jpg`],
        similarity: 0.9 - i * 0.1,
      }));

    it("should call the Voyage AI rerank API with correct parameters", async () => {
      const chunks = makeChunks(5);
      mockRerank.mockResolvedValue({
        data: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
          { index: 4, relevanceScore: 0.75 },
        ],
      });

      const { rerankChunks } = await import("./rerank");
      await rerankChunks("best restaurants in Asturias", chunks, 3);

      expect(mockRerank).toHaveBeenCalledWith({
        query: "best restaurants in Asturias",
        documents: chunks.map((c) => c.content),
        model: "rerank-2.5",
        topK: 3,
      });
    });

    it("should return chunks reordered by relevance score", async () => {
      const chunks = makeChunks(5);
      // Reranker says chunk-2 is best, then chunk-0, then chunk-4
      mockRerank.mockResolvedValue({
        data: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
          { index: 4, relevanceScore: 0.75 },
        ],
      });

      const { rerankChunks } = await import("./rerank");
      const result = await rerankChunks("query", chunks, 3);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("chunk-2");
      expect(result[1].id).toBe("chunk-0");
      expect(result[2].id).toBe("chunk-4");
    });

    it("should fall back to original order on API error", async () => {
      const chunks = makeChunks(5);
      mockRerank.mockRejectedValue(new Error("Voyage AI API error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { rerankChunks } = await import("./rerank");
      const result = await rerankChunks("query", chunks, 3);

      // Falls back to first `topK` chunks in original order
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("chunk-0");
      expect(result[1].id).toBe("chunk-1");
      expect(result[2].id).toBe("chunk-2");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Voyage AI] Rerank failed"),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("should handle empty chunk arrays", async () => {
      const { rerankChunks } = await import("./rerank");
      const result = await rerankChunks("query", [], 3);

      expect(result).toEqual([]);
      expect(mockRerank).not.toHaveBeenCalled();
    });

    it("should default topK to 3 when not specified", async () => {
      const chunks = makeChunks(5);
      mockRerank.mockResolvedValue({
        data: [
          { index: 0, relevanceScore: 0.9 },
          { index: 1, relevanceScore: 0.8 },
          { index: 2, relevanceScore: 0.7 },
        ],
      });

      const { rerankChunks } = await import("./rerank");
      await rerankChunks("query", chunks);

      expect(mockRerank).toHaveBeenCalledWith(
        expect.objectContaining({ topK: 3 })
      );
    });

    it("should log token usage when available", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const chunks = makeChunks(4);
      mockRerank.mockResolvedValue({
        data: [
          { index: 1, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
          { index: 2, relevanceScore: 0.75 },
        ],
        usage: { totalTokens: 150 },
      });

      const { rerankChunks } = await import("./rerank");
      await rerankChunks("query", chunks, 3);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("150 tokens")
      );
      consoleSpy.mockRestore();
    });

    it("should fall back to original order when rerank returns no data", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const chunks = makeChunks(5);
      mockRerank.mockResolvedValue({
        data: null,
      });

      const { rerankChunks } = await import("./rerank");
      const result = await rerankChunks("query", chunks, 3);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("chunk-0");
      expect(result[1].id).toBe("chunk-1");
      expect(result[2].id).toBe("chunk-2");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rerank returned no data")
      );
      consoleSpy.mockRestore();
    });

    it("should return chunks unchanged and skip Voyage when chunks count is less than topK", async () => {
      const chunks = makeChunks(2);

      const { rerankChunks } = await import("./rerank");
      const result = await rerankChunks("query", chunks, 5);

      expect(result).toHaveLength(2);
      expect(result).toEqual(chunks);
      expect(mockRerank).not.toHaveBeenCalled();
    });
  });
});
