import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock voyageai module
const mockEmbed = vi.fn();
const mockContextualizedEmbed = vi.fn();
vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn(function () {
    return { embed: mockEmbed, contextualizedEmbed: mockContextualizedEmbed };
  }),
}));

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock("./embedding-cache", () => ({
  EmbeddingCache: vi.fn(function () {
    return { get: mockGet, set: mockSet };
  }),
}));

describe("embeddings", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmbed.mockReset();
    mockContextualizedEmbed.mockReset();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getEmbeddingDimensions", () => {
    it("should return 512 for voyage-3 model with Matryoshka embeddings", async () => {
      const { getEmbeddingDimensions } = await import("./embeddings");
      expect(getEmbeddingDimensions()).toBe(512);
    });
  });

  describe("generateEmbedding", () => {
    it("should return embedding for a single text", async () => {
      const mockEmbedding = Array(512).fill(0.1);
      mockGet.mockResolvedValue(null);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const { generateEmbedding } = await import("./embeddings");
      const result = await generateEmbedding("test text");

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbed).toHaveBeenCalledWith({
        input: ["test text"],
        model: "voyage-3.5",
        inputType: "query",
        outputDimension: 512,
      });
    });

    it("should throw error when no embedding is returned", async () => {
      mockGet.mockResolvedValue(null);
      mockEmbed.mockResolvedValue({ data: [] });

      const { generateEmbedding } = await import("./embeddings");

      await expect(generateEmbedding("test text")).rejects.toThrow(
        "No embedding returned from Voyage AI"
      );
    });

    it("should throw error when data is null", async () => {
      mockGet.mockResolvedValue(null);
      mockEmbed.mockResolvedValue({ data: null });

      const { generateEmbedding } = await import("./embeddings");

      await expect(generateEmbedding("test text")).rejects.toThrow(
        "No embedding returned from Voyage AI"
      );
    });

    it("should throw error when embedding is undefined", async () => {
      mockGet.mockResolvedValue(null);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: undefined }],
      });

      const { generateEmbedding } = await import("./embeddings");

      await expect(generateEmbedding("test text")).rejects.toThrow(
        "No embedding returned from Voyage AI"
      );
    });

    it("should return cached embedding without API call", async () => {
      const cachedEmbedding = Array(512).fill(0.5);
      mockGet.mockResolvedValue(cachedEmbedding);

      const { generateEmbedding } = await import("./embeddings");
      const result = await generateEmbedding("cached text");

      expect(result).toEqual(cachedEmbedding);
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it("should cache embedding after API call", async () => {
      const mockEmbedding = Array(512).fill(0.1);
      mockGet.mockResolvedValue(null);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { totalTokens: 10 },
      });

      const { generateEmbedding } = await import("./embeddings");
      await generateEmbedding("new text");

      expect(mockSet).toHaveBeenCalledWith("new text", mockEmbedding);
    });

    it("should log token usage", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const mockEmbedding = Array(512).fill(0.1);
      mockGet.mockResolvedValue(null);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { totalTokens: 42 },
      });

      const { generateEmbedding } = await import("./embeddings");
      await generateEmbedding("test");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"total_tokens":42')
      );
      consoleSpy.mockRestore();
    });
  });

  describe("generateEmbeddings", () => {
    it("should generate embeddings for multiple texts", async () => {
      const mockEmbedding1 = Array(512).fill(0.1);
      const mockEmbedding2 = Array(512).fill(0.2);
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
      const mockEmbedding = Array(512).fill(0.1);

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
      const mockEmbedding = Array(512).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        // No usage field
      });

      const { generateEmbeddings } = await import("./embeddings");
      const result = await generateEmbeddings(["text1"]);

      expect(result.totalTokens).toBe(0);
    });

    it("should filter out undefined embeddings", async () => {
      const mockEmbedding = Array(512).fill(0.1);
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

    it("should pass inputType document and outputDimension for batch embeddings", async () => {
      const mockEmbedding = Array(512).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { totalTokens: 10 },
      });

      const { generateEmbeddings } = await import("./embeddings");
      await generateEmbeddings(["text1"]);

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          inputType: "document",
          outputDimension: 512,
        })
      );
    });

    it("should log total token usage for batch", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const mockEmbedding = Array(512).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { totalTokens: 50 },
      });

      const { generateEmbeddings } = await import("./embeddings");
      await generateEmbeddings(["text1"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("generateEmbeddings total")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"total_tokens":50')
      );
      consoleSpy.mockRestore();
    });
  });

  describe("generateContextualizedEmbeddings", () => {
    it("should generate contextualized embeddings for chunk groups", async () => {
      const mockEmbedding1 = Array(1024).fill(0.1);
      const mockEmbedding2 = Array(1024).fill(0.2);
      const mockEmbedding3 = Array(1024).fill(0.3);

      mockContextualizedEmbed
        .mockResolvedValueOnce({
          results: [
            {
              index: 0,
              embeddings: [mockEmbedding1, mockEmbedding2],
            },
          ],
          totalTokens: 200,
        })
        .mockResolvedValueOnce({
          results: [
            {
              index: 0,
              embeddings: [mockEmbedding3],
            },
          ],
          totalTokens: 100,
        });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      const result = await generateContextualizedEmbeddings([
        ["chunk1 from pdf1", "chunk2 from pdf1"],
        ["chunk1 from pdf2"],
      ]);

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toEqual(mockEmbedding1);
      expect(result.embeddings[1]).toEqual(mockEmbedding2);
      expect(result.embeddings[2]).toEqual(mockEmbedding3);
      expect(result.totalTokens).toBe(300);
    });

    it("should call contextualizedEmbed with correct payload structure", async () => {
      const mockEmbedding = Array(1024).fill(0.1);
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: [mockEmbedding, mockEmbedding],
          },
        ],
        totalTokens: 50,
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      await generateContextualizedEmbeddings([["chunk A", "chunk B"]]);

      expect(mockContextualizedEmbed).toHaveBeenCalledWith({
        inputs: [["chunk A", "chunk B"]],
        model: "voyage-3.5",
        inputType: "document",
        outputDimension: 512,
      });
    });

    it("should accumulate embeddings across multiple groups in order", async () => {
      const embeddings = [
        Array(1024).fill(0.1),
        Array(1024).fill(0.2),
        Array(1024).fill(0.3),
        Array(1024).fill(0.4),
      ];

      // Group 1: 2 chunks
      mockContextualizedEmbed
        .mockResolvedValueOnce({
          results: [
            {
              index: 0,
              embeddings: [embeddings[0], embeddings[1]],
            },
          ],
          totalTokens: 100,
        })
        // Group 2: 2 chunks
        .mockResolvedValueOnce({
          results: [
            {
              index: 0,
              embeddings: [embeddings[2], embeddings[3]],
            },
          ],
          totalTokens: 150,
        });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      const result = await generateContextualizedEmbeddings([
        ["group1-chunk1", "group1-chunk2"],
        ["group2-chunk1", "group2-chunk2"],
      ]);

      expect(result.embeddings).toHaveLength(4);
      expect(result.embeddings[0]).toEqual(embeddings[0]);
      expect(result.embeddings[1]).toEqual(embeddings[1]);
      expect(result.embeddings[2]).toEqual(embeddings[2]);
      expect(result.embeddings[3]).toEqual(embeddings[3]);
      expect(result.totalTokens).toBe(250);
    });

    it("should throw error when no data is returned for a group", async () => {
      mockContextualizedEmbed.mockResolvedValue({
        results: null,
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");

      await expect(
        generateContextualizedEmbeddings([["chunk1"]])
      ).rejects.toThrow("No contextualized embeddings returned for group 0");
    });

    it("should throw error when data array is empty for a group", async () => {
      mockContextualizedEmbed.mockResolvedValue({
        results: [],
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");

      await expect(
        generateContextualizedEmbeddings([["chunk1"]])
      ).rejects.toThrow("No contextualized embeddings returned for group 0");
    });

    it("should throw error when document data is missing chunk embeddings", async () => {
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: undefined,
          },
        ],
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");

      await expect(
        generateContextualizedEmbeddings([["chunk1"]])
      ).rejects.toThrow("No chunk embeddings in contextualized response for group 0");
    });

    it("should skip empty groups", async () => {
      const mockEmbedding = Array(1024).fill(0.5);
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: [mockEmbedding],
          },
        ],
        totalTokens: 30,
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      const result = await generateContextualizedEmbeddings([
        [],
        ["non-empty chunk"],
        [],
      ]);

      expect(mockContextualizedEmbed).toHaveBeenCalledTimes(1);
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual(mockEmbedding);
      expect(result.totalTokens).toBe(30);
    });

    it("should filter out undefined embeddings from response", async () => {
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: [
              Array(1024).fill(0.1),
              undefined,
              Array(1024).fill(0.3),
            ],
          },
        ],
        totalTokens: 75,
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      const result = await generateContextualizedEmbeddings([
        ["chunk1", "chunk2", "chunk3"],
      ]);

      expect(result.embeddings).toHaveLength(2);
    });

    it("should handle missing usage data", async () => {
      const mockEmbedding = Array(1024).fill(0.1);
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: [mockEmbedding],
          },
        ],
        // No totalTokens field
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      const result = await generateContextualizedEmbeddings([["chunk1"]]);

      expect(result.totalTokens).toBe(0);
    });

    it("should return empty result for empty input", async () => {
      const { generateContextualizedEmbeddings } = await import("./embeddings");
      const result = await generateContextualizedEmbeddings([]);

      expect(result.embeddings).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(mockContextualizedEmbed).not.toHaveBeenCalled();
    });

    it("should log token usage per group", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const mockEmbedding = Array(1024).fill(0.1);
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: [mockEmbedding],
          },
        ],
        totalTokens: 88,
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      await generateContextualizedEmbeddings([["chunk1"]]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"group_tokens":88')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("contextualizedEmbed group")
      );
      consoleSpy.mockRestore();
    });

    it("should log total summary across all groups", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const mockEmbedding = Array(1024).fill(0.1);
      mockContextualizedEmbed.mockResolvedValue({
        results: [
          {
            index: 0,
            embeddings: [mockEmbedding],
          },
        ],
        totalTokens: 50,
      });

      const { generateContextualizedEmbeddings } = await import("./embeddings");
      await generateContextualizedEmbeddings([["chunk1"], ["chunk2"]]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("generateContextualizedEmbeddings total")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"total_tokens":100')
      );
      consoleSpy.mockRestore();
    });
  });
});
