# Performance Report

> Updated on 2026-05-07 (dev server cache; production build skipped. Initial-load estimate from Apr 25 prod baseline still applies — May 4 triage ran a fresh build but initial-load per-route output was not captured.)

## Health Status: GREEN

**Total JS: 2,999 KB / 3,100 KB budget — 101 KB headroom. 18th consecutive GREEN.**

**Initial load JS: ~2,067 KB / 2,100 KB budget — 33 KB headroom (Apr 25 prod baseline estimate).**

Total JS is byte-identical to May 6 (0 KB net change). All 10 top chunks have identical file names and sizes — the .next cache is unchanged from yesterday. No source changes, no dep installs, no bundle impact from coverage agent test additions (test-only). Security Agent (May 7) identified 4 new outdated production packages vs May 6: `next` 16.2.5, `react`/`react-dom` 19.2.6, `stripe` 22.1.1, `resend` 6.12.3 — all patch/minor, zero CVEs. `@anthropic-ai/sdk` is now 3 minor versions behind (0.92.0 vs 0.95.0). CSS stable at 126 KB. ElevenLabs billing cycle resets today (~14:36 UTC per Cost Analyst).

## Key Metrics

| Metric | May 7 (dev) | May 6 (dev) | Apr 25 (prod) | Apr 4 (prod) | Budget | Status |
|--------|-------------|-------------|----------------|--------------|--------|--------|
| Total JS | **2,999 KB** | 2,999 KB | 2,941 KB | 2,851 KB | **3,100 KB** | GREEN (+101 KB) |
| Initial load JS | ~2,067 KB (estimated) | ~2,067 KB (est.) | 2,067 KB | ~1,800 KB | **2,100 KB** | GREEN (+33 KB est.) |
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
| ElevenLabs SDK + LiveKit | ~482 KB | Stable; @elevenlabs/react 1.4.0 minor available — measure before/after upgrade |
| PostHog analytics | ~186 KB | Stable |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~885 KB** | Stable (unchanged from May 6) |

## Top 10 Chunks (May 7 dev cache)

| Rank | Chunk file | Size | Likely contents | Loading | Delta vs May 6 |
|------|-----------|------|-----------------|---------|----------------|
| 1 | 1206~6g7o__rc.js (493,450 B) | 482 KB | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred | 0 KB |
| 2 | 07y9atwelbm1e.js (233,018 B) | 228 KB | Next.js App Router bootstrap + PPR | Static (framework) | 0 KB |
| 3 | 16.-n76qj0h36.js (201,128 B) | 197 KB | Supabase SDK (auth + postgrest + realtime) | Static | 0 KB |
| 4 | 0rzlto6_bwxpx.js (190,125 B) | 186 KB | PostHog analytics SDK | Deferred | 0 KB |
| 5 | 0wu4~xh-5rs6g.js (134,887 B) | 132 KB | React RSC Flight client runtime | Static (framework) | 0 KB |
| 6 | 06wz7w8nqnm1x.js (128,001 B) | 125 KB | i18n strings (6 locales, 406 keys) | Static | 0 KB |
| 7 | 0-zzfjv3~jbbq.js (125,470 B) | 122 KB | Unclassified — static vs deferred unknown | Unknown | 0 KB |
| 8 | 0ktbr965wa~br.js (114,831 B) | 112 KB | Polyfills (core-js v3) | Static | 0 KB |
| 9 | 03~yq9q893hmn.js (112,594 B) | 110 KB | react-markdown + micromark | Deferred | 0 KB |
| 10 | 13lm54j7eil8i.js (109,499 B) | 107 KB | Admin analytics (Stripe dashboard UI) | Deferred | 0 KB |

All 10 chunks have identical file names and byte sizes vs May 6. Cache is unchanged. Coverage agent's +28 new tests added this cycle are test-only — zero bundle impact confirmed. Chunk 7 (`0-zzfjv3~jbbq`, 122 KB) remains unclassified for the 5th consecutive cycle. Hash stability across cycles suggests it is a shared module boundary, not a dynamic dep chunk.

## Changes This Cycle (May 7 vs May 6)

