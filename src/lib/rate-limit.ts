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
  maxEntries: 10_000,    // max map size
};

const store = new Map<string, RateLimitEntry>();

function pruneExpired(entry: RateLimitEntry, now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return entry.timestamps.filter(ts => ts > cutoff);
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests, maxEntries } = config;

  // Get or create entry
  let entry = store.get(identifier);

  if (entry) {
    // Prune expired timestamps
    entry.timestamps = pruneExpired(entry, now, windowMs);
  } else {
    // Check map size before adding
    if (store.size >= maxEntries) {
      // Prune all expired entries first
      for (const [key, val] of store) {
        val.timestamps = pruneExpired(val, now, windowMs);
        if (val.timestamps.length === 0) {
          store.delete(key);
        }
      }
      // If still over limit, delete oldest entries
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
    // Rate limited
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

  // Allow request
  entry.timestamps.push(now);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

export function resetRateLimit(): void {
  store.clear();
}

export function getRateLimitStore(): Map<string, RateLimitEntry> {
  return store;
}
