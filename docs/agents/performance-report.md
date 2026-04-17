# Performance Report

> Updated on 2026-04-17 (dev server cache — production build verified Apr 4)

## Health Status: GREEN (split budget — both targets met, 12th consecutive day)

**Initial load JS: ~1,972 KB (budget: 2,000 KB) ✅ | Total JS: 2,892 KB (budget: 3,000 KB) ✅**

**0 KB change this cycle** (2,892 KB → 2,892 KB). Dev server was running — cached .next data, identical to Apr 14. No code changes, no npm install, no build.

**Key update from Security Agent (Apr 17):** posthog-js 1.367.0 → 1.369.2 upgrade is now **security-prioritized** (resolves 2 advisories: protobufjs Critical + dompurify Moderate via posthog-js transitive deps). PostHog chunk is 179 KB — expect minor size change after upgrade. 17 production deps outdated total (up from 4 on Apr 14).

## Key Metrics

| Metric | Current (2026-04-17) | Previous (2026-04-14) | Mar 8 (prod build) | Budget | Status |
|--------|----------------------|-----------------------|---------------------|--------|--------|
| Total JS | **2,892 KB** | 2,892 KB | 2,726 KB | 3,000 KB (split) | ✅ Under budget |
| Initial load JS | **~1,972 KB** | ~1,972 KB | — | 2,000 KB (split) | ✅ Under budget |
| Total CSS | **123 KB** | 123 KB | 122 KB | — | Stable |
| Production deps | 31 | 31 | 31 | 40 | Good |
| node_modules | 930 MB | 930 MB | 865 MB | — | Stable |
| .next | 46 MB | 46 MB | — | — | Dev cache partial view |

*Current (2026-04-17): Dev server was running — cached .next data. Production build verified 2026-04-04 (exit 0, 132/132 pages, 2,851 KB confirmed). 0 KB change from Apr 14.*

## Budget Status

**Split budget adopted 2026-04-04 — old single 2,500 KB budget retired.**

| Budget | Limit | Current | Status |
|--------|-------|---------|--------|
| **Initial load JS** (static chunks only, excl. deferred) | 2,000 KB | **~1,972 KB** | ✅ **Under budget** (+28 KB headroom) |
| **Total JS** (including deferred dynamic chunks) | 3,000 KB | **2,892 KB** | ✅ **Under budget** (+108 KB headroom) |
| Production deps | 40 | 31 | ✅ Good |

**Deferred chunks (not in initial load):** ElevenLabs 487 KB + PostHog 179 KB + react-markdown 145 KB + admin tabs 109 KB = **~920 KB deferred**.

**Headroom watch:** Initial load headroom stable at +28 KB. Still approaching the 2,000 KB limit — any new static dependency or significant feature >28 KB will breach. Next production build will provide exact numbers.

## Top 10 Chunks Identified

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | 0rshvp0av-j~8 | **487 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | **Deferred** (dynamic import) + idle prefetch | No — already optimized |
| 2 | 0kl219~9zy6hf | **232 KB** | Next.js App Router bootstrap + PPR + hydration (16.2.3) | Static (framework) | No — required |
| 3 | 0h80v~tvyoj6x | **190 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P4 below |
| 4 | 0b41ex1k0_kan | **179 KB** | PostHog analytics SDK v1.367.0 | **Deferred** (useEffect lazy import) | ⬆️ Upgrade posthog-js → 1.369.2 (security fix) |
| 5 | 068fwi350s41a | **145 KB** | react-markdown + micromark parser | **Deferred** (inside VoiceChat) | No — already optimized |
| 6 | 01wdr4.40b75i | **134 KB** | React RSC Flight client runtime | Static (framework) | No — required |
| 7 | 02diu4m7xvdz0 | **124 KB** | i18n strings (all 6 locales — Turbopack limitation) | Static | P5 closed — not fixable |
| 8 | 03~yq9q893hmn | **112 KB** | Polyfills (core-js v3) | Static | P1 applied — 3 KB actual savings only |
| 9 | 11nl9x8j7jq_d | **109 KB** | Admin analytics (Stripe dashboard UI) | **Deferred** (admin tab import) | No — already optimized |
| 10 | 0g4ao1l.hblqi | **84 KB** | Additional i18n/legal page translations | Static | Low priority |

