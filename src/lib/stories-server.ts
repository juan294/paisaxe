import type { Story, StoryRow } from "@/types/immersive";
import { rowToStory } from "@/types/immersive";
import { FALLBACK_STORIES } from "@/lib/stories-data";
import { getEnvironment } from "@/lib/environment";

/**
 * Server-side story fetching with Next.js cache.
 * Uses the Supabase REST API directly with `next: { revalidate: 60 }`
 * so Next.js can cache and deduplicate the request.
 */
export async function getStoriesServer(): Promise<Story[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
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
      console.warn("Failed to fetch stories server-side:", response.status);
      return FALLBACK_STORIES;
    }

    const data: StoryRow[] = await response.json();
    if (!data || data.length === 0) {
      return FALLBACK_STORIES;
    }

    return data.map(rowToStory);
  } catch (error) {
    console.warn("Error fetching stories server-side:", error);
    return FALLBACK_STORIES;
  }
}
