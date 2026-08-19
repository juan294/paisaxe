import { gzipSync } from "node:zlib";
import type { PublicStoryRow, Story } from "@/types/immersive";
import { PUBLIC_STORY_SELECT, rowToPublicStory } from "@/types/immersive";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import { FALLBACK_STORIES } from "@/lib/stories-data";
import { getEnvironment } from "@/lib/environment";
import { logger } from "@/lib/logger";

/**
 * PE-M5 (#813): the full story catalogue is serialized into the initial
 * `/immersive` payload (LCP-critical) and grows linearly as the catalogue
 * expands. The audit's recommendation was to instrument payload size/growth
 * first rather than restructure data loading — windowing/on-demand fetch
 * would break the client-side Fisher-Yates shuffle and deep-link slug
 * resolution in `immersive-page-content.tsx`, both of which require the full
 * story array to already be in memory. This constant documents the size
 * measured at audit time (71 stories ≈ 50KB gzip) so `[STORIES_PAYLOAD_SIZE]`
 * warns once growth exceeds it, making the trend visible before it's a
 * problem (see docs/operations/operations.md for the log-drain query).
 */
export const STORY_PAYLOAD_WARN_BYTES_GZIP = 50 * 1024;

/**
 * Log the serialized (raw + gzip) size of the story payload that will be
 * embedded in the initial `/immersive` server render. Only called on a true
 * cache MISS (real Supabase fetch), matching `logCacheMiss()`, so this never
 * runs on every request — only once per revalidate window.
 */
function logPayloadSize(stories: Story[]): void {
  try {
    const json = JSON.stringify(stories);
    const rawBytes = Buffer.byteLength(json);
    const gzipBytes = gzipSync(json).length;
    const meta = {
      story_count: stories.length,
      raw_bytes: rawBytes,
      gzip_bytes: gzipBytes,
      threshold_gzip_bytes: STORY_PAYLOAD_WARN_BYTES_GZIP,
    };

    if (gzipBytes > STORY_PAYLOAD_WARN_BYTES_GZIP) {
      logger.warn("[STORIES_PAYLOAD_SIZE]", meta);
    } else {
      logger.info("[STORIES_PAYLOAD_SIZE]", meta);
    }
  } catch (error) {
    // Instrumentation must never break the story fetch path.
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("[STORIES_PAYLOAD_SIZE_MEASURE_FAILED]", { error: message });
  }
}

/**
 * Log a warning when serving fallback stories.
 * Uses logger.error in production so it surfaces in Vercel logs.
 */
function logFallback(reason: string): void {
  if (getEnvironment() === "production") {
    logger.error("[STORIES_FALLBACK] Serving placeholder stories", { reason });
  } else {
    logger.warn("[STORIES_FALLBACK]", { reason });
  }
}

/**
 * Emit a structured cache-MISS event whenever the server actually reaches out to
 * Supabase instead of being served from Next.js's `revalidate` data cache.
 *
 * Next.js dedupes/caches the underlying `fetch()` for the revalidate window
 * (60 s in production), so this function only runs on a true cache MISS. Counting
 * these events against total page renders gives the effective CDN/data-cache
 * hit-rate. See docs/operations/operations.md → "Stories Cache Hit-Rate" for the
 * log-drain query used to monitor it.
 */
function logCacheMiss(): void {
  // info-level structured event so it is queryable in the Vercel log drain
  // without polluting error budgets. `count: 1` lets aggregators sum misses.
  logger.info("[STORIES_CACHE_MISS]", { table: "stories", count: 1 });
}

/**
 * Server-side story fetching with Next.js cache.
 * Uses the Supabase REST API directly with `next: { revalidate: 60 }`
 * so Next.js can cache and deduplicate the request.
 */
export async function getStoriesServer(): Promise<Story[]> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    logFallback("Missing Supabase credentials");
    return FALLBACK_STORIES;
  }

  // Skip fetch with dummy credentials (CI/E2E) — real Supabase anon keys are JWTs starting with 'eyJ'
  if (!supabaseKey.startsWith("eyJ")) {
    return FALLBACK_STORIES;
  }

  try {
    const isDev = getEnvironment() === "development";

    // Cache MISS: this code path only executes when Next.js's revalidate data
    // cache does not already hold the response, so each call is a real fetch.
    logCacheMiss();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/stories?is_active=eq.true&curation_status=eq.approved&order=display_order.asc&select=${PUBLIC_STORY_SELECT}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(8_000),
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 60 } }),
      }
    );

    if (!response.ok) {
      logFallback(`Supabase returned HTTP ${response.status} — likely missing GRANT SELECT for anon role`);
      return FALLBACK_STORIES;
    }

    const data: PublicStoryRow[] = await response.json();
    if (!data || data.length === 0) {
      logFallback("No approved stories in database");
      return FALLBACK_STORIES;
    }

    const stories = data.map(rowToPublicStory);
    logPayloadSize(stories);
    return stories;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[TABLE_FALLBACK]", { table: "stories", error: message });
    return FALLBACK_STORIES;
  }
}