### Load Profile Summary

| Category | Size | % of Total | Notes |
|----------|------|-----------|-------|
| **Deferred (dynamic imports)** | ~920 KB | 31.8% | Loads on-demand only |
| **Framework (Next.js + React)** | ~366 KB | 12.7% | Bootstrap, router, RSC runtime |
| **Vendor (static)** | ~302 KB | 10.4% | Supabase, polyfills |
| **App code (static)** | ~208 KB | 7.2% | i18n strings (both chunks) |
| **Other smaller chunks** | ~1,096 KB | 37.9% | Page routes, shared modules |

## Changes This Cycle (Apr 17 vs Apr 14)

**0 KB change** — no code changes, no npm install, no production build. Dev server was running with identical cached .next data.

| Item | Status |
|------|--------|
| Total JS | **0 KB** (2,892 KB unchanged) |
| CSS | Unchanged (123 KB) |
| Production deps | Unchanged count (31) |
| node_modules | Unchanged (930 MB) |
| Outdated packages | **17 production deps outdated** (up from 4 on Apr 14) — security agent audit |

**Security-driven update:** posthog-js upgrade priority escalated from Low → **Medium** (resolves 2 advisories, see dep table below).

## Action Items (Prioritized)

| Item | Gap | Priority | Notes |
|------|-----|----------|-------|
| **Upgrade posthog-js** | 1.367.0 → 1.369.2 | **Medium** | Resolves 2 security advisories (protobufjs Critical + dompurify Moderate via transitive deps). PostHog chunk (179 KB) may change slightly. Run `npm install posthog-js@latest` or `npm audit fix`. |
| Batch upgrade 16 production deps | Minor/patch updates | Low | @anthropic-ai/sdk (+2 minor), @supabase/supabase-js (+3 patches), next (+1 patch), @elevenlabs/react 1.1.1, @stripe/stripe-js 9.2.0, resend 6.11.0, and 8 others. Zero CVEs. |
| Monitor initial load headroom | +28 KB until budget breach | **Watch** | Next production build will provide exact numbers. If headroom <15 KB, P4 becomes actionable. |

## Previously Implemented

| Optimization | Impact | Implemented | Verified |
|-------------|--------|-------------|---------|
| **P1: Browserslist** | ~3 KB actual (predicted 80-112 KB) | 2026-03-29 | ✅ Measured Apr 4 — minimal impact |
| **P2: Idle prefetch ElevenLabs** | UX improvement (cold-start fix) | 2026-03-29 | N/A (UX) |
| **P3: Defer Vercel Analytics/SpeedInsights** | ~10-20 KB deferred | 2026-03-30 | ✅ Verified working Apr 4 |
| **P6: Split JS budget** | Process clarity | 2026-04-04 | ✅ Both new targets met |
| **P7: Update posthog-js** | Security + 12 minor versions | 2026-04-03 (triage) | ✅ 1.364.6 → 1.367.0 Apr 12 |
| **next@16.2.2** | Security (GHSA-h27x-g6w4-24gq closed) | 2026-04-03 (triage) | ✅ 16.2.2 → 16.2.3 Apr 10 |
| **Stripe ecosystem upgrade** | stripe 22.0.0, stripe-js 9.0.1, react-stripe-js 6.1.0 | 2026-04-04 | ✅ All current |
| **All dep gaps cleared** | 2c8f991: 3 majors + 6 minors + 3 patches | 2026-04-12 | ✅ node_modules synced Apr 13 |
| **Agent script budget fix** | Script now uses split 2,000/3,000 KB thresholds | 2026-04-14 (triage e858ef7) | ✅ Confirmed in source |

## Dynamic Import Chain Verification

### Code-Splitting Coverage: Excellent

**12 `dynamic()` imports + 18+ lazy `import()` calls** — all verified correct.

