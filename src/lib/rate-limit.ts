import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxEntries: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,     // 60 seconds
  maxRequests: 10,       // 10 requests per window
  maxEntries: 10_000,    // max map size (in-memory only)
};

// --- In-memory backend ---

const store = new Map<string, RateLimitEntry>();

function pruneExpired(entry: RateLimitEntry, now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return entry.timestamps.filter(ts => ts > cutoff);
}

function checkInMemory(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests, maxEntries } = config;

  let entry = store.get(identifier);

  if (entry) {
    entry.timestamps = pruneExpired(entry, now, windowMs);
  } else {
    if (store.size >= maxEntries) {
      for (const [key, val] of store) {
        val.timestamps = pruneExpired(val, now, windowMs);
        if (val.timestamps.length === 0) {
          store.delete(key);
        }
      }
      if (store.size >= maxEntries) {
        const keysToDelete = Array.from(store.keys()).slice(0, Math.floor(maxEntries * 0.1));
        for (const key of keysToDelete) {
          store.delete(key);
        }
      }
    }
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  const currentCount = entry.timestamps.length;

  if (currentCount >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + windowMs;
    const retryAfter = Math.ceil((resetAt - now) / 1000);

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

// --- Upstash backend ---

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const useUpstash = Boolean(upstashUrl && upstashToken);

// Cache Ratelimit instances by config key so each route's limits are enforced independently
const upstashInstances = new Map<string, Ratelimit>();

function getUpstashLimiter(config: RateLimitConfig): Ratelimit {
  const key = `${config.maxRequests}:${config.windowMs}`;
  let instance = upstashInstances.get(key);
  if (!instance) {
    instance = new Ratelimit({
      redis: new Redis({ url: upstashUrl!, token: upstashToken! }),
      limiter: Ratelimit.slidingWindow(
        config.maxRequests,
        `${config.windowMs / 1000} s`,
      ),
      prefix: `paisaxe-rl:${key}`,
    });
    upstashInstances.set(key, instance);
  }
  return instance;
}

async function checkUpstash(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(config);
  const result = await limiter.limit(identifier);
  const now = Date.now();

  if (result.success) {
    return {
      allowed: true,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  const retryAfter = Math.max(Math.ceil((result.reset - now) / 1000), 1);
  return {
    allowed: false,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset,
    retryAfter,
  };
}

// --- Public API ---

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<RateLimitResult> {
  if (useUpstash) {
    try {
      return await checkUpstash(identifier, config);
    } catch {
      // Upstash failed — fall back to in-memory so requests aren't blocked
      return checkInMemory(identifier, config);
    }
  }

  return checkInMemory(identifier, config);
}

export function resetRateLimit(): void {
  store.clear();
}

export function getRateLimitStore(): Map<string, RateLimitEntry> {
  return store;
}
