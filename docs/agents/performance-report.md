# Performance Report

> Updated on 2026-05-02 (dev server cache; production build skipped 8 days running. Apr 25 prod build is the only authoritative initial-load number.)

## Health Status: GREEN

**Total JS: 3,008 KB / 3,100 KB budget — 92 KB headroom. RECOVERED from RED after triage `a7fcb23f` raised budgets by 100 KB on each axis (2,000 -> 2,100 KB initial, 3,000 -> 3,100 KB total).**

**Initial load JS: ~2,067 KB / 2,100 KB budget — 33 KB headroom (using stale Apr 25 prod baseline). Status is GREEN under the new ceiling, but a fresh prod build is overdue.**

Two material changes since the May 1 report:

1. Triage commit `a7fcb23f` raised both budgets to reflect 7 weeks of structural growth (deps, FE-M1 voice-chat extraction, wave-2 work). The 3,008 KB bundle no longer breaches the total budget, and the ~2,067 KB Apr 25 initial-load baseline is now under budget too.
2. Triage analysis reclassified P4: setting `eventsPerSecond: 0` does NOT tree-shake `@supabase/realtime-js` from the webpack bundle. The previous savings estimates (~25 KB) were wrong. Real savings require either using `@supabase/auth-js` directly in `auth-provider.tsx` or lazy-loading the full Supabase client. Tracked in issue #558.

Bundle composition is byte-stable vs May 1 — no commit has touched dependencies or shared chunks since `3163f478`. The single notable code change is `749048e5` (revert voyageai to 0.1.0), a server-side dependency with no client bundle impact.

## Key Metrics

| Metric | May 2 (dev) | May 1 (dev) | Apr 25 (prod) | Apr 4 (prod) | Budget | Status |
|--------|-------------|-------------|----------------|--------------|--------|--------|
| Total JS | **3,008 KB** | 3,008 KB | 2,941 KB | 2,851 KB | **3,100 KB** | GREEN (+92 KB) |
| Initial load JS | ~2,067 KB (Apr 25 prod) | ~2,067 KB | 2,067 KB | ~1,800 KB | **2,100 KB** | GREEN (+33 KB) |
| Total CSS | 125 KB | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | 35 | 35 | 35 | 31 | 40 | Good |
| Development deps | 30 | 30 | 29 | -- | -- | Stable |
| node_modules | 1,046 MB | 1,046 MB | 1,047 MB | 896 MB | 1,100 MB | Good (+54 MB) |
| .next | 1,417 MB | 1,281 MB | -- | 46 MB | -- | Active dev session |

**Zero bundle delta this cycle.** All chunk hashes are byte-for-byte identical to May 1.

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| Total JS | 3,100 KB | 3,008 KB | +92 KB | GREEN |
| Initial load JS | 2,100 KB | ~2,067 KB (Apr 25 prod) | +33 KB | GREEN (stale) |
| Largest chunk | 500 KB | 482 KB (ElevenLabs, deferred) | +18 KB | GREEN |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,046 MB | +54 MB | Good |

**Deferred chunks (excluded from initial load, included in total):**

| Chunk | Size | Status |
|-------|------|--------|
| ElevenLabs SDK + LiveKit | ~482 KB | Stable |
| PostHog analytics | ~186 KB | Stable |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~885 KB** | Stable |

## Top 10 Chunks (May 2 dev cache)

| Rank | Chunk file | Size | Likely contents | Loading | Delta vs May 1 |
|------|-----------|------|-----------------|---------|----------------|
| 1 | 1206~6g7o__rc.js (493,450 B) | 482 KB | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred | 0 KB |
| 2 | 07y9atwelbm1e.js (233,018 B) | 228 KB | Next.js App Router bootstrap + PPR | Static (framework) | 0 KB |
| 3 | 0kugx322_2-wg.js (200,358 B) | 196 KB | Supabase SDK (auth + postgrest + realtime) | Static | 0 KB — see #558 |
| 4 | 00fah59htysmj.js (190,030 B) | 186 KB | PostHog analytics SDK 1.372.5 | Deferred | 0 KB |
| 5 | 0wu4~xh-5rs6g.js (134,887 B) | 132 KB | React RSC Flight client runtime | Static (framework) | 0 KB |
| 6 | 0mzmsu1pb-cds.js (127,520 B) | 125 KB | i18n strings (6 locales, 405 keys) | Static | 0 KB |
| 7 | 10e1-kbfg7iqw.js (125,258 B) | 122 KB | Unclassified — needs prod build | Unknown | 0 KB |
| 8 | 0ktbr965wa~br.js (114,831 B) | 112 KB | Polyfills (core-js v3) | Static | 0 KB |
| 9 | 03~yq9q893hmn.js (112,594 B) | 110 KB | react-markdown + micromark | Deferred | 0 KB |
| 10 | 13lm54j7eil8i.js (109,499 B) | 107 KB | Admin analytics (Stripe dashboard UI) | Deferred | 0 KB |

