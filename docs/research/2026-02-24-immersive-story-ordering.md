# Research: Immersive Page Story Ordering

> Generated: 2026-02-24 | Branch: develop | Commit: c95a244

## Question

How does the `/immersive` page load and order stories? The `randomized_order` feature flag exists — what does it do, and does the current implementation deliver a different starting point on every page load while keeping the order stable within a session?

---

## 1. Database Layer: Default Sort Order

Stories are stored in the `stories` table with a `display_order int default 0` column (`supabase/migrations/003_stories_table.sql:16`). An index exists on this column (`stories_order_idx`, line 28).

Every query that fetches stories for the immersive page sorts by `display_order ASC`:

- **Server-side REST fetch** (`src/lib/stories-server.ts:28`):
  ```
  /rest/v1/stories?is_active=eq.true&curation_status=eq.approved&order=display_order.asc&select=*
  ```

- **Client-side Supabase fetch** (`src/lib/stories-data.ts:19-24`):
  ```typescript
  supabase.from("stories").select("*")
    .eq("is_active", true)
    .eq("curation_status", "approved")
    .order("display_order", { ascending: true });
  ```

Without any feature flags enabled, stories always appear in the same `display_order` sequence. The story with the lowest `display_order` value is always first.

---

## 2. Server Component: Seed Generation

The immersive page server component (`src/app/immersive/page.tsx:13-32`) fetches the `randomized_order` feature flag and stories in parallel:

```typescript
const [isRandomEnabled, serverStories] = await Promise.all([
  isFeatureFlagEnabled("randomized_order"),
  getStoriesServer(),
]);

const serverShuffleSeed = isRandomEnabled
  ? Math.floor(Math.random() * 2147483647)
  : null;
```

When the flag is enabled, a random integer seed (0 to 2,147,483,646) is generated. When disabled, `null` is passed. Both values flow to the client component via the `serverShuffleSeed` prop.

### Next.js Caching Interaction

The feature flag check uses `next: { revalidate: 60 }` in production (`src/lib/feature-flags-server.ts:37`). The stories fetch also uses `next: { revalidate: 60 }` (`src/lib/stories-server.ts:36`). Both use `cache: "no-store"` in development.

**Critical detail**: The `page.tsx` server component itself has no `export const dynamic` or `export const revalidate` directives. In Next.js 16 (App Router), a server component that calls `Math.random()` is considered dynamic by default because `Math.random()` is a non-deterministic operation. However, the seed generation is behind a conditional (`if isRandomEnabled`), so Next.js static analysis may not detect it. If the page gets statically cached, the same seed would be served to all visitors until cache invalidation. In development mode (`cache: "no-store"`), a new seed is generated on every request.

---

## 3. Client Component: Ordering Pipeline

The client component (`src/app/immersive/immersive-page-content.tsx:41-117`) receives the server seed and processes stories through a multi-stage pipeline.

### Seed Persistence

At line 52, the seed is stored in a `useRef`:
```typescript
const shuffleSeed = useRef(serverShuffleSeed ?? Math.floor(Math.random() * 2147483647));
```

This means:
- If the server provided a seed (flag enabled), that seed is used for the component's entire lifetime.
- If the server provided `null` (flag disabled), a client-side seed is generated as fallback — but it is only used if shuffle is later triggered by the client-side flag check.
- The `useRef` ensures the seed never changes during the component's lifecycle (React re-renders do not reset it).

### Processing Pipeline (lines 95-117)

The `processedStories` useMemo runs four stages:

1. **Mood filter** (line 99-101): If a mood is selected via the MoodOverlay, `filterByMood()` filters stories by mood tags or category mapping (`src/lib/mood-mapping.ts:17-31`).

2. **Seasonal weighting** (line 103-107): If `seasonal_surfacing` flag is enabled, `applySeasonalWeighting()` moves stories with the current month in their `bestMonths` array to the front (`src/lib/seasonal-weighting.ts:8-29`). Relative order within boosted/non-boosted groups is preserved.

3. **Shuffle** (line 109-114):
   ```typescript
   const shouldShuffle = serverShuffleSeed !== null || isEnabled("randomized_order");
   if (shouldShuffle) {
     stories = fisherYatesShuffle(stories, shuffleSeed.current);
   }
   ```
   Shuffle triggers if either: (a) the server provided a non-null seed, or (b) the client-side flag check returns true.

4. **Category/Location/Duration filters** (line 119-128): `useStoryFilters()` filters by user-selected criteria (`src/hooks/use-story-filters.ts:21-34`).

### useMemo Dependencies

The `processedStories` memo depends on: `[allStories, selectedMood, isEnabled, serverShuffleSeed]` (line 117). The `shuffleSeed.current` ref is **not** a dependency — this is intentional, as changing the seed would cause a re-shuffle. The seed is fixed for the component's lifetime.

---

## 4. Shuffle Algorithm