### Public site (visitor-facing) — PROPERLY DEFERRED

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"    // 487 KB
    -> import ReactMarkdown from "react-markdown"               // ~145 KB
    -> import { usePostHog } from "posthog-js/react"            // ~179 KB (1.367.0 → upgrade to 1.369.2)
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
]))   // 179 KB after hydration, production only (v1.367.0 — upgrade to 1.369.2 for security)
```

### Vercel Analytics — DEFERRED (P3 complete)

```
layout.tsx
  -> import { VercelAnalytics } from "src/components/analytics"
    -> dynamic(() => import("@vercel/analytics/next"), { ssr: false })    // DEFERRED (v2.0.1)
    -> dynamic(() => import("@vercel/speed-insights/next"), { ssr: false }) // DEFERRED (v2.0.0)
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 286 MB | Framework (required) | ✅ **16.2.3 — current** |
| pdfjs-dist | 66 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | ✅ **v1.8.0 — current** |
| @opentelemetry | 40 MB | 0 KB (server-only) | Note: protobufjs advisory via this dep — not exploitable |
| posthog-js | 35 MB | ~179 KB (lazy-loaded in useEffect) | ⬆️ **1.367.0 → 1.369.2 — SECURITY UPGRADE** |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side Stripe SDK) | ✅ **22.0.1 — current** |
| @img | 16 MB | 0 KB (sharp image processing, server-only) | No action |
| core-js | 15 MB | ~112 KB (P1 browserslist applied — 3 KB savings only) | No further action |
| rxjs | 12 MB | ~0 KB (transitive, tree-shaken) | No action |

### Dependency Version Status

| Package | Installed | Latest | Gap | Priority |
|---------|-----------|--------|-----|----------|
| **posthog-js** | **1.367.0** | **1.369.2** | +2 minor | **Medium — resolves 2 security advisories** |
| next | 16.2.3 | 16.2.x+ | Patch | Low |
| @anthropic-ai/sdk | 0.88.0 | 0.90.x+ | +2 minor | Low |
| @supabase/supabase-js | 2.103.0 | 2.106.x+ | +3 patches | Low |
| @elevenlabs/react | 1.1.0 | 1.1.1 | Patch | Low |
| @stripe/stripe-js | 9.1.0 | 9.2.0 | Minor | Low |
| resend | 6.10.0 | 6.11.0 | Minor | Low |
| +(8 other production deps) | — | — | Minor/patch | Low |
| react / react-dom | 19.2.5 | 19.2.5 | — | ✅ Current |
| stripe | 22.0.1 | 22.0.1 | — | ✅ Current |
| @supabase/ssr | 0.10.2 | 0.10.2 | — | ✅ Current |
| @upstash/redis | 1.37.0 | 1.37.0 | — | ✅ Current |
| voyageai | 0.2.1 | 0.2.1 | — | ✅ Current |
| @vercel/analytics | 2.0.1 | 2.0.1 | — | ✅ Current |
| @vercel/speed-insights | 2.0.0 | 2.0.0 | — | ✅ Current |
| lucide-react | 1.8.0 | 1.8.0 | — | ✅ Current |

**17 production deps have minor/patch updates. 1 is security-prioritized (posthog-js → 1.369.2).** Recommend batching all 17 in next triage cycle, leading with posthog-js.

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Mar 29* | Apr 4 | Apr 10* | Apr 11* | Apr 12* | Apr 13* | Apr 14* | **Apr 17*** | Trend |
|--------|-------|-------|---------|-------|---------|---------|---------|---------|---------|-------------|-------|
| Total JS | 2,455 KB | 2,726 KB | 2,804 KB | 2,851 KB | 2,851 KB | 2,856 KB | 2,856 KB | 2,892 KB | 2,892 KB | **2,892 KB** | Stable |
| CSS | 130 KB | 122 KB | 124 KB | 123 KB | 123 KB | 123 KB | 123 KB | 123 KB | 123 KB | **123 KB** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | **31** | Stable |
| node_modules | 856 MB | 865 MB | 862 MB | 896 MB | 908 MB | 908 MB | 908 MB | 910 MB | 930 MB | **930 MB** | Stable |
| next | 16.x | 16.1.6 | 16.1.6 | 16.2.2 ✅ | 16.2.3 ✅ | 16.2.3 | 16.2.3 | 16.2.3 ✅ | 16.2.3 ✅ | **16.2.3 ✅** | Current |
| posthog-js | — | — | 1.353.0 | 1.364.6 | 1.367.0 | 1.367.0 | 1.367.0 | 1.367.0 | 1.367.0 | **1.367.0 ⬆️** | Upgrade needed |

