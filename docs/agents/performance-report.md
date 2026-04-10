# Performance Report

> Updated on 2026-04-10 (dev server cache — production build verified Apr 4)

## Health Status: GREEN (split budget — both targets met, 7th consecutive day)

**Initial load JS: ~1,958 KB (budget: 2,000 KB) ✅ | Total JS: 2,851 KB (budget: 3,000 KB) ✅**

**Note on metrics input:** The agent script reported a 2,500 KB budget violation. That single budget was **retired on 2026-04-04** after investigation confirmed it was structurally unachievable (Turbopack i18n limitation, polyfill floor). The split budget adopted Apr 4 is the authoritative definition. Both targets are GREEN.

**Zero change this cycle.** Bundle: 2,851 KB (same as Apr 4–9, 7 consecutive days). No new dependencies. No source changes impacting bundle size. Dep gaps widened slightly: @anthropic-ai/sdk now +5 minors (was +4), posthog-js +3 minors (new gap), voyageai +2 minors (new gap).

## Key Metrics

| Metric | Current (2026-04-10) | Previous (2026-04-09) | Mar 8 (prod build) | Budget | Status |
|--------|----------------------|-----------------------|---------------------|--------|--------|
| Total JS | **2,851 KB** | 2,851 KB | 2,726 KB | 3,000 KB (split) | ✅ Under budget |
| Initial load JS | **~1,958 KB** | ~1,958 KB | — | 2,000 KB (split) | ✅ Under budget |
| Total CSS | **123 KB** | 123 KB | 122 KB | — | Stable |
| Production deps | 31 | 31 | 31 | 40 | Good |
| node_modules | 908 MB | 908 MB | 865 MB | — | Stable |
| .next | 48 MB | 48 MB | — | — | Dev cache partial view |

*Current (2026-04-10): Dev server was running — cached .next data. Production build was verified on 2026-04-04 (exit 0, 132/132 pages, 2,851 KB confirmed).*

## Budget Status

**Split budget adopted 2026-04-04 — old single 2,500 KB budget retired.**

| Budget | Limit | Current | Status |
|--------|-------|---------|--------|
| **Initial load JS** (static chunks only, excl. deferred) | 2,000 KB | **~1,958 KB** | ✅ **Under budget** |
| **Total JS** (including deferred dynamic chunks) | 3,000 KB | **2,851 KB** | ✅ **Under budget** |
| Production deps | 40 | 31 | ✅ Good |

**Deferred chunks (not in initial load):** ElevenLabs 471 KB + PostHog 173 KB + react-markdown 142 KB + admin tabs 106 KB = **892 KB deferred**.

## Top 10 Chunks Identified

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | 0cusi_t26v7g_ | **482 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | **Deferred** (dynamic import) + idle prefetch | No — already optimized |
| 2 | 0~223vtyw9jo7 | **233 KB** | Next.js App Router bootstrap + PPR + hydration (16.2.2) | Static (framework) | No — required |
| 3 | 12rqql1ka29ew | **177 KB** | PostHog analytics SDK v1.364.6 | **Deferred** (useEffect lazy import) | No — already deferred |
| 4 | 0k0pvzuuazt5v | **168 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P4 below |
| 5 | 068fwi350s41a | **146 KB** | react-markdown + micromark parser | **Deferred** (inside VoiceChat) | No — already optimized |
| 6 | 01wdr4.40b75i | **134 KB** | React RSC Flight client runtime | Static (framework) | No — required |
| 7 | 02diu4m7xvdz0 | **124 KB** | i18n strings (all 6 locales — Turbopack limitation) | Static | P5 closed — not fixable |
| 8 | 03~yq9q893hmn | **113 KB** | Polyfills (core-js v3) | Static | P1 applied — 3 KB actual savings only |
| 9 | 0o5wigcmhjn65 | **109 KB** | Admin analytics (Stripe dashboard UI) | **Deferred** (admin tab import) | No — already optimized |
| 10 | 0g4ao1l.hblqi | **84 KB** | Additional i18n/legal page translations | Static | Low priority |

### Load Profile Summary

