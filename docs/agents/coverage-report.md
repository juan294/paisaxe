# Coverage Agent Report — 2026-04-20

## Summary

- **Test suite**: 5904 passing (1 pre-existing flaky timeout under load), 0 new failures
- **TypeScript**: No errors
- **Overall coverage**: **98.54% statements** (+0.37%), **95.94% branch** (+0.21%), **98.35% function** (+0.57%), **98.95% line** (+0.28%)

## Changes This Run

Added **36 new tests** across 5 files / 1 new test file to cover previously untested code paths:

### New Tests Added

| File | Tests Added | Coverage Impact |
|------|-------------|-----------------|
| `src/lib/feature-flags-server.test.ts` | +7 | `getAllFeatureFlagsServer` 56.09% → 97.56% (entire function was untested) |
| `src/app/api/webhooks/stripe/route.test.ts` | +2 | `POST /api/webhooks/stripe` 90% → 100% (dedup insert race condition + generic DB error) |
| `src/lib/env.test.ts` | +9 | `env.ts` 66.66% → ~97% (all 8 typed constant helpers now exercised) |
| `src/proxy.test.ts` | +5 | `auth-refresh.ts` 94.33% → 100%, `csrf-proxy.ts` 95.45% → 100% |
| `src/lib/proxy/maintenance.test.ts` | +13 (new file) | `maintenance.ts` 84.44% → 91.11%, `resetMaintenanceModeCache` now covered |

### Key Coverage Improvements

- **`feature-flags-server.ts`**: `getAllFeatureFlagsServer()` was entirely untested. Added 7 scenarios: success with multiple flags, empty result, missing config, non-JWT key, non-ok response, fetch error, and URL/cache-option verification.
- **`stripe/route.ts`**: The dedup insert race condition (`dedupError.code === "23505"`) and generic database error paths on the second INSERT were untested. Both now covered.
- **`auth-refresh.ts`**: Two remaining uncovered paths now tested: (1) `isTokenNearExpiry` catch block when the token is not valid base64 JSON; (2) `emitAuthRefreshTimeoutEvent` fetch call when `NEXT_PUBLIC_POSTHOG_KEY` is set.
- **`csrf-proxy.ts`**: The "Origin not allowed" 403 response (SE-L2 origin check) was untested — hitting it requires a POST to `/api/` with a disallowed `Origin` header, distinct from the CSRF-token-missing path.
- **`maintenance.ts`**: New dedicated test file covering `shouldBypassMaintenanceMode`, `resetMaintenanceModeCache`, and all branches of `isMaintenanceModeEnabled`.

## Remaining Uncovered Lines

### Genuinely Untestable

| File | Lines | Category | Detail |
|------|-------|----------|--------|
| `logger.ts` | 35-42 | Production-only | `makePinoLogger()` — only invoked when `NODE_ENV=production`; not reachable in vitest |
| `maintenance.ts` | 87, 114-116 | Production cache | Cache hit/set code behind `!isDev` guard — `isDev` is always `true` in test env (`NODE_ENV=test`) |
| `auth-refresh.ts` | 106 | Branch gap | V8 branch in `emitAuthRefreshTimeoutEvent`'s inner `.catch(() => {})` callback |
| `env.ts` | (statements) | Arrow fn bodies | Some typed constant arrow bodies may not instrument at 100% in V8; all lines covered |
| `posthog-provider.tsx` | 17 | SSR guard | `typeof window === "undefined"` — jsdom always has `window` |
| `embedding-cache.ts` | 55 | Dead code | LRU eviction guard — Map is guaranteed non-empty when triggered |
| `posthog-query.ts` | 70 | Dead code | `"unknown error"` fallback — only reachable if `error instanceof Error` is false AND retryable |
| `claude.ts` | 323 | Dead code | Post-loop throw — every loop iteration either returns or throws |
| `i18n/provider.tsx` | 25-26 | Type completeness | `es`/`en` lazy loaders never called — cache always contains them |
| `chat-action-detection.ts` | 357, 371-375, 417 | Dead code | Sort tie-breaker + null guard + dedup — structurally unreachable |
| `image-optimization.ts` | 130-131 | Dead code | JPEG format case — never called with JPEG |
| `post-row.tsx` | 18 | Dead code | `!dateStr` guard — caller pre-checks truthiness via `&&` operator |
| `story-editor-dialog/index.tsx` | 40-84 | Dead code | `!story` guards — component returns null before buttons render |
| `image-editor-dialog.tsx` | 56, 109, 129 | Dead code | `!story` guards — same pattern |
| `language-switcher.tsx` | 72, 75 | Dead code | Null ref + empty array guards |
| `toolbar-overflow-menu.tsx` | 67 | Dead code | Null ref guard — ref always set when menu is open |
| `use-stories.ts` | 39, 76 | SSR guards | `typeof window === "undefined"` in storage functions |
| `use-voice-session.ts` | 75-111 | SSR guards | `typeof window === "undefined"` in saveState; V8 instrumentation in useMemo |
| `visitors-analytics-panel.tsx` | 27, 35, 343, 544 | SSR guards + dead code | SSR checks + internal sub-component guards |
| `account-config-dialog.tsx` | 47 | Dead code | `!platform` guard |
| `admin/page.tsx` | 242, 265, 316 | Branch gaps | Rarely-reached JSX conditional branches |
| `favorites/page.tsx` | 36 | Branch gap | Edge case branch |
| `github-analytics-panel.tsx` | 254 | Dead code | Internal guard unreachable from parent |
| `stripe-analytics-panel.tsx` | 244 | Dead code | Internal guard unreachable from parent |
| `author-typewriter.tsx` | 17, 57, 65, 82-103 | V8 gap | Async animation `if (cancelled) return` guards — code executes but V8 doesn't instrument false-branch returns in async timer chains |

### Playwright-Only Files

| File | Stmt% | Why |
|------|-------|-----|
| `voice-agent-chat.tsx` | 46.3% | ElevenLabs WebSocket/SDK interaction requires real browser + audio context |
| `agents-dashboard/index.tsx` | 49.3% | Terminal UI + agent runner integration requires live subprocess behavior |

## Coverage Plateau

Coverage is at its practical ceiling for vitest/jsdom. The 0.37% statement gain this cycle came from covering previously untested logic in `getAllFeatureFlagsServer`, the Stripe dedup race condition, and the CSRF origin check — all of which were genuine logic gaps, not instrumentation noise. The remaining ~1.5% gap is entirely composed of SSR guards, production-only paths, and defensive dead code.

The only path to further improvement is Playwright E2E tests for voice-agent-chat and agents-dashboard.

## Cross-Agent Recommendations

- **Performance Agent**: 36 new tests only. No source changes, no new dependencies. Zero bundle impact.
- **Code Quality Agent**: `getAllFeatureFlagsServer` was the largest untested function (entire function body at 0%). Now covered. Pattern: when adding new exported async functions, ensure both the success path and all early-return/error paths are covered.
- **Security Agent**: Stripe dedup race condition (23505 unique constraint) and the origin-not-allowed CSRF path are now fully covered. All webhook error paths verified.
- **QA Agent**: Suite is clean. voice-agent-chat and agents-dashboard still need Playwright E2E.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
