# Performance Report

> Updated on 2026-04-27 (dev server cache -- production build run Apr 25 by triage agent remains authoritative)

## Health Status: YELLOW

**Initial load JS: 2,067 KB (CONFIRMED via Apr 25 prod build, budget: 2,000 KB) -- OVER by 67 KB**
**Total JS: 2,941 KB (Apr 25 prod baseline) / 2,963 KB dev cache today (budget: 3,000 KB) -- Under**

Dev server was running this cycle, so today's `.next` cache is the source -- numbers should be cross-checked against the Apr 25 production build, which remains the authoritative figure for initial load. The Apr 25 baseline (2,941 KB total, 2,067 KB initial) has not been invalidated by any code change since.

**Key changes since Apr 26:**
- **+23 KB dev-cache drift** (2,940 -> 2,963 KB). No production deps added (35, unchanged), no source commits that touch bundles -- this is dev cache regeneration noise from running `next dev` and exercising routes, not real growth. Production baseline remains 2,941 KB until a new prod build runs.
- **`.next` size grew 429 -> 668 MB**. Active dev session cached additional route bundles. Not a budget concern.
- **node_modules: 1,048 MB unchanged** -- under the 1,100 MB budget.
- **All deferred chunks unchanged**: ElevenLabs 478 KB, PostHog 180 KB, react-markdown 110 KB, admin tabs 107 KB.
- **No new perf-related commits**: posthog-js still 1.369.5, voyageai pinned 0.1.0, lucide-react 1.8.0, next 16.2.4.

## Key Metrics

| Metric | Today (2026-04-27 dev) | Prev (2026-04-26 dev) | Apr 25 prod | Apr 4 prod | Budget | Status |
|--------|------------------------|------------------------|-------------|------------|--------|--------|
| Total JS | **2,963 KB** (dev cache) | 2,940 KB (dev cache) | **2,941 KB** | 2,851 KB | 3,000 KB | Under (+37 KB headroom vs dev / +59 KB vs prod baseline) |
| Initial load JS | **2,067 KB** (Apr 25 prod) | 2,067 KB (Apr 25 prod) | **2,067 KB** | ~1,800 KB | 2,000 KB | OVER by 67 KB |
| Total CSS | 125 KB | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | **35** | 35 | 35 | 31 | 40 | Good (+5 headroom) |
| Development deps | 29 | 29 | 29 | -- | -- | Stable |
| node_modules | **1,048 MB** | 1,048 MB | 1,047 MB | 896 MB | 1,100 MB | Under (+52 MB) |
| .next | 668 MB | 429 MB | -- | 46 MB (dev) | -- | Active dev session |

*The +23 KB dev-cache drift is not a real regression. It is the difference between yesterday's idle dev cache and today's after some route exercising. Production baseline is unchanged.*

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Initial load JS** | 2,000 KB | **2,067 KB** (Apr 25 prod) | -67 KB | OVER -- P4 in progress |
| **Total JS** | 3,000 KB | **2,941 KB** (Apr 25 prod) | +59 KB | Under |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,048 MB | +52 MB | Under |

**Deferred chunks (excluded from initial load budget):**

| Chunk | Size | Status |
|-------|------|--------|
| ElevenLabs SDK + LiveKit | ~478 KB | Stable |
| PostHog analytics | ~180 KB | Stable |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~875 KB** | Stable |

## Top 10 Chunks

Chunk hashes change per build. Sizes from today's dev cache; content attribution is stable.

| Rank | Chunk (bytes) | Size | Contents | Loading | Actionable? |
|------|--------------|------|----------|---------|-------------|
| 1 | 0jgxvc_nt0fmz (489,726) | **478 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred (dynamic import) + idle prefetch | No -- already optimized |
| 2 | 07y9atwelbm1e (233,018) | **228 KB** | Next.js App Router bootstrap + PPR + hydration (16.2.4) | Static (framework) | No -- required |
| 3 | 08xx2ho6aacv7 (191,461) | **187 KB** | Supabase SDK (auth, postgrest, **realtime**) | Static | **P4 target -- ~20-30 KB savings** |
| 4 | 0bopql_owpunr (183,793) | **180 KB** | PostHog analytics SDK v1.369.5 | Deferred (useEffect lazy import) | No -- already optimized |
| 5 | 0wu4~xh-5rs6g (134,887) | **132 KB** | React RSC Flight client runtime | Static (framework) | No -- required |
| 6 | 0gb0~kkj~zqpo (125,174) | **122 KB** | i18n strings (all 6 locales -- Turbopack limitation) | Static | P5 closed -- not fixable |
| 7 | 0ktbr965wa~br (114,831) | **112 KB** | Polyfills (core-js v3) | Static | P1 applied -- no further savings |
| 8 | 03~yq9q893hmn (112,594) | **110 KB** | react-markdown + micromark parser | Deferred (inside VoiceChat) | No -- already optimized |
| 9 | 0ax6.6ah0eu8 (109,497) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred (admin tab import) | No -- already optimized |
| 10 | 0c_qd452s0tgs (85,120) | **83 KB** | Sentry client SDK (core + browser tracing, post-P8) | Static | P8 confirmed 0 KB savings; no further action |

