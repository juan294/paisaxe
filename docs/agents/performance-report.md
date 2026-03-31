# Performance Report

> Updated on 2026-03-30

## Health Status: YELLOW (JS budget exceeded by 304 KB — dev cache data)

**IMPORTANT CAVEAT:** Production build was skipped (dev server was running). Bundle sizes below are from the dev server's `.next` cache — they may differ from a production build. Dependency and disk metrics are still accurate.

**Total JS: 2,804 KB — exceeds 2,500 KB budget by 304 KB (12.2% over).** Unchanged from Mar 29 (same dev cache data). **However, P1 browserslist and P2 idle prefetch were both implemented on Mar 29** — the real impact of these changes can only be measured with a production build.

**Production build needed.** The browserslist addition should eliminate ~80-112 KB of core-js polyfills. A fresh `npm run build` is the only way to confirm actual savings.

## Key Metrics

| Metric | Current (2026-03-30)* | Previous (2026-03-29)* | Mar 8 (prod build) | Budget | Status |
|--------|----------------------|----------------------|---------------------|--------|--------|
| Total JS | **2,804 KB** | 2,804 KB | 2,726 KB | 2,500 KB | **Over budget** |
| Total CSS | **124 KB** | 124 KB | 122 KB | - | Good |
| Production deps | 31 | 31 | 31 | 40 | Good |
| node_modules | 862 MB | 862 MB | 865 MB | - | Stable |
| .next | 942 MB | 1,008 MB | 1,027 MB | - | Dev cache |

*\*Dev server cache — not a production build.*

## Budget Status

| Budget | Limit | Current (dev) | Estimated (prod)** | Status |
|--------|-------|---------------|-------------------|--------|
| Total JS | 2,500 KB | **2,804 KB** | **~2,592-2,724 KB** | Over budget (closer with P1) |
| Production deps | 40 | 31 | 31 | Good |

*\*\*Estimated: dev cache is typically 10-20% larger than production, plus P1 browserslist should remove ~80-112 KB polyfills.*

## Top 10 Chunks Identified

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | 0cusi_t26v7g_ | **482 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | **Deferred** (dynamic import) | No — already optimized |
| 2 | 0u95dh6lcl7tm | **232 KB** | Next.js App Router bootstrap + PPR + hydration | Static (framework) | No — required |
| 3 | 0xhb4vj110r-q | **176 KB** | PostHog analytics SDK v1.353.0 | **Deferred** (useEffect lazy import) | No — already lazy |
| 4 | 0k0pvzuuazt5v | **167 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P4 below |
| 5 | 109wl9l4s.nsr | **145 KB** | react-markdown + micromark parser | **Deferred** (inside VoiceChat) | No — already optimized |
| 6 | 01wdr4.40b75i | **134 KB** | React RSC Flight client runtime | Static (framework) | No — required |
| 7 | 01zssc3s5ox6h | **124 KB** | i18n strings (all 6 locales in dev mode) | Static (dev) | Verified correct — see P5 |
| 8 | 03~yq9q893hmn | **112 KB** | Polyfills (core-js v3.38.1) | Static | **FIXED — P1 browserslist added** |
| 9 | 0o5wigcmhjn65 | **108 KB** | Admin analytics (Stripe dashboard UI) | **Deferred** (admin tab import) | No — already optimized |
| 10 | 0g4ao1l.hblqi | **84 KB** | Additional i18n/legal page translations | Static | Low priority |

### Load Profile Summary

| Category | Size | % of Total | Notes |
|----------|------|-----------|-------|
| **Deferred (dynamic imports)** | ~911 KB | 32.5% | Loads on-demand only |
| **Framework (Next.js + React)** | ~366 KB | 13.1% | Bootstrap, router, RSC runtime |
| **Vendor (static)** | ~279 KB | 9.9% | Supabase, polyfills (polyfills should shrink after P1) |
| **App code (static)** | ~208 KB | 7.4% | i18n strings (both chunks) |
| **Other smaller chunks** | ~1,040 KB | 37.1% | Page routes, shared modules |

## Optimization Status

### Implemented This Cycle

| Optimization | Impact | Implemented | Notes |
|-------------|--------|-------------|-------|
| **P1: Browserslist** | ~80-112 KB savings | **2026-03-29** (triage) | package.json now targets last 2 versions of modern browsers. Polyfills chunk should be eliminated/reduced in next production build. |
| **P2: Idle prefetch ElevenLabs** | UX improvement (cold-start fix) | **2026-03-29** (triage) | `requestIdleCallback` in `immersive-page-content.tsx:79-86` prefetches 482 KB voice-chat chunk during idle time. Coverage agent confirms 100% test coverage on this code path. |

### Remaining Opportunities

### P3: Defer @vercel/analytics + @vercel/speed-insights — LOW-MEDIUM IMPACT (NEW)

**Status: NOT IMPLEMENTED.**

