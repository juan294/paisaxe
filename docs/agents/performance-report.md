# Performance Report

> Updated on 2026-03-08

## Health Status: YELLOW (JS budget exceeded by 226 KB)

**Build blockers from last report are RESOLVED.** Both the corrupted `coverage/` directory and the TypeScript error in `agent-config/route.ts` have been fixed. This is the first actual bundle measurement since Feb 7.

**Total JS: 2,726 KB — exceeds 2,500 KB budget by 226 KB (9% over).** The previous report estimated ~2,395 KB, but that estimate was based on Feb 7's 2,455 KB baseline minus projected savings — the actual measurement shows the bundle has grown by 271 KB since Feb 7, likely from new features (ISR, PPR, additional app code).

**Good news:** Code-splitting is well-implemented. ~914 KB of the total is deferred behind dynamic imports (ElevenLabs, PostHog, VoiceChat UI, admin panels). The initial page load JS is estimated at ~1,500 KB — well under budget. The budget violation is in *total* JS, not initial load.

**Production deps: 31 of 40 budget (77.5%).** Unchanged from last report.

## Key Metrics

| Metric | Current (2026-03-08) | Previous (2026-02-07) | Change | Budget | Status |
|--------|---------------------|----------------------|--------|--------|--------|
| Total JS | **2,726 KB** | 2,455 KB | **+271 KB (+11%)** | 2,500 KB | **Over budget** |
| Total CSS | **122 KB** | 130 KB | **-8 KB (-6%)** | - | Good |
| Production deps | 31 | 27 | +4 | 40 | Good |
| node_modules | 865 MB | 856 MB | +9 MB | - | Stable |
| .next | 1,027 MB | 2,102 MB (Feb 7 prod) | N/A | - | Expected |

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| Total JS | 2,500 KB | **2,726 KB** | **-226 KB (-9%)** | Over budget |
| Production deps | 40 | 31 | 9 | Good |

## Top 10 Chunks Identified

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | d33d3b23 | **482 KB** | ElevenLabs SDK + protobuf | **Deferred** (dynamic import) | No — already optimized |
| 2 | aee6c772 | **224 KB** | Next.js app bootstrap + hydration | Static (framework) | No — required |
| 3 | 89702102 | **181 KB** | PostHog analytics SDK | **Deferred** (useEffect dynamic import) | No — already lazy |
| 4 | 0df916ae | **168 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P3 below |
| 5 | ed8f8767 | **146 KB** | Chat interface component | **Deferred** (VoiceChat dynamic import) | No — already optimized |
| 6 | bddf0896 | **124 KB** | Error boundary + localization/i18n | Static | See P2 below |
| 7 | a6dad97d | **113 KB** | Polyfills (Object.assign, Promise, fetch) | Static | **Yes — see P1** |
| 8 | fd368131 | **111 KB** | App Router + navigation (PPR, prefetch) | Static (framework) | No — required |
| 9 | 9d279aa7 | **105 KB** | Admin analytics dashboard | **Deferred** (admin tab dynamic import) | No — already optimized |
| 10 | 681953fa | **75 KB** | Dynamic route imports / module loaders | Static (framework) | No — required |

### Load Profile Summary

| Category | Size | % of Total | Notes |
|----------|------|-----------|-------|
| **Deferred (dynamic imports)** | ~914 KB | 33.5% | Loads on-demand only |
| **Framework (Next.js core)** | ~410 KB | 15.0% | Bootstrap, router, module loaders |
| **Vendor (static)** | ~281 KB | 10.3% | Supabase, polyfills |
| **App code (static)** | ~124 KB | 4.5% | Error boundary, i18n |
| **Other smaller chunks** | ~997 KB | 36.6% | Page routes, shared modules |

**Estimated initial load: ~1,500-1,600 KB** (total minus deferred). This is within budget for initial load performance.

## Optimization Opportunities

### P1: Eliminate polyfills chunk (~113 KB savings) — HIGH IMPACT

Chunk `a6dad97d` (113 KB) contains browser compatibility polyfills for `Object.assign`, `String` methods, `Array.flat`, `Promise.finally`, and `fetch` API shimming. Modern browsers (Chrome 90+, Safari 15+, Firefox 90+) don't need these.

**Root cause:** Next.js defaults to a broad `browserslist` target. This project's audience (tourists in Asturias, 2026) uses overwhelmingly modern browsers.

**Fix:** Add a `browserslist` to `package.json`:
```json
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

**Alternative (faster):** Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  // ... existing config
  transpilePackages: [], // Ensure no unnecessary transpilation
};
```

**Effort:** Trivial (1 line in package.json). **Risk:** Very low — only drops IE11/legacy Android. **Savings:** ~80-113 KB.

### P2: Preload ElevenLabs chunk after page idle — MEDIUM IMPACT (UX)

QA Agent reports 3 persistent E2E journey failures (Journeys 3, 7, 14) due to the VoiceChat dynamic import exceeding 5s timeout. The 482 KB ElevenLabs chunk loads on-demand when the chat panel opens, but this is too slow for first interaction.