| Item | Change | Driver |
|------|--------|--------|
| Total JS | 0 KB | No installs, no source changes |
| All top-10 chunks | 0 KB, same hashes | Cache unchanged |
| Coverage agent tests | +28 tests (cron-job-lock, route error paths) | Test-only, zero bundle impact |
| `next` | 16.2.4 installed; **16.2.5 available** | Security Agent May 7 — patch, new this cycle |
| `react` / `react-dom` | 19.2.5 installed; **19.2.6 available** | Security Agent May 7 — patch, new this cycle |
| `stripe` | 22.1.0 installed; **22.1.1 available** | Security Agent May 7 — patch, new this cycle |
| `resend` | 6.12.2 installed; **6.12.3 available** | Security Agent May 7 — patch, new this cycle |
| `@anthropic-ai/sdk` | 0.92.0 installed; **0.95.0 available** | Now 3 minor versions behind (was 2) |
| `@elevenlabs/react` | 1.3.0 installed; 1.4.0 available | Carried from May 6 — measure ElevenLabs chunk before/after |
| Status | GREEN | Unchanged — 18th consecutive |

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
| **MEDIUM** | **Run `npm run build:analyze` to classify chunk 7** | Up to 122 KB if avoidable | 15 minutes | Chunk 7 (`0-zzfjv3~jbbq`, 122 KB) now unclassified for 5th consecutive cycle. If static, it is the largest remaining optimization target. Hash stability suggests shared boundary code, but `build:analyze` is required to confirm. |
| **MEDIUM** | **Batch pending dep upgrades** | Negligible | Trivial | `next` 16.2.5, `react`/`react-dom` 19.2.6, `stripe` 22.1.1, `resend` 6.12.3, `@elevenlabs/react` 1.4.0 (measure ElevenLabs chunk before/after), `@upstash/redis` 1.38.0, `posthog-js` 1.372.9. Review `@anthropic-ai/sdk` 0.93.0–0.95.0 changelogs separately before including. Exclude `voyageai`. |
| **MEDIUM** | **Measure ElevenLabs chunk before/after @elevenlabs/react 1.4.0** | Unknown | 5 minutes | Run `du -sk .next/static/chunks/1206*.js` before/after `npm install @elevenlabs/react@1.4.0`. The 482 KB ElevenLabs chunk is the single largest in the bundle. |
| **MEDIUM** | **Benchmark dep bumps before merge** | Avoids surprise breaches | Process change | Diff `du -sk .next/static/chunks` before/after any dep PR. Validated by May 5-6 chunk hash observation. |
| **LOW** | **Extract authoritative initial-load KB from next prod build** | Visibility | Trivial | Pipe `next build` output through `grep -E "(First Load|kB)"` to capture per-route breakdown. Eliminates stale Apr 25 estimate (+33 KB headroom unconfirmed). |
| **LOW** | **Pursue Option A (auth-js direct)** | 30-50 KB initial | 1-2 hours | Only if initial load exceeds 2,100 KB after authoritative measurement. |

## Quick Wins vs Heavy Lifts

**Quick wins (today):**
1. `npm run build:analyze` — 10-15 minutes; classify chunk 7 and confirm initial-load split. Now 5 cycles overdue.
2. `npm install next@16.2.5 react@19.2.6 react-dom@19.2.6 stripe@latest resend@latest @elevenlabs/react@1.4.0 @upstash/redis@latest posthog-js@latest` — measure ElevenLabs chunk before/after. Review `@anthropic-ai/sdk` 0.93-0.95 changelog separately.

**Heavy lift (only when needed):**
1. Issue #558 Option A (auth-js direct in auth-provider). Hold until initial-load headroom narrows below 10 KB on an authoritative prod build.

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
    -> import { usePostHog } from "posthog-js/react"              // ~186 KB
  -> requestIdleCallback(() => import("./voice-chat"))            // PREFETCH (P2)

admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar  // ~107 KB
```

**Static (in initial load):**

```
@sentry/nextjs: core + browser tracing (~83 KB, unchanged)
Supabase SDK: ~197 KB including realtime (issue #558 — stable since 2.105.3 patch)
i18n: ~125 KB — Turbopack limitation (406 keys, stable, 47th consecutive clean run)
core-js polyfills: ~112 KB — P1 browserslist applied, stable
```

**Unclassified:**

```
Chunk 7 (0-zzfjv3~jbbq, 125,470 B, 122 KB) — Confirmed present in May 4 production build.
  Static vs deferred unknown. Hash unchanged for 5 consecutive cycles.
  Possible sources: FE-M1 shared code, Anthropic SDK client surface, or wave-2 shared modules.
  Run `npm run build:analyze` to classify. If static, this is the largest remaining optimization target.
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Version | Status |
|---------|-------------------|----------------------|---------|--------|
| next + @next | 286 MB | Framework (required) | 16.2.4 (16.2.5 available) | Patch available |
| @sentry/nextjs + @sentry/core | 68 MB | ~83 KB static | 10.51.0 | Current |
| pdfjs-dist | 61 MB | 0 KB (devDependency) | 5.7.284 | Correct — server/scripts only |
| pdf-parse | 57 MB | 0 KB (devDependency) | 2.4.5 | Correct — server/scripts only |
| @opentelemetry | 46 MB | 0 KB (server-only) | various | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | 1.14.0 | Current |
| posthog-js | 37 MB | ~186 KB (lazy-loaded) | 1.372.8 (1.372.9 available) | Patch bump available |
| @napi-rs | 30 MB | 0 KB (native, server-only) | -- | No action |
| typescript | 24 MB | 0 KB (devDependency) | 6.0.3 | Current |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | 3.2.3 | No action |
| stripe | 18 MB | ~10-15 KB (server-side) | 22.1.0 (22.1.1 available) | Patch available |
| @rolldown | 19 MB | 0 KB (devDependency) | -- | Bundler internals, no action |
| @img | 16 MB | 0 KB (sharp native, server-only) | -- | No action |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | 3.x | No further action |
| zod | ~5 MB | ~8-12 KB | 4.4.3 | Current |
| voyageai | -- | ~2 KB (server-side only) | **0.1.0 (PINNED)** | **DO NOT BUMP — v0.2.x ESM build broken (`749048e5`)** |

### Dependency Version Status

Per Security Agent (May 7): GREEN — 0 advisories, 0 exploitable. Thirteenth consecutive GREEN. voyageai must remain pinned at 0.1.0. 17 outdated packages (up from 10 on May 6) — 4 new patch arrivals in the next/react/stripe/resend ecosystem.

| Package | Installed | Available | Status |
|---------|-----------|-----------|--------|
| `@anthropic-ai/sdk` | 0.92.0 | **0.95.0** | **3 minor versions behind — review 0.93.0–0.95.0 changelogs before batching** |
| `@elevenlabs/react` | 1.3.0 | **1.4.0** | **Minor upgrade available — measure ElevenLabs 482 KB chunk before/after** |
| `next` | 16.2.4 | **16.2.5** | Patch available — new this cycle |
| `react` | 19.2.5 | **19.2.6** | Patch available — new this cycle |
| `react-dom` | 19.2.5 | **19.2.6** | Patch available — new this cycle |
| `stripe` | 22.1.0 | **22.1.1** | Patch available — new this cycle |
| `resend` | 6.12.2 | **6.12.3** | Patch available — new this cycle |
| `@upstash/redis` | 1.37.0 | **1.38.0** | Minor upgrade available |
| `posthog-js` | 1.372.8 | 1.372.9 | Patch available |
| `zod` | 4.4.3 | 4.4.3 | Current |
| `postcss` | 8.5.14 | 8.5.14 | Current |
| `@supabase/supabase-js` | 2.105.3 | 2.105.3 | Current |
| `@sentry/nextjs` | 10.51.0 | 10.51.0 | Current |
| `lucide-react` | 1.14.0 | 1.14.0 | Current |
| `voyageai` | 0.1.0 (pinned) | -- | Intentional — DO NOT UPGRADE |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 17 | Apr 25 (prod) | May 3 | May 4 | May 5 | May 6 | **May 7** | Trend |
|--------|-------|-------|-------|--------|----------------|-------|-------|-------|-------|-----------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,892 | 2,941 | 3,008 | 2,999 | 2,999 | 2,999 | **2,999** | Plateau (0 KB, 8th cycle) |
| Initial load | -- | -- | ~1,800 | ~1,972 | 2,067 | 2,067 | 2,067 | ~2,067 | ~2,067 | **~2,067 (est.)** | Flat — authoritative prod extract pending |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~875 | ~885 | ~886 | ~886 | ~885 | **~885** | Stable |
| CSS | 130 | 122 | 123 | 123 | 125 | 125 | 126 | 126 | 126 | **126** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 35 | 35 | 35 | 35 | 35 | **35** | Stable |
| node_modules | 856 | 865 | 896 | 930 | 1,047 | 1,046 | 1,046 | 1,046 | 1,046 | **1,046 MB** | Stable |

*Total JS growth Feb 7 → May 7: +544 KB (+22.2%) over 3.1 months. Bundle has plateaued since Apr 30 (8 consecutive cycles at 2,999 KB). Split budgets (2,100 KB initial / 3,100 KB total) adopted Apr 4 absorb structural wave-1/wave-2 growth.*

## Comparison vs Previous Run (May 6)

| Item | May 6 | May 7 | Delta | Verdict |
|------|-------|-------|-------|---------|
| Total JS | 2,999 KB | 2,999 KB | 0 KB | Byte-identical; all chunk names and sizes unchanged |
| All top-10 chunks | Unchanged | Unchanged | 0 KB each | No dep installs, no source changes |
| Initial load | ~2,067 KB (est.) | ~2,067 KB (est.) | 0 KB | Estimate unchanged |
| CSS | 126 KB | 126 KB | 0 KB | Stable |
| `next` | 16.2.4 | 16.2.4 (16.2.5 new) | -- | Patch now available — new from Security Agent May 7 |
| `react`/`react-dom` | 19.2.5 | 19.2.5 (19.2.6 new) | -- | Patch now available — new from Security Agent May 7 |
| `stripe` | 22.1.0 | 22.1.0 (22.1.1 new) | -- | Patch now available — new from Security Agent May 7 |
| `resend` | 6.12.2 | 6.12.2 (6.12.3 new) | -- | Patch now available — new from Security Agent May 7 |
| `@anthropic-ai/sdk` | 2 minor versions behind | 3 minor versions behind | --  | 0.95.0 now latest; changelog review before batching |
| Status | GREEN (17th) | **GREEN (18th)** | -- | Consecutive streak extended |

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
| ~~Process~~ | ~~Fresh prod build~~ | ~~Visibility + accurate baseline~~ | DONE — May 4 triage |
| **Analysis** | **`npm run build:analyze` to classify chunk 7** | Up to 122 KB if avoidable | Pending — MEDIUM priority, 5th cycle overdue |
| **Process** | **Measure @elevenlabs/react 1.4.0 chunk impact** | Unknown | Carried from May 6 — measure ElevenLabs 482 KB before/after |
| **Process** | **Batch pending minor/patch dep upgrades** | Negligible | `next` 16.2.5, `react`/`react-dom` 19.2.6, `stripe` 22.1.1, `resend` 6.12.3, `@elevenlabs/react` 1.4.0, `@upstash/redis` 1.38.0, `posthog-js` 1.372.9. Review `@anthropic-ai/sdk` 0.93.0–0.95.0 separately. Exclude `voyageai`. |
| **Process** | **Benchmark dep bumps before merge** | Avoids surprise breaches | Ongoing — pattern validated |
| **LOW** | **Extract authoritative initial-load KB from next prod build** | Visibility | Ongoing — eliminate stale Apr 25 estimate |
| **P4 Option A** | **Use @supabase/auth-js directly in auth-provider** | **30-50 KB initial** | Hold — only if initial load exceeds 2,100 KB |
| **P4 Option B** | **Lazy-load full Supabase client** | **30-50 KB initial** | Hold — higher risk than Option A |

---
