import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("rate-limit empty window boundary", () => {
  it("denies a zero-request limit with a finite retry window, then accepts corrected capacity", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    vi.resetModules();
    const { checkRateLimit, resetRateLimit } = await import("./rate-limit");
    resetRateLimit();
    try {
      await expect(checkRateLimit("zero-capacity", { windowMs: 60_000, maxRequests: 0, maxEntries: 100 })).resolves.toEqual({
        allowed: false, limit: 0, remaining: 0, resetAt: Date.now() + 60_000, retryAfter: 60,
      });
      await expect(checkRateLimit("zero-capacity", { windowMs: 60_000, maxRequests: 1, maxEntries: 100 })).resolves.toEqual({
        allowed: true, limit: 1, remaining: 0, resetAt: Date.now() + 60_000,
      });
    } finally { resetRateLimit(); }
  });
});
