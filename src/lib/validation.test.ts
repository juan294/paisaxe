import { describe, it, expect } from "vitest";
import { sanitizeInput } from "./validation";

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
