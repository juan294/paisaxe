# Performance Report

> Updated on 2026-03-29

## Health Status: YELLOW (JS budget exceeded by 304 KB)

**⚠️ IMPORTANT CAVEAT:** Production build was skipped (dev server was running). Bundle sizes below are from the dev server's `.next` cache — they may differ from a production build. Dependency and disk metrics are still accurate. The +78 KB growth may partly be dev-mode overhead.

**Total JS: 2,804 KB — exceeds 2,500 KB budget by 304 KB (12.2% over).** Up from 2,726 KB on Mar 8 (+78 KB, +2.9%). This is the worst budget violation to date.

**P1 browserslist optimization still not implemented (3 weeks overdue).** The polyfills chunk (112 KB of core-js) remains in the bundle, serving Object.assign, Symbol, Promise, and WeakMap polyfills to modern browsers that don't need them. This is the single highest-impact, lowest-effort optimization available.

**Code-splitting remains well-implemented.** ~911 KB (32.5%) is deferred behind dynamic imports. Estimated initial load JS is ~1,893 KB. All ElevenLabs, PostHog, react-markdown, and admin panel chunks are properly deferred.

**Production deps: 31 of 40 budget (77.5%).** Unchanged.

## Key Metrics

| Metric | Current (2026-03-29)* | Previous (2026-03-08) | Change | Budget | Status |
|--------|----------------------|----------------------|--------|--------|--------|
| Total JS | **2,804 KB** | 2,726 KB | **+78 KB (+2.9%)** | 2,500 KB | **Over budget** |
| Total CSS | **124 KB** | 122 KB | +2 KB | - | Good |
| Production deps | 31 | 31 | 0 | 40 | Good |
| node_modules | 862 MB | 865 MB | -3 MB | - | Stable |
| .next | 1,008 MB | 1,027 MB | -19 MB | - | Stable |

*\*Dev server cache — not a production build.*

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| Total JS | 2,500 KB | **2,804 KB** | **-304 KB (-12.2%)** | Over budget |
| Production deps | 40 | 31 | 9 | Good |

## Top 10 Chunks Identified

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | 0cusi_t26v7g_ | **482 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | **Deferred** (dynamic import) | No — already optimized |
| 2 | 0u95dh6lcl7tm | **232 KB** | Next.js App Router bootstrap + PPR + hydration | Static (framework) | No — required |
| 3 | 0xhb4vj110r-q | **176 KB** | PostHog analytics SDK v1.353.0 | **Deferred** (useEffect lazy import) | No — already lazy |
| 4 | 0k0pvzuuazt5v | **167 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P3 below |
| 5 | 109wl9l4s.nsr | **145 KB** | react-markdown + micromark parser | **Deferred** (inside VoiceChat) | No — already optimized |
| 6 | 01wdr4.40b75i | **134 KB** | React RSC Flight client runtime | Static (framework) | No — required |
| 7 | 01zssc3s5ox6h | **124 KB** | i18n strings (all 6 locales × 392 keys) | Static | See P4 below |
| 8 | 03~yq9q893hmn | **112 KB** | Polyfills (core-js v3.38.1) | Static | **Yes — see P1** |
| 9 | 0o5wigcmhjn65 | **108 KB** | Admin analytics (Stripe dashboard UI) | **Deferred** (admin tab import) | No — already optimized |
| 10 | 0g4ao1l.hblqi | **84 KB** | Additional i18n/legal page translations | Static | Low priority |

### Load Profile Summary

| Category | Size | % of Total | Notes |
|----------|------|-----------|-------|
| **Deferred (dynamic imports)** | ~911 KB | 32.5% | Loads on-demand only |
| **Framework (Next.js + React)** | ~366 KB | 13.1% | Bootstrap, router, RSC runtime |
| **Vendor (static)** | ~279 KB | 9.9% | Supabase, polyfills |
| **App code (static)** | ~208 KB | 7.4% | i18n strings (both chunks) |
| **Other smaller chunks** | ~1,040 KB | 37.1% | Page routes, shared modules |

