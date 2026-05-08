import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ── Mock @upstash/redis before importing the module under test ──────────────
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function () {
    return { get: mockRedisGet, set: mockRedisSet };
  }),
}));

// ── Mock logger so we can assert on warn calls ──────────────────────────────
const mockLoggerWarn = vi.fn();
vi.mock("./logger", () => ({
  logger: { warn: mockLoggerWarn, info: vi.fn(), error: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function redisKey(text: string): string {
  return `embed:${sha256(text)}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("EmbeddingCache (Redis-backed)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: cache miss
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
  });

  it("returns null on cache miss (Redis returns null)", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    const result = await cache.get("hello world");

    expect(result).toBeNull();
    expect(mockRedisGet).toHaveBeenCalledOnce();
  });

  it("returns parsed embedding on cache hit (Redis returns JSON string)", async () => {
    const vector = [0.1, 0.2, 0.3];
    mockRedisGet.mockResolvedValue(JSON.stringify(vector));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    const result = await cache.get("hello world");

    expect(result).toEqual(vector);
  });

  it("returns embedding directly when Upstash auto-parses JSON (Redis returns Array, not string) — line 34", async () => {
    // Upstash Redis client can auto-parse JSON responses into native JS types.
    // When that happens, the stored embedding arrives as an Array, not a JSON string.
    const vector = [0.4, 0.5, 0.6];
    mockRedisGet.mockResolvedValue(vector); // already-parsed array, not a string

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    const result = await cache.get("auto-parsed text");

    expect(result).toEqual(vector);
    expect(Array.isArray(result)).toBe(true);
  });

  it("stores embedding as JSON string with 24h TTL", async () => {
    const vector = [0.4, 0.5, 0.6];

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    await cache.set("some text", vector);

    expect(mockRedisSet).toHaveBeenCalledWith(
      redisKey("some text"),
      JSON.stringify(vector),
      { ex: 86400 }
    );
  });

  it("uses embed: prefix + SHA-256 of input as Redis key", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    await cache.get("my query text");

    const expectedKey = redisKey("my query text");
    expect(mockRedisGet).toHaveBeenCalledWith(expectedKey);
    expect(expectedKey).toMatch(/^embed:[a-f0-9]{64}$/);
  });

  it("returns null and logs warning when Redis.get throws", async () => {
    mockRedisGet.mockRejectedValue(new Error("Connection refused"));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    const result = await cache.get("error text");

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[EMBEDDING_CACHE_MISS]",
      expect.objectContaining({ reason: expect.any(String) })
    );
  });

  it("does NOT call Redis.set when Redis.get throws (no double-fault)", async () => {
    mockRedisGet.mockRejectedValue(new Error("Network error"));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    await cache.get("error text");

    // set is never called via get — this ensures callers skip set on error path
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("silently absorbs Redis.set errors (fire-and-forget)", async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockRejectedValue(new Error("Write failed"));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    // Should not throw
    await expect(cache.set("text", [0.1, 0.2])).resolves.toBeUndefined();
  });

  it("different texts produce different Redis keys", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    await cache.get("text A");
    await cache.get("text B");

    const calls = mockRedisGet.mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]);
  });

  it("same text always produces the same Redis key (deterministic hash)", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache();

    await cache.get("repeated text");
    await cache.get("repeated text");

    const calls = mockRedisGet.mock.calls;
    expect(calls[0][0]).toBe(calls[1][0]);
  });
});
