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
const TEST_MODEL = "voyage-3.5";
const TEST_DIMENSIONS = 512;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function redisKey(
  text: string,
  model: string = TEST_MODEL,
  dimensions: number = TEST_DIMENSIONS
): string {
  return `embed:${model}:${dimensions}:${sha256(text)}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("EmbeddingCache (Redis-backed)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    // Default: cache miss
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
  });

  it("returns null on cache miss (Redis returns null)", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    const result = await cache.get("hello world");

    expect(result).toBeNull();
    expect(mockRedisGet).toHaveBeenCalledOnce();
  });

  it("returns parsed embedding on cache hit (Redis returns JSON string)", async () => {
    const vector = [0.1, 0.2, 0.3];
    mockRedisGet.mockResolvedValue(JSON.stringify(vector));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    const result = await cache.get("hello world");

    expect(result).toEqual(vector);
  });

  it("returns embedding directly when Upstash auto-parses JSON (Redis returns Array, not string) — line 34", async () => {
    // Upstash Redis client can auto-parse JSON responses into native JS types.
    // When that happens, the stored embedding arrives as an Array, not a JSON string.
    const vector = [0.4, 0.5, 0.6];
    mockRedisGet.mockResolvedValue(vector); // already-parsed array, not a string

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    const result = await cache.get("auto-parsed text");

    expect(result).toEqual(vector);
    expect(Array.isArray(result)).toBe(true);
  });

  it("stores embedding as JSON string with 24h TTL", async () => {
    const vector = [0.4, 0.5, 0.6];

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.set("some text", vector);

    expect(mockRedisSet).toHaveBeenCalledWith(
      redisKey("some text"),
      JSON.stringify(vector),
      { ex: 86400 }
    );
  });

  it("uses embed: prefix + model + dimensions + SHA-256 of input as Redis key", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.get("my query text");

    const expectedKey = redisKey("my query text");
    expect(mockRedisGet).toHaveBeenCalledWith(expectedKey);
    expect(expectedKey).toMatch(/^embed:voyage-3\.5:512:[a-f0-9]{64}$/);
  });

  it("produces a different cache key when the model changes for the same query text", async () => {
    // Regression test for BE-M7: the cache key must be scoped to the embedding
    // model, or a model change would silently serve stale-model vectors from
    // the old key for up to the 24h TTL.
    const { EmbeddingCache } = await import("./embedding-cache");
    const cacheOldModel = new EmbeddingCache("voyage-3.5", TEST_DIMENSIONS);
    const cacheNewModel = new EmbeddingCache("voyage-4", TEST_DIMENSIONS);

    await cacheOldModel.get("same query text");
    await cacheNewModel.get("same query text");

    const [oldKey] = mockRedisGet.mock.calls[0];
    const [newKey] = mockRedisGet.mock.calls[1];
    expect(newKey).not.toBe(oldKey);
  });

  it("produces a different cache key when the output dimension changes for the same query text", async () => {
    // Regression test for BE-M7: the cache key must be scoped to the output
    // dimension, or a dimension change (e.g. migration 017's Matryoshka
    // reduction) would collide with vectors of the previous dimension and
    // could crash match_chunks on a dimension mismatch.
    const { EmbeddingCache } = await import("./embedding-cache");
    const cacheOldDims = new EmbeddingCache(TEST_MODEL, 1024);
    const cacheNewDims = new EmbeddingCache(TEST_MODEL, 512);

    await cacheOldDims.get("same query text");
    await cacheNewDims.get("same query text");

    const [oldKey] = mockRedisGet.mock.calls[0];
    const [newKey] = mockRedisGet.mock.calls[1];
    expect(newKey).not.toBe(oldKey);
  });

  it("returns null and logs warning when Redis.get throws", async () => {
    mockRedisGet.mockRejectedValue(new Error("Connection refused"));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

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
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.get("error text");

    // set is never called via get — this ensures callers skip set on error path
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("skips Redis calls when cache env vars are missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await expect(cache.get("text")).resolves.toBeNull();
    await expect(cache.set("text", [0.1, 0.2])).resolves.toBeUndefined();
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("silently absorbs Redis.set errors (fire-and-forget)", async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockRejectedValue(new Error("Write failed"));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    // Should not throw
    await expect(cache.set("text", [0.1, 0.2])).resolves.toBeUndefined();
  });

  it("stringifies a non-Error rejection when Redis.get throws (falls to String(err) branch)", async () => {
    mockRedisGet.mockRejectedValue("plain string rejection");

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    const result = await cache.get("weird error text");

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[EMBEDDING_CACHE_MISS]",
      { reason: "plain string rejection" }
    );
  });

  it("stringifies a non-Error rejection from Redis.set's async .catch() (fire-and-forget path)", async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockRejectedValue({ code: "ECONNRESET" });

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.set("text", [0.1, 0.2]);
    // Allow the fire-and-forget .catch() microtask to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[EMBEDDING_CACHE_SET_FAILED]",
      { reason: String({ code: "ECONNRESET" }) }
    );
  });

  it("stringifies a non-Error value thrown synchronously by getRedis().set (outer catch)", async () => {
    mockRedisGet.mockResolvedValue(null);
    // Throwing synchronously (not returning a rejected promise) exercises the
    // outer try/catch in set(), not the inner .catch() on the returned promise.
    mockRedisSet.mockImplementation(() => {
      throw "synchronous non-Error throw";
    });

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await expect(cache.set("text", [0.1, 0.2])).resolves.toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[EMBEDDING_CACHE_SET_FAILED]",
      { reason: "synchronous non-Error throw" }
    );
  });

  it("uses err.message when getRedis().set throws a real Error synchronously (outer catch, Error branch)", async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockImplementation(() => {
      throw new Error("sync boom");
    });

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await expect(cache.set("text", [0.1, 0.2])).resolves.toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[EMBEDDING_CACHE_SET_FAILED]",
      { reason: "sync boom" }
    );
  });

  it("does not wait for Redis.set to finish", async () => {
    mockRedisSet.mockReturnValue(new Promise(() => {}));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    const result = await Promise.race([
      cache.set("slow write", [0.1, 0.2]).then(() => "returned"),
      new Promise((resolve) => setTimeout(() => resolve("blocked"), 10)),
    ]);

    expect(result).toBe("returned");
  });

  it("handles synchronous throw from getRedis().set — outer catch at line 65", async () => {
    // mockRedisSet throws synchronously (not a rejected promise) — this hits the outer
    // catch block in EmbeddingCache.set(), not the .catch() on the promise chain.
    mockRedisSet.mockImplementation(() => {
      throw new Error("sync Redis error");
    });

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await expect(cache.set("text", [0.1, 0.2])).resolves.toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[EMBEDDING_CACHE_SET_FAILED]",
      expect.objectContaining({ reason: "sync Redis error" })
    );
  });

  it("different texts produce different Redis keys", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.get("text A");
    await cache.get("text B");

    const calls = mockRedisGet.mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]);
  });

  it("same text always produces the same Redis key (deterministic hash)", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.get("repeated text");
    await cache.get("repeated text");

    const calls = mockRedisGet.mock.calls;
    expect(calls[0][0]).toBe(calls[1][0]);
  });
});
