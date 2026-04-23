import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import packageJson from "../../../../package.json";

const APP_VERSION: string = packageJson.version;

// Cache for external probe results (60s TTL)
const PROBE_CACHE_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 3_000;

interface CachedProbeResult {
  result: ExternalServiceStatus;
  expiresAt: number;
}

const probeCache = new Map<string, CachedProbeResult>();

function purgeExpiredProbes(now = Date.now()): void {
  for (const [key, cached] of probeCache) {
    if (cached.expiresAt <= now) {
      probeCache.delete(key);
    }
  }
}

function getCachedProbe(key: string): ExternalServiceStatus | null {
  purgeExpiredProbes();
  const cached = probeCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }
  return null;
}

function setCachedProbe(key: string, result: ExternalServiceStatus): void {
  const now = Date.now();
  probeCache.set(key, { result, expiresAt: now + PROBE_CACHE_TTL_MS });
  purgeExpiredProbes(now);
}

/** Exported for tests only — clears the in-memory probe cache. */
export function _clearProbeCacheForTests(): void {
  probeCache.clear();
}

/** Exported for tests only — seeds the in-memory probe cache with a custom TTL. */
export function _seedProbeCacheForTests(
  key: string,
  result: ExternalServiceStatus,
  expiresAt: number
): void {
  probeCache.set(key, { result, expiresAt });
}

/** Exported for tests only — inspects the current in-memory probe cache size. */
export function _getProbeCacheSizeForTests(): number {
  return probeCache.size;
}

interface SupabaseServiceStatus {
  status: "connected" | "error";
  latency_ms: number;
  error?: string;
}

interface StoriesStatus {
  status: "ok" | "fallback";
  count?: number;
  error?: string;
}

interface DatabaseSizeStatus {
  size_mb: number;
  limit_mb: number;
  usage_percent: number;
  error?: string;
}

interface DatabaseSizeErrorStatus {
  error: string;
}

interface ExternalServiceStatus {
  status: "ok" | "degraded" | "not_configured";
  latency_ms?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    supabase: SupabaseServiceStatus;
    stories: StoriesStatus;
    database: DatabaseSizeStatus | DatabaseSizeErrorStatus;
    anthropic: ExternalServiceStatus;
    voyage: ExternalServiceStatus;
    stripe: ExternalServiceStatus;
    elevenlabs: ExternalServiceStatus;
  };
}