**Estimated initial load: ~1,893 KB** (total minus deferred). Over the informal 1,800 KB initial budget from last report.

## Optimization Opportunities

### P1: Eliminate polyfills chunk (~80-112 KB savings) — HIGH IMPACT ⚡ — 3 WEEKS OVERDUE

**Status: NOT IMPLEMENTED.** First recommended on 2026-03-08. This is the single biggest quick win.

Chunk `03~yq9q893hmn` (112 KB) contains core-js v3.38.1 polyfills for `Object.assign`, `Symbol`, `Promise`, `WeakMap`, `Array.from`, `String.prototype.includes`, and `fetch` shimming. All modern browsers (Chrome 90+, Safari 15+, Firefox 90+) include these natively.

**Root cause:** No `browserslist` in `package.json` — Next.js defaults to broad browser targets.

**Fix (trivial — 1 line):**
```json
// package.json — add at the top level
{
  "browserslist": [
    "last 2 Chrome versions",
    "last 2 Firefox versions",
    "last 2 Safari versions",
    "last 2 Edge versions",
    "> 0.5%, not dead"
  ]
}
```

**Effort:** Trivial. **Risk:** Very low — only drops IE11/legacy Android. **Savings:** ~80-112 KB.

**If implemented today:** Total JS would drop to ~2,692-2,724 KB — still over budget, but reduces the violation from 12.2% to ~7.7-9.0%.

### P2: Preload ElevenLabs chunk after page idle — MEDIUM IMPACT (UX) — 3 WEEKS OVERDUE

**Status: NOT IMPLEMENTED.** First recommended on 2026-03-08. No `requestIdleCallback` found anywhere in `src/`.

The 482 KB ElevenLabs chunk loads on-demand when the voice chat panel opens. This causes a noticeable cold-start delay on first interaction.

**Fix (4 lines):**
```typescript
// In src/app/immersive/immersive-page-content.tsx — add to existing useEffect or new one
useEffect(() => {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => {
      import("@/components/immersive/voice-chat");
    });
  }
}, []);
```

**Effort:** Low. **Risk:** None — downloads during idle time. **Impact:** Eliminates cold-start latency on first chat open.

### P3: Tree-shake Supabase realtime module (~20-30 KB savings) — LOW IMPACT

**Status: NOT IMPLEMENTED.** Chunk `0k0pvzuuazt5v` (167 KB) includes the full Supabase client with `RealtimeClient` and WebSocket infrastructure. The public-facing immersive page doesn't use realtime subscriptions.

**Fix:** Create the Supabase client without realtime for public pages:
```typescript
const supabase = createBrowserClient(url, key, {
  realtime: { enabled: false },
});
```

**Effort:** Medium (requires auditing Supabase client usage). **Risk:** Low. **Savings:** ~20-30 KB.

### P4: i18n bundle optimization (~40-80 KB savings) — MEDIUM IMPACT (NEW)

