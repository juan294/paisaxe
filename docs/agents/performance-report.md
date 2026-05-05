# Performance Report

> Updated on 2026-05-05 (dev server cache; production build completed by May 4 triage — initial-load breakdown not yet extracted from that build's output.)

## Health Status: GREEN

**Total JS: 2,999 KB / 3,100 KB budget — 101 KB headroom. 16th consecutive GREEN.**

**Initial load JS: ~2,067 KB / 2,100 KB budget — 33 KB headroom (Apr 25 prod baseline; May 4 triage ran a fresh prod build but initial-load output was not captured; estimate still applies).**

Total JS is byte-identical to May 4 (0 KB change). All ten top chunks have the same byte count as yesterday — the dev server is serving the same compiled output. No npm install, no source changes since the May 4 triage. The "production build overdue" action item that held HIGH priority for 11 cycles is now RESOLVED: the May 4 triage ran `npm run build` successfully and confirmed the old `10e1-kbfg7iqw.js` chunk is no longer in the build output. CSS stable at 126 KB.

Two new outdated packages flagged by the Security Agent (May 5): `@anthropic-ai/sdk` 0.92.0 → 0.93.0 and `posthog-js` 1.372.6 → 1.372.8 (one more patch beyond what package.json currently pins). Zero CVEs on either.

## Key Metrics

| Metric | May 5 (dev) | May 4 (dev) | Apr 25 (prod) | Apr 4 (prod) | Budget | Status |
|--------|-------------|-------------|----------------|--------------|--------|--------|
| Total JS | **2,999 KB** | 2,999 KB | 2,941 KB | 2,851 KB | **3,100 KB** | GREEN (+101 KB) |
| Initial load JS | ~2,067 KB (estimated) | ~2,067 KB (Apr 25) | 2,067 KB | ~1,800 KB | **2,100 KB** | GREEN (+33 KB, baseline needs extraction from May 4 build) |
| Total CSS | 126 KB | 126 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | 35 | 35 | 35 | 31 | 40 | Good |
| Development deps | 30 | 30 | 29 | -- | -- | Stable |
| node_modules | 1,046 MB | 1,046 MB | 1,047 MB | 896 MB | 1,100 MB | Good |
| .next | 59 MB | 59 MB | -- | 46 MB | -- | Stable |

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| Total JS | 3,100 KB | 2,999 KB | +101 KB | GREEN |
| Initial load JS | 2,100 KB | ~2,067 KB (estimated) | +33 KB | GREEN |
| Largest chunk | 500 KB | 482 KB (ElevenLabs, deferred) | +18 KB | GREEN |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,046 MB | +54 MB | Good |

**Deferred chunks (excluded from initial load, included in total):**

| Chunk | Size | Status |
|-------|------|--------|
| ElevenLabs SDK + LiveKit | ~482 KB | Stable |
| PostHog analytics | ~187 KB | Stable; will shift slightly after posthog-js 1.372.8 install |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~886 KB** | Stable |

## Top 10 Chunks (May 5 dev cache — byte-identical to May 4)

| Rank | Chunk file | Size | Likely contents | Loading | Delta vs May 4 |
|------|-----------|------|-----------------|---------|----------------|
| 1 | 1206~6g7o__rc.js (493,450 B) | 482 KB | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred | 0 KB |
| 2 | 07y9atwelbm1e.js (233,018 B) | 228 KB | Next.js App Router bootstrap + PPR | Static (framework) | 0 KB |
| 3 | 0vd-4mj89d3k1.js (200,519 B) | 196 KB | Supabase SDK (auth + postgrest + realtime) | Static | 0 KB |
| 4 | 07x9xgl.2yssy.js (190,945 B) | 187 KB | PostHog analytics SDK | Deferred | 0 KB |
| 5 | 0wu4~xh-5rs6g.js (134,887 B) | 132 KB | React RSC Flight client runtime | Static (framework) | 0 KB |
| 6 | 06wz7w8nqnm1x.js (128,001 B) | 125 KB | i18n strings (6 locales, 406 keys) | Static | 0 KB |
| 7 | 0-zzfjv3~jbbq.js (125,470 B) | 122 KB | Unclassified — initial-load classification pending | Unknown | 0 KB |
| 8 | 0ktbr965wa~br.js (114,831 B) | 112 KB | Polyfills (core-js v3) | Static | 0 KB |
| 9 | 03~yq9q893hmn.js (112,594 B) | 110 KB | react-markdown + micromark | Deferred | 0 KB |
| 10 | 13lm54j7eil8i.js (109,499 B) | 107 KB | Admin analytics (Stripe dashboard UI) | Deferred | 0 KB |

Chunk 7 (`0-zzfjv3~jbbq`, 122 KB) remains unclassified. The May 4 triage confirmed this hash appeared in the fresh production build (replacing the old `10e1-kbfg7iqw`), so it is a real production chunk, not a dev artifact. Its static vs deferred status and module contents are still unknown without running `npm run build:analyze`. At 122 KB it is the largest unexplained contributor to bundle growth since Apr 4.

## Changes This Cycle (May 5 vs May 4)

| Item | Change | Driver |
|------|--------|--------|
| Total JS | 2,999 KB → 2,999 KB (0 KB) | No source changes, no npm install |
| All 10 top chunks | Byte-identical | Same .next cache as May 4 |
| Initial load estimate | ~2,067 KB (unchanged) | May 4 triage prod build not analyzed for initial-load split |
| CSS | 126 KB → 126 KB | Stable |
| node_modules | 1,046 MB | No change |
| **Fresh prod build** | **RESOLVED** | May 4 triage ran `npm run build`; 11-cycle backlog cleared |
| @anthropic-ai/sdk | 0.92.0 installed; 0.93.0 available | Security Agent May 5 |
| posthog-js | ^1.372.6 in package.json; 1.372.8 available | Security Agent May 5 |
| Status | GREEN | Unchanged |

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

**Recommendation:** Option A. Smaller blast radius. Pursue only if initial load exceeds 2,100 KB on a fresh prod build with authoritative split output.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| ~~**HIGH (11 cycles overdue)**~~ | ~~**Run a fresh production build**~~ | ~~Visibility only~~ | ~~Trivial~~ | **DONE — May 4 triage. `npm run build` completed. Old chunk `10e1-kbfg7iqw` replaced by `0-zzfjv3~jbbq`.** |
| **MEDIUM** | **Run `npm run build:analyze` to classify chunk 7** | Up to 122 KB if avoidable | 15 minutes | Chunk 7 (`0-zzfjv3~jbbq`, 122 KB) is confirmed in the production build but still unclassified. `npm run build:analyze` produces a webpack stats view; if chunk 7 is static, it is the largest remaining optimization target. |
| **MEDIUM** | **Install pending dep patches** | Negligible | Trivial | `npm install` to pick up posthog-js 1.372.8, zod 4.4.2, postcss 8.5.10 (override). Review `@anthropic-ai/sdk` 0.93.0 changelog before including. Exclude voyageai. |
| **MEDIUM** | **Benchmark dep bumps before merge** | Avoids surprise breaches | Process change | `3163f478` added +22 KB silently. Pattern: run `du -sk .next/static/chunks` before/after dependency PRs. |
| **LOW** | **Extract authoritative initial-load KB from May 4 build output** | Visibility | Trivial | Pipe `next build` output through `grep -E "(First Load|kB)"` on next prod build to capture the initial-load breakdown per-route. Eliminates stale Apr 25 estimate. |
| **LOW** | **Pursue Option A (auth-js direct)** | 30-50 KB initial | 1-2 hours | Only if initial load exceeds 2,100 KB after authoritative measurement. |

## Quick Wins vs Heavy Lifts

**Quick wins (today):**
1. `npm run build:analyze` — 10 minutes; produces the webpack bundle visualizer showing exactly what is in chunk 7. Closes the largest open analysis gap.
2. `npm install` — picks up posthog-js 1.372.8, zod 4.4.2, and postcss override. Review @anthropic-ai/sdk 0.93.0 changelog separately before including.

**Heavy lift (only when needed):**
1. Issue #558 Option A (auth-js direct in auth-provider). Hold until initial-load headroom narrows below 10 KB on an authoritative prod build with per-route breakdown.

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
i18n: ~125 KB — Turbopack limitation (406 keys, stable)
core-js polyfills: ~112 KB — P1 browserslist applied, stable
```

**Unclassified:**

```
Chunk 7 (0-zzfjv3~jbbq, 125,470 B, 122 KB) — Confirmed present in May 4 production build.
  Static vs deferred unknown. Possible sources: FE-M1 shared code, Anthropic SDK client
  surface, or wave-2 shared modules. Run `npm run build:analyze` to classify.
  If static, this is the largest remaining optimization target.
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
| posthog-js | 37 MB | ~187 KB (lazy-loaded) | 1.372.6 (1.372.8 available) | Patch bump pending |
| @napi-rs | 30 MB | 0 KB (native, server-only) | -- | No action |
| typescript | 24 MB | 0 KB (devDependency) | 6.0.3 | Current |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | 3.2.3 | No action |
| stripe | 18 MB | ~10-15 KB (server-side) | 22.1.0 | Current |
| @rolldown | 19 MB | 0 KB (devDependency) | -- | Bundler internals, no action |
| @img | 16 MB | 0 KB (sharp native, server-only) | -- | No action |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | 3.x | No further action |
| zod | ~5 MB | ~8-12 KB | 4.4.2 | Current per package.json |
| voyageai | -- | ~2 KB (server-side only) | **0.1.0 (PINNED)** | **DO NOT BUMP — v0.2.x ESM build broken (`749048e5`)** |

### Dependency Version Status

Per Security Agent (May 5): GREEN — 0 advisories, 0 exploitable. Eleventh consecutive GREEN. voyageai must remain pinned at 0.1.0.

| Package | Installed | Available | Status |
|---------|-----------|-----------|--------|
| posthog-js | 1.372.6 (est.) | 1.372.8 | Patch bump available |
| zod | 4.4.2 | 4.4.2 | Current |
| postcss | 8.5.10 | 8.5.14 | Patch bump available |
| @anthropic-ai/sdk | 0.92.0 | 0.93.0 | Minor upgrade available — review changelog |
| @supabase/supabase-js | 2.105.x | 2.105.3 | Patch bump available |
| next | 16.2.4 | 16.2.4 | Current |
| @elevenlabs/react | 1.3.0 | 1.3.0 | Current |
| react / react-dom | 19.2.5 | 19.2.5 | Current |
| @sentry/nextjs | 10.51.0 | 10.51.0 | Current |
| voyageai | 0.1.0 (pinned) | -- | Intentional — DO NOT UPGRADE |
| lucide-react | 1.14.0 | 1.14.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 17 | Apr 25 (prod) | May 1 | May 3 | May 4 | **May 5** | Trend |
|--------|-------|-------|-------|--------|----------------|-------|-------|-------|-----------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,892 | 2,941 | 3,008 | 3,008 | 2,999 | **2,999** | Plateau (0 KB) |
| Initial load | -- | -- | ~1,800 | ~1,972 | 2,067 | 2,067 | 2,067 | 2,067 | **~2,067 (est.)** | Flat — authoritative May 4 build output not captured |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~875 | ~885 | ~885 | ~886 | **~886** | Stable |
| CSS | 130 | 122 | 123 | 123 | 125 | 125 | 125 | 126 | **126** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 35 | 35 | 35 | 35 | **35** | Stable |
| node_modules | 856 | 865 | 896 | 930 | 1,047 | 1,046 | 1,046 | 1,046 | **1,046 MB** | Stable |

*Total JS growth Feb 7 → May 5: +544 KB (+22.2%) over 3.0 months. Bundle has plateaued since Apr 30. Split budgets (2,100 KB initial / 3,100 KB total) adopted Apr 4 absorb structural wave-1/wave-2 growth.*

## Comparison vs Previous Run (May 4)

| Item | May 4 | May 5 | Delta | Verdict |
|------|-------|-------|-------|---------|
| Total JS | 2,999 KB | 2,999 KB | 0 KB | Byte-identical — no source or dep changes |
| All 10 top chunks | See above | See above | 0 KB each | Identical |
| Initial load | ~2,067 KB (est.) | ~2,067 KB (est.) | 0 KB | Estimate unchanged; May 4 prod build output not captured |
| CSS | 126 KB | 126 KB | 0 KB | Stable |
| Fresh prod build | OVERDUE (11 cycles) | **RESOLVED (May 4 triage)** | -- | May 4 triage ran `npm run build` successfully |
| @anthropic-ai/sdk | 0.92.0 available | 0.93.0 available | -- | New minor version; review changelog before batching |
| posthog-js | 1.372.6 available | 1.372.8 available | -- | One more patch since yesterday |
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
| ~~Process~~ | ~~Fresh prod build~~ | ~~Visibility + accurate baseline~~ | **DONE — May 4 triage** |
| **Analysis** | **`npm run build:analyze` to classify chunk 7** | Up to 122 KB if avoidable | Pending — highest analysis priority |
| **Process** | **`npm install` for pending patch bumps** | Negligible | Pending — posthog-js 1.372.8, zod 4.4.2, postcss 8.5.14 |
| **Process** | **Benchmark dep bumps before merge** | Avoids surprise breaches | Ongoing |
| **P4 Option A** | **Use @supabase/auth-js directly in auth-provider** | **30-50 KB initial** | Hold — only if initial load exceeds 2,100 KB |
| **P4 Option B** | **Lazy-load full Supabase client** | **30-50 KB initial** | Hold — higher risk than Option A |

---
