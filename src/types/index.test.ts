import { describe, it, expect } from "vitest";
import type {
  Source,
  ImageResult,
  Chunk,
  SearchResult,
  ChatRequest,
  ChatResponse,
} from "./index";

describe("types/index", () => {
  describe("Source type", () => {
    it("should allow valid Source objects", () => {
      const source: Source = {
        id: "src-1",
        title: "Test Source",
        sourcePdf: "test.pdf",
        pageNumber: 5,
        snippet: "This is a snippet",
      };

      expect(source.id).toBe("src-1");
      expect(source.title).toBe("Test Source");
      expect(source.sourcePdf).toBe("test.pdf");
      expect(source.pageNumber).toBe(5);
      expect(source.snippet).toBe("This is a snippet");
    });

    it("should allow Source without optional pageNumber", () => {
      const source: Source = {
        id: "src-2",
        title: "Test Source",
        sourcePdf: "test.pdf",
        snippet: "This is a snippet",
      };

      expect(source.pageNumber).toBeUndefined();
    });
  });

  describe("ImageResult type", () => {
    it("should allow valid ImageResult objects", () => {
      const image: ImageResult = {
        id: "img-1",
        path: "/images/test.jpg",
        caption: "A test image",
        sourcePdf: "test.pdf",
      };

      expect(image.id).toBe("img-1");
      expect(image.path).toBe("/images/test.jpg");
      expect(image.caption).toBe("A test image");
      expect(image.sourcePdf).toBe("test.pdf");
    });

    it("should allow ImageResult without optional caption", () => {
      const image: ImageResult = {
        id: "img-2",
        path: "/images/test.jpg",
        sourcePdf: "test.pdf",
      };

      expect(image.caption).toBeUndefined();
    });
  });

  describe("Chunk type", () => {
    it("should allow valid Chunk objects with all properties", () => {
      const chunk: Chunk = {
        id: "chunk-1",
        content: "Chunk content here",
        sourcePdf: "test.pdf",
        pageNumber: 10,
        sectionTitle: "Section A",
        imageRefs: ["img-1", "img-2"],
        similarity: 0.95,
      };

      expect(chunk.id).toBe("chunk-1");
      expect(chunk.content).toBe("Chunk content here");
      expect(chunk.sourcePdf).toBe("test.pdf");
      expect(chunk.pageNumber).toBe(10);
      expect(chunk.sectionTitle).toBe("Section A");
      expect(chunk.imageRefs).toEqual(["img-1", "img-2"]);
      expect(chunk.similarity).toBe(0.95);
    });

    it("should allow Chunk without optional properties", () => {
      const chunk: Chunk = {
        id: "chunk-2",
        content: "Minimal chunk",
        sourcePdf: "test.pdf",
      };

      expect(chunk.pageNumber).toBeUndefined();
      expect(chunk.sectionTitle).toBeUndefined();
      expect(chunk.imageRefs).toBeUndefined();
      expect(chunk.similarity).toBeUndefined();
    });
  });

  describe("SearchResult type", () => {
    it("should allow valid SearchResult objects", () => {
      const result: SearchResult = {
        chunks: [
          {
            id: "chunk-1",
            content: "Content",
            sourcePdf: "test.pdf",
          },
        ],
        images: [
          {
            id: "img-1",
            path: "/test.jpg",
            sourcePdf: "test.pdf",
          },
        ],
      };

      expect(result.chunks).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });

    it("should allow empty arrays", () => {
      const result: SearchResult = {
        chunks: [],
        images: [],
      };

      expect(result.chunks).toHaveLength(0);
      expect(result.images).toHaveLength(0);
    });
  });

  describe("ChatRequest type", () => {
    it("should allow valid ChatRequest with context", () => {
      const request: ChatRequest = {
        message: "Tell me about Asturias",
        context: "User is on the nature page",
      };

      expect(request.message).toBe("Tell me about Asturias");
      expect(request.context).toBe("User is on the nature page");
    });

    it("should allow ChatRequest without optional context", () => {
      const request: ChatRequest = {
        message: "Tell me about Asturias",
      };

      expect(request.message).toBe("Tell me about Asturias");
      expect(request.context).toBeUndefined();
    });
  });

  describe("ChatResponse type", () => {
    it("should allow valid ChatResponse with all properties", () => {
      const response: ChatResponse = {
        message: "Here is information about Asturias...",
        sources: [
          {
            id: "src-1",
            title: "Guide",
            sourcePdf: "guide.pdf",
            snippet: "Snippet",
          },
        ],
        images: [
          {
            id: "img-1",
            path: "/image.jpg",
            sourcePdf: "guide.pdf",
          },
        ],
      };

      expect(response.message).toBe("Here is information about Asturias...");
      expect(response.sources).toHaveLength(1);
      expect(response.images).toHaveLength(1);
    });

    it("should allow ChatResponse without optional properties", () => {
      const response: ChatResponse = {
        message: "Here is information...",
      };

      expect(response.sources).toBeUndefined();
      expect(response.images).toBeUndefined();
    });
  });
});
