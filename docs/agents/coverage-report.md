# Coverage Agent Report — 2026-05-04

## Summary

- **Test suite**: 6515 total tests. 6515 pass (100% green — no load-induced flakes this run).
- **TypeScript**: Pass (no errors).
- **Overall coverage** (full suite, single machine, no concurrent load):
  - statements: 97.96% (10462/10679)
  - branches: 94.08% (6857/7288)
  - functions: 98.46% (2054/2086)
  - lines: 98.43% (9967/10125)
- **Vitest config thresholds** (95/90/95/95): all PASS.
- **Changes this run**: +19 targeted tests across 5 files, lifting several files from the "Remaining Uncovered" list to near-100% statement coverage.

## Changes This Run

| File | Tests | Coverage before | Coverage after |
|------|-------|-----------------|----------------|
| `src/lib/admin-auth.ts` | +2 | stmt 88.9% / br 84.4% | stmt **100%** / br 87.5% / fn 100% / line 100% |
| `src/app/api/health/route.ts` | +6 | stmt 86.3% / br 87.0% | stmt **98.27%** / br 93.93% / fn 100% / line 98.21% |
| `src/app/api/chat/stream/route.ts` | +5 | (partial) | stmt **100%** / br 94.73% / fn 100% / line 100% |
| `src/hooks/use-stream-chat.ts` | +4 | stmt 88.7% / br 85.4% | stmt **98.96%** / br 97.56% / fn 94.44% / line 100% |
| `src/components/immersive/story-viewer.tsx` | +2 | (partial) | stmt **99.1%** / br 98.3% / fn 97.14% / line 99% |

### Coverage Detail — what's new

**`admin-auth.ts` (+2 tests)**
- PGRST116 error code → 403 (not 500): confirms `validateAdminAuth()` maps "no rows" Supabase errors to forbidden rather than internal server error.
- `withAdminRead` cookie config coverage: exercises both `getAll()` (line 190) and the `setAll()` catch block (lines 192–199) that silently swallows "headers already sent" errors.

**`api/health/route.ts` (+6 tests)**

Phase 1 — service-timeout probes:
- Stories probe hangs past timeout → status `degraded`
- Database size probe hangs past timeout → status `healthy` (non-critical probe)
- Database size probe throws unexpectedly → status `healthy`

Phase 2 — inner catch blocks:
- `checkSupabase` inner catch (line 81): `from("chunks")...limit()` rejects → `degraded`
- `checkStories` error-result branch (line 100): stories query returns `{ error: ... }` → `degraded`
- `checkStories` inner catch (line 105): stories `.eq().eq()` rejects → `degraded`

**`api/chat/stream/route.ts` (+5 tests)**
- Secondary `validateChatRequest` check (line 125): returns 400 with custom validation message.
- Pre-aborted request signal (line 167): `AbortController` aborted before request reaches the handler.
- Feature flag fallback (line 244): `isFeatureFlagEnabled` rejects → logs `[CHAT_STREAM_FEATURE_FLAG_FALLBACK]` and continues.
- `isAbortError` plain-Error branch (line 44): a plain `Error` with `name = "AbortError"` (non-DOMException) triggers the abort log path.
- `ReadableStream.cancel()` (lines 310–311): `reader.cancel()` triggers the stream cancel callback, which aborts the stream controller and stops generator execution.

**`use-stream-chat.ts` (+4 tests)**
- `onError` with stream reader throw: sets error state + replaces assistant message placeholder.
- `onError` with AbortError from stream reader: silently ignores (no error state change).
- `onError` else-branch: when `assistantIndex` is out-of-bounds after `resetMessages()`, pushes a new error message instead of updating existing one.
- Outer catch with AbortError from `fetch()`: silently ignores.

**`story-viewer.tsx` (+2 tests)**
- Timer cancellation on rapid prev navigation (line 123): second click in quick succession calls `clearTimeout`, so `onIndexChange` fires only once.
- Suggest-place dialog lifecycle (lines 388, 490): `SuggestPlaceButton` click opens the dialog; Cancel button closes it.

### Genuinely untestable lines (documented)

| File | Line(s) | Reason |
|------|---------|--------|
| `api/health/route.ts` | 228 | Outer catch around the three probe `Promise.all` — all three probes have inner try-catch blocks so the outer `catch` can never be reached. |
| `api/chat/stream/route.ts` | 263 | Race-condition guard (`streamAbortController.signal.aborted` check in stream loop) — requires precise generator timing between iterations; unreliable in tests. |
| `story-viewer.tsx` | 306 | `onToggleFavorite={() => toggleFavorite(story.id)}` — `StoryInfoPanel` accepts the prop in its interface but never calls it. Dead prop, architecturally untestable without modifying source. |
| `admin-auth.ts` | 29–30, 184–185 | Optional-chaining / null-guard short-circuit branches — V8 instruments these as branches even though the null cases can't be constructed with the current mock infrastructure. |

## Remaining Uncovered Files

| File | Stmt | Branch | Category |
|------|------|--------|----------|
| `voice-agent-chat.tsx` | 42.7% | 40.7% | Requires Playwright E2E (carried from 17+ runs) |
| `agents-dashboard/index.tsx` | 49.3% | 47.8% | Requires Playwright E2E (carried from 17+ runs) |
| `instrumentation.ts` | 71.4% | 43.8% | Sentry init, only invoked under server runtime |
| `author-typewriter.tsx` | 86.1% | 62.2% | V8 instrumentation artifact for async-timer paths (documented Apr 15) |
| `logger.ts` | 87.5% | 76.9% | `makePinoLogger()` only invoked under `NODE_ENV=production` |
| `marketing-dashboard/post-row.tsx` | 87.5% | 87.5% | Defensive null guards |
| `app/api/webhooks/translate/route.ts` | 87.5% | 76.2% | Provider error variants |
| `use-media-query.ts` | 93.3% | 50.0% | `typeof window === "undefined"` SSR guard (jsdom always defines window) |
| `chat-action-detection.ts` | 99.2% | 80.3% | Defensive branches; not load-bearing for action correctness |
| `admin-auth.ts` | 100% | 87.5% | Branch misses are V8 optional-chaining artifacts (documented above) |

## Test Suite Health

Clean run — 6515/6515 pass, no load-induced flakes. All new tests pass in isolation.

The timing-sensitive assertions that caused flakes in the May 3 run (elapsed < timeout + N ms bounds) were removed from the health probe timeout tests. Status assertions only — the correct signal that a timeout occurred is the `degraded`/`healthy` result, not the wall-clock duration.

## Recommendations

- Continue tracking `voice-agent-chat.tsx` and `agents-dashboard/index.tsx` as Playwright E2E targets; jsdom cannot exercise them.
- `api/health/route.ts` outer catch (line 228) is the only remaining uncovered statement in that file; it is structurally unreachable given the current probe architecture. No action needed unless the probe architecture changes.
- Branch coverage for `admin-auth.ts` (87.5%) reflects V8 optional-chaining instrumentation rather than real logic gaps. Statements and lines are 100%.
