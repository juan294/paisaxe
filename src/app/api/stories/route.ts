import { NextResponse } from "next/server";
import { getStoriesServer } from "@/lib/stories-server";

/**
 * FE-H1 (#759): client-safe story fetch endpoint.
 *
 * `src/hooks/use-stories.ts` (a "use client" hook) used to import
 * `getStoriesFromDB` directly from `@/lib/stories-data`, which transitively
 * imports the Pino-based `@/lib/logger` and, through it,
 * `@/lib/request-context.ts`'s `node:async_hooks` require. Reaching the
 * browser bundle triggered a CSP `unsafe-eval` violation on every page load
 * (swallowed by a try/catch, but still recorded as a violation) and shipped
 * a server-only Pino redact-path list to every visitor.
 *
 * Routing the client's background fetch/revalidation through this route
 * handler keeps all logger-touching code server-side. Uses `getStoriesServer()`
 * — the same fetch-based, `next: { revalidate: 60 }`-cached source that
 * already seeds `/immersive`'s initial render — rather than the heavier
 * Supabase-js-based `getStoriesFromDB()`, since this route has no need for
 * the Supabase client at all. It still applies the FALLBACK_STORIES safety
 * net and logs `[TABLE_FALLBACK]`/`[STORIES_FALLBACK]` on failure exactly as
 * `getStoriesFromDB` did — only the caller moved.
 */
export async function GET() {
  const stories = await getStoriesServer();

  return NextResponse.json(
    { data: stories },
    {
      headers: {
        // Mirrors /api/feature-flags: short public cache with SWR so the CDN
        // absorbs most requests while still picking up curation changes quickly.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        "Vary": "Host",
      },
    }
  );
}