All ten chunk hashes match May 1 exactly. No dependency or shared-module changes have hit `node_modules` since `3163f478`.

## Changes This Cycle (May 2 vs May 1)

| Item | Change | Driver |
|------|--------|--------|
| Total JS budget | **3,000 -> 3,100 KB** | Triage `a7fcb23f` (recognizes 7 weeks of structural growth) |
| Initial load budget | **2,000 -> 2,100 KB** | Triage `a7fcb23f` |
| Total JS bundle | **0 KB** (3,008 KB) | No code changes affecting client bundle |
| voyageai version | 0.2.x -> 0.1.0 | `749048e5` (server-only revert; v0.2.x ESM build was broken) |
| P4 status | Reframed as infeasible-as-written | Triage analysis (#558) |
| Production deps | 0 (35) | No package add/remove |

The voyageai revert is server-side only (used by the embeddings pipeline); it does not change client-side bundle size.

## P4: Tree-Shake Supabase Realtime — RECLASSIFIED

**Status: Filed as #558. The previously documented approach does not work.**

The May 1 report recommended creating a `supabaseBrowserPublic` client with `realtime: { params: { eventsPerSecond: 0 } }` to drop ~25 KB. Triage analysis confirmed this is wrong: the `eventsPerSecond` runtime config does not affect what webpack bundles. `@supabase/realtime-js` is statically imported by `@supabase/supabase-js` and ships in every browser bundle regardless of the realtime client config.

Two real options exist for cutting the Supabase chunk; both require dedicated work:

**Option A: Use `@supabase/auth-js` directly in the auth provider** (`src/components/providers/auth-provider.tsx`).
- Bypasses `supabase-js` entirely for the public auth path.
- Estimated savings: 30-50 KB (drops realtime + postgrest from initial load).
- Effort: 1-2 hours. Requires re-validating cookie/SSR handoff with `@supabase/ssr`.

**Option B: Lazy-load the full Supabase client.**
- Replace top-level `supabaseBrowser` imports with `await import("@/lib/supabase-browser")` inside event handlers and effects.
- Estimated savings: 30-50 KB initial-load (full Supabase chunk shifts to deferred).
- Effort: 2-3 hours. Risk of waterfall regressions if a frequently-used path becomes async-blocked.
- Also requires verifying RSC components and proxy paths still work with the synchronous server client.

**Recommendation:** Option A. Smaller blast radius, no async refactor of components that currently treat the client as synchronous. Pursue only if a future cycle pushes initial load back over 2,100 KB.

Closing the 92 KB total / 33 KB initial headroom is not urgent. The new budgets give wave-3 work room to land before requiring further surgery.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **HIGH** | **Run a fresh production build** | Visibility (no client savings) | Trivial | `rm -rf .next && npm run build`. The dev cache has been authoritative for 8 days; the Apr 25 prod baseline does not include any of `3163f478`'s +22 KB. Without a fresh build, the actual current initial-load size is unknown and the reported 33 KB headroom is a guess. |
| **MEDIUM** | **Classify chunk 7 (10e1-kbfg7iqw, 122 KB)** | Potential savings if static and avoidable | Trivial after prod build | Hash unchanged for 2 cycles. Prod build will reveal whether this is deferred or initial-load. If static, investigate FE-M1 voice-chat extraction and Anthropic 0.91.1 client surface. |
| **MEDIUM** | **Benchmark dep bumps before merge** | Avoids surprise breaches | Process | `3163f478` added +22 KB silently across 4 chunks (Supabase +9, PostHog +6, ElevenLabs +4, chunk 7 +3). Run `du -sk .next/static/chunks` before/after dependency PRs. |
| **LOW** | **Pursue Option A (auth-js direct)** | 30-50 KB initial | Medium (1-2 hrs) | Only if initial load returns over 2,100 KB. Currently 33 KB under. |
| **LOW** | **Monitor PostHog and Supabase upgrade rate** | Process | None | Both grew >5 KB on minor bumps in the last cycle. Future bumps should be batched and benchmarked. |
| **LOW** | **Monitor Next.js for postcss inner-copy upgrade** | Security cleanup | None | postcss override confirmed ineffective (Next.js isolation). |

## Quick Wins vs Heavy Lifts

**Quick wins (today):**
1. `rm -rf .next && npm run build` — 5 minutes; gives the first authoritative post-`3163f478` initial-load number. Either confirms the 33 KB headroom or flags the report as too optimistic.
2. After the build, classify chunk 7 from Webpack's chunk-name output. If it's a deferred chunk, no action needed. If it's static, file an issue to extract.

**Heavy lift (only when needed):**
1. Issue #558 Option A (auth-js direct in auth-provider). Estimated 1-2 hours plus a verification cycle. Hold until headroom narrows again.

## Dynamic Import Chain Verification

**Deferred correctly (not in initial load):**

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })       // DEFERRED
    -> voice-chat/chat-header.tsx                                 // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-message-list.tsx                           // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-composer.tsx                               // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-error-banner.tsx                           // DEFERRED (FE-M1 sub-component)
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
Supabase SDK: ~196 KB including realtime (issue #558)
i18n: ~125 KB -- Turbopack limitation (405 keys, stable)
core-js polyfills: ~112 KB -- P1 browserslist applied, stable
```

**Unclassified:**
```
Chunk 10e1-kbfg7iqw (125,258 B, 122 KB) -- Hash stable for 2 cycles.
  Possible sources: FE-M1 shared code, Anthropic SDK 0.91.1 client surface,
  or other wave-2 shared modules. Prod build required to classify as static
  or deferred. If static, this is the largest unexplained contribution to
  initial-load growth since Apr 4.
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|-------------------|----------------------|--------|
| next + @next | 286 MB | Framework (required) | 16.2.4 |
| @sentry/nextjs + @sentry/core | 68 MB | ~83 KB static | P8 complete; 0 KB savings confirmed |
| pdfjs-dist | 61 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | v1.14.0 |
| posthog-js | 37 MB | ~186 KB (lazy-loaded) | 1.372.5 |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | v6.0.3 |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side) | 22.x |
| voyageai | -- | ~2 KB (server-side only) | **Pinned 0.1.0 — DO NOT BUMP. v0.2.x ESM build broken (commit `749048e5` reverted from 0.2.x).** |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | OK -- v4.4.1 |

