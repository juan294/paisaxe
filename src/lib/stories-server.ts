import type { Story, StoryRow } from "@/types/immersive";
import { rowToStory } from "@/types/immersive";
import { FALLBACK_STORIES } from "@/lib/stories-data";
import { getEnvironment } from "@/lib/environment";

/**
 * Log a warning when serving fallback stories.
 * Uses console.error in production so it surfaces in Vercel logs.
 */
function logFallback(reason: string): void {
  if (getEnvironment() === "production") {
    console.error(`[STORIES_FALLBACK] Serving placeholder stories: ${reason}`);
  } else {
    console.warn(`[STORIES_FALLBACK] ${reason}`);
  }
}

/**
 * Server-side story fetching with Next.js cache.
 * Uses the Supabase REST API directly with `next: { revalidate: 60 }`
 * so Next.js can cache and deduplicate the request.
 */
export async function getStoriesServer(): Promise<Story[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

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

    const response = await fetch(
      `${supabaseUrl}/rest/v1/stories?is_active=eq.true&curation_status=eq.approved&order=display_order.asc&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 60 } }),
      }
    );

    if (!response.ok) {
      logFallback(`Supabase returned HTTP ${response.status} — likely missing GRANT SELECT for anon role`);
      return FALLBACK_STORIES;
    }

    const data: StoryRow[] = await response.json();
    if (!data || data.length === 0) {
      logFallback("No approved stories in database");
      return FALLBACK_STORIES;
    }

    return data.map(rowToStory);
  } catch (error) {
    logFallback(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
    return FALLBACK_STORIES;
  }
}
