# Performance Report

> Auto-generated on 2026-02-01

## Health Status: 🟡 YELLOW

Bundle size exceeds budget by 160KB. Actionable optimizations identified below.

## Key Metrics

| Metric | Current | Previous | Change | Budget | Status |
|--------|---------|----------|--------|--------|--------|
| Total JS | 2,660 KB | 2,600 KB | +60 KB | 2,500 KB | ❌ Over |
| Total CSS | 98 KB | 104 KB | -6 KB | - | ✅ |
| Production deps | 30 | 30 | 0 | 40 | ✅ |
| node_modules | 863 MB | 860 MB | +3 MB | - | ⚠️ |
| .next build | 991 MB | 948 MB | +43 MB | - | ⚠️ |

## Budget Violations

| Budget | Limit | Current | Overage |
|--------|-------|---------|---------|
| Total JS | 2,500 KB | 2,660 KB | **+160 KB (6.4%)** |

## Largest Bundles

| Chunk | Size | Likely Contents |
|-------|------|-----------------|
| 855063e708f0d7b3.js | 466 KB | posthog-js (~30KB) + analytics deps |
| 67f2893e602300bd.js | 466 KB | Duplicate or framework chunk |
| 773abe17875a49cc.js | 219 KB | lucide-react icons |
| 4340a08ecfbd31a8.js | 202 KB | @elevenlabs/react + websocket |
| 5f22e004f1dacea9.js | 177 KB | framer-motion animations |
| fda8f1a530df2fea.js | 159 KB | react-markdown + dependencies |

## Heaviest Dependencies

| Package | Size | Client Bundle Impact | Used In |
|---------|------|---------------------|---------|
| posthog-js | ~150 KB gzipped | HIGH - loads on every page | Layout (global) |
| lucide-react | 45 MB (node_modules) | HIGH - 38 files import icons | Throughout app |
| framer-motion | ~150 KB | MEDIUM - used in 2 components | Language switcher, category badge |
| @elevenlabs/react | ~100 KB | LOW - dynamically imported | VoiceChat (lazy) |
| react-markdown | ~50 KB | LOW - dynamically imported | VoiceChat (lazy) |
| pdfjs-dist | 62 MB (node_modules) | NONE - scripts only | PDF processing scripts |
| pdf-parse | 57 MB (node_modules) | NONE - scripts only | PDF processing scripts |

## Optimization Opportunities

### 1. 🎯 HIGH IMPACT: Replace framer-motion with CSS animations (~150KB savings)

**Current usage:** Only 2 files use framer-motion for simple animations:
- `src/components/immersive/language-switcher.tsx`
- `src/components/immersive/category-filter-badge.tsx`

**Recommendation:** Replace with CSS animations or native React transitions.

```tsx
// Before (framer-motion)
import { motion, AnimatePresence } from "framer-motion";
<motion.div animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

// After (CSS)
<div className="transition-opacity duration-200" />
// Or use Tailwind's built-in animate-* classes
```

**Estimated savings:** 140-150 KB (removes entire framer-motion dependency)

---

### 2. 🎯 HIGH IMPACT: Lazy-load PostHog (~100KB savings)

**Current:** PostHog loads synchronously in the root layout, adding ~150KB to the initial bundle.

**Recommendation:** Lazy-load PostHog after page hydration:

```tsx
// src/components/posthog-provider.tsx
"use client";

import { useEffect, useState } from "react";
import type { PostHog } from "posthog-js";

export function PostHogProviderWrapper({ children }: { children: React.ReactNode }) {
  const [posthog, setPosthog] = useState<PostHog | null>(null);

  useEffect(() => {
    // Lazy load PostHog after initial render
    import("posthog-js").then((mod) => {
      const ph = mod.default;
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        ph.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
          api_host: "/a",
          person_profiles: "never",
          persistence: "memory",
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: true,
        });
        setPosthog(ph);
      }
    });
  }, []);

  if (!posthog) return <>{children}</>;

  // Dynamic import for PostHogProvider
  const { PostHogProvider } = require("posthog-js/react");
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

**Estimated savings:** 80-100 KB from critical path

---

### 3. 🎯 MEDIUM IMPACT: Optimize lucide-react imports

**Current:** 38 files import from lucide-react. The package uses tree-shaking, but ensure named imports.

**Verification:** All imports appear to use named imports (good). No action needed unless bundle analyzer shows otherwise.

**Alternative:** For further optimization, consider icon sprites or inline SVGs for the most common icons (X, Send, Mic).

---

### 4. ⚠️ LOW IMPACT: Already optimized (VoiceChat lazy loading)

**Status:** VoiceChat is already dynamically imported in `src/app/immersive/page.tsx`:

```tsx
const VoiceChat = dynamic(
  () => import("@/components/immersive/voice-chat").then((mod) => mod.VoiceChat),
  { ssr: false, loading: () => null }
);
```

This correctly defers loading of:
- @elevenlabs/react (~100 KB)
- react-markdown (~50 KB)

**No action needed.**

---

### 5. ℹ️ NO ACTION: pdfjs-dist and pdf-parse

**Status:** These packages (119 MB combined in node_modules) are only used in:
- `scripts/process-pdfs.ts`
- `scripts/extract-images.ts`

**Impact:** Zero client bundle impact. They are build-time/script dependencies only.

**Recommendation:** Consider moving to `devDependencies` to clarify their purpose:

```bash
npm uninstall pdf-parse pdfjs-dist
npm install -D pdf-parse pdfjs-dist
```

---

## Comparison to Previous Run

| Metric | Previous | Current | Delta | Trend |
|--------|----------|---------|-------|-------|
| Total JS | 2,600 KB | 2,660 KB | +60 KB | 📈 Regression |
| CSS | 104 KB | 98 KB | -6 KB | 📉 Improved |
| .next size | 948 MB | 991 MB | +43 MB | 📈 Regression |
| Dev deps | 23 | 24 | +1 | - |

**Notable changes:**
- JS bundle grew by 60 KB (2.3% increase)
- New routes added: `/api/admin/agent-reports`, `/api/suggestions`
- Build output grew by 43 MB (mostly static files and build cache)

---

## Action Plan

| Priority | Action | Savings | Effort | Status |
|----------|--------|---------|--------|--------|
| 1 | Remove framer-motion, use CSS | ~150 KB | Low | ✅ Done |
| 2 | Lazy-load PostHog | ~100 KB | Medium | ✅ Done |
| 3 | Move PDF deps to devDependencies | 0 KB (clarity) | Trivial | ✅ Done |

**Completed optimizations:**
- **framer-motion removed** (2026-02-02): Replaced with CSS animations and Tailwind classes in `language-switcher.tsx` and `category-filter-badge.tsx`. Estimated savings: ~150 KB.
- **PostHog lazy-loaded** (2026-02-02): Moved from static import to dynamic import in `useEffect`. PostHog now loads after hydration, removing ~100 KB from the critical path. The app renders immediately while PostHog loads in the background.
- **PDF deps moved to devDependencies** (2026-02-02): `pdfjs-dist` and `pdf-parse` are only used in build scripts (`scripts/process-pdfs.ts`, `scripts/extract-images.ts`), not in the client bundle. Moving to devDependencies clarifies their purpose.

**Estimated total savings: ~250 KB** (should bring bundle under budget at ~2,410 KB)

**All performance optimizations complete.**

---

## Build Output

```
Route (app)
┌ ○ /                              (Static)
├ ○ /_not-found                    (Static)
├ ○ /admin                         (Static)
├ ƒ /api/admin/agent-reports       (Dynamic)
├ ƒ /api/admin/analytics           (Dynamic)
├ ƒ /api/admin/elevenlabs-analytics (Dynamic)
├ ƒ /api/admin/feature-flags/[key] (Dynamic)
├ ƒ /api/admin/marketing/accounts  (Dynamic)
├ ƒ /api/admin/marketing/agent     (Dynamic)
├ ƒ /api/admin/marketing/agent-logs (Dynamic)
├ ƒ /api/admin/marketing/dashboard (Dynamic)
├ ƒ /api/admin/marketing/posts     (Dynamic)
├ ƒ /api/admin/marketing/schedule  (Dynamic)
├ ƒ /api/admin/stories             (Dynamic)
├ ƒ /api/admin/stories/[id]        (Dynamic)
├ ƒ /api/admin/stories/[id]/content-images (Dynamic)
├ ƒ /api/admin/stories/[id]/image  (Dynamic)
├ ƒ /api/admin/stories/[id]/image-source (Dynamic)
├ ƒ /api/admin/stories/[id]/status (Dynamic)
├ ƒ /api/admin/stories/bulk-delete (Dynamic)
├ ƒ /api/admin/stories/bulk-status (Dynamic)
├ ƒ /api/admin/suggestions         (Dynamic)
├ ƒ /api/admin/suggestions/[id]    (Dynamic)
├ ƒ /api/chat                      (Dynamic)
├ ƒ /api/chat/stream               (Dynamic)
├ ƒ /api/favorites                 (Dynamic)
├ ƒ /api/feature-flags             (Dynamic)
├ ƒ /api/health                    (Dynamic)
├ ƒ /api/suggestions               (Dynamic)
└ ...29 routes total
```

---

## Disk Usage

| Directory | Size | Notes |
|-----------|------|-------|
| node_modules | 863 MB | Includes dev tools, PDF processing |
| .next | 991 MB | Build cache + static assets |

---

*Report generated by Performance Agent*
