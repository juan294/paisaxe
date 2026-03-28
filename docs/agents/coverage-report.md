# Test Coverage Report (ARCHIVED)

> **ARCHIVED**: This standalone report has been consolidated into the unified Codebase Health Check.
> See `docs/health-report-[DATE].md` for the latest coverage data.
> This file is kept for historical reference only and is no longer updated.

> Last updated: 2026-03-28

## Summary

- **Total tests:** 5683 passed (+5 from 5678)
- **Test files:** 305 passed (100%) (+1 new file)
- **Statement coverage:** 98.69% (unchanged)
- **Branch coverage:** 96.44% (+0.08% from 96.36%)
- **Function coverage:** 98.71% (unchanged)
- **Line coverage:** ~99.09% (unchanged)
- **TypeScript:** No errors
- **Lint:** No errors

This cycle added 5 new tests across 6 files targeting branch and statement gaps. One new test file was created for the `use-stories` cache-hit path. Branch coverage improved through `stories-server.ts` non-Error error handling, `sitemap.ts` slug fallback, `category-filter-badge.tsx` click-outside/escape behaviors, and `suggest-place-dialog.tsx` loading-state close prevention. The `use-stories.test.ts` was refactored from `vi.resetModules()` to static imports with `clearStoriesCache()` for better V8 coverage tracking.

*Note: Coverage percentages fluctuate slightly as coverage scope expands to include more files.*

## Changes This Cycle (2026-03-28)

### New Tests Written (+5 tests across 6 files)

#### New Test Files

| File | What Was Covered |
|------|------------------|
| `use-stories.cache-hit.test.ts` | Dedicated test for `fetchStories` cache-hit path (line 142) — uses `Date.now()` mocking to make focus handler think cache is stale while `fetchStories` sees it as fresh |

#### Branch Improvements

| File | What Was Covered |
|------|------------------|
| `stories-server.ts` | Non-Error thrown value in catch block — `String(error)` branch at line 66 |
| `sitemap.ts` | Story slug fallback to `story.id` when `slug` is falsy (line 15) |
| `category-filter-badge.tsx` | Click-outside handler (line 50) and Escape key handler (line 64) |
| `suggest-place-dialog.tsx` | Loading-state close prevention in `handleOpenChange` (line 89) |

#### Test Infrastructure Improvements

| File | What Changed |
|------|--------------|
| `use-stories.test.ts` | Refactored from `vi.resetModules()` + dynamic imports to static imports with `clearStoriesCache()` — improves V8 coverage tracking reliability |

### Files with Documented Untestable Branches (Unchanged)

All previously documented untestable branches remain unchanged. See "Untestable Branches Documented" section below.

## Changes Previous Cycle (2026-03-27)

### New Tests Written (+18 tests across 7 files)

#### Files Reaching 100% Branch (5 files)

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `stories-data.ts` | 94.84% -> **100%** | DB error during build phase (isBuildPhase=true) for all 5 fetch functions (lines 42, 79, 112, 145, 178) -- `console.warn` suppression path |
| `costs-analytics-panel/alerts.tsx` | 98.3% -> **100%** | `useEffect` false-guard path when usageMetrics already loaded (line 49) |
| `costs-analytics-panel/forecast.tsx` | 96.87% -> **100%** | `useEffect` false-guard path when usageMetrics already loaded (line 35) |
| `admin/analytics/route.ts` | 98.95% -> **100%** | Non-Error value thrown in catch block (line 404) |
| `admin/stripe-analytics/route.ts` | 98.18% -> **100%** | Empty currency string fallback to EUR (line 15) |

#### API Route Branch Improvements

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `admin/costs-analytics/route.ts` | 92.42% -> **98.48%** | Recurring cost deduplication when serviceId already covered (line 91), missing `agents` array fallback (line 257), missing `conversations` array fallback (line 291), missing `agent_id` field fallback (line 300) |
| `mcp/places/route.ts` | 98.81% -> **100%** | Type filtering with underscored valid types like `meal_delivery`, `tourist_attraction` (line 143) |
| `mcp/make-booking/route.ts` | 96.87% -> **97.91%** | `:45` time at non-12 hour (13:45 -> "dos menos cuarto de la tarde") (line 157) |

#### Chat Action Detection Branch Improvements

