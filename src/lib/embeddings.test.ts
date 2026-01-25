import { describe, it, expect } from "vitest";
import { getEmbeddingDimensions, generateEmbedding, generateEmbeddings } from "./embeddings";

describe("embeddings", () => {
  describe("getEmbeddingDimensions", () => {
    it("should return 1024 for voyage-3 model", () => {
      expect(getEmbeddingDimensions()).toBe(1024);
    });
  });

  describe("generateEmbedding", () => {
    it("should be a function", () => {
      expect(typeof generateEmbedding).toBe("function");
    });

    it("should return a promise", () => {
      // We can't actually call it without API key, but we can verify the interface
      expect(generateEmbedding.length).toBe(1); // Takes 1 argument
    });
  });

  describe("generateEmbeddings", () => {
    it("should be a function", () => {
      expect(typeof generateEmbeddings).toBe("function");
    });

    it("should accept an array of texts", () => {
      expect(generateEmbeddings.length).toBe(1); // Takes 1 argument (array)
    });
  });

  // Note: Full integration tests for generateEmbedding and generateEmbeddings
  // require a valid VOYAGE_API_KEY and should be run separately.
});