### Dependency Version Status

Per Security Agent (May 2): GREEN — 0 advisories, npm audit clean. 8 outdated production packages, none security-relevant. voyageai must remain pinned at 0.1.0.

| Package | Installed | Status |
|---------|-----------|--------|
| posthog-js | 1.372.5 | Current |
| next | 16.2.4 | Current |
| @anthropic-ai/sdk | ^0.91.1 | Current |
| @supabase/supabase-js | ^2.105.1 | Current (#558 target) |
| @elevenlabs/react | ^1.3.0 | Current |
| react / react-dom | ^19.2.5 | Current |
| @sentry/nextjs | ^10.51.0 | Current |
| voyageai | 0.1.0 (pinned) | Intentional — DO NOT UPGRADE |
| zod | ^4.4.1 | Current |
| lucide-react | ^1.14.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 25 (prod) | Apr 30 | May 1 | **May 2** | Trend |
|--------|-------|-------|-------|--------|--------|----------------|--------|-------|-----------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,856 | 2,892 | 2,941 | 2,986 | 3,008 | **3,008** | Stable; budget raised to 3,100 |
| Initial load | -- | -- | ~1,800 | ~1,936 | ~1,972 | 2,067 | 2,067 | 2,067 | **2,067 (stale)** | Flat — needs fresh prod build |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~920 | ~875 | ~875 | ~885 | **~885** | Stable |
| CSS | 130 | 122 | 123 | 123 | 123 | 125 | 125 | 125 | **125** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 35 | 35 | 35 | **35** | Stable |
| node_modules | 856 | 865 | 896 | 908 | 930 | 1,047 | 1,048 | 1,046 | **1,046 MB** | Stable |

*Total JS growth Feb 7 -> May 2: +553 KB (+22.5%) over 2.7 months. Bundle plateau reached; structural growth absorbed by raised budgets.*

## Comparison vs Previous Run (May 1)

| Item | May 1 | May 2 | Delta | Verdict |
|------|-------|-------|-------|---------|
| Total JS budget | 3,000 KB | **3,100 KB** | +100 KB | Recognizes structural growth |
| Initial load budget | 2,000 KB | **2,100 KB** | +100 KB | Recognizes structural growth |
| Total JS bundle | 3,008 KB | 3,008 KB | 0 KB | Stable (no client-side dep changes) |
| All 10 top chunks | -- | -- | 0 KB each | Byte-stable hashes |
| Status | RED | **GREEN** | -- | Recovered via budget raise |
| voyageai | 0.2.x | 0.1.0 | server-only revert | No client impact |
| P4 status | Activated | Reclassified (issue #558) | -- | Original approach doesn't tree-shake |

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
| **P4 Option A** | **Use @supabase/auth-js directly in auth-provider** | **30-50 KB initial** | Hold — only if initial load returns over 2,100 KB |
| **P4 Option B** | **Lazy-load full Supabase client** | **30-50 KB initial** | Hold — higher risk than Option A |
| **Process** | **Run prod build each cycle** | **Visibility** | **Required — dev cache 8 days stale** |
| **Process** | **Classify chunk 7 after fresh build** | **Up to 122 KB if avoidable** | Pending prod build |

---
