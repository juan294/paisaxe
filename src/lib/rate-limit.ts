import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

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

type RateLimitBackend = "upstash" | "memory" | "blocked";
type RateLimitBackendReason = "upstash_missing" | "upstash_unavailable";

interface RateLimitBackendStatus {
  backend: RateLimitBackend;
  configured: boolean;
  degraded: boolean;
  reason?: RateLimitBackendReason;
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

function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

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

// --- Degradation tracking (BE-M1) ---

// Module-level flag set when Upstash is configured but unreachable.
// Allows health checks and monitoring to surface the degradation state.
let _rateLimitDegraded = false;

/**
 * Returns true if Upstash is configured but currently unavailable.
 * Used by health checks to surface the degraded rate-limiting state.
 */
export function isRateLimitDegraded(): boolean {
  return _rateLimitDegraded;
}

export function getRateLimitBackendStatus(): RateLimitBackendStatus {
  if (useUpstash) {
    return _rateLimitDegraded
      ? {
          backend: "upstash",
          configured: true,
          degraded: true,
          reason: "upstash_unavailable",
        }
      : {
          backend: "upstash",
          configured: true,
          degraded: false,
        };
  }

  if (isProduction()) {
    return {
      backend: "blocked",
      configured: false,
      degraded: true,
      reason: "upstash_missing",
    };
  }

  return {
    backend: "memory",
    configured: false,
    degraded: false,
  };
}

// --- Live backend probe (DO-H2) ---

/**
 * DO-H2 (#823): `_rateLimitDegraded` above is per-process state — on Vercel,
 * `/api/health` runs in a different isolate than `/api/chat/stream`, so it can
 * never observe a flag set there. This performs a live, side-effect-free Redis
 * PING so health reflects Upstash's CURRENT reachability instead of stale,
 * cross-process state that can never surface a real outage.
 *
 * Bounded by the caller: `/api/health` races this behind its own timeout
 * harness (see `PROBE_TIMEOUTS_MS.rateLimit` in health-timeouts.ts), passing an
 * AbortSignal through so a hung Redis call is actually cancelled rather than
 * left running after the timeout fallback resolves.
 */
export async function probeRateLimitBackend(
  signal?: AbortSignal
): Promise<RateLimitBackendStatus> {
  if (!useUpstash) {
    if (isProduction()) {
      return { backend: "blocked", configured: false, degraded: true, reason: "upstash_missing" };
    }
    return { backend: "memory", configured: false, degraded: false };
  }

  try {
    const redis = new Redis({ url: upstashUrl!, token: upstashToken!, signal });
    await redis.ping();
    return { backend: "upstash", configured: true, degraded: false };
  } catch (err) {
    logger.error("[RATE_LIMIT_HEALTH_PROBE_FAILED]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      backend: "upstash",
      configured: true,
      degraded: true,
      reason: "upstash_unavailable",
    };
  }
}

// --- IPv6 bucket normalization (BE-L5) ---

/**
 * BE-L5 (#798): `getClientIp` (src/lib/request-utils.ts) returns IPv6
 * addresses verbatim. A residential /64 allocation gives one subscriber
 * 2^64 distinct source addresses — trivially rotated via IPv6 privacy
 * extensions — each hashing to its own Upstash bucket, so the per-IP rate
 * limit is effectively unenforceable for IPv6 clients.
 *
 * Collapses an IPv6 address to its /64 prefix (the first four hextets) so
 * every address from the same allocation shares one bucket. IPv4 addresses
 * and non-IP sentinels (e.g. "unknown") pass through unchanged.
 *
 * Regression risk called out in the finding: a /64 can be a large shared
 * population behind some mobile/CGNAT-equivalent IPv6 deployments, which
 * risks false 429s for legitimate co-tenants. This intentionally keeps the
 * existing per-identifier request cap unchanged rather than guessing at a
 * higher one — if false-positive reports surface in practice, widen the cap
 * (or make the prefix length configurable) then, backed by real traffic
 * data rather than speculation.
 */
export function normalizeIpForRateLimit(ip: string): string {
  if (!ip.includes(":")) {
    // Not IPv6 (IPv4, "unknown", or any other non-colon identifier).
    return ip;
  }

  // Strip an interface zone/scope id (e.g. "fe80::1%eth0") if present.
  const withoutZone = ip.split("%")[0]!;

  const doubleColonIndex = withoutZone.indexOf("::");
  let groups: string[];

  if (doubleColonIndex !== -1) {
    const left = withoutZone
      .slice(0, doubleColonIndex)
      .split(":")
      .filter(Boolean);
    const right = withoutZone
      .slice(doubleColonIndex + 2)
      .split(":")
      .filter(Boolean);
    const missing = 8 - left.length - right.length;
    if (missing < 0) {
      // More groups than a valid IPv6 address can hold — malformed input.
      // Fail safe: fall back to the raw string as the bucket key rather
      // than throwing or silently merging unrelated clients.
      return ip;
    }
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    groups = withoutZone.split(":");
    if (groups.length !== 8) {
      // Not a recognizable fully-expanded IPv6 address — fall back.
      return ip;
    }
  }

  // Normalize each hextet (e.g. "0000" and "0" must bucket identically —
  // they're the same address) and validate it's actually hex. Any group
  // that fails validation means the input wasn't real IPv6; fall back to
  // the raw string rather than producing a bogus bucket key.
  const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;
  if (!groups.every(g => HEX_GROUP.test(g))) {
    return ip;
  }
  const normalizedGroups = groups.map(g => parseInt(g, 16).toString(16));

  return `${normalizedGroups.slice(0, 4).join(":")}::/64`;
}

function failClosed(config: RateLimitConfig): RateLimitResult {
  return {
    allowed: false,
    limit: config.maxRequests,
    remaining: 0,
    resetAt: Date.now() + config.windowMs,
    retryAfter: Math.ceil(config.windowMs / 1000),
  };
}

// --- Public API ---

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<RateLimitResult> {
  if (useUpstash) {
    try {
      const result = await checkUpstash(identifier, config);
      // Clear degraded flag on successful Upstash call
      _rateLimitDegraded = false;
      return result;
    } catch (err) {
      _rateLimitDegraded = true;
      logger.error("[RATE_LIMIT_FALLBACK]", {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      });
      // BE-M1: warn on every fallback request so monitoring can detect degradation,
      // regardless of environment. Production fails closed; dev/test uses in-memory.
      logger.warn("[RATE_LIMIT_DEGRADED]", { reason: "upstash_unavailable" });
      if (isProduction()) {
        // Fail closed in production: deny the request so Upstash failure doesn't bypass limits
        return failClosed(config);
      }
      // Dev/test: fall through to in-memory
      return checkInMemory(identifier, config);
    }
  }

  if (isProduction()) {
    _rateLimitDegraded = true;
    logger.warn("[RATE_LIMIT_DEGRADED]", {
      reason: "upstash_missing",
      backend: "blocked",
    });
    return failClosed(config);
  }

  return checkInMemory(identifier, config);
}

export function resetRateLimit(): void {
  store.clear();
  _rateLimitDegraded = false;
}

export function getRateLimitStore(): Map<string, RateLimitEntry> {
  return store;
}
