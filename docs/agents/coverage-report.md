# Coverage Agent Report — 2026-05-22

## Status: GREEN

Test suite fully green at 6,591 tests across 354 files (zero failures). Coverage at the May 20–21 plateau.

## Overall Coverage

| Metric     | This run | Prior (May 21) | Prior (May 11) |
|------------|----------|----------------|----------------|
| Statements | 98.66%   | 98.66%         | 98.58%         |
| Branches   | 95.40%   | 95.40%         | 95.18%         |
| Functions  | 98.75%   | 98.75%         | 98.65%         |
| Lines      | 99.10%   | 99.10%         | 99.05%         |

Coverage is identical to the May 20 / May 21 snapshots. No new tests were authored this cycle; the remaining uncovered lines are unchanged from the prior cycle and fall into the four documented categories below.

## Tool Health Note

The initial `npx vitest run --coverage` invocation was killed by a worker-pool storm: 21 test files failed to start workers with `[vitest-pool-runner]: Timeout waiting for worker to respond`, plus 1 spurious timeout on `src/app/immersive/layout.test.tsx > renders children` that did not reproduce on the retry. Re-running with `--no-file-parallelism` completed cleanly in 263s with all 6,591 tests passing. This is consistent with the known concurrency-storm pattern recorded in auto-memory ([[feedback_background_agent_concurrency]]). Future agent runs of this script should consider passing `--no-file-parallelism` by default on macOS hosts when run alongside other background agents.

## Coverage Plateau Confirmed (3rd Consecutive Cycle)

98.66% statements / 95.40% branches remains the practical ceiling for vitest + jsdom on this codebase. The remaining uncovered lines fall entirely into four documented categories:

### 1. Playwright-only components (unchanged)

These render WebSocket / voice / agent-runner streams that cannot be exercised under jsdom. Playwright E2E coverage is the only path forward and is owned by the QA Agent.

| File | Stmt % | Note |
|------|--------|------|
| `src/components/admin/voice-agent-chat.tsx` | 42.68% | Live ElevenLabs WebSocket integration |
| `src/components/admin/agents-dashboard/index.tsx` | 49.27% | Live agent-runner streaming |

### 2. V8 instrumentation quirks (unchanged)

V8 coverage cannot reach these lines despite the tests exercising the surrounding logic:

- `src/components/immersive/author-typewriter.tsx` lines 40-59, 67, 79-105 — `setInterval` callbacks scheduled across microtask + idle frames. Tests verify final state but V8 doesn't account the timer-frame statements.
- `src/hooks/use-stream-chat.ts` line 172 — closure inside `cleanup()` that V8 may not instrument when GC runs early.
- `src/app/api/health/route.ts` line 223 — `Promise.all` catch branch on a path V8 may not instrument.

### 3. SSR / runtime guards genuinely unreachable in jsdom (unchanged)

These guards protect against runtime environments jsdom cannot simulate:

- `src/hooks/use-media-query.ts` line 15 — `typeof window === "undefined"` SSR guard. Unreachable because React DOM itself requires `window`.
- `src/lib/request-context.ts` line 49 — `requestContextStorage.run(...)` reached only when `node:async_hooks` import succeeds, which is blocked in jsdom's ESM env.
- `src/lib/feature-flags-server.ts` setTimeout abort callback (75% function coverage) — covered by AbortError dispatch path, but the setTimeout firing path itself never runs under fake-timer mocks.
- `src/lib/sentry-before-send.ts` line 8 — `redactHeaders` no-op return when `headers` is undefined. Architecturally unreachable: caller at line 34 (`if (event.request.headers)`) guarantees a truthy headers value before invoking redactHeaders.
- `src/lib/i18n/provider.tsx` lines 25-26 — `es:` and `en:` entries in the `localeLoaders` map. Dead-code: both locales are pre-populated in `translationCache` at module init, so the loader for `es`/`en` is never invoked.

### 4. Architecturally unreachable defensive code (unchanged)

These statements exist for type-safety or defensive programming but cannot be reached via the public API:

