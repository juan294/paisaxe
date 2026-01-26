import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, resetRateLimit, getRateLimitStore } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimit();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit("user1");
    expect(result.allowed).toBe(true);
  });

  it("returns correct remaining count after first request", () => {
    const result = checkRateLimit("user1");
    expect(result.remaining).toBe(9);
  });

  it("blocks at limit+1 (11th request returns allowed: false)", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1");
    }
    const result = checkRateLimit("user1");
    expect(result.allowed).toBe(false);
  });

  it("returns retryAfter > 0 when blocked", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1");
    }
    const result = checkRateLimit("user1");
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1");
    }
    // Blocked now
    expect(checkRateLimit("user1").allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(60001);

    const result = checkRateLimit("user1");
    expect(result.allowed).toBe(true);
  });

  it("tracks identifiers independently", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1");
    }
    // user1 is blocked
    expect(checkRateLimit("user1").allowed).toBe(false);
    // user2 should still be allowed
    expect(checkRateLimit("user2").allowed).toBe(true);
  });

  it("prunes expired entries", () => {
    checkRateLimit("user1");
    vi.advanceTimersByTime(60001);

    // After window expires, old timestamps are pruned
    const result = checkRateLimit("user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("handles map overflow without crashing", () => {
    const config = { windowMs: 60_000, maxRequests: 10, maxEntries: 10_000 };
    for (let i = 0; i < 10_001; i++) {
      checkRateLimit(`user-${i}`, config);
    }
    // Should not crash and store should be within bounds
    expect(getRateLimitStore().size).toBeLessThanOrEqual(10_000);
  });

  it("resetRateLimit clears all entries", () => {
    checkRateLimit("user1");
    checkRateLimit("user2");
    expect(getRateLimitStore().size).toBe(2);

    resetRateLimit();
    expect(getRateLimitStore().size).toBe(0);
  });

  it("returns correct limit value", () => {
    const result = checkRateLimit("user1");
    expect(result.limit).toBe(10);
  });

  it("returns resetAt in the future", () => {
    const now = Date.now();
    const result = checkRateLimit("user1");
    expect(result.resetAt).toBeGreaterThan(now);
  });

  it("multiple rapid requests decrement remaining correctly", () => {
    const r1 = checkRateLimit("user1");
    expect(r1.remaining).toBe(9);

    const r2 = checkRateLimit("user1");
    expect(r2.remaining).toBe(8);

    const r3 = checkRateLimit("user1");
    expect(r3.remaining).toBe(7);
  });
});