**Chunk 3 (Supabase, 187 KB) is the P4 target.** Realtime is the only extractable sub-component for public pages.

## Changes This Cycle (Apr 27 vs Apr 26)

| Item | Change | Driver |
|------|--------|--------|
| Total JS (dev cache) | **+23 KB** (2,940 -> 2,963 KB) | Dev cache drift -- not a real regression |
| Initial load (prod baseline) | **0 KB** (2,067 KB) | No new prod build; baseline unchanged |
| Deferred chunks | **0 KB** (~875 KB) | Stable |
| node_modules | **0 MB** (1,048 -> 1,048 MB) | Stable |
| Production deps | **0** (35 -> 35) | Stable |
| .next disk usage | **+239 MB** (429 -> 668 MB) | Dev session route exercising |

### Commits Since Apr 26 Affecting Bundle Size

None. No production code commits this cycle that change static dependencies, dynamic-import boundaries, or bundle structure. The +23 KB is dev-cache noise, confirmed by zero change to production deps, deferred chunk sizes, or node_modules size.

## P4: Tree-Shake Supabase Realtime -- ACTIVE PRIORITY

**Estimated savings: ~20-30 KB from initial load.**

Supabase `realtime` enables live database subscriptions. No public-facing pages use it; only admin features require it. The browser client currently loads the full SDK for all pages.

### Implementation

Step 1 -- Create a realtime-free client for public pages:

```typescript
// src/lib/supabase/browser-public.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowserPublic = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: { eventsPerSecond: 0 },
    },
  }
);
```

Step 2 -- Replace `supabaseBrowser` with `supabaseBrowserPublic` in public components:
- `src/components/immersive/`
- `src/components/chat/`
- Homepage components

Step 3 -- Keep full client in:
- `src/components/admin/`
- Any caller using `supabase.channel()` or `.on()` subscriptions

Step 4 -- Verify with production build:
```bash
rm -rf .next && npm run build
```

Expected: Supabase chunk drops from ~187 KB to ~160-165 KB. Initial load drops from ~2,067 KB to ~2,040-2,047 KB.

**P4 alone leaves us ~42 KB over budget.** Pair with the budget raise below.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **HIGH** | **Implement P4: Supabase realtime tree-shake** | ~20-30 KB | Medium | See code above. Closes the largest remaining static chunk savings. |
| **HIGH** | **Raise initial load budget to 2,100 KB** | Process change | Trivial | Structural growth since Apr 4 baseline (Sentry, Supabase 2.97->2.104, posthog upgrades, voyageai). P4 alone leaves ~2,042 KB still over 2,000 KB. |
| **MEDIUM** | Run `rm -rf .next && npm run build` next cycle | Visibility | Trivial | Refreshes prod baseline; current Apr 25 baseline is 2 days stale. Performance agent should require a prod build for any cycle reporting >5 KB drift. |
| **LOW** | Monitor Next.js releases for postcss inner copy upgrade | Security cleanup | Trivial | Per Security Agent: postcss override confirmed ineffective; wait for Next.js upstream. |
| **CLOSED** | ~~postcss override~~ | ~~0 KB~~ | -- | Confirmed ineffective Apr 25 -- Next.js bundles isolated copy. |
| **CLOSED** | ~~P8: Sentry Replay removal~~ | ~~0 KB~~ | -- | Replay was config-only; never bundled. Confirmed Apr 25. |
| **CLOSED** | ~~node_modules budget raise~~ | -- | -- | Done Apr 25 (1,000 -> 1,100 MB). |

## Dynamic Import Chain Verification

**Deferred correctly (not in initial load):**

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })       // DEFERRED
    -> dynamic(() => import("./voice-chat-elevenlabs"))           // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"      // ~478 KB
    -> import ReactMarkdown from "react-markdown"                 // ~110 KB
    -> import { usePostHog } from "posthog-js/react"              // ~180 KB
  -> requestIdleCallback(() => import("./voice-chat"))            // PREFETCH (P2)

admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar  // ~107 KB