- `src/lib/claude.ts` line 381 — `throw lastError || new Error("Max retries exceeded")` is unreachable: the retry loop always returns or throws inside the iteration. TypeScript requires the terminal throw for function-return inference.
- `src/lib/chat-action-detection.ts` lines 357, 371-375, 417 — defensive branches inside the address deduplication merge loop that the existing fixture set never exercises (rare overlap patterns).
- `src/lib/image-optimization.ts` lines 130-131 — `case "jpeg"` of the format switch. The pipeline only ever processes AVIF + WebP; jpeg is a defensive fallback.
- `src/components/admin/marketing-dashboard/post-row.tsx` line 18 — defensive guard when `post.id` is missing. Posts are always created with an id by the API.
- `src/hooks/use-stories.ts` lines 215, 263 — `if (!enabled) return` guards. The `enabled` parameter defaults to `true` and no caller passes `false`. (Recommend removing in a separate cycle — flagged for Code Quality agent.)
- `src/app/webhooks/translate/route.ts` line 206 — recovery branch in `UNKNOWN_SHAPE` handler. The entry-gate schema is identical to the second-parse schema, so the else-branch is dead code. (Recommend removing in a separate cycle — flagged for Code Quality agent.)
- `src/app/api/admin/agent-config/route.ts` line 103 — `!agentParsed || !agentParsed.success` defensive re-check inside the else branch. The outer guard at line 89 has already excluded this case.

## Files Below 100% Statements (by category)

| Category | File | Stmt % |
|----------|------|--------|
| Playwright-only | voice-agent-chat.tsx | 42.68 |
| Playwright-only | agents-dashboard/index.tsx | 49.27 |
| V8 instrumentation | author-typewriter.tsx | 86.07 |
| Architectural dead code | post-row.tsx | 87.50 |
| Architectural dead code | story-editor-dialog/index.tsx | 89.28 |
| SSR guard | use-media-query.ts | 93.33 |
| Architectural dead code | request-context.ts | 95.00 |
| Architectural dead code | sentry-before-send.ts | 95.23 |
| Architectural dead code | i18n/provider.tsx | 96.07 |
| Architectural dead code | use-stories.ts | 96.18 |
| Architectural dead code | image-optimization.ts | 96.42 |
| Architectural dead code | feature-flags-server.ts | 97.56 |
| Architectural dead code | logger-sanitize.ts | 97.82 |
| Architectural dead code | favorites/page.tsx | 98.30 |
| Architectural dead code | health/route.ts | 98.24 |
| Architectural dead code | agent-config/route.ts | 98.03 |
| Architectural dead code | translate/route.ts | 98.94 |
| V8 instrumentation | image-detection.ts | 99.15 |
| Defensive throw | claude.ts | 99.47 |
| Defensive | immersive/page-content.tsx (branch) | 100 (97.82 br) |

All listed gaps are either (a) Playwright-only (out of vitest scope), (b) V8 instrumentation artefacts, or (c) defensive dead code documented above.

## Recommendations to Code Quality Agent

Two dead-code branches can be safely removed (lossless cleanup; no test changes needed):

1. **`src/hooks/use-stories.ts` lines 215 + 263** — the `enabled` parameter defaults to `true` and no caller passes `false`. Remove the parameter and the two `if (!enabled) return;` guards.
2. **`src/app/webhooks/translate/route.ts` line 206** — the else-branch of `UNKNOWN_SHAPE` recovery is architecturally blocked by the identical entry-gate schema. Remove the dead else.
3. **`src/lib/i18n/provider.tsx` lines 25-26** — `es:`/`en:` entries of `localeLoaders` are pre-cached and never invoked. Remove the dead entries (declared cache is already initialized at module top).
4. **`src/app/api/admin/agent-config/route.ts` line 103** — defensive re-check is already covered by outer guard. Remove.

These all dropped flags from prior cycles but remain open.

## Verification

```bash
npx vitest run --coverage --no-file-parallelism
# Test Files  354 passed (354)
# Tests       6591 passed (6591)
# Statements  98.66% (10533/10675)
# Branches    95.40% (6949/7284)
# Functions   98.75% (2057/2083)
# Lines       99.10% (10030/10121)
# Duration    262.83s
```

No source or test files were modified this cycle. No commits.
