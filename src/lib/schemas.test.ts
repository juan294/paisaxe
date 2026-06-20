import { describe, it, expect } from "vitest";
import { chatRequestSchema, favoritesPostSchema } from "./schemas";

/**
 * BE-L3 (#524): the chat schema is now the single validation path. These tests
 * cover the behaviour that previously lived in validateChatRequest:
 * sanitization, post-sanitization length limits, and messageIndex coercion.
 */
describe("chatRequestSchema", () => {
  it("sanitizes the message (trim + collapse whitespace) in one pass", () => {
    const result = chatRequestSchema.safeParse({ message: "  hello   world  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("hello world");
      expect(result.data.messageIndex).toBe(0);
    }
  });

  it("rejects a message that is empty after sanitization", () => {
    const result = chatRequestSchema.safeParse({ message: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing message", () => {
    const result = chatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-string message", () => {
    const result = chatRequestSchema.safeParse({ message: 123 });
    expect(result.success).toBe(false);
  });

  it("rejects a message over 500 characters", () => {
    const result = chatRequestSchema.safeParse({ message: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("sanitizes and accepts a valid context", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      context: "  some   context  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.context).toBe("some context");
    }
  });

  it("rejects a context over 600 characters", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      context: "b".repeat(601),
    });
    expect(result.success).toBe(false);
  });

  it("preserves a valid messageIndex", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: 3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(3);
    }
  });

  it("coerces a negative messageIndex to 0", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: -1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(0);
    }
  });

  it("coerces a non-integer messageIndex to 0", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: 2.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(0);
    }
  });

  it("coerces a non-number messageIndex to 0", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: "abc" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(0);
    }
  });
});

// ─── BE-L1: favoritesPostSchema array bounds ───────────────────────────────
describe("favoritesPostSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts an array of 1 UUID", () => {
    const result = favoritesPostSchema.safeParse({ storyIds: [validUuid] });
    expect(result.success).toBe(true);
  });

  it("accepts an array of 200 UUIDs", () => {
    // Generate 200 unique-enough UUIDs by varying the last segment
    const ids = Array.from({ length: 200 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    );
    const result = favoritesPostSchema.safeParse({ storyIds: ids });
    expect(result.success).toBe(true);
  });

  it("rejects an array of 201 UUIDs (BE-L1: missing .max(200))", () => {
    const ids = Array.from({ length: 201 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    );
    const result = favoritesPostSchema.safeParse({ storyIds: ids });
    expect(result.success).toBe(false);
  });

  it("rejects an empty array", () => {
    const result = favoritesPostSchema.safeParse({ storyIds: [] });
    expect(result.success).toBe(false);
  });
});
