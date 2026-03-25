# Phase 2: Enable ISR on `/immersive`

> **Goal**: Make `/immersive` use Incremental Static Regeneration (ISR) with 60-second revalidation, so the rendered HTML is cached at Vercel's CDN edge globally.
> **Depends on**: Phase 1 (root layout must not force dynamic rendering)

## Context

After Phase 1 removes `headers()` from layouts, the remaining dynamic triggers in `/immersive` are:
1. `getStoriesServer()` — already uses `next: { revalidate: 60 }` (ISR-compatible)
2. `isFeatureFlagEnabled()` — already uses `next: { revalidate: 60 }` (ISR-compatible)
3. `Math.random()` for shuffle seed — runs once per revalidation cycle (acceptable: same shuffle for all users during 60s window)

The page is already ISR-compatible after Phase 1. We just need to add the explicit `revalidate` export so Next.js knows to cache the full route (not just the data fetches).

Without `export const revalidate`, Next.js treats the page as dynamic because `getStoriesServer()` and `isFeatureFlagEnabled()` are async operations. The `revalidate` export tells Next.js: "this page's output is cacheable; regenerate it at most every N seconds."

## Files Changed

| File | Action |
|------|--------|
| `src/app/immersive/page.tsx` | Add `export const revalidate = 60` |
| `src/app/immersive/page.test.tsx` | Add test verifying revalidate export |

## TDD: Tests First

### 1. Update `src/app/immersive/page.test.tsx`

```pseudo
ADD new test in "ImmersivePage (server component)" describe block:

  it("should export revalidate = 60 for ISR", async () => {
    // Import the module to check the named export
    const pageModule = await import("./page");
    expect(pageModule.revalidate).toBe(60);
  });
```

## Implementation

### 1. `src/app/immersive/page.tsx`

```pseudo
ADD after imports (before the component):

  /**
   * ISR: Cache this page at the CDN edge for 60 seconds.
   * After 60s, the next request triggers a background regeneration.
   * Stories and feature flags also have 60s data cache (revalidate: 60).
   */
  export const revalidate = 60;
```

No other changes needed. The page's async data fetching (`getStoriesServer`, `isFeatureFlagEnabled`) and `Math.random()` all work correctly with ISR — they run once at render time, the result is baked into HTML, and the HTML is cached for 60s.

## Verification

### Automated
```bash
# Tests pass
npm run test

# Build should show /immersive as ISR (not dynamic)
npm run build 2>&1 | grep '/immersive'
# Expected: shows revalidate interval (e.g., "ISR: 60 Seconds")
# or static symbol with revalidation, NOT f (dynamic)
```

### Manual
```bash
# After deploy: First request warms the cache
curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\n" https://paisaxe.es/immersive

# Second request should be a CDN cache hit
curl -sI https://paisaxe.es/immersive | grep -iE '(x-vercel-cache|age)'
# Expected: x-vercel-cache: HIT (or STALE), age > 0

# Third request from a different region (use VPN or ask someone in UAE)
# Should also be fast (~50-200ms) since CDN caches globally
```

## Notes

- The shuffle seed (`Math.random()`) produces the same value for all users during a 60s ISR window. This is fine — stories appear in a random order, it's just the same random order for everyone for 60 seconds. On the next revalidation, a new seed is generated.
- `getStoriesServer()` and `isFeatureFlagEnabled()` both use `next: { revalidate: 60 }` for their data cache. This aligns with the page-level revalidation. Both caches expire roughly together.
- If a story is added/updated in the admin dashboard, it appears within 60 seconds (the next ISR cycle). For immediate visibility, on-demand ISR can be added later via `revalidatePath('/immersive')` in the admin API routes.