Both `@vercel/analytics` and `@vercel/speed-insights` are **statically imported** in `src/app/layout.tsx:11-12` and rendered directly in the JSX (lines 145-146). They are analytics-only — not critical to initial render or interactivity.

**Current code** (`src/app/layout.tsx:11-12`):
```typescript
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
```

**Fix — defer with next/dynamic:**
```typescript
import dynamic from "next/dynamic";
const Analytics = dynamic(
  () => import("@vercel/analytics/next").then(m => ({ default: m.Analytics })),
  { ssr: false }
);
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then(m => ({ default: m.SpeedInsights })),
  { ssr: false }
);
```

**Effort:** Low. **Risk:** Very low — deferred analytics load is standard practice (PostHog already does this). **Savings:** ~10-20 KB deferred from initial load. These packages are small individually, but every KB matters when over budget.

### P4: Tree-shake Supabase realtime module (~20-30 KB savings) — LOW IMPACT (DOWNGRADED)

**Status: NOT IMPLEMENTED. Downgraded from P3 to P4.**

Chunk `0k0pvzuuazt5v` (167 KB) includes the Supabase SDK with `RealtimeClient`. **However, investigation confirms realtime subscriptions are used ONLY in admin pages** (`use-realtime-feature-flags.ts`). Public-facing pages never create realtime connections.

**Why downgraded:** Disabling realtime for public pages requires creating two separate Supabase client instances (one for public, one for admin). This adds complexity for ~20-30 KB savings. The current singleton pattern in `supabase-browser.ts` is simpler and the realtime module is tree-shaken from server bundles.

**Fix (if pursued):**
```typescript
// src/lib/supabase-browser-public.ts
const supabase = createBrowserClient(url, key, {
  realtime: { enabled: false },
});
```

**Effort:** Medium (audit all client usage, create separate clients). **Savings:** ~20-30 KB.

### P5: Verify i18n lazy loading in production build — NEEDS VERIFICATION

**Status: Code confirmed correct — needs production build to verify output.**

The lazy-loading implementation in `src/lib/i18n/provider.tsx` is correct:
- `es` and `en` are statically imported (lines 12-13)
- `fr`, `de`, `pt`, `ast` are loaded via `import()` only when the locale changes (lines 27-30)
- No code path statically imports all 6 locales

The 208 KB across two i18n chunks in dev mode is likely a **dev-mode artifact** — Turbopack may bundle all locale files for HMR. A production build should show only es+en in the initial bundle (~70 KB) with fr/de/pt/ast deferred.

**Action:** Run `npm run build:analyze` to verify. If all 6 are still bundled in production, the lazy-loading may have a dead import path somewhere.

### P6: Split JS budget (initial vs total) — PROCESS IMPROVEMENT

**Carried from previous report.** With 911 KB (32.5%) deferred behind dynamic imports, the 2,500 KB total budget penalizes good code-splitting.

**Recommendation:**
- **Initial load JS:** <= 1,800 KB (estimated ~1,893 KB currently)
- **Total JS:** <= 3,000 KB (currently 2,804 KB — 196 KB headroom)

### P7: Update posthog-js to latest — MINOR

**posthog-js is at v1.353.0** in the lockfile. The package.json pins `^1.353.0`. Security agent previously flagged a dompurify vuln fix in a newer version. Updating may also yield minor bundle size improvements.

**Effort:** Trivial (`npm update posthog-js`). **Risk:** Low.

## Dynamic Import Chain Verification

### Code-Splitting Coverage: Excellent

**11 `dynamic()` imports + 18+ lazy `import()` calls** across the codebase.

### Public site (visitor-facing) — PROPERLY DEFERRED

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"    // 482 KB
    -> import ReactMarkdown from "react-markdown"               // ~145 KB
    -> import { usePostHog } from "posthog-js/react"            // ~176 KB
  -> requestIdleCallback(() => import("./voice-chat"))          // PREFETCH (NEW)
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
]))   // 176 KB after hydration, production only
```

### Vercel Analytics — STATICALLY LOADED (P3)

```
layout.tsx
  -> import { Analytics } from "@vercel/analytics/next"          // STATIC
  -> import { SpeedInsights } from "@vercel/speed-insights/next" // STATIC
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 257 MB | Framework (required) | No action |
| pdfjs-dist | 63 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 45 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | Optimized |
| @opentelemetry | 40 MB | 0 KB (server-only) | No action |
| posthog-js | 31 MB | ~176 KB (lazy-loaded in useEffect) | **Consider update from 1.353.0** |
| @napi-rs | 29 MB | 0 KB (native, server-only) | No action |
| typescript | 23 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| @img | 16 MB | 0 KB (sharp image processing, server-only) | No action |
| core-js | 15 MB | **~0-30 KB** (P1 browserslist should eliminate most polyfills) | **P1 applied** |
| rxjs | 12 MB | ~0 KB (transitive, tree-shaken) | No action |
| @babel | 12 MB | 0 KB (build tool) | No action |
| es-abstract | 11 MB | 0 KB (transitive, dev-only) | No action |

