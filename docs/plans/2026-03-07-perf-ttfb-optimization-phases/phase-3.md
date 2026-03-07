# Phase 3: Enable PPR for Streaming

> **Goal**: Enable Partial Prerendering (PPR) so the static shell (layout + skeleton) is prerendered at build time and cached permanently at CDN edge. Dynamic content (stories) streams in via Suspense.
> **Depends on**: Phase 1 (layouts must be synchronous for optimal PPR)

## Context

With ISR (Phase 2), a CDN cache miss still requires the full serverless function to run before the user sees anything. PPR eliminates this: the static shell (HTML structure, CSS, skeleton UI) is prerendered at build time and served instantly from CDN. The dynamic parts (story data, feature flags) stream in after.

This means even on a cold function + empty cache scenario, users see the skeleton UI in ~50ms (from CDN), then stories appear as the function completes.

## Architecture

With PPR enabled, `/immersive` renders in two phases:

**Phase A — Instant (CDN, ~50ms):**
- Root layout HTML (`<html>`, `<head>`, `<body>`, providers, JSON-LD)
- Immersive layout HTML (tourist destination JSON-LD)
- `<StoryCardSkeleton />` fallback from the Suspense boundary

**Phase B — Streamed (serverless function):**
- `ImmersiveDataLoader` async component fetches stories + feature flag
- `ImmersivePageContent` renders with real data
- HTML chunks stream into the static shell

## Files Changed

| File | Action |
|------|--------|
| `next.config.ts` | Add `experimental: { ppr: true }` (or `ppr: 'incremental'`) |
| `src/app/immersive/page.tsx` | Restructure: extract data fetching into async component inside Suspense |
| `src/app/immersive/page.test.tsx` | Update tests for new component structure |

## TDD: Tests First

### 1. Update `src/app/immersive/page.test.tsx`

The server component tests need to account for the restructured component hierarchy. The page now has a synchronous wrapper and an async inner component.

```pseudo
CHANGE "ImmersivePage (server component)" describe block:

  The test helper importAndRender() needs to handle the new structure:
  - ImmersivePage is now synchronous (returns JSX with Suspense)
  - ImmersiveDataLoader is the async component inside Suspense
  - Tests should still verify that stories and flags are fetched
  - Tests should still verify seed behavior

  KEEP all existing test assertions (seed null/numeric, stories passed, parallel fetch)
  CHANGE: rendering approach — ImmersivePage() no longer needs await
    (but the inner ImmersiveDataLoader still does async work,
     so tests use waitFor or render the resolved tree)

  ADD: test that verifies Suspense fallback renders the skeleton
    it("should render StoryCardSkeleton as Suspense fallback", () => {
      // Render the page synchronously (before data loads)
      // Expect skeleton to be in the document
    });
```

## Implementation

### 1. `next.config.ts`

```pseudo
CHANGE experimental block:
  BEFORE:
    experimental: {
      optimizePackageImports: ["lucide-react", "posthog-js"],
    }
  AFTER:
    experimental: {
      ppr: true,
      optimizePackageImports: ["lucide-react", "posthog-js"],
    }
```

Note: If `ppr: true` enables PPR globally and causes issues with other routes, use `ppr: 'incremental'` instead and add `export const experimental_ppr = true` to `/immersive/page.tsx` only. Check Next.js 16 docs during implementation.

### 2. `src/app/immersive/page.tsx`

```pseudo
RESTRUCTURE the page to separate static shell from dynamic data:

BEFORE:
  export default async function ImmersivePage() {
    const [isRandomEnabled, serverStories] = await Promise.all([...]);
    const serverShuffleSeed = isRandomEnabled ? Math.random()... : null;
    return (
      <Suspense fallback={<StoryCardSkeleton />}>
        <ImmersivePageContent
          serverShuffleSeed={serverShuffleSeed}
          initialStories={serverStories}
        />
      </Suspense>
    );
  }

AFTER:
  export default function ImmersivePage() {
    // Synchronous — this becomes the static shell (prerendered by PPR)
    return (
      <Suspense fallback={<StoryCardSkeleton />}>
        <ImmersiveDataLoader />
      </Suspense>
    );
  }

  // Async server component — the dynamic "hole" that streams in
  async function ImmersiveDataLoader() {
    const [isRandomEnabled, serverStories] = await Promise.all([
      isFeatureFlagEnabled("randomized_order"),
      getStoriesServer(),
    ]);

    const serverShuffleSeed = isRandomEnabled
      ? Math.floor(Math.random() * 2147483647)
      : null;

    return (
      <ImmersivePageContent
        serverShuffleSeed={serverShuffleSeed}
        initialStories={serverStories}
      />
    );
  }
```

Key points:
- `ImmersivePage` is synchronous — PPR prerendering can cache it
- `ImmersiveDataLoader` is async — it becomes the streaming boundary
- The `<Suspense fallback={<StoryCardSkeleton />}>` is the split point
- The skeleton is baked into the prerendered HTML
- Everything else (data fetching, seed generation) happens inside the streaming part

## Verification

### Automated
```bash
# Tests pass
npm run test

# Build should show PPR indicators
npm run build 2>&1 | grep -E '/(immersive|about|privacy|terms)'
# Expected: PPR-specific indicators in build output (partial prerender)

# Type check passes (new component structure must type-check)
npm run typecheck
```

### Manual
```bash
# After deploy: Check response headers for PPR streaming
curl -sI https://paisaxe.es/immersive | grep -iE '(transfer-encoding|x-vercel)'
# Expected: transfer-encoding: chunked (indicates streaming)

# View page source — should contain skeleton HTML in the initial response
# even before the stories load
curl -s https://paisaxe.es/immersive | grep -c 'animate-pulse'
# Expected: > 0 (skeleton elements in the prerendered shell)

# Performance: First request should return the shell near-instantly
# even if the function is cold
curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://paisaxe.es/immersive
# Expected: TTFB << Total (shell arrives fast, content streams after)
```

## Rollback

PPR is isolated to `next.config.ts` and the page restructure:
1. Remove `ppr: true` from next.config.ts
2. Revert page.tsx to the `async function ImmersivePage()` pattern
3. ISR from Phase 2 continues working without PPR

## Notes

- PPR vulnerability GHSA-5f7q-jpqc-wp7h (memory DoS) is patched in next@16.1.6 (installed version: ^16.1.6).
- If PPR causes unexpected issues with other routes, switch to `ppr: 'incremental'` and opt-in only for `/immersive`.
- The `ImmersiveDataLoader` component is private to the page module (not exported). It's an implementation detail for PPR's streaming boundary.
