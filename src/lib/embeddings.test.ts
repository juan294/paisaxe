import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEmbeddingDimensions } from "./embeddings";

describe("embeddings", () => {
  describe("getEmbeddingDimensions", () => {
    it("should return 1024 for voyage-3 model", () => {
      expect(getEmbeddingDimensions()).toBe(1024);
    });
  });

  // Note: generateEmbedding and generateEmbeddings require mocking the VoyageAIClient
  // which is complex due to module initialization. Integration tests should verify
  // the actual API calls work correctly.
});
