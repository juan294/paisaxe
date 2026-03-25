# Test Coverage Report (ARCHIVED)

> **ARCHIVED**: This standalone report has been consolidated into the unified Codebase Health Check.
> See `docs/health-report-[DATE].md` for the latest coverage data.
> This file is kept for historical reference only and is no longer updated.

> Last updated: 2026-03-25

## Summary

- **Total tests:** 5648 passed (+43 from 5605)
- **Test files:** 304 passed (100%)
- **Statement coverage:** 98.68% (+0.16%)
- **Branch coverage:** 96.08% (+0.67% from 95.41%)
- **Function coverage:** 98.71% (+0.26%)
- **Line coverage:** ~99.08% (+0.16%)
- **TypeScript:** ✅ No errors

**Branch coverage crossed 96%.** This cycle added 43 new tests targeting the PostHog provider production initialization path, a new pricing/loading.tsx skeleton, visitors-analytics-panel percentage thresholds, and branch gaps across 7 API routes (github-analytics, subscription-optimizer, chat, checkout/day-pass, checkout/embedded, checkout/health, marketing/dashboard, agents-summary, elevenlabs-analytics). PostHog provider coverage jumped from 61.76% to ~90%+ with production hostname mocking. Statement coverage rose to 98.68%.

*Note: Coverage percentages fluctuate slightly as coverage scope expands to include more files.*

## Changes This Cycle (2026-03-25)

### New Tests Written (+43 tests across 12 files)

#### New Test Files

| File | Coverage Change | What Was Covered |
|------|----------------|------------------|
| `pricing/loading.test.tsx` | 0% → **100%** | New test file for the pricing page skeleton loading component |

#### PostHog Provider (Major Improvement)

| File | Coverage Change | What Was Covered |
|------|----------------|------------------|
| `posthog-provider.tsx` | 61.76% → **~90%+** | Production hostname mocking, PostHog initialization (lines 75-101), PostHogProvider rendering (line 114), pageview capture with/without search params (lines 32-36), `__loaded` skip path, `window.posthog` global singleton, `api_host` env var |

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
| `visitors-analytics-panel.tsx` | NewVsReturningBar percentage display threshold (lines 613, 619) — segment <= 10% hides label |

## Changes Previous Cycle (2026-03-24)

### New Tests Written (+19 tests across 10 files)

#### Hooks

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `use-reduced-motion.ts` | 50% → **100%** | SSR guard via useState initializer capture — simulates `typeof window === "undefined"` by extracting and calling the initializer with `window` temporarily deleted |
| `use-voice-session.ts` | 85% → **90%** | SSR guard (line 53) via node-environment test with `renderToString` — new test file `use-voice-session.ssr.test.ts` |

#### Lib Modules

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `localize-story.ts` | 86.66% → **100%** | Empty title/description fallbacks to Spanish originals (lines 30, 32) |
| `posting-service.ts` | 94.44% → **100%** | Null `media_urls`, `hashtags`, `engagement` fallback defaults in `rowToPost` (lines 243-252) |
| `stories-data.ts` | 93.81% → **94.84%** | Non-JWT anon key fallback (line 30) |

#### Admin Components

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `account-config-dialog.tsx` | 95% → **97.5%** | Empty accountName trim fallback to "Paisaxe" (line 67) |
| `costs-analytics-panel/forecast.tsx` | — | `!usageMetrics` false branch in useEffect (line 35) — no re-fetch when data loaded |
| `costs-analytics-panel/alerts.tsx` | — | `!usageMetrics` false branch in useEffect (line 49) — no re-fetch when data loaded |

#### Editor Hooks

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `use-story-editor-save.ts` | 96.05% → **100%** | Empty imageSource fallback to undefined on upload (line 124), content image (line 126), and undefined `story.imageSource` fallback to empty string (line 127) |

#### Immersive Components

| File | Branch Change | What Was Covered |
|------|---------------|------------------|
| `author-typewriter.tsx` | — | 10 new cancellation guard tests covering lines 51, 57, 65, 82-94 (async timing; V8 may not register due to fake timer instrumentation limitations) |

### Files Reaching 100% Branch Coverage This Cycle (4 files)

`use-reduced-motion.ts`, `localize-story.ts`, `posting-service.ts`, `use-story-editor-save.ts`

### Untestable Branches Documented (No Test Changes)