| File | What Was Covered |
|------|------------------|
| `chat-action-detection.ts` | 6 new tests for address overlap/adjacency deduplication (lines 371-377), place-name-covered-by-address dedup (lines 427-430), seenTexts dedup (line 417) |

### Files Reaching 100% Branch Coverage This Cycle (5 files)

`stories-data.ts`, `costs-analytics-panel/alerts.tsx`, `costs-analytics-panel/forecast.tsx`, `admin/analytics/route.ts`, `admin/stripe-analytics/route.ts`

## Changes Previous Cycle (2026-03-26)

### New Tests Written (+12 tests across 6 files)

#### API Routes Reaching 100% Branch

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `health/route.ts` | 93.54% -> **100%** | Null stories data `?? 0` fallback (line 75), non-Error exception in checkStories catch (line 85 both branches) |
| `chat/stream/route.ts` | 93.75% -> **100%** | Asturianu feature flag `enabled: true` path (line 106), null flagData `?? false` fallback |
| `marketing/agent/route.ts` | 95.83% -> **100%** | Agent without voice config returning `undefined` (line 224 false branch) |

#### Component Branch Improvements

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `fullscreen-button.tsx` | 91.3% -> **95.65%** | iPad Pro detection via `navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1` (line 26) |
| `visitors-analytics-panel.tsx` | -- | OS data (section 08) and Screen Size data (section 09) rendering with multiple items |
| `elevenlabs-analytics-panel.tsx` | -- | Skeleton recent conversations table rendering during loading state (line 544) -- verifies 5 skeleton rows with pulse animations |

### Files Reaching 100% Branch Coverage This Cycle (3 files)

`health/route.ts`, `chat/stream/route.ts`, `marketing/agent/route.ts`

## Changes Previous Cycle (2026-03-25)

### New Tests Written (+43 tests across 12 files)

#### New Test Files

| File | Coverage Change | What Was Covered |
|------|----------------|------------------|
| `pricing/loading.test.tsx` | 0% -> **100%** | New test file for the pricing page skeleton loading component |

#### PostHog Provider (Major Improvement)

| File | Coverage Change | What Was Covered |
|------|----------------|------------------|
| `posthog-provider.tsx` | 61.76% -> **~90%+** | Production hostname mocking, PostHog initialization (lines 75-101), PostHogProvider rendering (line 114), pageview capture with/without search params (lines 32-36), `__loaded` skip path, `window.posthog` global singleton, `api_host` env var |

#### API Route Branch Coverage

| File | What Was Covered |
|------|------------------|
| `github-analytics/route.ts` | Default date fallbacks (lines 21-23), null data arrays for `?.` branches (lines 64-65, 82-83, 100), catch block date range fallback (lines 133-134) |
| `subscription-optimizer/route.ts` | Non-Error throw (line 99), admin auth fallback (lines 118-119), empty POST body (lines 124-132) |
| `chat/route.ts` | Various optional chaining and conditional branches |
| `checkout/day-pass/route.ts` | Undefined `user.email` fallback (line 63), non-Error throw (line 75) |
| `checkout/embedded/route.ts` | Undefined `user.email` fallback (line 63), non-Error throw (line 74) |
| `checkout/health/route.ts` | Null `unit_amount` fallback (line 77), non-Error throw (line 88) |
| `marketing/dashboard/route.ts` | Various branch gaps (lines 164, 173, 179-209) |
| `agents-summary/route.ts` | Various branch gaps (lines 34, 104, 148-151) |
| `elevenlabs-analytics/route.ts` | Various branch gaps (lines 112-120, 135) |

#### Visitors Analytics Panel

| File | What Was Covered |
|------|------------------|
| `visitors-analytics-panel.tsx` | NewVsReturningBar percentage display threshold (lines 613, 619) -- segment <= 10% hides label |

## Changes Previous Cycle (2026-03-24)

### New Tests Written (+19 tests across 10 files)

#### Hooks

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `use-reduced-motion.ts` | 50% -> **100%** | SSR guard via useState initializer capture -- simulates `typeof window === "undefined"` by extracting and calling the initializer with `window` temporarily deleted |
| `use-voice-session.ts` | 85% -> **90%** | SSR guard (line 53) via node-environment test with `renderToString` -- new test file `use-voice-session.ssr.test.ts` |

