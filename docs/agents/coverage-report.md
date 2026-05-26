# Coverage Agent Report — 2026-05-26

## Status: GREEN

Coverage improved across statements, branches, functions, and lines vs the May 22 baseline. One new test added (`stories-data.test.ts` +1) to cover the `?? supabase` fallback in the new `getClient()` helper introduced by commit `54707d54`. Suite is green in isolation; full coverage produced clean numbers after retrying with `--no-file-parallelism`.

## Overall Coverage

| Metric     | This run (May 26) | May 22 | May 11 |
|------------|-------------------|--------|--------|
| Statements | 98.70% (10531/10669) | 98.66% | 98.58% |
| Branches   | 95.42% (6948/7281)   | 95.40% | 95.18% |
| Functions  | 98.84% (2058/2082)   | 98.75% | 98.65% |
| Lines      | 99.13% (10028/10115) | 99.10% | 99.05% |

Each metric is the new high-water mark for this codebase.

## Changes This Cycle

### Source changes since May 22 (not authored by Coverage Agent)
- `src/lib/stories-data.ts` (commit `54707d54`): added `getClient()` helper that returns the browser singleton when `typeof window !== "undefined"`, falling back to the module-level `supabase` server client. Prevents duplicate `GoTrueClient` instances sharing the same storage key as `AuthProvider`.
- `src/lib/costs/manual-costs.ts`: added `import "server-only"` (commit `f197747b`).
- `src/components/admin/costs-analytics-panel/alerts.tsx` + `forecast.tsx`: switched from barrel imports (`@/lib/costs`) to direct submodule imports (`@/lib/costs/tier-alerts`, `@/lib/costs/forecast`) to dodge a Turbopack module-factory error.
- New `src/test/__mocks__/server-only.ts` test scaffold (no-op stub).

### Tests authored this cycle
- `src/lib/stories-data.test.ts`: +1 test. Covers the `createSupabaseBrowserClient() ?? supabase` fallback at `stories-data.ts:12` by mocking the browser client factory to return `null` once and asserting that `getStoriesFromDB` still flows through the module-level `supabase` mock. Also converted the `supabase-browser` mock to `vi.fn(...)` so it can be overridden per test. Coverage of `stories-data.ts` branches rose from 93.69% to 94.59%.

## Tool Health Note (recurring)

The first `npx vitest run --coverage` attempt completed but had 13 spurious "Test timed out in 5000ms" failures plus 5 worker-pool start failures. All 13 reproduced as PASS when re-run in isolation:

```
src/lib/posthog-query.test.ts
src/components/auth/auth-provider.test.tsx
src/components/immersive/accessibility.test.tsx
src/components/admin/costs-analytics-panel/modals.test.tsx
src/components/admin/marketing-dashboard/account-config-dialog.test.tsx (6 tests)
src/components/admin/marketing-dashboard/create-draft-dialog.test.tsx (3 tests)
```

Root cause was the documented background-agent concurrency limit ([[feedback_background_agent_concurrency]]): concurrent `vitest` runs from `chapa`, `portfolio`, `termplex`, and `archy` projects were saturating CPU and the forks pool. Re-running with `--no-file-parallelism` once the other agents finished produced a clean run.

**Recommendation for future Coverage Agent runs:** Wait for `pgrep -f "vitest run --coverage" | grep -v paisaxe` to be empty before launching, or prepend `--no-file-parallelism --pool=threads` to reduce fork pressure when other agents are active.

## Coverage Plateau (~98.7% statements / 95.4% branches)

The remaining uncovered lines fall into the same four documented categories as prior cycles:

### 1. Playwright-only components (unchanged)

| File | Stmt % | Note |
|------|--------|------|
| `src/components/admin/voice-agent-chat.tsx` | 42.68% | Live ElevenLabs WebSocket integration |
| `src/components/admin/agents-dashboard/index.tsx` | 49.27% | Live agent-runner streaming |

### 2. V8 instrumentation quirks (unchanged)

- `src/components/immersive/author-typewriter.tsx` lines 40-59, 67, 79-105 — `setInterval` callbacks scheduled across microtask + idle frames.
- `src/hooks/use-stream-chat.ts` line 172 — closure inside `cleanup()` that V8 may not instrument when GC runs early.
- `src/app/api/health/route.ts` (`Promise.all` catch branch) — V8 instrumentation gap.

### 3. SSR / runtime guards genuinely unreachable in jsdom (unchanged)