| File | Branch | Why Untestable |
|------|--------|----------------|
| `use-reduced-motion.ts:14` | SSR guard | ~~`typeof window === "undefined"` — jsdom always has `window`~~ **NOW COVERED** via useState initializer capture |
| `use-voice-session.ts:53` | SSR guard | **PARTIALLY COVERED** — node-environment test covers line 53; lines 75-111 remain (session read/write) |
| `immersive-page-content.tsx:73` | SSR guard | Same pattern — `useState` initializer SSR check |
| `elevenlabs-agents.ts:44` | `as const` guard | Empty-string fallback on hardcoded const values; mocking tests the mock |
| `claude.ts:323` | Exhaustiveness guard | Post-loop throw unreachable — loop always returns/throws |
| `post-row.tsx:18` | Dead guard | `formatDate` null check; JSX `&&` ensures `dateStr` is always truthy |
| `use-stories.ts:142` | Race condition guard | Callers always pre-check staleness before calling `fetchStories` |
| `story-editor-dialog/index.tsx:40-84` | V8 merge artifact + null guards | V8 coverage merge conflict across workers with different mock configs; defensive null checks unreachable (component returns null before rendering UI when `!story`) |
| `embedding-cache.ts:55` | Dead guard | Map always has entries when `size >= maxSize` |
| `posthog-query.ts:70` | Dead guard | `isRetryable` requires `Error` instance; `"unknown error"` unreachable |
| `language-switcher.tsx:72-75` | Dead guard | Listbox/options always present after render |
| `modals.tsx:99` | Dead guard | Input only renders when `serviceId === "custom"` |
| `translate-story.ts:131` | Dead guard | `JSON.parse` always throws `SyntaxError` (extends `Error`) |
| `translate-story.ts:241` | Dead guard | `parseTranslationResponse` always sets `error` when `success=false` |
| `subscription-optimizer.ts:160` | Dead guard | Undefined `usedFeatures` routes to "review" branch before reaching `?? []` |
| `story-progress-bar.tsx:86` | Dead guard | Home key guard; `base` always `>= 0` by construction |
| `story-viewer.tsx:559` | Dead guard | Component returns null before `BookmarkButton` when story undefined |
| `image-optimization.ts:130-131` | Dead code | JPEG case in switch — only avif/webp used by callers |
| `chat-action-detection.ts:321` | Dead code | Trailing period removal — regex character classes never capture `.` |
| `i18n/provider.tsx:25-26` | Dead code | es/en lazy loaders for pre-cached locales never called |
| `suggest-place-dialog.tsx:89` | Dead guard | Radix Dialog never calls `onOpenChange(true)` in test environments |
| `toolbar-overflow-menu.tsx:67` | Dead guard | React synchronously sets ref during render |
| `elevenlabs-analytics-panel.tsx:270,471` | Dead guard | StatCard/SkeletonStatCard color fallbacks — all callers pass valid colors |
| `github-analytics-panel.tsx:238` | Dead guard | StatCard color fallback — all callers pass valid colors |
| `stripe-analytics-panel.tsx:225,531` | Dead guard | StatCard color fallback and OrderStatusBadge status fallback — all callers pass valid values |
| `author-typewriter.tsx:17,43` | Ref null guard | React always assigns ref during render in jsdom; after unmount, `cancelled=true` prevents `setText` from being called |
| `author-typewriter.tsx:51-94` | Async timing | V8 coverage instrumentation limitation with async/await + fake timers — tests written and passing but V8 doesn't register coverage |
| `use-story-editor.ts:179` | V8 artifact | Line beyond EOF — v8 coverage artifact at module boundary |
| `account-config-dialog.tsx:47` | Dead guard | Component returns null before UI renders, so `handleSave` never invoked without platform |
| `make-booking/route.ts:137,157-158` | Dead guard | `numbers[hour12] \|\| String(hour12)` — hour12 is always 1-12 and all values exist in map |
| `stories-data.ts:42,79,112,145,178` | Defensive guards | Repeated `!key.startsWith("eyJ")` pattern across fallback story functions — covered for one, structurally identical for rest |

### Statement Coverage Plateau (Confirmed at 98.68%)

All remaining uncovered source files were re-audited. Every uncovered statement falls into one of 5 categories:

1. **SSR guards** (`typeof window === "undefined"`) — 10 lines across 5 files. jsdom always has `window`.
2. **Architecturally unreachable defensive guards** — ~45 lines. Parent-level checks prevent reaching child guards (e.g., chart sub-components guarded by parent conditionals, story-null checks in handlers that only render when story exists).
3. **Async cancellation guards** — 10 lines in author-typewriter. V8 instrumentation doesn't register coverage with fake timers.
4. **Dead code paths** — 5 lines. Regex never captures periods, TypeScript safety nets, JPEG branch never used.
5. **SDK dependencies** — ~72 lines. ElevenLabs, PostHog, complex browser APIs require Playwright E2E.

### Low-Coverage Files (Require E2E)

| File | Stmts | Branch | Why |
|------|-------|--------|-----|
| `voice-agent-chat.tsx` | 45.6% | 42.9% | ElevenLabs SDK, WebSocket connections |
| `agents-dashboard/index.tsx` | 48.5% | 47.8% | Complex dialog state, terminal emulation |

These 2 files account for the bulk of the remaining coverage gap and require Playwright E2E tests for meaningful improvement. `posthog-provider.tsx` was improved from 61.8% to ~90%+ this cycle via production hostname mocking.

### Source Code Bugs Found (Not Fixed — Test-Only Changes)

- **`story-editor-dialog/index.tsx`**: Disconnected fullscreen state — `state.isFullscreen` (line 267) and `imageEditor.setIsFullscreen` (use-image-editor.ts line 75) are two separate `useState(false)` hooks. Nothing ever sets `state.isFullscreen` to `true`, so the fullscreen overlay in `index.tsx` can never render through normal user interaction.

## Cross-Agent Recommendations

- **Performance Agent**: No new dependencies added. All test additions are devDependency-only. No impact on bundle size.
- **Code Quality Agent**: Dead code still present: `chat-action-detection.ts` trailing-period removal (line 321 — regex never captures `.`), JPEG branch in `image-optimization.ts` (lines 130-131), `i18n/provider.tsx` es/en lazy loaders (lines 25-26). Consider removing. `subscription-optimizer.ts:160` `?? []` is dead (undefined routes to "review" first). `story-editor-dialog/index.tsx` has disconnected fullscreen state — `state.isFullscreen` never set to `true`.
- **Security Agent**: All webhook and MCP error paths remain fully covered. No regression. API route branch coverage stable at high levels.
- **QA Agent**: No new testability gaps. The 3 SDK-dependent components need Playwright E2E tests for further coverage. Journey tests at 100% — consider adding chat interaction coverage.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
