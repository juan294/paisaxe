import { requiredValue } from "@/test/required-value";
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
    it("falls back when a provider index points to a missing chunk and recovers on valid output", async () => {
      const chunks = makeChunks(5);
      delete chunks[4];
      const onDegraded = vi.fn();
      mockRerank.mockResolvedValueOnce({ data: [{ index: 4 }] });
      const { rerankChunks } = await import("./rerank");
      await expect(rerankChunks("query", chunks, 3, { onDegraded })).resolves.toEqual(chunks.slice(0, 3));
      expect(onDegraded).toHaveBeenCalledOnce();
      mockRerank.mockResolvedValueOnce({ data: [{ index: 2 }] });
      await expect(rerankChunks("query", chunks, 3)).resolves.toEqual([chunks[2]]);
    });

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
      }, { abortSignal: undefined, timeoutInSeconds: undefined });
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
      expect(requiredValue(result[0], "src/lib/rerank.test.ts:85 result").id).toBe("chunk-2");
      expect(requiredValue(result[1], "src/lib/rerank.test.ts:86 result").id).toBe("chunk-0");
      expect(requiredValue(result[2], "src/lib/rerank.test.ts:87 result").id).toBe("chunk-4");
    });

    it("should fall back to original order on API error", async () => {
      const chunks = makeChunks(5);
      mockRerank.mockRejectedValue(new Error("Voyage AI API error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { rerankChunks } = await import("./rerank");
      const result = await rerankChunks("query", chunks, 3);

      // Falls back to first `topK` chunks in original order
      expect(result).toHaveLength(3);
      expect(requiredValue(result[0], "src/lib/rerank.test.ts:101 result").id).toBe("chunk-0");
      expect(requiredValue(result[1], "src/lib/rerank.test.ts:102 result").id).toBe("chunk-1");
      expect(requiredValue(result[2], "src/lib/rerank.test.ts:103 result").id).toBe("chunk-2");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Voyage AI] Rerank failed")
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
        expect.objectContaining({ topK: 3 }),
        { abortSignal: undefined, timeoutInSeconds: undefined }
      );
    });

    it("should log token usage when available", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
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
        expect.stringContaining('"total_tokens":150')
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
      expect(requiredValue(result[0], "src/lib/rerank.test.ts:170 result").id).toBe("chunk-0");
      expect(requiredValue(result[1], "src/lib/rerank.test.ts:171 result").id).toBe("chunk-1");
      expect(requiredValue(result[2], "src/lib/rerank.test.ts:172 result").id).toBe("chunk-2");

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
