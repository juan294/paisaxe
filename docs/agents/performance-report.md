# Performance Report

> Updated on 2026-05-04 (dev server cache; production build skipped 10 cycles running. Apr 25 prod build remains the only authoritative initial-load number.)

## Health Status: GREEN

**Total JS: 2,999 KB / 3,100 KB budget — 101 KB headroom. 15th consecutive GREEN.**

**Initial load JS: ~2,067 KB / 2,100 KB budget — 33 KB headroom (Apr 25 prod baseline, now 10 days stale). A fresh production build is the single highest-priority outstanding action — has been HIGH for 10 cycles.**

Total JS slipped 9 KB versus May 3 (3,008 → 2,999 KB). All ten top chunks are within ~1 KB of their May 3 sizes; the change is normal dev-cache fluctuation, not a real source change. CSS reappears in the metrics this cycle (126 KB) after being skipped on May 3. No npm install was run, so the May 2 patch bumps to posthog-js (1.372.6) and zod (4.4.2) and the May 3-noted postcss patch are still pending in `package.json` but not in `node_modules`.

## Key Metrics

| Metric | May 4 (dev) | May 3 (dev) | Apr 25 (prod) | Apr 4 (prod) | Budget | Status |
|--------|-------------|-------------|----------------|--------------|--------|--------|
| Total JS | **2,999 KB** | 3,008 KB | 2,941 KB | 2,851 KB | **3,100 KB** | GREEN (+101 KB) |
| Initial load JS | ~2,067 KB (Apr 25) | ~2,067 KB (Apr 25) | 2,067 KB | ~1,800 KB | **2,100 KB** | GREEN (+33 KB, stale 10 cycles) |
| Total CSS | 126 KB | N/A (skipped) | 125 KB | 122 KB | -- | Stable |
| Production deps | 35 | 35 | 35 | 31 | 40 | Good |
| Development deps | 30 | 30 | 29 | -- | -- | Stable |
| node_modules | 1,046 MB | 1,046 MB | 1,047 MB | 896 MB | 1,100 MB | Good |
| .next | 59 MB | 327 MB | -- | 46 MB | -- | Fresh dev start |

The .next directory dropped from 327 MB on May 3 to 59 MB this cycle — the dev server was restarted again with no incremental cache accumulation, so this snapshot reflects an early-session compile. That makes the dev-cache numbers slightly lower than May 3, not an actual bundle reduction.

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| Total JS | 3,100 KB | 2,999 KB | +101 KB | GREEN |
| Initial load JS | 2,100 KB | ~2,067 KB (Apr 25, 10-day stale) | +33 KB | GREEN (stale baseline) |
| Largest chunk | 500 KB | 482 KB (ElevenLabs, deferred) | +18 KB | GREEN |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,046 MB | +54 MB | Good |

**Deferred chunks (excluded from initial load, included in total):**

| Chunk | Size | Status |
|-------|------|--------|
| ElevenLabs SDK + LiveKit | ~482 KB | Stable |
| PostHog analytics | ~187 KB | Stable; will shift slightly after posthog-js 1.372.6 install |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~886 KB** | Stable |

## Top 10 Chunks (May 4 dev cache)

