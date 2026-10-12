import { requiredValue } from "@/test/required-value";
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

function normalizedText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function redisKey(
  text: string,
  model: string = TEST_MODEL,
  dimensions: number = TEST_DIMENSIONS
): string {
  return `embed:${model}:${dimensions}:${sha256(normalizedText(text))}`;
}

function searchResultKey(text: string, limit: number): string {
  return `search:v2:legacy:${limit}:${sha256(normalizedText(text))}`;
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
    const vector = Array.from({ length: TEST_DIMENSIONS }, (_, i) => i / TEST_DIMENSIONS);
    mockRedisGet.mockResolvedValue(JSON.stringify(vector));

    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    const result = await cache.get("hello world");

    expect(result).toEqual(vector);
  });

  it("returns embedding directly when Upstash auto-parses JSON (Redis returns Array, not string) — line 34", async () => {
    // Upstash Redis client can auto-parse JSON responses into native JS types.
    // When that happens, the stored embedding arrives as an Array, not a JSON string.
    const vector = Array(TEST_DIMENSIONS).fill(0.4);
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

    const [oldKey] = requiredValue(mockRedisGet.mock.calls[0], "src/lib/embedding-cache.test.ts:131 mock call tuple");
    const [newKey] = requiredValue(mockRedisGet.mock.calls[1], "src/lib/embedding-cache.test.ts:132 mock call tuple");
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

    const [oldKey] = requiredValue(mockRedisGet.mock.calls[0], "src/lib/embedding-cache.test.ts:148 mock call tuple");
    const [newKey] = requiredValue(mockRedisGet.mock.calls[1], "src/lib/embedding-cache.test.ts:149 mock call tuple");
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
    expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:308 calls[0]")[0]).not.toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:308 calls[1]")[0]);
  });

  it("same text always produces the same Redis key (deterministic hash)", async () => {
    const { EmbeddingCache } = await import("./embedding-cache");
    const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

    await cache.get("repeated text");
    await cache.get("repeated text");

    const calls = mockRedisGet.mock.calls;
    expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:319 calls[0]")[0]).toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:319 calls[1]")[0]);
  });

  // ── PE-L5 (#819): normalize query text before hashing ─────────────────────
  describe("query text normalization (#819)", () => {
    it("trims leading/trailing whitespace before hashing, so 'Oviedo' and ' Oviedo  ' share a cache entry", async () => {
      const { EmbeddingCache } = await import("./embedding-cache");
      const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

      await cache.get("Oviedo");
      await cache.get("  Oviedo  ");

      const calls = mockRedisGet.mock.calls;
      expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:332 calls[0]")[0]).toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:332 calls[1]")[0]);
      expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:333 calls[0]")[0]).toBe(redisKey("Oviedo"));
    });

    it("collapses internal whitespace runs before hashing", async () => {
      const { EmbeddingCache } = await import("./embedding-cache");
      const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

      await cache.get("best   restaurants  in Asturias");
      await cache.get("best restaurants in Asturias");

      const calls = mockRedisGet.mock.calls;
      expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:344 calls[0]")[0]).toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:344 calls[1]")[0]);
    });

    it("does NOT fold case — embeddings are case-sensitive, so 'Oviedo' and 'oviedo' must stay distinct entries", async () => {
      const { EmbeddingCache } = await import("./embedding-cache");
      const cache = new EmbeddingCache(TEST_MODEL, TEST_DIMENSIONS);

      await cache.get("Oviedo");
      await cache.get("oviedo");

      const calls = mockRedisGet.mock.calls;
      expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:355 calls[0]")[0]).not.toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:355 calls[1]")[0]);
    });

    it("exports normalizeQueryText for reuse by other cache keys (e.g. SearchResultCache)", async () => {
      const { normalizeQueryText } = await import("./embedding-cache");
      expect(normalizeQueryText("  Oviedo   guide  ")).toBe("Oviedo guide");
    });
  });
});

