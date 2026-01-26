import { describe, it, expect } from "vitest";
import { sanitizeInput, validateChatRequest } from "./validation";

describe("sanitizeInput", () => {
  it("trims leading and trailing whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("collapses multiple spaces to a single space", () => {
    expect(sanitizeInput("hello    world")).toBe("hello world");
  });

  it("strips control characters like \\x00, \\x08, \\x7F", () => {
    expect(sanitizeInput("hello\x00\x08\x7Fworld")).toBe("helloworld");
  });

  it("strips zero-width characters like \\u200B and \\uFEFF", () => {
    expect(sanitizeInput("hello\u200B\uFEFFworld")).toBe("helloworld");
  });

  it("preserves newlines", () => {
    expect(sanitizeInput("hello\nworld")).toBe("hello\nworld");
  });
});

describe("validateChatRequest", () => {
  it("rejects null body", () => {
    const result = validateChatRequest(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid request body");
  });

  it("rejects undefined body", () => {
    const result = validateChatRequest(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid request body");
  });

  it("rejects missing message", () => {
    const result = validateChatRequest({});
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message is required");
  });

  it("rejects non-string message (number)", () => {
    const result = validateChatRequest({ message: 123 });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message must be a string");
  });

  it("rejects non-string message (boolean)", () => {
    const result = validateChatRequest({ message: true });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message must be a string");
  });

  it("rejects non-string message (array)", () => {
    const result = validateChatRequest({ message: ["hello"] });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message must be a string");
  });

  it("rejects empty string message", () => {
    const result = validateChatRequest({ message: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message cannot be empty");
  });

  it("rejects whitespace-only message", () => {
    const result = validateChatRequest({ message: "   " });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message cannot be empty");
  });

  it("rejects message over 500 characters", () => {
    const longMessage = "a".repeat(501);
    const result = validateChatRequest({ message: longMessage });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Message exceeds maximum length of 500 characters");
  });

  it("accepts valid message and returns sanitized version", () => {
    const result = validateChatRequest({ message: "  hello   world  " });
    expect(result.valid).toBe(true);
    expect(result.sanitizedMessage).toBe("hello world");
  });

  it("accepts undefined context", () => {
    const result = validateChatRequest({ message: "hello" });
    expect(result.valid).toBe(true);
    expect(result.sanitizedContext).toBeUndefined();
  });

  it("rejects non-string context", () => {
    const result = validateChatRequest({ message: "hello", context: 42 });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Context must be a string");
  });

  it("rejects context over 600 characters", () => {
    const longContext = "b".repeat(601);
    const result = validateChatRequest({ message: "hello", context: longContext });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Context exceeds maximum length of 600 characters");
  });

  it("returns sanitized context when provided", () => {
    const result = validateChatRequest({
      message: "hello",
      context: "  some   context  ",
    });
    expect(result.valid).toBe(true);
    expect(result.sanitizedContext).toBe("some context");
  });
});
