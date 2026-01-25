import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock the dependencies
vi.mock("@/lib/claude", () => ({
  generateChatResponse: vi.fn(),
  extractSourcesFromChunks: vi.fn(),
}));

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  search: vi.fn(),
}));

import { generateChatResponse, extractSourcesFromChunks } from "@/lib/claude";
import { generateEmbedding } from "@/lib/embeddings";
import { search } from "@/lib/search";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a successful chat response", async () => {
    const mockEmbedding = new Array(1024).fill(0.1);
    const mockChunks = [
      { id: "1", content: "Test content", sourcePdf: "test.pdf" },
    ];
    const mockImages = [{ id: "img1", path: "/test.jpg", sourcePdf: "test.pdf" }];
    const mockSources = [{ id: "1", title: "Test", sourcePdf: "test.pdf", snippet: "..." }];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(search).mockResolvedValue({ chunks: mockChunks, images: mockImages });
    vi.mocked(generateChatResponse).mockResolvedValue("This is a response about Asturias");
    vi.mocked(extractSourcesFromChunks).mockReturnValue(mockSources);

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Tell me about Asturias" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("This is a response about Asturias");
    expect(data.sources).toEqual(mockSources);
    expect(data.images).toEqual(mockImages);
  });

  it("should include context in the message when provided", async () => {
    const mockEmbedding = new Array(1024).fill(0.1);

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(search).mockResolvedValue({ chunks: [], images: [] });
    vi.mocked(generateChatResponse).mockResolvedValue("Response");
    vi.mocked(extractSourcesFromChunks).mockReturnValue([]);

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "What is this?",
        context: "User is viewing Lagos de Covadonga",
      }),
    });

    await POST(request);

    expect(generateChatResponse).toHaveBeenCalledWith(
      expect.stringContaining("Lagos de Covadonga"),
      expect.any(Array)
    );
  });

  it("should return 400 when message is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Message is required");
  });

  it("should return 400 when message is not a string", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: 123 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Message is required");
  });

  it("should return 500 on internal error", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("API Error"));

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Test" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
