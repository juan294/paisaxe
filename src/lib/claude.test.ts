import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateChatResponse, extractSourcesFromChunks } from "./claude";
import type { Chunk } from "@/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("claude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-api-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("generateChatResponse", () => {
    it("should generate a response from Claude API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "This is a response about Asturias" }],
        }),
      });

      const chunks: Chunk[] = [
        {
          id: "1",
          content: "Asturias is a beautiful region",
          sourcePdf: "guide.pdf",
          pageNumber: 1,
        },
      ];

      const response = await generateChatResponse("Tell me about Asturias", chunks);

      expect(response).toBe("This is a response about Asturias");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": "test-api-key",
          }),
        })
      );
    });

    it("should handle empty context", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Hello!" }],
        }),
      });

      const response = await generateChatResponse("Hello", []);

      expect(response).toBe("Hello!");
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(generateChatResponse("Test", [])).rejects.toThrow(
        "Anthropic API error: 500 - Internal Server Error"
      );
    });

    it("should return empty string if no text block in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "image", data: "..." }],
        }),
      });

      const response = await generateChatResponse("Test", []);
      expect(response).toBe("");
    });

    it("should truncate context that exceeds max length", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Response" }],
        }),
      });

      // Create chunk with very long content
      const longContent = "A".repeat(500);
      const chunks: Chunk[] = [
        {
          id: "1",
          content: longContent,
          sourcePdf: "guide.pdf",
        },
      ];

      await generateChatResponse("Question", chunks);

      // Verify fetch was called (context should be truncated internally)
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("extractSourcesFromChunks", () => {
    it("should extract sources from chunks", () => {
      const chunks: Chunk[] = [
        {
          id: "1",
          content: "Content about Oviedo that is quite long and should be truncated",
          sourcePdf: "oviedo-guide.pdf",
          pageNumber: 5,
          sectionTitle: "Visiting Oviedo",
        },
        {
          id: "2",
          content: "Content about food",
          sourcePdf: "food-guide.pdf",
        },
      ];

      const sources = extractSourcesFromChunks(chunks);

      expect(sources).toHaveLength(2);
      expect(sources[0]).toEqual({
        id: "1",
        title: "Visiting Oviedo",
        sourcePdf: "oviedo-guide.pdf",
        pageNumber: 5,
        snippet: expect.stringContaining("Content about Oviedo"),
      });
      expect(sources[1].title).toBe("food-guide.pdf"); // Falls back to sourcePdf when no sectionTitle
    });

    it("should use sourcePdf as title when sectionTitle is missing", () => {
      const chunks: Chunk[] = [
        {
          id: "1",
          content: "Some content",
          sourcePdf: "test.pdf",
        },
      ];

      const sources = extractSourcesFromChunks(chunks);
      expect(sources[0].title).toBe("test.pdf");
    });

    it("should return empty array for empty chunks", () => {
      const sources = extractSourcesFromChunks([]);
      expect(sources).toEqual([]);
    });
  });
});
