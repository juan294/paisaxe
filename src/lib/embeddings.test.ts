import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock voyageai module
const mockEmbed = vi.fn();
vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn(() => ({
    embed: mockEmbed,
  })),
}));

describe("embeddings", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmbed.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getEmbeddingDimensions", () => {
    it("should return 1024 for voyage-3 model", async () => {
      const { getEmbeddingDimensions } = await import("./embeddings");
      expect(getEmbeddingDimensions()).toBe(1024);
    });
  });

  describe("generateEmbedding", () => {
    it("should return embedding for a single text", async () => {
      const mockEmbedding = Array(1024).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const { generateEmbedding } = await import("./embeddings");
      const result = await generateEmbedding("test text");

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbed).toHaveBeenCalledWith({
        input: ["test text"],
        model: "voyage-3",
      });
    });

    it("should throw error when no embedding is returned", async () => {
      mockEmbed.mockResolvedValue({ data: [] });

      const { generateEmbedding } = await import("./embeddings");

      await expect(generateEmbedding("test text")).rejects.toThrow(
        "No embedding returned from Voyage AI"
      );
    });

    it("should throw error when data is null", async () => {
      mockEmbed.mockResolvedValue({ data: null });

      const { generateEmbedding } = await import("./embeddings");

      await expect(generateEmbedding("test text")).rejects.toThrow(
        "No embedding returned from Voyage AI"
      );
    });

    it("should throw error when embedding is undefined", async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: undefined }],
      });

      const { generateEmbedding } = await import("./embeddings");

      await expect(generateEmbedding("test text")).rejects.toThrow(
        "No embedding returned from Voyage AI"
      );
    });
  });

  describe("generateEmbeddings", () => {
    it("should generate embeddings for multiple texts", async () => {
      const mockEmbedding1 = Array(1024).fill(0.1);
      const mockEmbedding2 = Array(1024).fill(0.2);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding1 }, { embedding: mockEmbedding2 }],
        usage: { totalTokens: 100 },
      });

      const { generateEmbeddings } = await import("./embeddings");
      const result = await generateEmbeddings(["text1", "text2"]);

      expect(result.embeddings).toHaveLength(2);
      expect(result.embeddings[0]).toEqual(mockEmbedding1);
      expect(result.embeddings[1]).toEqual(mockEmbedding2);
      expect(result.totalTokens).toBe(100);
    });

    it("should process texts in batches of 128", async () => {
      // Create 150 texts to test batching
      const texts = Array(150).fill("test text");
      const mockEmbedding = Array(1024).fill(0.1);

      mockEmbed
        .mockResolvedValueOnce({
          data: Array(128).fill({ embedding: mockEmbedding }),
          usage: { totalTokens: 1000 },
        })
        .mockResolvedValueOnce({
          data: Array(22).fill({ embedding: mockEmbedding }),
          usage: { totalTokens: 200 },
        });

      const { generateEmbeddings } = await import("./embeddings");
      const result = await generateEmbeddings(texts);

      expect(mockEmbed).toHaveBeenCalledTimes(2);
      expect(result.embeddings).toHaveLength(150);
      expect(result.totalTokens).toBe(1200);
    });

    it("should throw error when batch returns no data", async () => {
      mockEmbed.mockResolvedValue({ data: null });

      const { generateEmbeddings } = await import("./embeddings");

      await expect(generateEmbeddings(["text1", "text2"])).rejects.toThrow(
        "No embeddings returned for batch 0"
      );
    });

    it("should handle missing usage data", async () => {
      const mockEmbedding = Array(1024).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        // No usage field
      });

      const { generateEmbeddings } = await import("./embeddings");
      const result = await generateEmbeddings(["text1"]);

      expect(result.totalTokens).toBe(0);
    });

    it("should filter out undefined embeddings", async () => {
      const mockEmbedding = Array(1024).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [
          { embedding: mockEmbedding },
          { embedding: undefined },
          { embedding: mockEmbedding },
        ],
        usage: { totalTokens: 100 },
      });

      const { generateEmbeddings } = await import("./embeddings");
      const result = await generateEmbeddings(["text1", "text2", "text3"]);

      expect(result.embeddings).toHaveLength(2);
    });

    it("should return empty result for empty input", async () => {
      const { generateEmbeddings } = await import("./embeddings");
      const result = await generateEmbeddings([]);

      expect(result.embeddings).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(mockEmbed).not.toHaveBeenCalled();
    });
  });
});