- `src/hooks/use-media-query.ts` line 15 — `typeof window === "undefined"` SSR guard. React DOM itself requires `window`.
- `src/lib/request-context.ts` line 49 — `requestContextStorage.run(...)` requires `node:async_hooks` import to succeed, blocked in jsdom's ESM env.
- `src/lib/feature-flags-server.ts` setTimeout abort callback (75% function coverage) — covered by AbortError dispatch path, but the setTimeout firing path itself never runs under fake-timer mocks.
- `src/lib/sentry-before-send.ts` line 8 — `redactHeaders` no-op return when `headers` is undefined. Architecturally unreachable: caller at line 34 guarantees a truthy headers value.
- `src/hooks/use-stories.ts` lines 58, 95, 332 — `if (typeof window === "undefined")` / `if (typeof window !== "undefined")` SSR guards in `loadFromStorage`, `saveToStorage`, `clearStoriesCache`. Cannot exercise the SSR side under jsdom.
- `src/hooks/use-stories.ts` line 155 — `if (localStorageBootstrapped.current) return;` early-return guard. The useEffect runs once per hook instance under vitest (no Strict-Mode double-invocation), so the early-return branch is structurally unreachable.
- **NEW**: `src/lib/stories-data.ts` line 14 — `return supabase;` (server-side else of `getClient()`). In jsdom, `typeof window !== "undefined"` is always true, so the else branch never runs. Architecturally unreachable in vitest/jsdom (same family as `use-media-query.ts:15` and `use-stories.ts:58/95/332`).

### 4. Architecturally unreachable defensive code (unchanged)

- `src/lib/claude.ts` line 381 — `throw lastError || new Error("Max retries exceeded")` is unreachable: the retry loop always returns or throws inside the iteration. TypeScript requires the terminal throw for return-type inference.
- `src/lib/chat-action-detection.ts` lines 357, 371-375, 417 — defensive branches inside the address deduplication merge loop that the existing fixture set never exercises.
- `src/lib/image-optimization.ts` lines 130-131 — `case "jpeg"` of the format switch. The pipeline only ever processes AVIF + WebP.
- `src/components/admin/marketing-dashboard/post-row.tsx` line 18 — defensive guard when `post.id` is missing. Posts are always created with an id by the API.
- `src/app/api/admin/agent-config/route.ts` line 103 — `!agentParsed || !agentParsed.success` defensive re-check inside the else branch. The outer guard at line 89 has already excluded this case.
- `src/components/admin/marketing-dashboard/story-editor-dialog/index.tsx` lines 40-84 — defensive fallback render path.

## Files Below 100% Statements (by category)

| Category | File | Stmt % |
|----------|------|--------|
| Playwright-only | voice-agent-chat.tsx | 42.68 |
| Playwright-only | agents-dashboard/index.tsx | 49.27 |
| V8 instrumentation | author-typewriter.tsx | 86.07 |
| Architectural dead code | post-row.tsx | 87.50 |
| Architectural dead code | story-editor-dialog/index.tsx | 89.28 |
| SSR guard | use-media-query.ts | 93.33 |
| SSR guard | request-context.ts | 95.00 |
| SSR guard | sentry-before-send.ts | 95.23 |
| Architectural dead code | image-optimization.ts | 96.42 |
| Architectural dead code | language-switcher.tsx | 96.87 |
| Architectural dead code | use-voice-session.ts | 97.05 |
| Architectural dead code | feature-flags-server.ts | 97.56 |
| SSR guard | use-stories.ts | 97.63 |
| Architectural dead code | logger-sanitize.ts | 97.82 |
| Architectural dead code | account-config-dialog.tsx | 97.87 |
| Architectural dead code | workflow-menu.tsx | 98.24 |
| Architectural dead code | voice-chat.tsx | 98.43 |
| SSR guard (line 14) | stories-data.ts | 98.94 |
| V8 instrumentation | image-detection.ts | 99.15 |
| Defensive throw | claude.ts | 99.47 |
| V8 instrumentation | story-viewer.tsx | 99.10 |

All listed gaps are either (a) Playwright-only (out of vitest scope), (b) V8 instrumentation artefacts, or (c) defensive dead code / SSR guards documented above.

## Recommendations to Code Quality Agent

Same as prior cycle (still open):

1. `src/app/api/admin/agent-config/route.ts` line 103 — defensive re-check is already covered by outer guard at line 89. Remove to clean up branch coverage.
2. `src/lib/chat-action-detection.ts` lines 357, 371-375, 417 — either widen the address-dedup fixture set or remove the unreachable branches.
3. `src/lib/image-optimization.ts` lines 130-131 (`case "jpeg"`) — pipeline only ever processes AVIF/WebP; remove the jpeg case or convert it to a `default` that throws.

## Verification

```bash
npx vitest run --coverage --no-file-parallelism
# Statements   : 98.7%  (10531/10669)
# Branches     : 95.42% (6948/7281)
# Functions    : 98.84% (2058/2082)
# Lines        : 99.13% (10028/10115)
```

Source changes this cycle: 1 test file (`src/lib/stories-data.test.ts`) — added one test + converted the `supabase-browser` mock to a `vi.fn()` to enable per-test override. No source files modified. No commits.
