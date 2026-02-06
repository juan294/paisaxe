# Performance Report

> Updated on 2026-02-06

## Health Status: YELLOW

**Bundle size exceeds budget by 389KB (+15.6%).** Production build was skipped (dev server running), so metrics are from dev cache and may differ from production build.

**Note:** This report analyzes dev server cache (`.next`). For accurate production metrics, run a full production build.

## Key Metrics

| Metric | Current | Previous (2026-02-02) | Change | Budget | Status |
|--------|---------|----------|--------|--------|--------|
| Total JS | 2,889 KB | 2,660 KB | **+229 KB (+8.6%)** | 2,500 KB | Over budget |
| Total CSS | 132 KB | 98 KB | +34 KB | - | Regression |
| Production deps | 27 | 30 | -3 | 40 | Good |
| node_modules | 850 MB | 863 MB | -13 MB | - | Stable |
| .next build | 2,129 MB | 991 MB | **+1,138 MB** | - | Large increase |

## Budget Violations

| Budget | Limit | Current | Overage |
|--------|-------|---------|---------|
| Total JS | 2,500 KB | 2,889 KB | **+389 KB (15.6%)** |

**Regression Analysis:**
- Bundle grew by 229 KB since last report (4 days ago)
- .next directory doubled in size (+1.1 GB) - likely dev cache bloat
- CSS increased by 34 KB - may indicate added styles or reduced optimization

## Largest Bundles

| Chunk | Size | Likely Contents | Impact |
|-------|------|-----------------|--------|
| ff75735b9b73148a.js | 476 KB | ElevenLabs WebRTC + WebSocket | Critical |
| 90fd5c2e839b728a.js | 476 KB | ElevenLabs (duplicate/peer?) | Critical |
| bb6d58382d01dec1.js | 245 KB | Unknown (new since last report) | High |
| 2b88146d0d128b78.js | 183 KB | lucide-react icons | Medium |
| 9513c041a7409515.js | 172 KB | PostHog (lazy-loaded) | Non-blocking |
| 1cadbebe7f77139c.js | 153 KB | react-markdown + deps | Lazy-loaded |

**Red flags:**
1. **Two 476 KB ElevenLabs chunks** — This is unusual. Likely indicates either:
   - Duplicate imports from multiple entry points
   - Separate chunks for client/server or main/worker code
2. **New 245 KB chunk** — Appeared since last report. Source unknown without production build analysis.
3. **CSS +34 KB regression** — Investigate what styles were added.

## Heaviest Dependencies

| Package | node_modules Size | Client Bundle Impact | Used In | Status |
|---------|------------------|---------------------|---------|--------|
| @elevenlabs/react | Unknown | **~476 KB x2 (952 KB!)** | VoiceChat, VoiceAgentChat | Bloated |
| posthog-js | 30 MB | ~172 KB (lazy-loaded) | Analytics | Optimized |
| lucide-react | 45 MB | ~183 KB | 40+ files | Heavy but tree-shaken |
| pdfjs-dist | 63 MB | 0 KB | Build scripts only (devDep) | No impact |
| pdf-parse | 57 MB | 0 KB | Build scripts only (devDep) | No impact |
| next | 156 MB | Framework | Core | Required |
| react-markdown | Unknown | ~153 KB (lazy-loaded) | VoiceChat | Optimized |

**Previous optimizations (completed 2026-02-02):**
- framer-motion removed (-177 KB)
- PostHog lazy-loaded (~560 KB deferred from critical path)
- PDF dependencies moved to devDependencies

## Top Optimization Opportunities

### 1. CRITICAL: Investigate ElevenLabs Duplication (~476 KB savings)

**Issue:** Two identical 476 KB chunks containing ElevenLabs WebRTC code.

**Current usage:**
- `src/components/immersive/voice-chat-elevenlabs.tsx`
- `src/app/admin/voice-agent-chat.tsx` (admin panel)

