/**
 * QA-L2: Unit tests for chat-route-utils.
 *
 * Covers all branches of buildEnrichedChatMessage and buildRateLimitHeaders.
 */
import { describe, it, expect } from "vitest";
import {
  buildEnrichedChatMessage,
  buildRateLimitHeaders,
} from "./chat-route-utils";

describe("buildEnrichedChatMessage", () => {
  it("returns the raw message when no context is provided", () => {
    expect(buildEnrichedChatMessage("¿Qué hay en Oviedo?")).toBe(
      "¿Qué hay en Oviedo?"
    );
  });

  it("returns the raw message when context is an empty string (falsy branch)", () => {
    // Empty string is falsy → message returned as-is
    expect(buildEnrichedChatMessage("Hello", "")).toBe("Hello");
  });

  it("returns the raw message when context is undefined", () => {
    expect(buildEnrichedChatMessage("Hello", undefined)).toBe("Hello");
  });

  it("prepends context with the standard separator when context is truthy", () => {
    const result = buildEnrichedChatMessage(
      "¿Cuánto cuesta entrar?",
      "El usuario está viendo Lagos de Covadonga"
    );
    expect(result).toBe(
      "El usuario está viendo Lagos de Covadonga\n\nPregunta del usuario: ¿Cuánto cuesta entrar?"
    );
  });

  it("handles a message-only call with no second argument", () => {
    // Equivalent to context=undefined
    const result = buildEnrichedChatMessage("Dime más");
    expect(result).toBe("Dime más");
  });
});

describe("buildRateLimitHeaders", () => {
  const baseLimit = {
    limit: 10,
    remaining: 7,
    resetAt: 1_700_000_000,
  };

  it("returns X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset", () => {
    const headers = buildRateLimitHeaders(baseLimit);
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("7");
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
  });

  it("does NOT include Retry-After when retryAfter is undefined", () => {
    const headers = buildRateLimitHeaders(baseLimit);
    expect("Retry-After" in headers).toBe(false);
  });

  it("includes Retry-After when retryAfter is defined", () => {
    const headers = buildRateLimitHeaders({ ...baseLimit, retryAfter: 30 });
    expect(headers["Retry-After"]).toBe("30");
  });

  it("sets X-RateLimit-Remaining to '0' when blocked=true, regardless of remaining", () => {
    const headers = buildRateLimitHeaders({ ...baseLimit, remaining: 5 }, true);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("uses the actual remaining value when blocked=false (default)", () => {
    const headers = buildRateLimitHeaders(
      { ...baseLimit, remaining: 3 },
      false
    );
    expect(headers["X-RateLimit-Remaining"]).toBe("3");
  });

  it("includes Retry-After and sets remaining to '0' when blocked with retryAfter", () => {
    const headers = buildRateLimitHeaders(
      { ...baseLimit, remaining: 0, retryAfter: 60 },
      true
    );
    expect(headers["Retry-After"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});