| Rank | Chunk file | Size | Likely contents | Loading | Delta vs May 3 |
|------|-----------|------|-----------------|---------|----------------|
| 1 | 1206~6g7o__rc.js (493,450 B) | 482 KB | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred | 0 KB |
| 2 | 07y9atwelbm1e.js (233,018 B) | 228 KB | Next.js App Router bootstrap + PPR | Static (framework) | 0 KB |
| 3 | 0vd-4mj89d3k1.js (200,519 B) | 196 KB | Supabase SDK (auth + postgrest + realtime) | Static | +0.2 KB (issue #558) |
| 4 | 07x9xgl.2yssy.js (190,945 B) | 187 KB | PostHog analytics SDK | Deferred | +1 KB |
| 5 | 0wu4~xh-5rs6g.js (134,887 B) | 132 KB | React RSC Flight client runtime | Static (framework) | 0 KB |
| 6 | 06wz7w8nqnm1x.js (128,001 B) | 125 KB | i18n strings (6 locales, 406 keys) | Static | +0.5 KB (1 new key, `premium.loading_access`) |
| 7 | 0-zzfjv3~jbbq.js (125,470 B) | 122 KB | Unclassified — needs prod build | Unknown | +0.2 KB (hash drift only) |
| 8 | 0ktbr965wa~br.js (114,831 B) | 112 KB | Polyfills (core-js v3) | Static | 0 KB |
| 9 | 03~yq9q893hmn.js (112,594 B) | 110 KB | react-markdown + micromark | Deferred | 0 KB |
| 10 | 13lm54j7eil8i.js (109,499 B) | 107 KB | Admin analytics (Stripe dashboard UI) | Deferred | 0 KB |

Chunk 7 hash changed (`10e1-kbfg7iqw` → `0-zzfjv3~jbbq`) but the size is byte-identical at 122 KB. The hash rotation is consistent with a dev-cache rebuild, not a real change in the chunk's contents. **The chunk has been 122 KB across 4 consecutive cycles and remains unclassified; this is the largest unexplained contributor to growth since Apr 4.**

## Changes This Cycle (May 4 vs May 3)

| Item | Change | Driver |
|------|--------|--------|
| Total JS | 3,008 KB → 2,999 KB (-9 KB) | Dev-cache restart (`.next` 327 MB → 59 MB) |
| CSS | N/A → 126 KB | Reported again after May 3 skip |
| i18n chunk | +1 leaf key (`premium.loading_access`, commit `1b450ac7`) | All 6 locales updated atomically; ~+0.5 KB to chunk 6 |
| Chunk 7 hash | `10e1-kbfg7iqw` → `0-zzfjv3~jbbq` | Rebuild artifact; size 0 KB delta |
| node_modules | 1,046 MB | No change — `npm install` still pending |
| Status | GREEN | Unchanged |

No installed deps changed, no client-side source files of note were touched. The 9 KB dev-cache delta is below the noise floor for the dev compiler and should not be interpreted as a real bundle reduction.

## P4: Tree-Shake Supabase Realtime — RECLASSIFIED (Issue #558)

**Status: On hold. Two real options exist, both require dedicated work.**

The `eventsPerSecond: 0` approach does not tree-shake `@supabase/realtime-js` from the webpack bundle. It is statically imported by `@supabase/supabase-js` regardless of runtime config.

**Option A: Use `@supabase/auth-js` directly in auth-provider** (`src/components/providers/auth-provider.tsx`).
- Bypasses `supabase-js` entirely for the public auth path.
- Estimated savings: 30-50 KB initial load (drops realtime + postgrest).
- Effort: 1-2 hours. Requires re-validating cookie/SSR handoff with `@supabase/ssr`.

**Option B: Lazy-load the full Supabase client.**
- Replace top-level `supabaseBrowser` imports with `await import("@/lib/supabase-browser")` inside event handlers and effects.
- Estimated savings: 30-50 KB initial load (full Supabase chunk shifts to deferred).
- Effort: 2-3 hours. Risk of waterfall regressions on frequently-used paths.

**Recommendation:** Option A. Smaller blast radius. Pursue only if initial load returns over 2,100 KB on a fresh prod build.

The 33 KB initial-load headroom is reported against a 10-day-stale baseline. The fresh prod build may show the actual current number is anywhere from -10 KB to +25 KB versus that figure.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **HIGH (10 cycles overdue)** | **Run a fresh production build** | Visibility only | Trivial | `npm install && rm -rf .next && npm run build`. Predates `3163f478` (+22 KB) and all wave-2 merges. The 33 KB initial-load headroom is an estimate — has not been a measurement since Apr 25. |
| **HIGH** | **Install posthog-js 1.372.6, zod 4.4.2, postcss 8.5.13** | Negligible | Trivial | Bundled into the same `npm install` run. Patch bumps only. |
| **MEDIUM** | **Classify chunk 7 (0-zzfjv3~jbbq, 122 KB)** | Up to 122 KB if avoidable | Trivial after prod build | Size byte-stable for 4 cycles. Hash now rotated; prod build will reveal whether it is static or deferred and what modules are inside. Possible sources: FE-M1 voice-chat extraction, Anthropic SDK 0.92.0 client surface, or shared wave-2 code. |
| **MEDIUM** | **Benchmark dep bumps before merge** | Avoids surprise breaches | Process change | `3163f478` added +22 KB silently. Pattern: run `du -sk .next/static/chunks` before/after dependency PRs. |
| **LOW** | **Pursue Option A (auth-js direct)** | 30-50 KB initial | 1-2 hours | Only if initial load exceeds 2,100 KB after a fresh build confirms. |
| **LOW** | **Monitor PostHog chunk after patch install** | 0-2 KB expected | None | posthog-js patch bump; deferred chunk was 187 KB this cycle. |

## Quick Wins vs Heavy Lifts

**Quick wins (today):**
1. `npm install && rm -rf .next && npm run build` — 10 minutes; installs three pending patches, clears stale cache, and produces the first authoritative initial-load measurement since Apr 25. This alone resolves the two highest-priority action items and is a hard prerequisite for everything else on the list.
2. After the build, classify chunk 7 from webpack chunk-name output. If deferred, close the open question. If static and avoidable, file an issue.

**Heavy lift (only when needed):**
1. Issue #558 Option A (auth-js direct in auth-provider). Estimated 1-2 hours plus a verification cycle. Hold until initial-load headroom narrows below 10 KB on a fresh prod baseline.

## Dynamic Import Chain Verification

**Deferred correctly (not in initial load):**

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })       // DEFERRED
    -> voice-chat/chat-header.tsx                                 // DEFERRED (FE-M1)
    -> voice-chat/chat-message-list.tsx                           // DEFERRED (FE-M1)
    -> voice-chat/chat-composer.tsx                               // DEFERRED (FE-M1)
    -> voice-chat/chat-error-banner.tsx                           // DEFERRED (FE-M1)
    -> dynamic(() => import("./voice-chat-elevenlabs"))           // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"      // ~482 KB
    -> import ReactMarkdown from "react-markdown"                 // ~110 KB
    -> import { usePostHog } from "posthog-js/react"              // ~187 KB
  -> requestIdleCallback(() => import("./voice-chat"))            // PREFETCH (P2)

admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar  // ~107 KB
```

**Static (in initial load):**

```
@sentry/nextjs: core + browser tracing (~83 KB, unchanged)
Supabase SDK: ~196 KB including realtime (issue #558)
i18n: ~125 KB — Turbopack limitation (406 keys, +1 this cycle)
core-js polyfills: ~112 KB — P1 browserslist applied, stable
```

**Unclassified:**

```
Chunk 7 (0-zzfjv3~jbbq, 125,470 B, 122 KB) — Size byte-stable for 4 cycles,
  hash rotated this cycle on dev rebuild. Possible sources: FE-M1 shared code,
  Anthropic SDK 0.92.0 client surface, or other wave-2 shared modules. Prod
  build required to classify. If static, this is the largest unexplained
  contributor to initial-load growth since Apr 4.
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Version | Status |
|---------|-------------------|----------------------|---------|--------|
| next + @next | 286 MB | Framework (required) | 16.2.4 | Current |
| @sentry/nextjs + @sentry/core | 68 MB | ~83 KB static | 10.51.0 | Current |
| pdfjs-dist | 61 MB | 0 KB (devDependency) | 5.7.284 | Correct — server/scripts only |
| pdf-parse | 57 MB | 0 KB (devDependency) | 2.4.5 | Correct — server/scripts only |
| @opentelemetry | 46 MB | 0 KB (server-only) | various | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | 1.14.0 | Current |
| posthog-js | 37 MB | ~187 KB (lazy-loaded) | 1.372.5 (1.372.6 pending install) | Patch bump pending |
| @napi-rs | 30 MB | 0 KB (native, server-only) | -- | No action |
| typescript | 24 MB | 0 KB (devDependency) | 6.0.3 | Current |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | 3.2.3 | No action |
| stripe | 18 MB | ~10-15 KB (server-side) | 22.1.0 | Current |
| @rolldown | 19 MB | 0 KB (devDependency) | -- | Bundler internals, no action |
| @img | 16 MB | 0 KB (sharp native, server-only) | -- | No action |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | 3.x | No further action |
| zod | ~5 MB | ~8-12 KB | 4.4.1 (4.4.2 pending install) | Patch bump pending |
| voyageai | -- | ~2 KB (server-side only) | **0.1.0 (PINNED)** | **DO NOT BUMP — v0.2.x ESM build broken (`749048e5`)** |

### Dependency Version Status

Per Security Agent (May 4): GREEN — 0 advisories, npm audit clean. 3 prod patch bumps still pending install (posthog-js, zod, postcss). voyageai must remain pinned at 0.1.0.

| Package | Installed | Package.json | Status |
|---------|-----------|-------------|--------|
| posthog-js | 1.372.5 | ^1.372.6 | Pending `npm install` (3rd cycle) |
| zod | 4.4.1 | ^4.4.2 | Pending `npm install` (3rd cycle) |
| postcss | 8.5.10 | ^8.5.10 (override) | Latest available 8.5.13 |
| next | 16.2.4 | ^16.2.4 | Current |
| @anthropic-ai/sdk | 0.92.0 | ^0.92.0 | Current |
| @supabase/supabase-js | 2.105.x | ^2.105.1 | Current (#558 target) |
| @elevenlabs/react | 1.3.0 | ^1.3.0 | Current |
| react / react-dom | 19.2.5 | ^19.2.5 | Current |
| @sentry/nextjs | 10.51.0 | ^10.51.0 | Current |
| voyageai | 0.1.0 (pinned) | 0.1.0 | Intentional — DO NOT UPGRADE |
| lucide-react | 1.14.0 | ^1.14.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 17 | Apr 25 (prod) | Apr 30 | May 1 | May 2 | May 3 | **May 4** | Trend |
|--------|-------|-------|-------|--------|----------------|--------|-------|-------|-------|-----------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,892 | 2,941 | 2,986 | 3,008 | 3,008 | 3,008 | **2,999** | Plateau (-9 KB dev cache) |
| Initial load | -- | -- | ~1,800 | ~1,972 | 2,067 | 2,067 | 2,067 | 2,067 | 2,067 | **2,067 (10-day stale)** | Flat — needs fresh prod build |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~875 | ~875 | ~885 | ~885 | ~885 | **~886** | Stable |
| CSS | 130 | 122 | 123 | 123 | 125 | 125 | 125 | 125 | N/A | **126** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 35 | 35 | 35 | 35 | 35 | **35** | Stable |
| node_modules | 856 | 865 | 896 | 930 | 1,047 | 1,048 | 1,046 | 1,046 | 1,046 | **1,046 MB** | Stable |

*Total JS growth Feb 7 → May 4: +544 KB (+22.2%) over 2.9 months. Bundle plateau holds since Apr 30; budgets raised on Apr 4 to absorb structural wave-1/wave-2 growth.*

## Comparison vs Previous Run (May 3)

| Item | May 3 | May 4 | Delta | Verdict |
|------|-------|-------|-------|---------|
| Total JS | 3,008 KB | 2,999 KB | -9 KB | Dev-cache restart artifact |
| Initial load | ~2,067 KB (stale) | ~2,067 KB (stale 10 days) | 0 KB | Still stale — prod build overdue |
| CSS | N/A (skipped) | 126 KB | -- | Stable vs Apr 25 (125 KB) |
| Chunk 6 (i18n) | 125 KB | 125 KB | +0.5 KB | One new translation key |
| Chunk 7 (unclassified) | 122 KB | 122 KB | 0 KB (hash rotated) | Unchanged contents |
| posthog-js installed | 1.372.5 | 1.372.5 | -- | Patch bump still pending |
| zod installed | 4.4.1 | 4.4.1 | -- | Patch bump still pending |
| Status | GREEN | **GREEN** | -- | Unchanged |

## Optimization Backlog

| Priority | Action | Estimated Savings | Status |
|----------|--------|-------------------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~3 KB actual~~ | DONE (Mar 29) |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | DONE (Mar 29) |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB~~ | DONE (Mar 30) |
| ~~P5~~ | ~~Fix i18n bundling~~ | -- | CLOSED — Turbopack limitation |
| ~~P6~~ | ~~Split JS budget~~ | -- | DONE (Apr 4) |
| ~~Security~~ | ~~posthog-js advisories~~ | ~~2 advisories~~ | DONE (e66e510, Apr 20) |
| ~~P8~~ | ~~Disable Sentry session replay~~ | ~~0 KB confirmed~~ | DONE (fef651f5, Apr 22) |
| ~~P4 (original)~~ | ~~Tree-shake via eventsPerSecond:0~~ | ~~~25 KB~~ | RECLASSIFIED — does not tree-shake (#558) |
| **Process** | **Fresh prod build + npm install** | **Visibility + accurate baseline** | **Overdue — 10 cycles** |
| **Process** | **Classify chunk 7 after fresh build** | **Up to 122 KB if avoidable** | Pending prod build |
| **P4 Option A** | **Use @supabase/auth-js directly in auth-provider** | **30-50 KB initial** | Hold — only if initial load returns over 2,100 KB |
| **P4 Option B** | **Lazy-load full Supabase client** | **30-50 KB initial** | Hold — higher risk than Option A |
| **Process** | **Benchmark dep bumps before merge** | **Avoids surprise breaches** | Ongoing |

---
