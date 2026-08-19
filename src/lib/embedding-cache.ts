import "server-only";
import { createHash } from "crypto";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

const KEY_PREFIX = "embed:";
const TTL_SECONDS = 86400; // 24 hours

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
    return `${KEY_PREFIX}${this.model}:${this.dimensions}:${createHash("sha256").update(text).digest("hex")}`;
  }

  async get(text: string): Promise<number[] | null> {
    if (!hasRedisConfig()) return null;

    const key = this.hashKey(text);
    try {
      const raw = await getRedis().get<string>(key);
      if (raw === null || raw === undefined) return null;
      // Upstash may auto-parse JSON; handle both string and already-parsed array.
      if (Array.isArray(raw)) return raw as number[];
      return JSON.parse(raw) as number[];
    } catch (err) {
      logger.warn("[EMBEDDING_CACHE_MISS]", {
        reason: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async set(text: string, embedding: number[]): Promise<void> {
    if (!hasRedisConfig()) return;

    const key = this.hashKey(text);
    try {
      void getRedis()
        .set(key, JSON.stringify(embedding), { ex: TTL_SECONDS })
        .catch((err: unknown) => {
          logger.warn("[EMBEDDING_CACHE_SET_FAILED]", {
            reason: err instanceof Error ? err.message : String(err),
          });
        });
    } catch (err) {
      // Fire-and-forget: a write failure is non-fatal. The embedding was
      // already computed; the worst outcome is a cache miss next time.
      logger.warn("[EMBEDDING_CACHE_SET_FAILED]", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
