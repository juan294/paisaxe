import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks required before importing seed-database.ts because it runs side
// effects at module load time (env var checks, createClient calls, etc.)
// ---------------------------------------------------------------------------

// Prevent process.exit when env vars are missing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_KEY", "fake-service-key");
vi.stubEnv("VOYAGE_API_KEY", "");

// Mock the extracted-stories module that may not exist in every checkout
vi.mock("../content/processed/extracted-stories", () => ({
  GENERATED_STORIES: [],
}));

// Mock Supabase to prevent real network calls at import time
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnThis(),
    neq: vi.fn().mockResolvedValue({ error: null }),
  })),
}));

// Mock VoyageAI to prevent real network calls (must be a constructable class-like mock)
vi.mock("voyageai", () => {
  class VoyageAIClientMock {
    constructor(_opts: unknown) {}
  }
  return { VoyageAIClient: VoyageAIClientMock };
});

// Mock unsplash-placeholders to avoid importing src/ code in script tests
vi.mock("../src/lib/unsplash-placeholders", () => ({
  needsPlaceholderImage: vi.fn(() => false),
  getPlaceholderForStory: vi.fn(() => ({ image: "/placeholder.webp", imageSource: null })),
}));

// Mock dotenv so it doesn't read the real .env.local
vi.mock("dotenv", () => ({ config: vi.fn() }));

// Now import the functions under test
import { groupChunksByPdf, computeRetryDelay, isRateLimitError } from "./seed-database";
import type { Chunk } from "./seed-database";

// ---------------------------------------------------------------------------
// groupChunksByPdf
// ---------------------------------------------------------------------------
describe("groupChunksByPdf", () => {
  it("returns empty map for empty input", () => {
    expect(groupChunksByPdf([])).toEqual(new Map());
  });

  it("groups all chunks under the same PDF key", () => {
    const chunks: Chunk[] = [
      { content: "chunk one", sourcePdf: "guide.pdf", pageNumber: 1 },
      { content: "chunk two", sourcePdf: "guide.pdf", pageNumber: 2 },
      { content: "chunk three", sourcePdf: "guide.pdf", pageNumber: 3 },
    ];
    const map = groupChunksByPdf(chunks);
    expect(map.size).toBe(1);
    expect(map.get("guide.pdf")).toHaveLength(3);
  });

  it("groups chunks across multiple PDFs separately", () => {
    const chunks: Chunk[] = [
      { content: "alpha", sourcePdf: "a.pdf", pageNumber: 1 },
      { content: "beta", sourcePdf: "b.pdf", pageNumber: 1 },
      { content: "gamma", sourcePdf: "a.pdf", pageNumber: 2 },
    ];
    const map = groupChunksByPdf(chunks);
    expect(map.size).toBe(2);
    expect(map.get("a.pdf")).toHaveLength(2);
    expect(map.get("b.pdf")).toHaveLength(1);
  });

  it("preserves chunk order within each group", () => {
    const chunks: Chunk[] = [
      { content: "first", sourcePdf: "doc.pdf", pageNumber: 1 },
      { content: "second", sourcePdf: "doc.pdf", pageNumber: 2 },
      { content: "third", sourcePdf: "doc.pdf", pageNumber: 3 },
    ];
    const group = groupChunksByPdf(chunks).get("doc.pdf")!;
    expect(group[0].content).toBe("first");
    expect(group[1].content).toBe("second");
    expect(group[2].content).toBe("third");
  });

  it("preserves sectionTitle on each chunk", () => {
    const chunks: Chunk[] = [
      { content: "body text here", sourcePdf: "guide.pdf", pageNumber: 5, sectionTitle: "NATURALEZA" },
    ];
    const group = groupChunksByPdf(chunks).get("guide.pdf")!;
    expect(group[0].sectionTitle).toBe("NATURALEZA");
  });

  it("handles a single chunk correctly", () => {
    const chunks: Chunk[] = [
      { content: "only one", sourcePdf: "solo.pdf", pageNumber: 1 },
    ];
    const map = groupChunksByPdf(chunks);
    expect(map.size).toBe(1);
    expect(map.get("solo.pdf")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// computeRetryDelay
// ---------------------------------------------------------------------------
describe("computeRetryDelay", () => {
  it("returns the initial delay for attempt 0", () => {
    expect(computeRetryDelay(0, 1000)).toBe(1000);
  });

  it("doubles the delay on each attempt (exponential backoff)", () => {
    expect(computeRetryDelay(1, 1000)).toBe(2000);
    expect(computeRetryDelay(2, 1000)).toBe(4000);
    expect(computeRetryDelay(3, 1000)).toBe(8000);
  });

  it("works with different initial delay values", () => {
    expect(computeRetryDelay(0, 500)).toBe(500);
    expect(computeRetryDelay(1, 500)).toBe(1000);
    expect(computeRetryDelay(2, 500)).toBe(2000);
  });

  it("handles attempt 0 with initial delay 0 (edge case)", () => {
    expect(computeRetryDelay(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isRateLimitError
// ---------------------------------------------------------------------------
describe("isRateLimitError", () => {
  it("returns true for an Error with '429' in the message", () => {
    expect(isRateLimitError(new Error("Request failed with status 429"))).toBe(true);
  });

  it("returns true for an Error with 'rate limit' in the message", () => {
    expect(isRateLimitError(new Error("You have exceeded the rate limit"))).toBe(true);
  });

  it("returns true for 'rate limit' regardless of surrounding words", () => {
    expect(isRateLimitError(new Error("rate limit exceeded"))).toBe(true);
  });

  it("returns false for a generic non-rate-limit error", () => {
    expect(isRateLimitError(new Error("Network timeout"))).toBe(false);
    expect(isRateLimitError(new Error("Internal server error 500"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isRateLimitError("string error")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(429)).toBe(false);
  });

  it("returns false for an Error with empty message", () => {
    expect(isRateLimitError(new Error(""))).toBe(false);
  });
});