## Comparison: 7-Run Trend

| Metric | Feb 6 | Feb 7 | Mar 7 (est.) | Mar 8 | Mar 29* | **Mar 30*** | Trend |
|--------|-------|-------|-------------|-------|---------|------------|-------|
| Total JS | 2,889 KB | 2,455 KB | ~2,395 KB | 2,726 KB | 2,804 KB | **2,804 KB** | Flat (dev cache) |
| CSS | - | 130 KB | Unknown | 122 KB | 124 KB | **124 KB** | Stable |
| Prod deps | 27 | 27 | 31 | 31 | 31 | **31** | Stable |
| node_modules | 850 MB | 856 MB | 861 MB | 865 MB | 862 MB | **862 MB** | Stable |
| .next | - | - | - | 1,027 MB | 1,008 MB | **942 MB** | Down |
| EL deferred | No (2x476) | Yes (1x482) | Yes | Yes | Yes | **Yes** | Stable |
| EL idle prefetch | No | No | No | No | No | **Yes (NEW)** | Improved |
| Browserslist | No | No | No | No | No | **Yes (NEW)** | Improved |
| posthog-js | 1.237.x | 1.237.x | 1.353.0 | 1.353.0 | 1.353.0 | **1.353.0** | Stale |
| Key event | EL dedup | optimizePkg | Build blocked | Build ok | Dev cache | **P1+P2 done** | - |

*\*Dev server cache — may overcount vs production build.*

**Why no change in numbers?** Same dev server cache as Mar 29. The P1 (browserslist) and P2 (idle prefetch) implementations happened on Mar 29 but the dev server cache was not rebuilt. A production build is needed to measure actual impact.

## Disk Usage

| Directory | Size | Notes |
|-----------|------|-------|
| node_modules | 862 MB | Stable |
| .next | 942 MB | Dev server cache (-66 MB from Mar 29) |

## Action Plan

| Priority | Action | Estimated Savings | Effort | Status |
|----------|--------|-------------------|--------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~80-112 KB~~ | ~~Trivial~~ | **DONE (Mar 29)** |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | ~~Low~~ | **DONE (Mar 29)** |
| **P3** | **Defer Vercel Analytics/SpeedInsights** | ~10-20 KB (deferred) | Low | **New** |
| P4 | Tree-shake Supabase realtime | ~20-30 KB | Medium | Downgraded |
| P5 | Verify i18n bundling (needs prod build) | ~40-80 KB | Low | Needs build |
| P6 | Split JS budget (initial vs total) | Process clarity | Trivial | Pending |
| P7 | Update posthog-js to latest | Security + minor | Trivial | Pending |

**Next critical action:** Run a production build (`npm run build`) to measure the real impact of P1 browserslist. Expected savings: ~80-112 KB from eliminated polyfills, potentially bringing total JS to ~2,692-2,724 KB. With dev-to-prod shrinkage (10-20%), the actual number may be closer to budget.

---

## Cross-Agent Context

**For Security Agent:** posthog-js remains at 1.353.0 — dompurify vuln fix status unchanged. Browserslist (P1) has no security implications. @vercel/analytics v2.0.1 and @vercel/speed-insights v2.0.0 still pending evaluation — deferring their loading (P3) doesn't change upgrade urgency. next@16.2.2+ still needed when available.

**For Code Quality Agent:** P1+P2 implemented, verify with production build. New P3: `@vercel/analytics` and `@vercel/speed-insights` are statically imported in `layout.tsx:11-12` — should be deferred via `dynamic()` for consistency with PostHog pattern. All 11 `dynamic()` imports verified correct.

**For QA Agent:** P2 idle prefetch now implemented — voice chat cold-start latency should improve. Coverage agent confirms `requestIdleCallback` prefetch body has 100% test coverage. No new E2E-impacting changes.

**For Coverage Agent:** No new dependencies affect bundle composition. Test suite additions (5689 tests) are devDependency-only — zero production bundle impact. P2 idle prefetch code path verified covered.

**For Cost Analyst Agent:** No cost-impacting changes. Zero Paisaxe voice usage means ElevenLabs SDK chunk is never loaded in production visits. Browserslist optimization (P1) reduces bandwidth marginally when verified in production.

**For Localization Agent:** i18n lazy loading verified correct in code: es+en static, fr/de/pt/ast dynamic. The 208 KB in dev-mode chunks is likely a dev artifact. Production build needed to confirm only ~70 KB of locale data in initial bundle.

---

*Report generated by Performance Agent — 2026-03-30*
*Dev server cache data — production build needed for accurate measurements*
*P1 + P2 implemented since last report — awaiting production build verification*
