import { describe, it, expect } from "vitest";
import { chatRequestSchema } from "./schemas";

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