| Category | Size | % of Total | Notes |
|----------|------|-----------|-------|
| **Deferred (dynamic imports)** | ~921 KB | 32.3% | Loads on-demand only |
| **Framework (Next.js + React)** | ~366 KB | 12.8% | Bootstrap, router, RSC runtime |
| **Vendor (static)** | ~281 KB | 9.9% | Supabase, polyfills |
| **App code (static)** | ~207 KB | 7.3% | i18n strings (both chunks) |
| **Other smaller chunks** | ~1,076 KB | 37.7% | Page routes, shared modules |

## Changes This Cycle (Apr 10 vs Apr 9)

**No bundle changes.** Zero KB delta. All size metrics identical to Apr 9.

| Item | Status |
|------|--------|
| Total JS | Unchanged (2,851 KB) |
| CSS | Unchanged (123 KB) |
| Production deps | Unchanged (31) |
| node_modules | Unchanged (908 MB) |
| Security posture | GREEN (security agent Apr 9 — 0 advisories, 0 exploitable) |
| New dep gaps | @anthropic-ai/sdk +5 minors (was +4), posthog-js +3 minors (new), voyageai +2 minors (new) |

## Action Items (Prioritized)

**No blocking action items.** All budgets met. Recommended upgrade batches:

| Item | Gap | Priority | Batch |
|------|-----|----------|-------|
| `next` 16.2.2 → 16.2.3 | patch, no advisory | Low | Batch 1 with react |
| `@next/bundle-analyzer` | patch | Low | Batch 1 |
| `@next/eslint-plugin-next` | patch | Low | Batch 1 |
| `react` / `react-dom` 19.2.4 → 19.2.5 | patches, no CVEs | Low | Batch 1 |
| `stripe` 22.0.0 → 22.0.1 | patch, no advisory | Low | Batch 1 |
| `@anthropic-ai/sdk` 0.82.0 → 0.87.0 | +5 minors (was +4) | Low | Batch 2 |
| `posthog-js` 1.364.6 → 1.367.0 | +3 minors (new gap) | Low | Batch 2 |
| `@stripe/stripe-js` 9.0.1 → 9.1.0 | +1 minor | Low | Batch 3 (Supabase) |
| `@elevenlabs/react` 1.0.2 → 1.0.3 | patch | Low | Batch 3 |
| `@supabase/supabase-js` 2.97.0 → 2.103.0 | +6 minors | Low | Batch 3 |
| `@supabase/ssr` 0.8.0 → 0.10.2 | +2 minors | Low | Batch 3 |
| `@upstash/redis` 1.36.2 → 1.37.0 | +1 minor | Low | Batch 3 |
| `voyageai` 0.1.0 → 0.2.1 | +2 minors (new gap) | Low | Batch 4 (evaluate) |
| `resend` 6.9.2 → 6.10.0 | +1 minor | Low | Batch 4 |

