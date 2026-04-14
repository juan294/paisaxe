# Coverage Agent Report — 2026-04-14

## Summary

- **Test suite**: 100% passing (5718 tests, 0 failures)
- **TypeScript**: No errors
- **Overall coverage**: **98.73% statements** (unchanged), **96.64% branch** (unchanged), **98.72% function** (unchanged), **99.13% line** (unchanged)

## Changes This Run

No test changes required. All 5718 tests pass on first run. Two new tests since last run (`src/config/vercel-config.test.ts` from commit 9d1102c — Vercel single-region fix).

## Coverage Plateau

Day 15 at 98.73% statements / 96.64% branch. Deep re-investigation of all uncovered lines confirms no new testable gaps exist. Every uncovered path was re-examined:

### Confirmed Unreachable / Untestable

| File | Lines | Category | Detail |
|------|-------|----------|--------|
| proxy.ts | 22, 129, 398 | Branch gaps | CORS origin / auth edge cases |
| layout.tsx | 24 | SSR guard | `metadata` export branch |
| robots.ts | 6 | Env guard | `VERCEL_ENV` check |
| posthog-provider.tsx | 17 | SSR guard | `typeof window === "undefined"` — jsdom always has `window` |
| embedding-cache.ts | 55 | Dead code | LRU eviction guard — Map is guaranteed non-empty when triggered |
| posthog-query.ts | 70 | Dead code | `"unknown error"` fallback — only reachable if `error instanceof Error` is false AND retryable, which is contradictory |
| claude.ts | 323 | Dead code | Post-loop throw — every loop iteration either returns or throws |
| i18n/provider.tsx | 25-26 | Type completeness | `es`/`en` lazy loaders never called — cache always contains them |
| chat-action-detection.ts | 357, 371-375, 417 | Dead code | Sort tie-breaker + null guard + dedup — structurally unreachable |
| image-optimization.ts | 130-131 | Dead code | JPEG format case in private function — never called with JPEG |
| post-row.tsx | 18 | Dead code | `!dateStr` guard — caller pre-checks truthiness |
| story-editor-dialog/index.tsx | 40-84 | Dead code | `!story` guards — component returns null before buttons render |
| language-switcher.tsx | 72-75 | Dead code | Null ref + empty array guards — always set/populated |
| use-stories.ts | 39, 76, 124, 131, 277 | SSR guards + dead code | SSR checks + sort tie-breaker |
| use-voice-session.ts | 75-111 | SSR guard | `typeof window === "undefined"` — untestable in jsdom |
| author-typewriter.tsx | 17-57, 65, 82-103 | V8 gap | Async animation code provably executes (test assertions verify) but V8 doesn't instrument cancelled Promise paths |

### Playwright-Only Files

| File | Stmt% | Why |
|------|-------|-----|
| voice-agent-chat.tsx | 45.6% | ElevenLabs WebSocket/SDK interaction |
| agents-dashboard/index.tsx | 48.5% | Terminal UI + agent runner integration |

## Recommendation

Coverage is at its practical ceiling for vitest/jsdom. The only path to further improvement is Playwright E2E tests for voice-agent-chat and agents-dashboard. No additional unit tests will move the needle.

## Cross-Agent Recommendations

- **Performance Agent**: No changes. Zero bundle impact. Test count +2 from Vercel config test.
- **Code Quality Agent**: No new dead code. All existing dead code branches documented and stable. Global `afterEach(() => vi.useRealTimers())` in `src/test/setup.ts` continues to prevent timer leakage.
- **Security Agent**: All webhook and MCP error paths remain fully covered. No regression.
- **QA Agent**: Suite is 100% clean. voice-agent-chat and agents-dashboard still need Playwright E2E.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
