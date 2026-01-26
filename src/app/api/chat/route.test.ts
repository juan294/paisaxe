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

vi.mock("@/lib/validation", () => ({
  validateChatRequest: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: { enabled: false }, error: null }),
        }),
      }),
    }),
  },
}));

import { generateChatResponse, extractSourcesFromChunks } from "@/lib/claude";
import { generateEmbedding } from "@/lib/embeddings";
import { search } from "@/lib/search";
import { validateChatRequest } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: rate limit allows requests
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });

    // Default: validation passes
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: true,
      sanitizedMessage: "Test message",
      sanitizedContext: undefined,
    });
  });

  it("should return a successful chat response", async () => {
    const mockEmbedding = new Array(1024).fill(0.1);
    const mockChunks = [
      { id: "1", content: "Test content", sourcePdf: "test.pdf" },
    ];
    const mockImages = [{ id: "img1", path: "/test.jpg", sourcePdf: "test.pdf" }];
    const mockSources = [{ id: "1", title: "Test", sourcePdf: "test.pdf", snippet: "..." }];

    vi.mocked(validateChatRequest).mockReturnValue({
      valid: true,
      sanitizedMessage: "Tell me about Asturias",
      sanitizedContext: undefined,
    });
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

    vi.mocked(validateChatRequest).mockReturnValue({
      valid: true,
      sanitizedMessage: "What is this?",
      sanitizedContext: "User is viewing Lagos de Covadonga",
    });
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
      expect.any(Array),
      false
    );
  });

  it("should return 400 when message is missing", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Message is required",
    });

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
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Message must be a string",
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: 123 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Message must be a string");
  });

  it("should return 500 on internal error", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: true,
      sanitizedMessage: "Test",
      sanitizedContext: undefined,
    });
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

  it("should return 400 for empty message (after trim)", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Message cannot be empty",
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Message cannot be empty");
  });

  it("should return 400 for whitespace-only message", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Message cannot be empty",
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "   " }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Message cannot be empty");
  });

  it("should return 400 for message exceeding 500 chars", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Message exceeds maximum length of 500 characters",
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "a".repeat(501) }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Message exceeds maximum length of 500 characters");
  });

  it("should return 400 for non-string context", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Context must be a string",
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "hello", context: 42 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Context must be a string");
  });

  it("should return 400 for context exceeding 600 chars", async () => {
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: false,
      error: "Context exceeds maximum length of 600 characters",
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "hello", context: "b".repeat(601) }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Context exceeds maximum length of 600 characters");
  });

  it("should return 429 when rate limited with correct headers", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: 1234567890,
      retryAfter: 30,
    });

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Test" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Too many requests. Please try again later.");
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1234567890");
  });

  it("should include X-RateLimit-Remaining header on successful response", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 10,
      remaining: 7,
      resetAt: Date.now() + 60000,
    });
    vi.mocked(validateChatRequest).mockReturnValue({
      valid: true,
      sanitizedMessage: "Hello",
      sanitizedContext: undefined,
    });
    vi.mocked(generateEmbedding).mockResolvedValue(new Array(1024).fill(0.1));
    vi.mocked(search).mockResolvedValue({ chunks: [], images: [] });
    vi.mocked(generateChatResponse).mockResolvedValue("Response");
    vi.mocked(extractSourcesFromChunks).mockReturnValue([]);

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("7");
  });
});