**Hypothesis:** Both components import `@elevenlabs/react` independently, causing Next.js to create separate chunks if they're in different route segments (public vs admin).

**Recommended investigation steps:**
1. Run production build with `npm run build` to see if duplication persists
2. Run bundle analyzer: `npm run build:analyze` to visualize chunk contents
3. Check if ElevenLabs is being imported in both App Router and client components

**Potential fixes:**
```tsx
// Option A: Single lazy-loaded wrapper (recommended)
// src/components/elevenlabs-provider.tsx
"use client";
import { lazy } from "react";

const ElevenLabsWrapper = lazy(() => import("@elevenlabs/react"));

export function useElevenLabs() {
  // Shared lazy-loaded instance
}

// Option B: Route-based code splitting
// Ensure admin routes don't share chunks with public routes
// (Next.js should handle this automatically, but verify in bundle analyzer)
```

**Estimated savings:** 476 KB (eliminate duplication) or 952 KB (if both can be fully lazy-loaded)

---

### 2. HIGH: Investigate CSS Regression (+34 KB)

**Issue:** CSS bundle grew from 98 KB to 132 KB (+34.7%) in 4 days.

**Possible causes:**
- New Tailwind classes added (not purged)
- Added component libraries with bundled CSS
- Development mode including source maps or debug styles

**Investigation steps:**
```bash
# Check CSS files in production build
npm run build
ls -lh .next/static/css/

# Compare Tailwind classes used
# (Requires production build for accurate purge analysis)
```

**Recommendation:** Run production build to see if CSS size normalizes. Dev builds often include unpurged styles.

**Estimated savings:** Up to 34 KB if regression is dev-mode artifact

---

### 3. MEDIUM: Optimize lucide-react Icon Loading (~50-100 KB potential)

**Current:** 40+ files import from `lucide-react`, resulting in ~183 KB chunk.

**Status:** Icons ARE using named imports (good for tree-shaking), but 40 import sites is high.

**Opportunities:**
1. **Icon consolidation:** Create a central icon registry for most common icons
2. **SVG inlining:** For icons used in critical path (e.g., X, Send, Mic), inline the SVG directly
3. **Icon sprites:** Use SVG sprites for frequently repeated icons

**Example optimization:**
```tsx
// Before: 40 files each importing from lucide-react
import { X, Send, Mic } from "lucide-react";

// After: Critical icons inlined
// src/components/icons/inline.tsx
export const XIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

// Non-critical icons still lazy-loaded from lucide-react
```

**Estimated savings:** 50-100 KB (depends on how many icons are in critical path)

---

### 4. LOW: Verify PostHog Optimization Still Working

**Status:** PostHog shows as 172 KB chunk (`9513c041a7409515.js`), which should be lazy-loaded per previous optimization.

**Verification needed:**
```tsx
// Confirm this pattern is still in use:
// src/components/posthog-provider.tsx
useEffect(() => {
  Promise.all([
    import("posthog-js"),
    import("posthog-js/react"),
  ]).then(...)
}, []);
```

**Check:** Is PostHog still deferred from critical path? Look at Lighthouse/WebPageTest to confirm it loads after First Contentful Paint.

**Expected result:** PostHog loads in background, doesn't block page render.

---

### 5. NO ACTION: react-markdown (Already Optimized)

**Status:** react-markdown is dynamically imported in VoiceChat:
```tsx
// src/app/immersive/immersive-page-content.tsx
const VoiceChat = dynamic(
  () => import("@/components/immersive/voice-chat").then((mod) => mod.VoiceChat),
  { ssr: false, loading: () => null }
);
```

**Impact:** 153 KB deferred until voice chat is opened.

**No action needed.**

---

## Comparison: Current vs Previous

| Metric | 2026-02-02 | 2026-02-06 | Delta | Trend |
|--------|-----------|-----------|-------|-------|
| Total JS (raw) | 2,660 KB | 2,889 KB | **+229 KB** | Regressed |
| Total CSS | 98 KB | 132 KB | **+34 KB** | Regressed |
| Production deps | 30 | 27 | -3 | Improved |
| .next cache | 991 MB | 2,129 MB | +1,138 MB | Dev bloat |

