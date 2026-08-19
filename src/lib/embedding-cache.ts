import "server-only";
import { createHash } from "crypto";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";
import type { SearchResult } from "@/types";

const KEY_PREFIX = "embed:";
const TTL_SECONDS = 86400; // 24 hours

// PE-M2 (#810): full retrieval results (vector search + rerank + image lookup)
// keyed on the normalized query text. TTL is intentionally much shorter than
// the embedding cache's 24h — there is no content-version marker wired to
// `npm run seed-db`, so a short TTL is the bound on how long a reseed can
// serve stale retrieval results (see regression risk in issue #810).
const SEARCH_KEY_PREFIX = "search:";
const SEARCH_TTL_SECONDS = 600; // 10 minutes

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

// Lazily-created singleton so construction is deferred until first use.
// This allows the module to be imported in environments where the env vars
// are not yet set (e.g. during Next.js build-time module evaluation).
let _redis: Redis | null = null;

function hasRedisConfig(): boolean {
  return Boolean(upstashUrl && upstashToken);
}

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({ url: upstashUrl!, token: upstashToken! });
  }
  return _redis;
}

/**
 * Shared get/set implementation for the Redis-JSON caches below
 * (`EmbeddingCache`, `SearchResultCache`). Both cache a JSON-serializable
 * value under a hashed key with a TTL and treat any Redis failure as a
 * soft miss — never let a cache problem fail the request it's speeding up.
 */
async function redisJsonGet<T>(key: string, missLogTag: string): Promise<T | null> {
  if (!hasRedisConfig()) return null;

  try {
    const raw = await getRedis().get<string>(key);
    if (raw === null || raw === undefined) return null;
    // Upstash may auto-parse JSON; handle both string and already-parsed
    // values. `typeof raw === "object"` covers both arrays (embeddings) and
    // plain objects (search results) since arrays are objects in JS.
    if (typeof raw === "object") return raw as T;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn(missLogTag, {
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function redisJsonSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
  failLogTag: string
): Promise<void> {
  if (!hasRedisConfig()) return;

  try {
    void getRedis()
      .set(key, JSON.stringify(value), { ex: ttlSeconds })
      .catch((err: unknown) => {
        logger.warn(failLogTag, {
          reason: err instanceof Error ? err.message : String(err),
        });
      });
  } catch (err) {
    // Fire-and-forget: a write failure is non-fatal. The value was already
    // computed; the worst outcome is a cache miss next time.
    logger.warn(failLogTag, {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Normalize query text before it's used as a cache key.
 *
 * PE-L5 (#819): trims leading/trailing whitespace and collapses internal
 * whitespace runs, so "Oviedo" and " Oviedo  " (or "best   restaurants")
 * hit the same cache entry instead of missing each other.
 *
 * Deliberately does NOT lowercase: Voyage embeddings are case-sensitive, so
 * folding case risks subtly shifting retrieval for proper nouns/acronyms
 * (see #819 regression risk). Only the whitespace normalization — which the
 * issue calls out as safe — is applied.
 */
export function normalizeQueryText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export class EmbeddingCache {
  /**
   * @param model - Embedding model identifier (e.g. "voyage-3.5"). Included in
   *   the cache key so a model change can't collide with entries produced by
   *   a different model.
   * @param dimensions - Output vector dimension (e.g. 512). Included in the
   *   cache key so a dimension change (e.g. a Matryoshka reduction migration)
   *   can't collide with entries of a different dimension, which would
   *   otherwise silently serve stale-shape vectors or crash `match_chunks`.
   */
  constructor(
    private readonly model: string,
    private readonly dimensions: number
  ) {}

  private hashKey(text: string): string {
    const normalized = normalizeQueryText(text);
    return `${KEY_PREFIX}${this.model}:${this.dimensions}:${createHash("sha256").update(normalized).digest("hex")}`;
  }

  async get(text: string): Promise<number[] | null> {
    return redisJsonGet<number[]>(this.hashKey(text), "[EMBEDDING_CACHE_MISS]");
  }

  async set(text: string, embedding: number[]): Promise<void> {
    return redisJsonSet(this.hashKey(text), embedding, TTL_SECONDS, "[EMBEDDING_CACHE_SET_FAILED]");
  }
}

/**
 * PE-M2 (#810): caches the full `SearchResult` (reranked chunks + images) for
 * a query, so a repeat question skips the vector-search RPC, the rerank call,
 * and the image lookup entirely — not just the embedding.
 *
 * Keyed on the normalized query text plus the requested `limit` (a query
 * asking for top-3 vs top-5 results must not share an entry). TTL is
 * `SEARCH_TTL_SECONDS` (10 minutes) rather than the embedding cache's 24h —
 * see the module-level comment on `SEARCH_TTL_SECONDS` for why.
 */
export class SearchResultCache {
  private hashKey(queryText: string, limit: number): string {
    const normalized = normalizeQueryText(queryText);
    return `${SEARCH_KEY_PREFIX}${limit}:${createHash("sha256").update(normalized).digest("hex")}`;
  }

  async get(queryText: string, limit: number): Promise<SearchResult | null> {
    return redisJsonGet<SearchResult>(this.hashKey(queryText, limit), "[SEARCH_RESULT_CACHE_MISS]");
  }

  async set(queryText: string, limit: number, result: SearchResult): Promise<void> {
    return redisJsonSet(
      this.hashKey(queryText, limit),
      result,
      SEARCH_TTL_SECONDS,
      "[SEARCH_RESULT_CACHE_SET_FAILED]"
    );
  }
}