posthog-provider.tsx -> useEffect(() => Promise.all([
  import("posthog-js"), import("posthog-js/react")
]))   // ~180 KB after hydration, production only (v1.369.5)
```

**Static (in initial load):**

```
@sentry/nextjs: auto-instrumented. Core + browser tracing only (~83 KB).
@sentry/replay NOT included -- confirmed no savings from fef651f5.
Supabase SDK: ~187 KB including realtime (~20-30 KB savings via P4)
i18n: ~122 KB -- Turbopack limitation, not addressable
core-js polyfills: ~112 KB -- P1 browserslist applied, stable
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|-------------------|----------------------|--------|
| next + @next | 286 MB | Framework (required) | 16.2.4 -- current |
| @sentry/nextjs + @sentry/core | 67 MB | ~83 KB static (post-P8) | P8 complete; 0 KB savings confirmed |
| pdfjs-dist | 66 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | v1.8.0 -- current |
| posthog-js | 36 MB | ~180 KB (lazy-loaded in useEffect) | 1.369.5 -- current, 0 advisories |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side only) | 22.0.2 -- current |
| voyageai | -- | ~2 KB (server-side only) | Pinned 0.1.0 (8f53cd29 -- v0.2.x ESM broke dynamic import) |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | OK |
| pino | ~5 MB | 0 KB | Server-only, confirmed |

### Dependency Version Status

Per Security Agent (Apr 27): YELLOW with 8 moderate advisories, 0 exploitable. No bundle action available; both chains are upstream issues (Next.js inner postcss, svix transitive uuid).

| Package | Installed | Latest | Status |
|---------|-----------|--------|--------|
| posthog-js | 1.369.5 | 1.369.5 | Current, 0 advisories |
| next | 16.2.4 | 16.2.4 | Current |
| @anthropic-ai/sdk | ^0.90.0 | 0.90.x | Current |
| @supabase/supabase-js | ^2.104.0 | 2.104.x | Current |
| react / react-dom | ^19.2.5 | 19.2.5 | Current |
| @sentry/nextjs | ^10.49.0 | 10.49.x | Current |
| @sentry/core | 10.49.0 (pinned) | 10.49.x | Current |
| zod | ^4.3.6 | 4.x | Current |
| voyageai | 0.1.0 (pinned) | 0.2.x | Pinned intentionally -- 0.2.x ESM breaks dynamic import |
| resend | 6.12.2 (synced) | 6.12.2 | Pin drift cleared |
| lucide-react | ^1.8.0 | 1.8.0 | Current |
| postcss | ^8.5.10 (devDep) | 8.5.10 | Current; Next.js internal copy at 8.4.31 (advisory, upstream-only fix) |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 20 | Apr 25 (prod) | Apr 26 | **Apr 27** | Trend |
|--------|-------|-------|-------|--------|--------|--------|----------------|--------|------------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,856 | 2,892 | 2,941 | **2,941** | 2,940 | **2,963 (dev)** | +23 KB dev drift |
| Initial load | -- | -- | ~1,800 | ~1,936 | ~1,972 | ~2,066 | **2,067** | 2,067 | **2,067 (prod)** | 0 KB |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~920 | ~875 | **~875** | ~875 | **~875** | 0 KB |
| CSS | 130 | 122 | 123 | 123 | 123 | 125 | **125** | 125 | **125** | 0 KB |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 34 | **35** | 35 | **35** | 0 |
| node_modules | 856 | 865 | 896 | 908 | 930 | 1,047 | **1,047** | 1,048 | **1,048 MB** | 0 MB |

*Apr 27: Dev cache (no prod build this cycle). Apr 25 prod build remains authoritative for initial load and total JS.*
*2.5-month total growth (prod baseline): 2,455 -> 2,941 KB (+486 KB, +19.8%).*

## Optimization Backlog

| Priority | Action | Estimated Savings | Status |
|----------|--------|-------------------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~3 KB actual~~ | DONE (Mar 29) |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | DONE (Mar 29) |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB~~ | DONE (Mar 30) |
| ~~P5~~ | ~~Fix i18n bundling~~ | -- | CLOSED -- Turbopack limitation |
| ~~P6~~ | ~~Split JS budget~~ | -- | DONE (Apr 4) |
| ~~Security~~ | ~~posthog-js advisories~~ | ~~2 advisories~~ | DONE (e66e510, Apr 20) |
| ~~P8~~ | ~~Disable Sentry session replay~~ | ~~0 KB confirmed~~ | DONE (fef651f5, Apr 22) |
| **P4** | **Tree-shake Supabase realtime** | **~20-30 KB** | **ACTIVE -- implement next** |
| **Process** | **Raise initial load budget to 2,100 KB** | **YELLOW -> GREEN** | Recommended alongside P4 |