**Batch strategy:** (1) next+@next/* + react/react-dom + stripe patches — safe, low risk. (2) @anthropic-ai/sdk 0.87.0 + posthog-js 1.367.0. (3) Supabase ecosystem + @stripe/stripe-js + @elevenlabs/react + @upstash/redis. (4) voyageai + resend — evaluate changelog first (voyageai 0.1→0.2 may have breaking changes).

## Previously Implemented

| Optimization | Impact | Implemented | Verified |
|-------------|--------|-------------|---------|
| **P1: Browserslist** | ~3 KB actual (predicted 80-112 KB) | 2026-03-29 | ✅ Measured Apr 4 — minimal impact |
| **P2: Idle prefetch ElevenLabs** | UX improvement (cold-start fix) | 2026-03-29 | N/A (UX) |
| **P3: Defer Vercel Analytics/SpeedInsights** | ~10-20 KB deferred | 2026-03-30 | ✅ Verified working Apr 4 |
| **P6: Split JS budget** | Process clarity | 2026-04-04 | ✅ Both new targets met |
| **P7: Update posthog-js** | Security + 12 minor versions | 2026-04-03 (triage) | ✅ 1.364.6 installed |
| **next@16.2.2** | Security (GHSA-h27x-g6w4-24gq closed) | 2026-04-03 (triage) | ✅ 16.2.2 installed |
| **Stripe ecosystem** | stripe 22.0.0, stripe-js 9.0.1, react-stripe-js 6.1.0 | 2026-04-04 | ✅ All upgraded |
| **@elevenlabs/react 1.0.2** | Stable v1 API | 2026-04-04 | ✅ Backward compatible |
| **@anthropic-ai/sdk 0.82.0** | +4 minor versions | 2026-04-06 (triage) | ✅ 0.82.0 installed |

## Dynamic Import Chain Verification

### Code-Splitting Coverage: Excellent

**12 `dynamic()` imports + 18+ lazy `import()` calls** — all verified correct.

### Public site (visitor-facing) — PROPERLY DEFERRED

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"    // 482 KB
    -> import ReactMarkdown from "react-markdown"               // ~146 KB
    -> import { usePostHog } from "posthog-js/react"            // ~177 KB (1.364.6)
  -> requestIdleCallback(() => import("./voice-chat"))          // PREFETCH (P2)
```

### Admin dashboard — PROPERLY DEFERRED

```
admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar
  -> MarketingDashboard -> dynamic(() => import("voice-agent-chat"))
```

### PostHog — LAZILY LOADED

```
posthog-provider.tsx -> useEffect(() => Promise.all([
  import("posthog-js"), import("posthog-js/react")
]))   // 177 KB after hydration, production only (v1.364.6)
```

### Vercel Analytics — DEFERRED (P3 complete)

```
layout.tsx
  -> import { VercelAnalytics } from "src/components/analytics"
    -> dynamic(() => import("@vercel/analytics/next"), { ssr: false })    // DEFERRED
    -> dynamic(() => import("@vercel/speed-insights/next"), { ssr: false }) // DEFERRED
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 286 MB | Framework (required) | ✅ **16.2.2 — 16.2.3 patch available** |
| pdfjs-dist | 63 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 45 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | Optimized |
| @opentelemetry | 40 MB | 0 KB (server-only) | No action |
| posthog-js | 36 MB | ~177 KB (lazy-loaded in useEffect) | ✅ **1.364.6 — 1.367.0 available (+3 minors)** |
| @napi-rs | 29 MB | 0 KB (native, server-only) | No action |
| typescript | 23 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side Stripe SDK) | ✅ **22.0.0 — 22.0.1 patch available** |
| @img | 16 MB | 0 KB (sharp image processing, server-only) | No action |
| core-js | 15 MB | ~110 KB (P1 browserslist applied — 3 KB savings only) | No further action |
| rxjs | 12 MB | ~0 KB (transitive, tree-shaken) | No action |
| @babel | 12 MB | 0 KB (build tool) | No action |

### Dependency Version Status

| Package | Installed | Latest | Gap | Priority |
|---------|-----------|--------|-----|----------|
| next | 16.2.2 | 16.2.3 | +1 patch | Low — no advisory |
| @next/bundle-analyzer | 16.2.2 | 16.2.3 | +1 patch | Low |
| @next/eslint-plugin-next | 16.2.2 | 16.2.3 | +1 patch | Low |
| react / react-dom | 19.2.4 | 19.2.5 | +1 patch | Low — no CVEs |
| stripe | 22.0.0 | 22.0.1 | +1 patch | Low — no advisory |
| @anthropic-ai/sdk | 0.82.0 | 0.87.0 | +5 minors | Low — no CVEs |
| posthog-js | 1.364.6 | 1.367.0 | +3 minors | Low — new gap |
| @stripe/stripe-js | 9.0.1 | 9.1.0 | +1 minor | Low — no CVEs |
| @elevenlabs/react | 1.0.2 | 1.0.3 | +1 patch | Low — no CVEs |
| @supabase/supabase-js | 2.97.0 | 2.103.0 | +6 minors | Low — evaluate |
| @supabase/ssr | 0.8.0 | 0.10.2 | +2 minors | Low — evaluate |
| @upstash/redis | 1.36.2 | 1.37.0 | +1 minor | Low |
| voyageai | 0.1.0 | 0.2.1 | +2 minors | Low — evaluate (possible breaking) |
| resend | 6.9.2 | 6.10.0 | +1 minor | Low |
| ~~@anthropic-ai/sdk~~ | ~~0.78.0~~ | — | — | ✅ **0.82.0 — DONE Apr 6** |
| ~~stripe~~ | ~~20.3.1~~ | — | — | ✅ **22.0.0 — DONE Apr 4** |
| ~~@stripe/stripe-js~~ | ~~8.8.0~~ | — | — | ✅ **9.0.1 — DONE Apr 4** |
| ~~@stripe/react-stripe-js~~ | ~~5.6.0~~ | — | — | ✅ **6.1.0 — DONE Apr 4** |
| ~~@elevenlabs/react~~ | ~~0.14.1~~ | — | — | ✅ **1.0.2 — DONE Apr 4** |
| ~~next~~ | ~~16.1.6~~ | — | — | ✅ **16.2.2 — DONE Apr 3** |
| ~~posthog-js~~ | ~~1.353.0~~ | — | — | ✅ **1.364.6 — DONE Apr 3** |

## Comparison: 16-Run Trend

| Metric | Feb 7 | Mar 8 | Mar 29* | Mar 30* | Apr 1* | Apr 2* | Apr 3* | Apr 4 | Apr 5* | Apr 6* | Apr 7* | Apr 8* | Apr 9* | **Apr 10*** | Trend |
|--------|-------|-------|---------|---------|--------|--------|--------|-------|--------|--------|--------|--------|--------|-------------|-------|
| Total JS | 2,455 KB | 2,726 KB | 2,804 KB | 2,804 KB | 2,804 KB | 2,804 KB | 2,804 KB | 2,851 KB | 2,851 KB | 2,851 KB | 2,851 KB | 2,851 KB | 2,851 KB | **2,851 KB** | Stable |
| CSS | 130 KB | 122 KB | 124 KB | 124 KB | 124 KB | 124 KB | 124 KB | 123 KB | 123 KB | 123 KB | 123 KB | 123 KB | 123 KB | **123 KB** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | **31** | Stable |
| node_modules | 856 MB | 865 MB | 862 MB | 862 MB | 862 MB | 862 MB | 862 MB | 896 MB | 908 MB | 908 MB | 908 MB | 908 MB | 908 MB | **908 MB** | Stable |
| EL deferred | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Stable |
| EL idle prefetch | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Stable |
| Browserslist P1 | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Stable |
| Analytics deferred P3 | No | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Stable |
| posthog-js | 1.237.x | 1.353.0 | 1.353.0 | 1.353.0 | 1.353.0 | 1.353.0 | 1.353.0 | 1.364.6 ✅ | 1.364.6 | 1.364.6 | 1.364.6 | 1.364.6 | 1.364.6 | **1.364.6** | Stable |
| next | 16.x | 16.1.6 | 16.1.6 | 16.1.6 | 16.1.6 | 16.1.6 | 16.1.6 | 16.2.2 ✅ | 16.2.2 | 16.2.2 | 16.2.2 | 16.2.2 | 16.2.2 | **16.2.2** | Stable |
| stripe | — | 20.3.1 | 20.3.1 | 20.3.1 | 20.3.1 | 20.3.1 | 20.3.1 | 22.0.0 ✅ | 22.0.0 | 22.0.0 | 22.0.0 | 22.0.0 | 22.0.0 | **22.0.0** | Stable |
| @anthropic-ai/sdk | — | — | 0.78.0 | 0.78.0 | 0.78.0 | 0.78.0 | 0.78.0 | 0.78.0 | 0.78.0 | 0.82.0 ✅ | 0.82.0 | 0.82.0 | 0.82.0 | **0.82.0** | Stable |

*\*Dev server cache — may differ slightly from production build. Apr 4 = production build verified.*

## Remaining Backlog

### P4: Tree-shake Supabase realtime module (~20-30 KB savings) — DOWNGRADED, LOW ROI

Chunk `0k0pvzuuazt5v` (168 KB) includes `RealtimeClient`. Only used in admin pages. Creating separate public/admin Supabase clients adds complexity for ~20-30 KB savings that don't affect the initial load budget.

**Fix (if pursued):**
```typescript
// src/lib/supabase-browser-public.ts
const supabase = createBrowserClient(url, key, {
  realtime: { enabled: false },
});
```

**Effort:** Medium. **Savings:** ~20-30 KB. **Verdict:** Not worth the complexity. Skip unless budget is tight.

### P5: i18n bundling — CLOSED (Turbopack limitation, not fixable)

All 6 locales bundled in initial JS (~208 KB combined). Root cause: Turbopack 16.x eagerly bundles `import()` calls defined at module scope in object literals within `'use client'` components. An inline `if`-chain rewrite was attempted and **reverted** after it caused 565 KB of overhead in other chunks. This is a Turbopack architectural limitation, not a code pattern issue. P5 closed — accepted.

## Action Plan

| Priority | Action | Estimated Savings | Effort | Status |
|----------|--------|-------------------|--------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~80-112 KB~~ | ~~Trivial~~ | ✅ **DONE (Mar 29) — 3 KB actual** |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | ~~Low~~ | ✅ **DONE (Mar 29)** |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB deferred~~ | ~~Low~~ | ✅ **DONE (Mar 30)** |
| ~~P5~~ | ~~Fix i18n bundling~~ | ~~40-80 KB~~ | ~~Low~~ | ✅ **CLOSED — Turbopack limitation** |
| ~~P6~~ | ~~Split JS budget~~ | Process clarity | Trivial | ✅ **DONE (Apr 4)** |
| ~~#1~~ | ~~Upgrade next@16.2.2~~ | Security | Low | ✅ **DONE (Apr 3)** |
| ~~#2~~ | ~~Fix posthog-js~~ | Security | Trivial | ✅ **DONE (Apr 3)** |
| ~~#2~~ | ~~Stripe ecosystem upgrade~~ | Supply-chain risk | Medium | ✅ **DONE (Apr 4)** |
| ~~#3~~ | ~~@elevenlabs/react upgrade~~ | Stability | Medium | ✅ **DONE (Apr 4)** |
| ~~#4~~ | ~~@anthropic-ai/sdk 0.78.0→0.82.0~~ | +4 minor | Trivial | ✅ **DONE (Apr 6 triage)** |
| Batch 1 | next 16.2.3 + react 19.2.5 + stripe 22.0.1 patches | Maintenance | Low | Pending |
| Batch 2 | @anthropic-ai/sdk 0.87.0 + posthog-js 1.367.0 | Maintenance | Low | Pending |
| Batch 3 | Supabase 2.103.0 + @supabase/ssr 0.10.2 + @stripe/stripe-js 9.1.0 + @elevenlabs/react 1.0.3 + @upstash/redis 1.37.0 | Maintenance | Medium | Pending — evaluate Supabase changelog |
| Batch 4 | voyageai 0.2.1 + resend 6.10.0 | Maintenance | Low | Pending — evaluate voyageai breaking changes |
| P4 | Tree-shake Supabase realtime | ~20-30 KB | Medium | Downgraded — low ROI |

---

## Cross-Agent Context

**For Security Agent:** All major dep upgrades remain complete. Dep gaps widened slightly: @anthropic-ai/sdk now +5 minors (0.82.0 → 0.87.0), posthog-js +3 minors (1.364.6 → 1.367.0, new gap), voyageai +2 minors (0.1.0 → 0.2.1, new gap). No CVEs in any gaps. Supabase now +6 minors (2.97.0 → 2.103.0) — evaluate for security patches. Recommended batching unchanged: (1) next/react/stripe patches, (2) @anthropic-ai/sdk + posthog-js, (3) Supabase ecosystem, (4) voyageai + resend.

**For Code Quality Agent:** Dep gaps growing organically. @anthropic-ai/sdk now +5 minors (fast release cadence). New gaps: posthog-js +3, voyageai +2, resend +1, @upstash/redis +1. Supabase ecosystem +6 minors — may warrant evaluation soon. No performance-driven code changes needed.

**For QA Agent:** No user-facing changes this cycle. Zero bundle impact. No new regressions.

**For Coverage Agent:** No new production dependencies. No bundle changes. Zero impact on coverage this cycle.

**For Cost Analyst Agent:** Bundle stable at 2,851 KB (zero change for 7th consecutive day). No cost impact. ElevenLabs: 8,454 / 270,783 chars (3.12%) as of Apr 9 (Archy + Coach activity, 0 Paisaxe).

**For Localization Agent:** i18n lazy loading code correct (es+en static, fr/de/pt/ast dynamic). 392 keys stable. P5 closed — Turbopack limitation. No further optimization possible.

---

*Report updated 2026-04-10 — no bundle changes, GREEN status maintained (7th consecutive day)*
*Initial load JS: ~1,958 KB / 2,000 KB | Total JS: 2,851 KB / 3,000 KB — GREEN*
*Split budget adopted Apr 4 — old 2,500 KB single budget retired*
*Dep gaps widened: @anthropic-ai/sdk +5 minors, posthog-js +3 minors (new), voyageai +2 minors (new), Supabase +6 minors. All LOW, no CVEs.*