**Fix:** Add an idle-time prefetch in `immersive-page-content.tsx`:
```typescript
useEffect(() => {
  // Prefetch voice chat chunk after page is idle
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => {
      import("@/components/immersive/voice-chat");
    });
  }
}, []);
```

**Effort:** Low (4 lines). **Risk:** None — downloads during idle time, doesn't block initial render. **Impact:** Eliminates 5s cold-start latency on first chat open. Fixes 3 QA E2E failures.

### P3: Tree-shake Supabase realtime module (~20-30 KB savings) — LOW IMPACT

Chunk `0df916ae` (168 KB) includes the full Supabase client with auth, postgrest, AND realtime. The realtime module adds ~20-30 KB but is only used for admin features (if at all). The public-facing immersive page doesn't use realtime subscriptions.

**Fix:** If realtime is not used on the public site, create the Supabase client without it:
```typescript
import { createBrowserClient } from "@supabase/ssr";

// For public pages — no realtime needed
const supabase = createBrowserClient(url, key, {
  realtime: { enabled: false },
});
```

**Effort:** Medium (requires auditing Supabase usage across pages). **Risk:** Low. **Savings:** ~20-30 KB.

### P4: Consider splitting the JS budget — LOW PRIORITY (PROCESS)

The 2,500 KB budget measures *total* JS including deferred chunks. With 914 KB deferred behind dynamic imports, the initial load is ~1,500 KB — well below any reasonable performance threshold.

**Recommendation:** Split the budget:
- **Initial load JS:** ≤ 1,800 KB (currently ~1,500 KB — 300 KB headroom)
- **Total JS:** ≤ 3,000 KB (currently 2,726 KB — 274 KB headroom)

This better reflects the actual user experience. The current 2,500 KB total budget penalizes good code-splitting practices — deferred chunks don't affect page load performance.

## Optimization Progress

### Implemented Since Last Report

| Optimization | Date | Actual Impact | Source |
|-------------|------|---------------|--------|
| **VoiceAgentChat dynamic import** | Since Mar 7 | 482 KB deferred from Marketing tab load | P2 from Mar 7 report |
| **Build blockers resolved** | Since Mar 7 | Actual measurement possible | P0 from Mar 7 report |
| **posthog-js updated to 1.359.1** | Since Mar 7 | Security vuln resolved | Security Agent recommendation |

### Still Pending

| Optimization | Priority | Estimated Savings | Effort |
|-------------|----------|-------------------|--------|
| Browserslist modernization (drop polyfills) | **P1** | ~80-113 KB | Trivial |
| Preload ElevenLabs on idle | **P2** | UX (fixes 3 E2E failures) | Low |
| Tree-shake Supabase realtime | **P3** | ~20-30 KB | Medium |
| Split JS budget (initial vs total) | **P4** | Process improvement | Trivial |

## Dynamic Import Chain Verification

### Public site (visitor-facing) — PROPERLY DEFERRED ✓

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED ✓
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED ✓
      -> import { useConversation } from "@elevenlabs/react"    // 482 KB
    -> import ReactMarkdown from "react-markdown"               // ~40 KB (inside deferred chunk)
    -> import { usePostHog } from "posthog-js/react"            // ~181 KB (already loaded by provider)
```

### Admin dashboard — PROPERLY DEFERRED ✓ (FIXED since last report)

```
admin/page.tsx
  -> dynamic(() => import("marketing-dashboard"), { ssr: false })  // DEFERRED ✓
    -> dynamic(() => import("../voice-agent-chat"))                // DEFERRED ✓ (was static — NOW FIXED)
      -> import { useConversation } from "@elevenlabs/react"       // 482 KB
```

### PostHog — LAZILY LOADED ✓

```
providers.tsx -> PostHogProviderWrapper
  -> posthog-provider.tsx
    -> useEffect(() => Promise.all([
        import("posthog-js"),
        import("posthog-js/react")
      ]))                                                          // 181 KB after hydration
