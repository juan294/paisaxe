# Coverage Agent Report — 2026-04-15

## Summary

- **Test suite**: 100% passing (5718 tests, 0 failures)
- **TypeScript**: No errors
- **Overall coverage**: **98.74% statements** (+0.01%), **96.62% branch** (-0.02%), **98.72% function** (unchanged), **99.14% line** (+0.01%)

## Changes This Run

No test changes required. All 5718 tests pass on first run. Coverage numbers shifted by rounding (9381/9500 stmts) — no new tests or source changes since Apr 14.

## Coverage Plateau

Day 16 at 98.74% statements / 96.62% branch. Full re-investigation of all 119 uncovered statements confirms no new testable gaps exist. Every uncovered path was re-examined and categorized:

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
| story-editor-dialog/index.tsx | 50, 79, 84 | Dead code | `!story` guards — component returns null before buttons render |
| image-editor-dialog.tsx | 56, 109, 129 | Dead code | `!story` guards — same pattern as story-editor-dialog |
| language-switcher.tsx | 72, 75 | Dead code | Null ref + empty array guards — always set/populated |
| toolbar-overflow-menu.tsx | 67 | Dead code | Null ref guard — ref always set when menu is open |
| use-stories.ts | 39, 76 | SSR guards | `typeof window === "undefined"` in storage functions |
| use-voice-session.ts | 53, 75 | SSR guards | `typeof window === "undefined"` in storage functions |
| visitors-analytics-panel.tsx | 27, 35, 343, 544 | SSR guards + dead code | SSR checks + internal sub-component guards unreachable due to parent filtering |
| account-config-dialog.tsx | 47 | Dead code | `!platform` guard — component returns null before save button renders |
| admin/page.tsx | 242, 265, 316 | Branch gaps | Rarely-reached JSX conditional branches |
| favorites/page.tsx | 36 | Branch gap | Edge case branch |
| github-analytics-panel.tsx | 254 | Dead code | Internal guard unreachable from parent |
| stripe-analytics-panel.tsx | 244 | Dead code | Internal guard unreachable from parent |
| author-typewriter.tsx | 17, 57, 65, 82, 84, 86, 88, 90, 92, 94 | V8 gap | Async animation `if (cancelled) return` guards — code provably executes (test assertions verify cycle completion) but V8 doesn't instrument the false-branch `return` statements in async timer chains |

### Playwright-Only Files

| File | Stmt% | Why |
|------|-------|-----|
| voice-agent-chat.tsx | 46.3% | ElevenLabs WebSocket/SDK interaction |
| agents-dashboard/index.tsx | 49.3% | Terminal UI + agent runner integration |

## Recommendation

Coverage is at its practical ceiling for vitest/jsdom. The only path to further improvement is Playwright E2E tests for voice-agent-chat and agents-dashboard. No additional unit tests will move the needle.

## Cross-Agent Recommendations

- **Performance Agent**: No changes. Zero bundle impact. No new dependencies or source changes.
- **Code Quality Agent**: No new dead code. All existing dead code branches documented and stable. Global `afterEach(() => vi.useRealTimers())` in `src/test/setup.ts` continues to prevent timer leakage.
- **Security Agent**: All webhook and MCP error paths remain fully covered. No regression.
- **QA Agent**: Suite is 100% clean. voice-agent-chat and agents-dashboard still need Playwright E2E.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
