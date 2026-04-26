# Coverage Agent Report — 2026-04-24

## Summary

- **Test suite**: Passing under reduced concurrency (`--max-workers=4`). 5913 total tests, 5910 pass, 3 load-induced flakes (all pass in isolation).
- **TypeScript**: Pass (no errors).
- **Overall coverage** (pre-edit baseline): **98.16% statements**, **95.51% branch**, **97.94% function**, **98.55% line**.
- **Changes this run**: +5 targeted tests covering 4 defensive branches across 3 files. Expected overall branch coverage improvement to ~95.6%.

## Changes This Run

| File | Tests Added | Gap Closed |
|------|-------------|-----------|
| `src/lib/admin-formatters.test.ts` | +2 | `metadata.translations \|\| {}` and `metadata.translation_status \|\| {}` fallback branches (`admin-formatters.ts:24-25`). File now 100% branch in isolation. |
| `src/lib/csrf.test.ts` | +1 | `new URL(referer)` catch branch when Referer header is malformed (`csrf.ts:91`). File now 100% branch in isolation. |
| `src/lib/request-context.test.ts` | +3 | (a) `withRequestContext` passthrough when `x-request-id` is absent; (b) same when header is blank (`.trim()` guard); (c) Edge-runtime fallback path where `AsyncLocalStorage` is unavailable and `fallbackRequestContext` is used instead (`request-context.ts:16,40-46`). |

### New Coverage Detail

- **admin-formatters.ts** — Added two fixtures where `metadata` is present but missing one of the two expected sub-objects. The two `|| {}` fallbacks were previously reachable only in theory.
- **csrf.ts** — Added a malformed Referer fixture. Exercises the `new URL(...)` throw path in the fallback validation branch — critical for same-origin enforcement on requests without an `Origin` header.
- **request-context.ts** — Three new tests:
  1. Request with no `x-request-id` header must pass through without establishing context (line 66).
  2. Request with whitespace-only `x-request-id` must be treated as missing (verifies the `.trim()` guard).
  3. Under a simulated Edge runtime, the module falls back to a synchronous `fallbackRequestContext` var instead of `AsyncLocalStorage`. Uses `vi.resetModules()` + a `globalThis.EdgeRuntime` spoof.

All three files target security- or reliability-critical code paths:
- CSRF origin validation is the first defense on all non-exempt API routes.
- Request context propagation is load-bearing for structured logging and Sentry breadcrumbs in the Edge runtime.

## Remaining Uncovered Lines

No new testable gaps were found. Everything remaining matches the categories documented in previous runs.

### Genuinely Untestable (no change)

| File | Lines | Category | Detail |
|------|-------|----------|--------|
| `logger.ts` | 77.33% | Production-only | `makePinoLogger()` — only invoked under `NODE_ENV=production`; not reachable in vitest. |
| `voice-agent-chat.tsx` | 46.25% | Requires Playwright E2E | Complex multi-step voice UI flows; carried from prior runs. |
| `agents-dashboard/index.tsx` | 49.27% | Requires Playwright E2E | Admin agent runner with long-polling; carried from prior runs. |
| `posthog-provider.tsx` | 17 | SSR guard | `typeof window === "undefined"` — jsdom always defines `window`. |
| `favorites/layout.tsx` | 5 | Env fallback | `NEXT_PUBLIC_SITE_URL || ...` — NEXT_PUBLIC_SITE_URL is always set in test env. |
| `lib/i18n/provider.tsx` | 25-26 | Structural dead code | `es`/`en` loaders never called — both are cached at module init. |
| `lib/platforms/index.ts` | 25-78 (reported) | V8 instrumentation artifact | 100% in isolation; the full-suite 0% is an instrumentation quirk from `export *` + re-imports across forked workers, not a real gap. |
| `claude.ts` | 377 | Unreachable | "Should not reach here" fallback with leading `// TypeScript needs it` comment. |

### Low-Priority Branches

| File | Branch | Notes |
|------|--------|-------|
| `csrf.ts` | previously 97.14% | Now 100% in isolation after this run. |
| `admin-formatters.ts` | previously 88.23% | Now 100% in isolation after this run. |
| `request-context.ts` | previously 62.5% | Now 87.5% in isolation; remaining gap is a V8 quirk with `vi.resetModules` invalidating line 49 coverage in the reset run. Covered in practice by the normal-runtime tests earlier in the file. |

## Test Suite Health

- **Load-induced flakes**: 3 tests fail only under full-suite parallel load on this machine (`chat-actions > copy button`, `drafts-panel > resets copied state after 2s timeout`, `costs-analytics-panel > handleDeleteCost without confirm`). All pass in isolation (verified). These are the same class of fake-timer / load-race issues documented in prior runs; the project-level `afterEach(() => vi.useRealTimers())` guard in `src/test/setup.ts` mitigates but does not fully eliminate under heavy concurrency. Recommendation: continue running coverage with `--max-workers=4` on developer machines.
- **V8 coverage aggregation ENOENT**: One full-suite run failed to aggregate results because a worker's temp coverage file disappeared (`coverage/.tmp/coverage-15.json`). This is a vitest+V8 race, unrelated to the tests themselves. The earlier baseline numbers (98.16% / 95.51% / 97.94% / 98.55%) remain valid.

## Recommendations

- No new source-code work required.
- Continue tracking `voice-agent-chat.tsx` and `agents-dashboard/index.tsx` as Playwright E2E targets (carried from prior 15+ runs).
- If Paisaxe moves off V8 coverage to istanbul, the `platforms/index.ts` 0% artifact and the V8 aggregation ENOENT should both disappear.

SHARED_CONTEXT_START
## Coverage Agent — 2026-04-24
- Test suite stable under `--max-workers=4`: 5910 pass, 3 load-induced flakes (pass in isolation)
- Baseline coverage: **98.16% statements / 95.51% branch / 97.94% function / 98.55% line** (v8 aggregation hit one ENOENT race on a second full run — transient, not a regression)
- **+5 new tests** closing real branch gaps in 3 security/reliability files:
  - `admin-formatters.ts`: `|| {}` fallbacks for missing `translations` / `translation_status` (now 100% branch in isolation)
  - `csrf.ts`: malformed Referer catch branch in `validateOrigin` (now 100% branch in isolation)
  - `request-context.ts`: missing `x-request-id`, whitespace header, Edge-runtime `AsyncLocalStorage`-unavailable fallback
- No source changes. Carried: `voice-agent-chat.tsx` (46%), `agents-dashboard/index.tsx` (49%) still need Playwright E2E.

**Cross-agent recommendations:**
- Performance Agent: No new deps, no source edits. Zero bundle impact.
- Security Agent: CSRF Referer catch branch and request-context fallback now covered. Edge-runtime logging path no longer a coverage blind spot.
- QA Agent: Same 3 load-induced fake-timer flakes (`chat-actions copy`, `drafts-panel copy`, `costs-analytics handleDeleteCost`) recur under full-concurrency runs. All pass cleanly at `--max-workers=4`. Pattern: fake timers + `waitFor` + real setTimeout producers.
- Code Quality Agent: V8 coverage aggregation ENOENT race on `/coverage/.tmp/coverage-*.json` observed once this run. Consider `--coverage.clean=true` default or migrate to istanbul if it repeats.
- Triage Agent: No code commits required beyond the +5 coverage tests. Full suite stable.
SHARED_CONTEXT_END