#### Lib Modules

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `localize-story.ts` | 86.66% -> **100%** | Empty title/description fallbacks to Spanish originals (lines 30, 32) |
| `posting-service.ts` | 94.44% -> **100%** | Null `media_urls`, `hashtags`, `engagement` fallback defaults in `rowToPost` (lines 243-252) |
| `stories-data.ts` | 93.81% -> **94.84%** | Non-JWT anon key fallback (line 30) |

#### Admin Components

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `account-config-dialog.tsx` | 95% -> **97.5%** | Empty accountName trim fallback to "Paisaxe" (line 67) |
| `costs-analytics-panel/forecast.tsx` | -- | `!usageMetrics` false branch in useEffect (line 35) -- no re-fetch when data loaded |
| `costs-analytics-panel/alerts.tsx` | -- | `!usageMetrics` false branch in useEffect (line 49) -- no re-fetch when data loaded |

#### Editor Hooks

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `use-story-editor-save.ts` | 96.05% -> **100%** | Empty imageSource fallback to undefined on upload (line 124), content image (line 126), and undefined `story.imageSource` fallback to empty string (line 127) |

#### Immersive Components

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `author-typewriter.tsx` | -- | 10 new cancellation guard tests covering lines 51, 57, 65, 82-94 (async timing; V8 may not register due to fake timer instrumentation limitations) |

### Files Reaching 100% Branch Coverage This Cycle (4 files)

`use-reduced-motion.ts`, `localize-story.ts`, `posting-service.ts`, `use-story-editor-save.ts`

### Untestable Branches Documented (No Test Changes)

| File | Branch | Why Untestable |
|------|--------|----------------|
| `use-voice-session.ts:75-111` | SSR guard | `typeof window === "undefined"` / `typeof navigator !== "undefined"` -- jsdom always has both |
| `immersive-page-content.tsx:73` | SSR guard | Same pattern -- `useState` initializer SSR check |
| `elevenlabs-agents.ts:44` | `as const` guard | Empty-string fallback on hardcoded const values; mocking tests the mock |
| `claude.ts:323` | Exhaustiveness guard | Post-loop throw unreachable -- loop always returns/throws |
| `post-row.tsx:18` | Dead guard | `formatDate` null check; JSX `&&` ensures `dateStr` is always truthy |
| `use-stories.ts:142` | Race condition guard | Callers always pre-check staleness before calling `fetchStories` |
| `story-editor-dialog/index.tsx:40-84` | V8 merge artifact + null guards | V8 coverage merge conflict across workers with different mock configs; defensive null checks unreachable (component returns null before rendering UI when `!story`) |
| `embedding-cache.ts:55` | Dead guard | Map always has entries when `size >= maxSize` |
| `posthog-query.ts:70` | Dead guard | `isRetryable` requires `Error` instance; `"unknown error"` unreachable |
| `posthog-provider.tsx:17` | SSR guard | `typeof window === "undefined"` -- jsdom always has `window` |
| `language-switcher.tsx:72-75` | Dead guard | Listbox/options always present after render |
| `modals.tsx:99` | Dead guard | Input only renders when `serviceId === "custom"` |
| `translate-story.ts:131` | Dead guard | `JSON.parse` always throws `SyntaxError` (extends `Error`) |
| `translate-story.ts:241` | Dead guard | `parseTranslationResponse` always sets `error` when `success=false` |
| `subscription-optimizer.ts:160` | Dead guard | Undefined `usedFeatures` routes to "review" branch before reaching `?? []` |
| `story-progress-bar.tsx:86` | Dead guard | Home key guard; `base` always `>= 0` by construction |
| `story-viewer.tsx:559` | Dead guard | Component returns null before `BookmarkButton` when story undefined |
| `image-optimization.ts:130-131` | Dead code | JPEG case in switch -- only avif/webp used by callers |
| `chat-action-detection.ts:321` | Dead code | Trailing period removal -- regex character classes never capture `.` |
| `i18n/provider.tsx:25-26` | Dead code | es/en lazy loaders for pre-cached locales never called |
| `suggest-place-dialog.tsx:89` | Dead guard | Radix Dialog never calls `onOpenChange(true)` in test environments |
| `toolbar-overflow-menu.tsx:67` | Dead guard | React synchronously sets ref during render |
| `elevenlabs-analytics-panel.tsx:270,471` | Dead guard | StatCard/SkeletonStatCard color fallbacks -- all callers pass valid colors |
| `github-analytics-panel.tsx:238` | Dead guard | StatCard color fallback -- all callers pass valid colors |
| `stripe-analytics-panel.tsx:225,244,531` | Dead guard | StatCard color fallback, RevenueChart empty guard, OrderStatusBadge status fallback |
| `visitors-analytics-panel.tsx:544` | Dead guard | UTMTable empty guard -- parent checks `utmCampaigns.length > 0` before rendering |
| `admin/page.tsx:821` | Dead code | StatCard non-clickable variant -- all current usages pass `onClick`; not exported |
| `author-typewriter.tsx:17,43` | Ref null guard | React always assigns ref during render in jsdom |
| `author-typewriter.tsx:51-94` | Async timing | V8 coverage instrumentation limitation with async/await + fake timers |
| `use-story-editor.ts:179` | V8 artifact | Line beyond EOF -- v8 coverage artifact at module boundary |
| `account-config-dialog.tsx:47` | Dead guard | Component returns null before UI renders, so `handleSave` never invoked without platform |
| `make-booking/route.ts:137,158` | Dead guard | `numbers[hour12] \|\| String(hour12)` -- hour12 is always 1-12 and all values exist in map |
| `agents/run/route.ts:130,139` | Dead guard | `String.split().pop()` never returns undefined |
| `agents-summary/route.ts:34` | Dead guard | All agent flagKeys end with `_enabled` |
| `costs-analytics/route.ts:272` | Dead guard | Config agent IDs are always non-empty strings |