**Two i18n chunks total 208 KB** of static translation strings (chunks #7 and #10). With 392 keys × 6 locales, all locale data is bundled upfront.

The lazy-loading setup (es+en static, others dynamic) was implemented in Feb — but the dev-mode chunks suggest all 6 locale files are being bundled. This may be a dev-only artifact or the lazy-loading may not be effective in all code paths.

**Investigation needed:** Run a production build (`npm run build:analyze`) to verify whether the lazy locale loading actually excludes fr/de/pt/ast from the initial bundle. If it doesn't:

```typescript
// Ensure dynamic locales are ONLY loaded via dynamic import
const loadLocale = async (locale: string) => {
  switch (locale) {
    case 'es': return (await import('./es')).default;
    case 'en': return (await import('./en')).default;
    // These should NOT be statically imported anywhere
    case 'fr': return (await import('./fr')).default;
    case 'de': return (await import('./de')).default;
    case 'pt': return (await import('./pt')).default;
    case 'ast': return (await import('./ast')).default;
  }
};
```

**Effort:** Low-Medium. **Savings:** ~40-80 KB if non-primary locales are truly deferred. **Needs:** Production build analysis to confirm.

### P5: Split JS budget (initial vs total) — PROCESS IMPROVEMENT

**Carried from last report.** With 911 KB deferred, the 2,500 KB total budget penalizes good code-splitting.

**Recommendation:**
- **Initial load JS:** ≤ 1,800 KB (currently ~1,893 KB — slightly over)
- **Total JS:** ≤ 3,000 KB (currently 2,804 KB — 196 KB headroom)

### P6: posthog-js version discrepancy — MINOR

**posthog-js is at v1.353.0** — the Mar 8 report stated it was updated to 1.359.1, but the lockfile shows 1.353.0. The package.json pins `^1.353.0`. Consider updating to latest for potential bundle size improvements and the dompurify vuln fix the security agent previously flagged.

## Optimization Progress

### Implemented Since Last Report (Mar 8)

| Optimization | Impact | Notes |
|-------------|--------|-------|
| *(None)* | — | No performance optimizations implemented in the last 3 weeks |

### Still Pending

| Optimization | Priority | Estimated Savings | Effort | First Flagged | Status |
|-------------|----------|-------------------|--------|---------------|--------|
| **Browserslist (drop polyfills)** | **P1** | ~80-112 KB | Trivial | **Mar 8 (3 weeks)** | **Overdue** |
| **Preload ElevenLabs on idle** | **P2** | UX improvement | Low | **Mar 8 (3 weeks)** | **Overdue** |
| Tree-shake Supabase realtime | P3 | ~20-30 KB | Medium | Mar 8 | Pending |
| i18n bundle investigation | P4 | ~40-80 KB | Low-Medium | **New** | Needs prod build |
| Split JS budget | P5 | Process clarity | Trivial | Mar 8 | Pending |
| Update posthog-js | P6 | Security + minor | Trivial | New | Pending |

**If P1 + P3 are both implemented:** Total JS ≈ 2,662-2,694 KB — still over 2,500 KB budget but within striking distance. Adding P4 (if validated) could bring it to ~2,582-2,654 KB.

**To fully close the gap:** Either implement P1+P3+P4, or adopt the split budget model (P5) which recognizes that deferred chunks don't impact page load.

## Dynamic Import Chain Verification

### Public site (visitor-facing) — PROPERLY DEFERRED ✓

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED ✓
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED ✓
      -> import { useConversation } from "@elevenlabs/react"    // 482 KB
    -> import ReactMarkdown from "react-markdown"               // ~145 KB (inside deferred chunk)
    -> import { usePostHog } from "posthog-js/react"            // ~176 KB (already loaded by provider)
```

### Admin dashboard — PROPERLY DEFERRED ✓

```
admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar
  -> MarketingDashboard -> dynamic(() => import("voice-agent-chat"))  // DEFERRED ✓
```

### PostHog — LAZILY LOADED ✓

```
posthog-provider.tsx -> useEffect(() => Promise.all([
  import("posthog-js"), import("posthog-js/react")
]))   // 176 KB after hydration
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 257 MB | Framework (required) | No action |
| pdfjs-dist | 63 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 45 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | Optimized |
| @opentelemetry | 40 MB | 0 KB (server-only) | No action |
| posthog-js | 31 MB | ~176 KB (lazy-loaded in useEffect) | **Update from 1.353.0** |
| @napi-rs | 29 MB | 0 KB (native, server-only) | No action |
| typescript | 23 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| @img | 16 MB | 0 KB (sharp image processing, server-only) | No action |
| core-js | 15 MB | Polyfills (~112 KB) | **P1: browserslist** |
| rxjs | 12 MB | ~0 KB (transitive, tree-shaken) | No action |
| @babel | 12 MB | 0 KB (build tool) | No action |
| es-abstract | 11 MB | 0 KB (transitive, dev-only) | No action |

## Comparison: 6-Run Trend

| Metric | 2026-02-06 | 2026-02-07 | 2026-03-07 (est.) | 2026-03-08 | **2026-03-29*** | Trend |
|--------|-----------|-----------|------------------|------------|--------------|-------|
| Total JS | 2,889 KB | 2,455 KB | ~2,395 KB (est.) | 2,726 KB | **2,804 KB** | ↑ Growing |
| CSS | - | 130 KB | Unknown | 122 KB | **124 KB** | Stable |
| Prod deps | 27 | 27 | 31 | 31 | **31** | Stable |
| node_modules | 850 MB | 856 MB | 861 MB | 865 MB | **862 MB** | Stable |
| ElevenLabs deferred | ✗ (2x476) | ✓ (1x482) | ✓ (1x482) | ✓ (1x482) | **✓ (1x482)** | Stable |
| VoiceAgentChat deferred | ✗ | ✗ | ✗ | ✓ | **✓** | Stable |
| posthog-js | 1.237.x | 1.237.x | 1.353.0 | 1.353.0 | **1.353.0** | Stale |
| Key event | EL dedup | optimizePkgImports | Build blocked | Build unblocked | **Dev cache only** | — |

*\*Dev server cache — may overcount vs production build.*

**Why the growth?** +78 KB since Mar 8 with 0 new production dependencies. Likely contributors:
1. App code growth (new features, additional UI components)
2. Dev-mode Turbopack chunk strategy (less aggressive tree-shaking than production)
3. i18n data — 392 keys across 6 locales is 208 KB across 2 chunks

**Critical:** A production build (`npm run build`) is needed to get accurate numbers. Dev server bundles are typically 10-20% larger than production builds.

## Disk Usage

| Directory | Size | Notes |
|-----------|------|-------|
| node_modules | 862 MB | Stable (-3 MB from Mar 8) |
| .next | 1,008 MB | Dev server cache (not production build) |

## Action Plan

| Priority | Action | Estimated Savings | Effort | Overdue? |
|----------|--------|-------------------|--------|----------|
| **P1** | **Add browserslist to drop polyfills** | ~80-112 KB | Trivial | **3 weeks** |
| **P2** | **Preload ElevenLabs on idle** | UX (cold-start fix) | Low | **3 weeks** |
| P3 | Tree-shake Supabase realtime | ~20-30 KB | Medium | No |
| P4 | Investigate i18n bundling (needs prod build) | ~40-80 KB | Low-Medium | New |
| P5 | Split JS budget (initial vs total) | Process clarity | Trivial | No |
| P6 | Update posthog-js to latest | Security + minor | Trivial | New |

**Recommended immediate action:** Implement P1 (browserslist). Single line in package.json, ~100 KB savings, zero risk. This has been the top recommendation for 3 weeks.

---

## Cross-Agent Context

**For Security Agent:** posthog-js is at 1.353.0, not 1.359.1 as previously reported — the dompurify vuln fix may not be applied. Verify and update. Browserslist change (P1) has no security implications. Supabase realtime tree-shaking (P3) doesn't affect auth or security.

**For Code Quality Agent:** Bundle grew +78 KB in 3 weeks with 0 new deps — investigate if dev-mode overhead or actual app code growth. P1 (browserslist) and P4 (i18n investigation) are code-quality items. All 11 dynamic imports verified correct — no static imports leaking heavy modules.

**For QA Agent:** P2 (idle prefetch of ElevenLabs) remains unimplemented — if voice chat E2E journey has cold-start timeouts, this is the fix. All deferred chunks verified correct. ISR caching note from Mar 8 still applies for locale-aware content.

**For Coverage Agent:** No new dependencies affect bundle composition. Test suite additions (5685 tests) are devDependency-only — zero production bundle impact.

**For Cost Analyst Agent:** No cost-impacting changes. Browserslist optimization (P1) reduces bandwidth marginally. Zero Paisaxe voice usage means ElevenLabs SDK chunk is never loaded in production visits.

**For Localization Agent:** 208 KB of i18n data bundled across 2 chunks. Lazy-loading (es+en static, others dynamic) is configured, but dev-mode bundles show all 6 locales. Need production build to verify lazy-loading effectiveness. If all 6 are truly bundled, that's ~80 KB of unnecessary translations for most visitors.

---

*Report generated by Performance Agent — 2026-03-29*
*⚠️ Dev server cache data — production build needed for accurate measurements*