```

### Stripe — STATIC BUT ROUTE-SCOPED

```
pricing/checkout/page.tsx
  -> import { EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"  // Static
  -> import { loadStripe } from "@stripe/stripe-js"                       // Static, lazy init
```

Not dynamically imported, but only used on `/pricing/checkout` — not loaded on home or immersive pages.

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 257 MB | Framework (required) | No action |
| pdfjs-dist | 63 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 45 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | Optimized |
| @opentelemetry | 40 MB | 0 KB (server-only) | No action |
| posthog-js | 35 MB | ~181 KB (lazy-loaded in useEffect) | Updated to 1.359.1 |
| @napi-rs | 29 MB | 0 KB (native, server-only) | No action |
| typescript | 23 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| @img | 16 MB | 0 KB (sharp image processing, server-only) | No action |
| core-js | 15 MB | Polyfills (~113 KB) | **P1: browserslist** |
| rxjs | 12 MB | ~0 KB (transitive, tree-shaken) | No action |
| @babel | 12 MB | 0 KB (build tool) | No action |
| es-abstract | 11 MB | 0 KB (transitive, dev-only) | No action |

## Comparison: 5-Run Trend

| Metric | 2026-02-02 | 2026-02-06 | 2026-02-07 | 2026-03-07 (est.) | **2026-03-08** | Trend |
|--------|-----------|-----------|-----------|------------------|------------|-------|
| Total JS | 2,660 KB | 2,889 KB | 2,455 KB | ~2,395 KB (est.) | **2,726 KB** | ↑ Regression |
| CSS | - | - | 130 KB | Unknown | **122 KB** | ↓ Improved |
| Prod deps | 30 | 27 | 27 | 31 | **31** | Stable |
| node_modules | - | 850 MB | 856 MB | 861 MB | **865 MB** | Stable |
| ElevenLabs deferred | ✗ (1x476) | ✗ (2x476) | ✓ (1x482) | ✓ (1x482) | **✓ (1x482)** | Stable |
| VoiceAgentChat deferred | ✗ | ✗ | ✗ | ✗ | **✓** | Fixed! |
| Key event | framer-motion removed | ElevenLabs dedup | optimizePkgImports | Build blocked | **Build unblocked** | — |

**Why the regression?** The Mar 7 estimate (~2,395 KB) was based on Feb 7's baseline minus projected savings — not an actual measurement. The actual growth from Feb 7 (2,455 KB) to now (2,726 KB) is +271 KB, attributable to:
1. New ISR/PPR infrastructure (commits `dbcd6c5`, `0c13c00`)
2. Additional app code for new features
3. Turbopack chunk strategy differences between builds
4. 392 UI translation keys (up from 221 in Feb) — more i18n data bundled

## ISR/PPR Performance Impact

Recent commits enabled ISR (`revalidate: 60`) and PPR (`cacheComponents: true`) for the immersive page. While these improve runtime TTFB:

- **Bundle impact:** PPR adds framework code for partial rendering support (contributes to the 224 KB bootstrap chunk)
- **QA concern:** ISR caching may serve stale English translations during client-side navigation (QA Agent reports Spanish→English title switching in Journey 1)
- **Recommendation:** Monitor ISR cache invalidation for locale-specific content. Consider using `revalidateTag()` for translation-dependent pages.

## Disk Usage

| Directory | Size | Notes |
|-----------|------|-------|
| node_modules | 865 MB | Stable (+9 MB from Feb 7, expected) |
| .next | 1,027 MB | Production build artifact |

## Action Plan

| Priority | Action | Estimated Savings | Effort | Blocked By |
|----------|--------|-------------------|--------|-----------|
| **P1** | **Add browserslist to drop polyfills** | ~80-113 KB | Trivial | Nothing |
| **P2** | **Preload ElevenLabs on idle** | UX improvement (fixes 3 E2E failures) | Low | Nothing |
| P3 | Tree-shake Supabase realtime | ~20-30 KB | Medium | Audit needed |
| P4 | Split JS budget (initial vs total) | Process clarity | Trivial | Decision |

**If P1 is implemented:** Total JS drops to ~2,613-2,646 KB — still over the 2,500 KB budget by ~113-146 KB. Combined with P3, total could reach ~2,583-2,616 KB. To fully close the gap, the budget should be reconsidered (P4) since ~914 KB is deferred and doesn't affect page load.

---

## Cross-Agent Context

**For Security Agent:** posthog-js dompurify vuln resolved (updated to 1.359.1, confirmed clean audit Mar 8). No new client-heavy dependencies. Browserslist change (P1) has no security implications.

**For Code Quality Agent:** Bundle growth of +271 KB since Feb 7 warrants investigation. ISR/PPR commits may have added framework overhead. Check if PPR `cacheComponents` is adding unnecessary serialization code. The polyfills chunk (113 KB) can be eliminated with a `browserslist` entry in `package.json`.

**For QA Agent:** ElevenLabs chunk preloading (P2) should fix Journeys 3, 7, 14 — the 482 KB chunk loads on-demand within idle time instead of on first click. ISR caching (`revalidate: 60`) may be serving stale translations (Journey 1 regression) — investigate locale-aware cache keys.

**For Coverage Agent:** No new dependencies affect bundle composition. Test suite additions (5059 tests) are devDependency-only — zero impact on production bundle.

**For Cost Analyst Agent:** No cost-impacting changes. ElevenLabs SDK loading path unchanged. Browserslist optimization (P1) reduces bandwidth costs marginally.

**For Localization Agent:** Translation key count growth (221→392) adds bundled i18n data. Lazy-loading (es+en static, others dynamic) is properly in place. ISR may serve stale translations — verify locale consistency during client navigation.

---

*Report generated by Performance Agent — 2026-03-08*
*First actual bundle measurement since Feb 7 — build blockers resolved*
