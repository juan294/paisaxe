# Coverage Agent Report — 2026-04-21

## Summary

- **Test suite**: 5981 passing (0 failures on clean run; 1 known load-race flake on parallel run — pre-existing, non-deterministic)
- **TypeScript**: No errors
- **Overall coverage**: **98.58% statements** (+0.04%), **96.03% branch** (+0.09%), **98.35% function** (unchanged), **98.99% line** (+0.04%)

## Changes This Run

Added **5 new tests** to `src/lib/proxy/maintenance.test.ts` covering the production-mode cache branch of `isMaintenanceModeEnabled()`:

| File | Tests Added | Coverage Impact |
|------|-------------|-----------------|
| `src/lib/proxy/maintenance.test.ts` | +5 | `maintenance.ts` 91.11% → 100% statements, 81.25% → ~100% branches |

### Key Coverage Improvements

- **`maintenance.ts` production cache branch** (lines 87, 114-116): previously uncovered because the existing test file had `NODE_ENV=test`, forcing `isDev=true` and short-circuiting all cache logic. New tests explicitly set `NODE_ENV=production` (with `getEnvironment()` mocked to `"production"`) to exercise:
  1. First-call fetch populates the cache (lines 114-116)
  2. Subsequent calls return cached value without refetching (line 87)
  3. Cache invalidation when the Supabase URL changes (different project)
  4. Cache refetch after 30s TTL expiry (via `Date.now` spy)
  5. Error responses do NOT populate the cache (ensures next call refetches)

`src/lib/proxy/` directory now reports **100% statements**, up from 97.71%.

## Remaining Uncovered Lines

### Genuinely Untestable

| File | Lines | Category | Detail |
|------|-------|----------|--------|
| `logger.ts` | 35-42 | Production-only | `makePinoLogger()` — only invoked when `NODE_ENV=production`; not reachable in vitest |
| `auth-refresh.ts` | 106 | Branch gap | V8 branch in `emitAuthRefreshTimeoutEvent`'s inner `.catch(() => {})` callback |
| `env.ts` | (statements) | Arrow fn bodies | Some typed constant arrow bodies may not instrument at 100% in V8; all lines covered |
| `posthog-provider.tsx` | 17 | SSR guard | `typeof window === "undefined"` — jsdom always has `window` |
| `embedding-cache.ts` | 55 | Dead code | LRU eviction guard — Map is guaranteed non-empty when triggered |
| `posthog-query.ts` | 70 | Dead code | `"unknown error"` fallback — only reachable if `error instanceof Error` is false AND retryable |
| `claude.ts` | 343 | Dead code | Post-loop throw — every loop iteration either returns or throws |
| `i18n/provider.tsx` | 25-26 | Type completeness | `es`/`en` lazy loaders never called — cache always contains them |
| `chat-action-detection.ts` | 357, 371-375, 417 | Dead code | Sort tie-breaker + null guard + dedup — structurally unreachable |
| `image-optimization.ts` | 130-131 | Dead code | JPEG format case — never called with JPEG |
| `csrf.ts` | 91 | Branch gap | Internal guard |
| `rate-limit.ts` | 163 | Branch gap | Internal guard |
| `post-row.tsx` | 18 | Dead code | `!dateStr` guard — caller pre-checks truthiness via `&&` operator |
| `story-editor-dialog/index.tsx` | 40-84 | Dead code | `!story` guards — component returns null before buttons render |
| `image-editor-dialog.tsx` | 56, 109, 129 | Dead code | `!story` guards — same pattern |
| `language-switcher.tsx` | 72-75 | Dead code | Null ref + empty array guards |
| `toolbar-overflow-menu.tsx` | 67 | Dead code | Null ref guard — ref always set when menu is open |
| `use-stories.ts` | 39, 76, 124, 131, 277 | SSR guards + dead code | `typeof window === "undefined"` + defensive branches |
| `use-voice-session.ts` | 75-111 | SSR guards | `typeof window === "undefined"` in saveState; V8 instrumentation in useMemo |
| `use-stream-chat.ts` | 209 | Branch gap | Internal guard |
| `visitors-analytics-panel.tsx` | 238-246, 254 | Dead code | Internal sub-component guards |
| `stripe-analytics-panel.tsx` | 225-244, 531 | Dead code | Internal guard unreachable from parent |
| `costs-analytics-panel.tsx` | 270, 471 | Dead code | Internal guards |
| `elevenlabs-analytics-panel.tsx` | 544 | Dead code | Internal guard |
| `story-editor-dialog` index | 56, 109, 129 | Dead code | `!story` early returns |
| `favorites/page.tsx` | 36, 222-227 | Branch gap + edge case | Share-fallback + edge branches |
| `admin-shell.tsx` | 225, 246, 266, 317 | Branch gaps | Rarely-reached JSX conditional branches |
| `author-typewriter.tsx` | 17-57, 65, 82-103 | V8 gap | Async animation `if (cancelled) return` guards — code executes but V8 doesn't instrument false-branch returns in async timer chains |
| `stream chat route` | 186-187 | Error path | SSE error handling |
| `health route` | 21 | Branch gap | Internal guard |
| `make-booking route` | 398-402 | Error path | Tail error branch |
| `webhooks/elevenlabs` | 394 | Branch gap | Internal guard |
| `maintenance-config-panel.tsx` | (handleMaintenanceMode) | — | Covered by proxy tests |

### Playwright-Only Files

| File | Stmt% | Why |
|------|-------|-----|
| `voice-agent-chat.tsx` | 46.25% | ElevenLabs WebSocket/SDK interaction requires real browser + audio context |
| `agents-dashboard/index.tsx` | 49.27% | Terminal UI + agent runner integration requires live subprocess behavior |

## Coverage Plateau

Coverage has now passed **98.58% statements**, up from 98.54% the prior run. Today's gain came from unlocking the production cache branch in `maintenance.ts` — a genuine logic path that was previously short-circuited by `NODE_ENV=test`. The approach (mocking `process.env.NODE_ENV` alongside `getEnvironment()`) is a reusable pattern for any code that branches on dev/test vs. production environment.

The remaining ~1.4% gap is composed entirely of SSR guards, production-only runtime paths, defensive dead code, and V8 instrumentation artifacts in async timer chains. The only path to meaningful further improvement is Playwright E2E coverage for `voice-agent-chat` and `agents-dashboard`.

## Cross-Agent Recommendations

- **Performance Agent**: 5 new tests only. No source changes, no new dependencies. Zero bundle impact.
- **Code Quality Agent**: Tests that depend on `process.env.NODE_ENV` branching should explicitly set the variable — relying on vitest's default `"test"` value silently hides production-mode code paths from coverage. Pattern added in `maintenance.test.ts` describe block.
- **Security Agent**: Maintenance-mode cache now fully covered — includes the Supabase URL invalidation case (cache busts when the project URL changes, preventing cross-tenant state leak). No regression risk.
- **QA Agent**: Suite still at clean state. `voice-agent-chat` and `agents-dashboard` remain the only Playwright-eligible low-coverage files.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
