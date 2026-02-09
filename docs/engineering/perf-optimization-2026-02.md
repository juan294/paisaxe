# Performance Optimization — February 2026 (Speed Insights)

> Completed: 2026-02-09
> Trigger: Vercel Speed Insights showing Real Experience Score (RES) of 88 (target >90)

## Context

Site launched Feb 8, 2026. Vercel Speed Insights identified two routes needing attention:

| Route | RES Before | Primary Issues |
|-------|-----------|----------------|
| `/admin` (Desktop) | 42 (Poor) | INP 344ms, heavy initial JS from 5 analytics sub-panels + 3 static dialog imports |
| `/immersive` (Mobile) | 85 (Needs Improvement) | INP 376ms (typewriter re-renders), FCP 2.06s (LanguageProvider null return), LCP 2.26s |
| USA visitors (Mobile) | 58 | Geographic latency to EU-hosted Supabase |

## Completed Optimizations

### Priority 1: High Impact

#### 1A. Lazy-Mount Analytics Sub-Panels (`/admin`)
**Target:** INP, initial JS execution
**File:** `src/components/admin/analytics-dashboard.tsx`

Previously all 5 sub-panels (~4,000 lines) mounted simultaneously with `display:none`. Changed to track visited tabs — panels only mount on first tab click, then stay mounted for cache preservation.

```tsx
const [visitedTabs, setVisitedTabs] = useState<Set<AnalyticsSubTab>>(new Set(["visitors"]));
// Only mount visited panels; display:none hides inactive ones
```

**Impact:** Initial mount reduced from ~4,000 lines to ~810 lines (Visitors only). Cache behavior via `AnalyticsCacheProvider` unchanged.

#### 1B. Lazy-Mount Top-Level Admin Tabs (`/admin`)
**File:** `src/app/admin/page.tsx`

Applied same visited-tabs pattern at top level. Previously tabs unmounted on switch (losing state, triggering refetches). Now visited panels persist with `display:none`.

#### 1C. Typewriter Animation Optimization (`/immersive` mobile)
**Target:** INP (376ms)
**Files:** `src/components/immersive/story-viewer.tsx` → extracted to `src/components/immersive/author-typewriter.tsx`

The typewriter called `setTypewriterText()` per character at 80ms intervals, re-rendering the entire 809-line StoryViewer each time.

**Changes:**
1. Extracted into standalone `AuthorTypewriter` component
2. Uses `ref` to update DOM text directly (`spanRef.current.textContent`) instead of React state
3. Uses `requestAnimationFrame` for timing instead of `setTimeout`
4. Parent StoryViewer no longer re-renders on character changes

#### 1D. Eliminate LanguageProvider Render-Blocking (`/immersive` mobile)
**Target:** FCP (2.06s)
**File:** `src/lib/i18n/provider.tsx`

Previously returned `null` until locale detection completed in a `useEffect`, blocking the entire render tree for one frame. Moved `resolveLocale()` into the `useState` initializer (reads `localStorage` and `navigator.language` — both synchronous on client).

### Priority 2: Medium Impact

#### 2A. Lazy-Load Translation Files
**Target:** FCP/LCP, bundle size (~65KB savings)
**File:** `src/lib/i18n/provider.tsx`

All 6 locale files were statically imported. Changed to keep `es` (default) and `en` as static imports, dynamic-import others. Cached in module-level `Map` for instant subsequent switches.

#### 2B. Dynamic-Import Admin Dialogs (`/admin`)
**Target:** Initial bundle parse time
**File:** `src/app/admin/page.tsx`

`StoryEditorDialog`, `CreateStoryDialog`, and `SelectionToolbar` converted to `dynamic()` with `ssr: false`. Only loaded when modals are opened.

#### 2C. Extract & Memoize Progress Bar (`/immersive` mobile)
**Target:** INP
**File:** `src/components/immersive/story-viewer.tsx` → `src/components/immersive/story-progress-bar.tsx`

Progress bar (up to 20 interactive elements with inline handlers) extracted to a `React.memo`-wrapped component with event delegation via data attributes.

#### 2D. Wrap Navigation State in `startTransition` (`/immersive` mobile)
**Target:** INP
**File:** `src/app/immersive/immersive-page-content.tsx`

Wrapped `setCurrentIndex` (story navigation) in `startTransition` so the browser can process touch events between render chunks.

#### 2E. Remove Unused Font Preconnects (all routes)
**Target:** FCP (~20-50ms)
**File:** `src/app/layout.tsx`

Removed `fonts.googleapis.com` and `fonts.gstatic.com` preconnects — `next/font/google` self-hosts Inter, making these wasted DNS lookups.

## Not Yet Implemented (Priority 3)

These items were deferred pending RES measurement after P1+P2:

| Item | Description | Status |
|------|-------------|--------|
| 3A. Edge-Cached Stories API | Edge API route with `Cache-Control` headers for US users | Pending — measure USA RES impact from P1+P2 first |
| 3B. Preload First Story Image | Server-side `<link rel="preload">` for first story image | Pending — requires server-side Supabase query + shuffle seed handling |

## Expected vs Actual Impact

| Route | Before | Expected After P1+P2 | Actual (measure after 24-48h) |
|-------|--------|---------------------|-------------------------------|
| `/admin` (Desktop) | 42 | ~75-85 | Pending measurement |
| `/immersive` (Mobile) | 85 | ~92-95 | Pending measurement |
| USA visitors (Mobile) | 58 | ~60-65 | Pending measurement |

## Key Files Modified

| File | Change | Priority |
|------|--------|----------|
| `src/components/admin/analytics-dashboard.tsx` | Visited-tabs lazy mounting | P1 |
| `src/app/admin/page.tsx` | Visited-tabs + dynamic dialog imports | P1+P2 |
| `src/components/immersive/author-typewriter.tsx` | **New** — extracted from story-viewer | P1 |
| `src/components/immersive/story-viewer.tsx` | Typewriter extraction + progress bar extraction | P1+P2 |
| `src/components/immersive/story-progress-bar.tsx` | **New** — memoized with event delegation | P2 |
| `src/lib/i18n/provider.tsx` | Synchronous init + lazy translation loading | P1+P2 |
| `src/app/immersive/immersive-page-content.tsx` | `startTransition` wrapping | P2 |
| `src/app/layout.tsx` | Removed unused font preconnects | P2 |

## Patterns Established

### Visited-Tabs Lazy Mounting
For tab-based UIs with expensive panels, track which tabs have been visited and only mount a panel on first click. Keep mounted panels alive with `display:none` to preserve state and caches.

### DOM-Direct Animation Updates
For high-frequency UI updates (typewriter, counters, timers), use `ref.current.textContent` instead of React state to avoid triggering re-renders of parent components.

### Event Delegation in Repeated Elements
For components rendering many similar interactive elements (progress dots, list items), use a single event handler on the container with `data-*` attributes instead of individual handlers.

### Translation Lazy Loading
Keep the default locale statically imported for zero-latency rendering. Dynamic-import other locales on demand with a module-level cache.

---

*Documented: 2026-02-09*
*Related: Performance Optimization Plan (`/Users/juan/.claude/plans/immutable-sparking-pinwheel.md`)*