### Statement Coverage Plateau (Confirmed at 98.69%)

All remaining uncovered source files were re-audited. Every uncovered statement falls into one of 5 categories:

1. **SSR guards** (`typeof window === "undefined"`) -- 10 lines across 5 files. jsdom always has `window`.
2. **Architecturally unreachable defensive guards** -- ~45 lines. Parent-level checks prevent reaching child guards (e.g., chart sub-components guarded by parent conditionals, story-null checks in handlers that only render when story exists).
3. **Async cancellation guards** -- 10 lines in author-typewriter. V8 instrumentation doesn't register coverage with fake timers.
4. **Dead code paths** -- 5 lines. Regex never captures periods, TypeScript safety nets, JPEG branch never used.
5. **SDK dependencies** -- ~72 lines. ElevenLabs, PostHog, complex browser APIs require Playwright E2E.

### Low-Coverage Files (Require E2E)

| File | Stmts | Branch | Why |
|------|-------|--------|-----|
| `voice-agent-chat.tsx` | 45.6% | 42.9% | ElevenLabs SDK, WebSocket connections |
| `agents-dashboard/index.tsx` | 48.5% | 47.8% | Complex dialog state, terminal emulation |

These 2 files account for the bulk of the remaining coverage gap and require Playwright E2E tests for meaningful improvement.

### Source Code Bugs Found (Not Fixed -- Test-Only Changes)

- **`story-editor-dialog/index.tsx`**: Disconnected fullscreen state -- `state.isFullscreen` (line 267) and `imageEditor.setIsFullscreen` (use-image-editor.ts line 75) are two separate `useState(false)` hooks. Nothing ever sets `state.isFullscreen` to `true`, so the fullscreen overlay in `index.tsx` can never render through normal user interaction.

## Cross-Agent Recommendations

- **Performance Agent**: No new dependencies added. All test additions are devDependency-only. No impact on bundle size.
- **Code Quality Agent**: Dead code still present: `chat-action-detection.ts` trailing-period removal (line 321 -- regex never captures `.`), JPEG branch in `image-optimization.ts` (lines 130-131), `i18n/provider.tsx` es/en lazy loaders (lines 25-26). Consider removing. `subscription-optimizer.ts:160` `?? []` is dead (undefined routes to "review" first). `story-editor-dialog/index.tsx` has disconnected fullscreen state -- `state.isFullscreen` never set to `true`.
- **Security Agent**: All webhook and MCP error paths remain fully covered. No regression. Health endpoint at 100% branch. Chat/stream route at 100% branch. 3 new API routes at 100% branch this cycle.
- **QA Agent**: No new testability gaps. The 2 SDK-dependent components need Playwright E2E tests for further coverage.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
