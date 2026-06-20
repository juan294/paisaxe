import type { PublicStoryRow, Story } from "@/types/immersive";
import { PUBLIC_STORY_SELECT, rowToPublicStory } from "@/types/immersive";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import { FALLBACK_STORIES } from "@/lib/stories-data";
import { getEnvironment } from "@/lib/environment";
import { logger } from "@/lib/logger";

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

    return data.map(rowToPublicStory);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[TABLE_FALLBACK]", { table: "stories", error: message });
    return FALLBACK_STORIES;
  }
}