**Regression root causes (hypothesis):**
1. **ElevenLabs duplication** — Admin voice chat may have introduced second import path
2. **Dev server artifacts** — Running analysis on dev cache instead of production build
3. **New dependencies** — Check git log for any new packages added in last 4 days

**Action items to investigate regressions:**
```bash
# 1. Check recent dependency changes
git log --since="2026-02-02" --oneline -- package.json

# 2. Check for new ElevenLabs usage
git log --since="2026-02-02" --oneline -- "**/*elevenlabs*"

# 3. Run production build for accurate metrics
npm run build
npm run build:analyze
```

---

## Action Plan (Prioritized)

| Priority | Action | Estimated Savings | Effort | Status |
|----------|--------|-------------------|--------|--------|
| P0 | **Run production build** | N/A (measurement) | Low | Required |
| P0 | Fix ElevenLabs duplication | **476 KB** | Medium | Blocked by #1 |
| P1 | Investigate CSS regression | **34 KB** | Low | Blocked by #1 |
| P1 | Optimize lucide-react critical icons | 50-100 KB | Medium | Can start |
| P2 | Verify PostHog lazy-load working | 0 KB (validation) | Low | Can start |

**Critical path:**
1. **Must run production build first** — Current metrics are from dev cache and may be misleading
2. Once production metrics are available, re-prioritize based on actual bundle sizes
3. ElevenLabs duplication is likely the #1 issue (if confirmed in production)

---

## Disk Usage

| Directory | Size | Previous | Change | Notes |
|-----------|------|----------|--------|-------|
| node_modules | 850 MB | 863 MB | -13 MB | Stable |
| .next | 2,129 MB | 991 MB | **+1,138 MB** | Dev cache bloat |

**Recommendation:** Clear .next cache periodically:
```bash
rm -rf .next
npm run build  # Fresh production build
```

---

## Build Output

**Note:** No production build was run. Analysis is based on dev server cache.

**To generate accurate report:**
```bash
# Stop dev server first
npm run build
npm run build:analyze

# Then re-run performance analysis
npm run analyze-performance
```

---

## Lighthouse/Core Web Vitals (Missing)

**Status:** No Lighthouse metrics available in this run.

**Recommended:** Add Core Web Vitals to performance monitoring:
- **LCP (Largest Contentful Paint):** Target < 2.5s
- **FID (First Input Delay):** Target < 100ms
- **CLS (Cumulative Layout Shift):** Target < 0.1
- **FCP (First Contentful Paint):** Target < 1.8s
- **TTI (Time to Interactive):** Target < 3.8s

**How to measure:**
```bash
# Run Lighthouse in CI
npx lighthouse https://paisaxe.com --output=json --output-path=./lighthouse-report.json

# Or use WebPageTest for detailed waterfall analysis
```

---

## Summary & Recommendations

### **Immediate Actions (This Week)**
1. **Stop dev server and run production build** — Current metrics are unreliable
2. **Run bundle analyzer** — Identify source of ElevenLabs duplication
3. **Check git history** — Find what changed between 2026-02-02 and today

### **Short-term Actions (Next Sprint)**
1. **Fix ElevenLabs duplication** — Biggest win (~476 KB)
2. **Investigate CSS regression** — Should be quick fix
3. **Set up automated performance monitoring** — Prevent regressions

### **Long-term Actions (Backlog)**
1. **Optimize lucide-react** — Inline critical icons
2. **Add Core Web Vitals tracking** — Monitor real user metrics
3. **Consider icon sprites** — For frequently repeated icons

---

## Cross-Agent Context

---

*Report generated by Performance Agent — Last updated: 2026-02-06*
*Based on dev cache, not production build — metrics may not reflect production reality*
