import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("rate-limit", () => {
  describe("in-memory backend (no Upstash env vars)", () => {
    let checkRateLimit: typeof import("./rate-limit").checkRateLimit;
    let resetRateLimit: typeof import("./rate-limit").resetRateLimit;
    let getRateLimitStore: typeof import("./rate-limit").getRateLimitStore;

    beforeEach(async () => {
      vi.useFakeTimers();
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      vi.resetModules();
      const mod = await import("./rate-limit");
      checkRateLimit = mod.checkRateLimit;
      resetRateLimit = mod.resetRateLimit;
      getRateLimitStore = mod.getRateLimitStore;
      resetRateLimit();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("allows requests under the limit", async () => {
      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
    });

    it("returns correct remaining count after first request", async () => {
      const result = await checkRateLimit("user1");
      expect(result.remaining).toBe(9);
    });

    it("blocks at limit+1 (11th request returns allowed: false)", async () => {
      for (let i = 0; i < 10; i++) {
        await checkRateLimit("user1");
      }
      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(false);
    });

    it("returns retryAfter > 0 when blocked", async () => {
      for (let i = 0; i < 10; i++) {
        await checkRateLimit("user1");
      }
      const result = await checkRateLimit("user1");
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("resets after window expires", async () => {
      for (let i = 0; i < 10; i++) {
        await checkRateLimit("user1");
      }
      expect((await checkRateLimit("user1")).allowed).toBe(false);

      vi.advanceTimersByTime(60001);

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
    });

    it("tracks identifiers independently", async () => {
      for (let i = 0; i < 10; i++) {
        await checkRateLimit("user1");
      }
      expect((await checkRateLimit("user1")).allowed).toBe(false);
      expect((await checkRateLimit("user2")).allowed).toBe(true);
    });

    it("prunes expired entries", async () => {
      await checkRateLimit("user1");
      vi.advanceTimersByTime(60001);

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it("handles map overflow without crashing", async () => {
      const config = { windowMs: 60_000, maxRequests: 10, maxEntries: 10_000 };
      for (let i = 0; i < 10_001; i++) {
        await checkRateLimit(`user-${i}`, config);
      }
      expect(getRateLimitStore().size).toBeLessThanOrEqual(10_000);
    });

    it("deletes expired entries when store exceeds maxEntries", async () => {
      const config = { windowMs: 1_000, maxRequests: 10, maxEntries: 3 };

      // Add 3 entries to fill the store
      await checkRateLimit("a", config);
      await checkRateLimit("b", config);
      await checkRateLimit("c", config);
      expect(getRateLimitStore().size).toBe(3);

      // Expire all entries by advancing past the window
      vi.advanceTimersByTime(1_001);

      // Adding a new entry should trigger cleanup of the expired entries
      await checkRateLimit("d", config);

      // The expired entries should have been deleted, leaving only "d"
      expect(getRateLimitStore().has("d")).toBe(true);
      expect(getRateLimitStore().size).toBeLessThanOrEqual(3);
    });

    it("resetRateLimit clears all entries", async () => {
      await checkRateLimit("user1");
      await checkRateLimit("user2");
      expect(getRateLimitStore().size).toBe(2);

      resetRateLimit();
      expect(getRateLimitStore().size).toBe(0);
    });

    it("returns correct limit value", async () => {
      const result = await checkRateLimit("user1");
      expect(result.limit).toBe(10);
    });

    it("returns resetAt in the future", async () => {
      const now = Date.now();
      const result = await checkRateLimit("user1");
      expect(result.resetAt).toBeGreaterThan(now);
    });

    it("multiple rapid requests decrement remaining correctly", async () => {
      const r1 = await checkRateLimit("user1");
      expect(r1.remaining).toBe(9);

      const r2 = await checkRateLimit("user1");
      expect(r2.remaining).toBe(8);

      const r3 = await checkRateLimit("user1");
      expect(r3.remaining).toBe(7);
    });

    it("accepts custom config for window and max requests", async () => {
      const config = { windowMs: 10_000, maxRequests: 2, maxEntries: 100 };
      await checkRateLimit("user1", config);
      await checkRateLimit("user1", config);
      const result = await checkRateLimit("user1", config);
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(2);
    });
  });

  describe("Upstash backend (env vars set)", () => {
    let checkRateLimit: typeof import("./rate-limit").checkRateLimit;
    let resetRateLimit: typeof import("./rate-limit").resetRateLimit;

    const mockLimit = vi.fn();

    beforeEach(async () => {
      vi.useFakeTimers();
      process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

      vi.resetModules();
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: class MockRatelimit {
          limit = mockLimit;
          static slidingWindow = vi.fn().mockReturnValue({
            type: "slidingWindow",
          });
        },
      }));
      vi.doMock("@upstash/redis", () => ({
        Redis: class MockRedis {
          constructor() {}
        },
      }));

      const mod = await import("./rate-limit");
      checkRateLimit = mod.checkRateLimit;
      resetRateLimit = mod.resetRateLimit;
    });

    afterEach(() => {
      vi.useRealTimers();
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      mockLimit.mockReset();
    });

    it("delegates to Upstash when env vars are set", async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
      });

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.limit).toBe(10);
      expect(mockLimit).toHaveBeenCalledWith("user1");
    });

    it("returns blocked result when Upstash denies", async () => {
      const resetTime = Date.now() + 30_000;
      mockLimit.mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: resetTime,
      });

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("falls back to in-memory if Upstash call fails", async () => {
      mockLimit.mockRejectedValue(new Error("Redis connection failed"));

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it("emits logger.warn([RATE_LIMIT_DEGRADED]) when falling back to in-memory in dev/test", async () => {
      // Ensure we're NOT in production so the in-memory fallback path is taken
      vi.stubEnv("NODE_ENV", "test");
      mockLimit.mockRejectedValue(new Error("Redis connection failed"));

      // Spy on the logger module's warn method
      const loggerModule = await import("./logger");
      const warnSpy = vi.spyOn(loggerModule.logger, "warn").mockImplementation(() => {});

      await checkRateLimit("user1");

      expect(warnSpy).toHaveBeenCalledWith(
        "[RATE_LIMIT_DEGRADED]",
        expect.objectContaining({ reason: "Redis unavailable" })
      );

      vi.unstubAllEnvs();
      warnSpy.mockRestore();
    });

    it("fails closed (denies) in production when Upstash call fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      mockLimit.mockRejectedValue(new Error("Redis down"));

      const result = await checkRateLimit("user1", {
        windowMs: 60_000,
        maxRequests: 10,
        maxEntries: 100,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(10);
      expect(result.retryAfter).toBe(60);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[RATE_LIMIT_FALLBACK]",
        expect.objectContaining({ identifier: "user1" })
      );

      vi.unstubAllEnvs();
      consoleSpy.mockRestore();
    });

    it("uses identifier as-is in Upstash key", async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 10_000,
      });

      await checkRateLimit("mcp-weather:127.0.0.1", {
        windowMs: 10_000,
        maxRequests: 5,
        maxEntries: 100,
      });
      expect(mockLimit).toHaveBeenCalledWith("mcp-weather:127.0.0.1");
    });

    it("resetRateLimit does not crash in Upstash mode", () => {
      expect(() => resetRateLimit()).not.toThrow();
    });

    it("creates distinct Upstash limiter per config", async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
      });

      // First call with default config creates one Ratelimit instance
      await checkRateLimit("chat:user1");

      // Second call with a different config creates a separate instance
      mockLimit.mockResolvedValue({
        success: true,
        limit: 1,
        remaining: 0,
        reset: Date.now() + 60_000,
      });
      await checkRateLimit("suggestion:user1", {
        windowMs: 60_000,
        maxRequests: 1,
        maxEntries: 100,
      });

      // slidingWindow should have been called twice — once per distinct config
      const { Ratelimit: MockRatelimit } = await import("@upstash/ratelimit");
      expect(MockRatelimit.slidingWindow).toHaveBeenCalledTimes(2);
    });

    it("reuses cached Upstash limiter for same config", async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
      });

      // Two calls with the same default config should reuse one instance
      await checkRateLimit("user1");
      await checkRateLimit("user2");

      const { Ratelimit: MockRatelimit } = await import("@upstash/ratelimit");
      expect(MockRatelimit.slidingWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe("backend auto-detection", () => {
    afterEach(() => {
      vi.useRealTimers();
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it("uses in-memory when only URL is set (both required)", async () => {
      vi.resetModules();
      process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { checkRateLimit, resetRateLimit, getRateLimitStore } =
        await import("./rate-limit");
      resetRateLimit();

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
      expect(getRateLimitStore().size).toBe(1);
    });

    it("uses in-memory when only TOKEN is set (both required)", async () => {
      vi.resetModules();
      delete process.env.UPSTASH_REDIS_REST_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

      const { checkRateLimit, resetRateLimit, getRateLimitStore } =
        await import("./rate-limit");
      resetRateLimit();

      const result = await checkRateLimit("user1");
      expect(result.allowed).toBe(true);
      expect(getRateLimitStore().size).toBe(1);
    });
  });
});