async function checkSupabase(): Promise<SupabaseServiceStatus> {
  const start = performance.now();
  try {
    const { error } = await supabase.from("chunks").select("id").limit(1);
    const latency_ms = Math.round(performance.now() - start);

    if (error) {
      return { status: "error", latency_ms, error: error.message };
    }

    return { status: "connected", latency_ms };
  } catch (err) {
    const latency_ms = Math.round(performance.now() - start);
    return {
      status: "error",
      latency_ms,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkStories(): Promise<StoriesStatus> {
  try {
    const { count, error } = await supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("curation_status", "approved");

    if (error) {
      return { status: "fallback", error: error.message };
    }

    const approvedStoryCount = count ?? 0;
    // If zero approved stories, the immersive page will serve fallback content
    if (approvedStoryCount === 0) {
      return {
        status: "fallback",
        count: 0,
        error: "No approved stories — fallback images will be served",
      };
    }

    return { status: "ok", count: approvedStoryCount };
  } catch (err) {
    return {
      status: "fallback",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

const STORAGE_LIMIT_MB = 8192; // Supabase Pro tier: 8 GB
const STORAGE_WARNING_THRESHOLD = 0.8; // 80%

async function checkDatabaseSize(): Promise<
  DatabaseSizeStatus | DatabaseSizeErrorStatus
> {
  try {
    const { data, error } = await supabase.rpc("get_database_size");

    if (error) {
      return { error: error.message };
    }

    const sizeBytes = data as number;
    const size_mb = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
    const usage_percent =
      Math.round((size_mb / STORAGE_LIMIT_MB) * 1000) / 10;

    return {
      size_mb,
      limit_mb: STORAGE_LIMIT_MB,
      usage_percent,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Wraps a promise with a timeout. Resolves to a degraded status if exceeded.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(onTimeout()), timeoutMs)
    ),
  ]);
}

/**
 * Key-presence probe: checks that an env var is set. No network call needed.
 */
function checkEnvKeyOnly(
  cacheKey: string,
  envVarName: string
): ExternalServiceStatus {
  const cached = getCachedProbe(cacheKey);
  if (cached) return cached;

  const key = process.env[envVarName]?.trim();
  const result: ExternalServiceStatus = key
    ? { status: "ok" }
    : { status: "not_configured" };

  setCachedProbe(cacheKey, result);
  return result;
}

/**
 * Probe Anthropic: key-presence only (no network call — avoids token spend).
 */
async function checkAnthropic(): Promise<ExternalServiceStatus> {
  return checkEnvKeyOnly("anthropic", "ANTHROPIC_API_KEY");
}

/**
 * Probe Voyage AI: key-presence only (embedding endpoints are metered).
 */
async function checkVoyage(): Promise<ExternalServiceStatus> {
  return checkEnvKeyOnly("voyage", "VOYAGE_API_KEY");
}

/**
 * Probe ElevenLabs: key-presence only.
 */
async function checkElevenLabs(): Promise<ExternalServiceStatus> {
  return checkEnvKeyOnly("elevenlabs", "ELEVENLABS_API_KEY");
}

/**
 * Probe Stripe: ping /v1/charges?limit=0 with the secret key.
 * A successful auth confirms the key is valid and Stripe is reachable.
 */
async function checkStripe(): Promise<ExternalServiceStatus> {
  const cached = getCachedProbe("stripe");
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    const result: ExternalServiceStatus = { status: "not_configured" };
    setCachedProbe("stripe", result);
    return result;
  }

  const start = performance.now();

  const fetchResult = await withTimeout(
    (async (): Promise<ExternalServiceStatus> => {
      try {
        const res = await fetch("https://api.stripe.com/v1/charges?limit=0", {
          headers: { Authorization: `Bearer ${key}` },
        });
        const latency_ms = Math.round(performance.now() - start);
        if (res.ok) {
          return { status: "ok", latency_ms };
        }
        return { status: "degraded", latency_ms, error: `HTTP ${res.status}` };
      } catch (err) {
        const latency_ms = Math.round(performance.now() - start);
        return {
          status: "degraded",
          latency_ms,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })(),
    PROBE_TIMEOUT_MS,
    (): ExternalServiceStatus => ({
      status: "degraded",
      latency_ms: PROBE_TIMEOUT_MS,
      error: "Probe timed out",
    })
  );

  setCachedProbe("stripe", fetchResult);
  return fetchResult;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    const [
      supabaseStatus,
      storiesStatus,
      databaseStatus,
      anthropicStatus,
      voyageStatus,
      stripeStatus,
      elevenLabsStatus,
    ] = await Promise.all([
      checkSupabase(),
      checkStories(),
      checkDatabaseSize(),
      checkAnthropic(),
      checkVoyage(),
      checkStripe(),
      checkElevenLabs(),
    ]);

    const isSupabaseError = supabaseStatus.status !== "connected";
    const isStoriesFallback = storiesStatus.status !== "ok";
    const isDatabaseOverThreshold =
      "usage_percent" in databaseStatus &&
      databaseStatus.usage_percent >= STORAGE_WARNING_THRESHOLD * 100;

    // External service probes are informational — they do NOT degrade overall status.
    // Only Supabase connectivity is required for the app to function.
    const overallStatus =
      isSupabaseError || isStoriesFallback || isDatabaseOverThreshold
        ? "degraded"
        : "healthy";

    const body: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: process.uptime(),
      services: {
        supabase: supabaseStatus,
        stories: storiesStatus,
        database: databaseStatus,
        anthropic: anthropicStatus,
        voyage: voyageStatus,
        stripe: stripeStatus,
        elevenlabs: elevenLabsStatus,
      },
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const body: HealthResponse = {
      status: "degraded",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: process.uptime(),
      services: {
        supabase: {
          status: "error",
          latency_ms: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        },
        stories: {
          status: "fallback",
          error: err instanceof Error ? err.message : "Unknown error",
        },
        database: {
          error: err instanceof Error ? err.message : "Unknown error",
        },
        anthropic: { status: "degraded" },
        voyage: { status: "degraded" },
        stripe: { status: "degraded" },
        elevenlabs: { status: "degraded" },
      },
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  }
}