// ── SearchResultCache (#810) ─────────────────────────────────────────────────
describe("SearchResultCache (Redis-backed)", () => {
  const sampleResult = {
    chunks: [
      {
        id: "chunk-1",
        content: "Oviedo is the capital of Asturias",
        sourcePdf: "guide.pdf",
        pageNumber: 1,
        sectionTitle: "Intro",
        imageRefs: ["img1.jpg"],
        similarity: 0.9,
      },
    ],
    images: [],
  };

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
  });

  it("returns null on cache miss", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    const result = await cache.get("Oviedo", 3, "legacy");

    expect(result).toBeNull();
  });

  it("returns the parsed SearchResult on cache hit (Redis returns JSON string)", async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify(sampleResult));

    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    const result = await cache.get("Oviedo", 3, "legacy");

    expect(result).toEqual(sampleResult);
  });

  it("returns the result directly when Upstash auto-parses JSON into an object", async () => {
    mockRedisGet.mockResolvedValue(sampleResult);

    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    const result = await cache.get("Oviedo", 3, "legacy");

    expect(result).toEqual(sampleResult);
  });

  it("stores the result as JSON with the short (10 minute) TTL", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    await cache.set("Oviedo", 3, sampleResult, "legacy");

    expect(mockRedisSet).toHaveBeenCalledWith(
      searchResultKey("Oviedo", 3),
      JSON.stringify(sampleResult),
      { ex: 600 }
    );
  });

  it("keys on normalized query text + limit — distinct limits do not collide", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    await cache.get("Oviedo", 3, "legacy");
    await cache.get("Oviedo", 5, "legacy");

    const calls = mockRedisGet.mock.calls;
    expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:443 calls[0]")[0]).not.toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:443 calls[1]")[0]);
  });

  it("normalizes whitespace before hashing, consistent with the embedding cache", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    await cache.get("  Oviedo  ", 3, "legacy");
    await cache.get("Oviedo", 3, "legacy");

    const calls = mockRedisGet.mock.calls;
    expect(requiredValue(calls[0], "src/lib/embedding-cache.test.ts:454 calls[0]")[0]).toBe(requiredValue(calls[1], "src/lib/embedding-cache.test.ts:454 calls[1]")[0]);
  });

  it("skips Redis calls when cache env vars are missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    await expect(cache.get("Oviedo", 3, "legacy")).resolves.toBeNull();
    await expect(cache.set("Oviedo", 3, sampleResult, "legacy")).resolves.toBeUndefined();
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("returns null and logs a warning when Redis.get throws", async () => {
    mockRedisGet.mockRejectedValue(new Error("Connection refused"));

    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    const result = await cache.get("Oviedo", 3, "legacy");

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[SEARCH_RESULT_CACHE_MISS]",
      expect.objectContaining({ reason: expect.any(String) })
    );
  });

  it("silently absorbs Redis.set errors (fire-and-forget)", async () => {
    mockRedisSet.mockRejectedValue(new Error("Write failed"));

    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();

    await expect(cache.set("Oviedo", 3, sampleResult, "legacy")).resolves.toBeUndefined();
  });
});

describe("full-result cache corruption", () => {
  beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });
  it.each([
    { chunks: "not-an-array", images: [] },
    { chunks: [], images: [{ id: "i", path: null }] },
    { chunks: [{ id: "c", content: null }], images: [] },
    { arbitrary: true },
  ])("treats a parsed but invalid cache record as a miss: %j", async (record) => {
    mockRedisGet.mockResolvedValue(record);
    const { SearchResultCache } = await import("./embedding-cache");
    expect(await new SearchResultCache().get("Oviedo", 3, "legacy")).toBeNull();
  });
});

describe("corpus-versioned result evidence", () => {
  const citation = { title: "Synthetic source", url: "https://source.example.test/facts", license: "CC0-1.0", revision: "2026-10-11", attribution: "Example owner" };
  const authored = { chunks: [{ id: "authored", content: "Independently authored synthetic fact", citation }], images: [] };

  beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "synthetic-test-token");
    mockRedisSet.mockResolvedValue("OK");
  });

  it("keeps version A and B results separate even for identical normalized query and limit", async () => {
    const stored = new Map<string, string>();
    mockRedisGet.mockImplementation((key: string) => Promise.resolve(stored.get(key) ?? null));
    mockRedisSet.mockImplementation((key: string, value: string) => { stored.set(key, value); return Promise.resolve("OK"); });
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();
    const next = { chunks: [{ ...authored.chunks[0], id: "new-version", content: "A corrected synthetic fact", citation }], images: [] };
    await cache.set("  same query ", 3, authored, "version-a");
    expect(await cache.get("same query", 3, "version-b")).toBeNull();
    await cache.set("same query", 3, next, "version-b");
    expect(await cache.get("same query", 3, "version-a")).toEqual(authored);
    expect(await cache.get("same query", 3, "version-b")).toEqual(next);
    expect([...stored.keys()]).toEqual([
      `search:v2:version-a:3:${sha256("same query")}`,
      `search:v2:version-b:3:${sha256("same query")}`,
    ]);
  });

  it("does not accept authored citations with missing evidence or a PDF/page camouflage", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();
    const base = { id: "authored", content: "Synthetic fact", citation };
    for (const chunk of [
      { ...base, citation: { ...citation, attribution: "" } },
      { ...base, citation: { ...citation, url: "javascript:alert(1)" } },
      { ...base, citation: undefined, sourcePdf: "" },
      { ...base, citation: { ...citation, revision: "" }, sourcePdf: "guide.pdf" },
      { ...base, sourcePdf: "invented.pdf" },
      { ...base, pageNumber: 17 },
    ]) {
      mockRedisGet.mockResolvedValue({ chunks: [chunk], images: [] });
      expect(await cache.get("same query", 3, "version-a")).toBeNull();
    }
    mockRedisGet.mockResolvedValue(authored);
    expect(await cache.get("same query", 3, "version-a")).toEqual(authored);
  });

  it("cannot resurrect unreviewed legacy images or accept a fake authored source in legacy", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    const cache = new SearchResultCache();
    mockRedisGet.mockResolvedValue({ chunks: [{ id: "legacy", content: "Synthetic legacy fixture", sourcePdf: "legacy.pdf" }], images: [{ id: "old-photo", path: "/old-photo.jpg", sourcePdf: "legacy.pdf" }] });
    expect(await cache.get("same query", 3, "legacy")).toBeNull();
    mockRedisGet.mockResolvedValue({ chunks: [{ id: "legacy", content: "Synthetic fixture", sourcePdf: "" }], images: [] });
    expect(await cache.get("same query", 3, "legacy")).toBeNull();
    mockRedisGet.mockResolvedValue({ chunks: [{ ...authored.chunks[0], sourcePdf: "legacy.pdf", citation }], images: [] });
    expect(await cache.get("same query", 3, "legacy")).toBeNull();
  });
});