The Fisher-Yates shuffle (`src/lib/shuffle.ts:18-28`) accepts an optional seed:

```typescript
export function fisherYatesShuffle<T>(array: T[], seed?: number): T[] {
  const result = [...array];
  const random = seed !== undefined ? mulberry32(seed) : Math.random;
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

When a seed is provided, it uses the Mulberry32 PRNG (`src/lib/shuffle.ts:4-12`) for deterministic results — the same seed always produces the same permutation. Without a seed, it uses `Math.random` (non-deterministic).

---

## 5. Session Stability Mechanism

The current session stability relies on two mechanisms:

### Server-side seed via useRef
The seed generated in `page.tsx` is passed to the client and stored in `useRef` (line 52). As long as the React component stays mounted, the same seed produces the same shuffle. A full page reload (`F5`, navigation away and back) triggers a new server render with a new `Math.random()` seed.

### Story data caching
The `useStories` hook (`src/hooks/use-stories.ts`) caches stories in:
- **In-memory singleton** (`cache` object, line 28-32): Shared across hook instances, lasts until page refresh. TTL: 5 minutes for revalidation.
- **localStorage** (`paisaxe-stories-cache`, line 8): Persists across sessions. TTL: 24 hours.

When the component revalidates stories in the background (stale-while-revalidate pattern), the `allStories` array reference changes, which triggers the `processedStories` useMemo to re-run. However, the shuffle seed remains the same (stored in `useRef`), so the shuffle produces the same permutation — unless the set of stories itself changed (e.g., a new story was added).

---

## 6. Feature Flag State

The `randomized_order` flag is seeded as **disabled** in the database migration (`supabase/migrations/008_feature_flags.sql:45`):
```sql
('randomized_order', false, 'Randomized Story Order', 'Shuffle story order with a session-stable seed')
```

It can be toggled via the admin panel (`src/components/admin/feature-toggles-panel.tsx:70`), where it is categorized under "discovery". The admin calls `updateFeatureFlag(flagKey, enabled)` which hits the admin API endpoint.

---

## 7. Share Link and Story Deep-Link Behavior

When a user arrives via `?story=slug` (`src/app/immersive/immersive-page-content.tsx:72-83`):

```typescript
const storySlug = searchParams.get("story");
if (storySlug && allStories.length > 0) {
  const index = allStories.findIndex((s) => s.slug === storySlug || s.id === storySlug);
  if (index >= 0) {
    setCurrentIndex(index);
  }
}
```

This searches `allStories` (the **unprocessed** list from `useStories`, not the shuffled `processedStories`). The `currentIndex` is then applied to `filteredStories` (line 142: `const currentStory = filteredStories[currentIndex]`). If the shuffle is active, the index found in the unshuffled array may not correspond to the same story in the shuffled array, because the stories at the same index position differ between the two arrays.

---

## 8. Interaction Between Seasonal Weighting and Shuffle

When both `seasonal_surfacing` and `randomized_order` are enabled, seasonal weighting runs first (stage 2), then shuffle runs on the weighted result (stage 3). The shuffle fully randomizes the order, so the seasonal boost is effectively neutralized — stories that were moved to the front by seasonal weighting get shuffled to random positions.

---

## 9. Surprise Me Button

The Surprise Me button (`src/components/immersive/surprise-me-button.tsx:24-35`) provides its own randomization independently of the ordering pipeline. It picks a random unviewed story index, or any random index if all have been viewed. It uses `Math.random()` directly, not the seeded PRNG.

---

## 10. Related Files

| File | Role |
|------|------|
| `src/app/immersive/page.tsx` | Server component: flag check + seed generation |
| `src/app/immersive/immersive-page-content.tsx` | Client component: ordering pipeline |
| `src/lib/shuffle.ts` | Fisher-Yates shuffle with Mulberry32 PRNG |
| `src/lib/seasonal-weighting.ts` | Month-based story boosting |
| `src/lib/mood-mapping.ts` | Mood-to-category filtering |
| `src/lib/stories-server.ts` | Server-side story fetch (REST, cached) |
| `src/lib/stories-data.ts` | Client-side story fetch (Supabase JS) |
| `src/hooks/use-stories.ts` | SWR story cache hook |
| `src/hooks/use-story-filters.ts` | Category/location/duration filtering |
| `src/hooks/use-viewed-stories.ts` | Viewed story tracking |
| `src/types/immersive.ts` | Story type definitions |
| `supabase/migrations/003_stories_table.sql` | Stories table schema |
| `supabase/migrations/008_feature_flags.sql` | Feature flags table + seed data |
| `src/lib/feature-flags-server.ts` | Server-side flag checking |
| `src/hooks/use-feature-flags.ts` | Client-side flag hook |
| `src/components/admin/feature-toggles-panel.tsx` | Admin toggle UI |
| `docs/engineering/visitor-experience.md` | Design document for discovery features |