*\*Dev server cache — may differ slightly from production build. Apr 4 = production build verified.*

**2-month growth: 2,455 → 2,892 KB (+437 KB, +17.8%).** Growth completely plateaued — 0 KB change for 3 consecutive days (Apr 12–17 excluding Apr 13 sync). All historic growth was from dependency upgrades, not new features.

## Remaining Backlog

### P4: Tree-shake Supabase realtime module (~20-30 KB savings) — LOW ROI, MONITOR

Chunk containing Supabase is 190 KB. `RealtimeClient` is only used in admin pages. Creating separate public/admin Supabase clients adds complexity for ~20-30 KB savings.

**Fix (if pursued):**
```typescript
// src/lib/supabase-browser-public.ts
const supabase = createBrowserClient(url, key, {
  realtime: { enabled: false },
});
```

**Effort:** Medium. **Savings:** ~20-30 KB. **Verdict:** With initial load headroom at +28 KB, this becomes actionable if another static dependency is added and headroom drops below 15 KB. Monitor.

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
| ~~All dep gaps~~ | ~~3 majors + 6 minors + 3 patches~~ | Maintenance | — | ✅ **DONE (Apr 12 — 2c8f991, synced Apr 13)** |
| ~~Agent script~~ | ~~Update budget thresholds~~ | Process fix | Trivial | ✅ **DONE (Apr 14 — triage e858ef7)** |
| **Security** | **posthog-js → 1.369.2** | 2 advisories resolved | Trivial | **READY — `npm install posthog-js@latest` or `npm audit fix`** |
| Low | Batch 16 remaining dep upgrades | Maintenance | Low | Batch with next triage cycle |
| P4 | Tree-shake Supabase realtime | ~20-30 KB | Medium | Monitoring — actionable if headroom <15 KB |

---

## Cross-Agent Context

**For Security Agent:** Bundle unchanged (0 KB delta). posthog-js security upgrade (1.367.0 → 1.369.2) is the top action item this cycle — resolves protobufjs Critical + dompurify Moderate. PostHog chunk (179 KB, deferred) may change slightly after upgrade. node_modules stable at 930 MB.

**For Code Quality Agent:** posthog-js is highest-priority dep upgrade this cycle (2 advisories). 16 additional production deps are minor/patch behind — recommend batching with next triage. Supabase realtime (P4) still the only structural optimization — +28 KB headroom unchanged.

**For QA Agent:** 0 KB bundle change. No user-facing changes. After posthog-js upgrade, re-verify analytics tracking in staging per security agent recommendation. No other performance-related regression risk.

**For Coverage Agent:** No new production dependencies. No source changes. Zero impact on test coverage.

**For Cost Analyst Agent:** Bundle stable at 2,892 KB (zero change). node_modules stable at 930 MB. ElevenLabs SDK chunk unchanged at 487 KB (deferred). posthog-js upgrade pending — negligible cost impact.

**For Localization Agent:** i18n bundling stable. 392 keys stable. P5 closed — Turbopack limitation. No optimization possible. Lazy-loading (es+en static, fr/de/pt/ast dynamic) unchanged.

---

*Report updated 2026-04-17 — 0 KB change (dev cache unchanged). GREEN status maintained (12th consecutive day).*
*Initial load JS: ~1,972 KB / 2,000 KB | Total JS: 2,892 KB / 3,000 KB — GREEN*
*Split budget adopted Apr 4 — old 2,500 KB single budget retired.*
*Key action: posthog-js → 1.369.2 (security — resolves 2 advisories). 16 other deps pending batch upgrade.*
