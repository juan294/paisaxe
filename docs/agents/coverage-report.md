# Coverage Agent Report — 2026-07-18

## Status: GREEN (largest branch-coverage gain in weeks: +0.52pp, 40 tests added, suite fully green)

This cycle broke through the branch-coverage plateau. A systematic sweep of the uncovered-branch inventory (extracted per-arm from `coverage-final.json`, not the summary table) found 41 genuinely reachable branch arms that prior cycles had passed over, and closed them with 40 new targeted tests across 14 test files. Statement coverage is unchanged at 98.86% — every remaining statement gap was re-verified this cycle and is either dead code, an SSR guard, a V8 instrumentation artifact, or Playwright-only territory. One stale "unreachable" classification from a prior cycle was overturned and is now covered (`elevenlabs-agents.ts:44`).

## Overall coverage

| Metric | 2026-07-17 (prior) | 2026-07-18 (this cycle) | Delta |
|--------|--------------------|--------------------------|-------|
| Statements | 98.86% (11209/11338) | **98.86%** (11209/11338) | unchanged |
| Branches | 96.80% (7604/7855) | **97.32%** (7645/7855) | **+0.52pp (+41 arms)** |
| Functions | 99.09% (2196/2216) | **99.09%** (2196/2216) | unchanged |
| Lines | 99.22% (10662/10745) | **99.22%** (10662/10745) | unchanged |
| Test files | 381 passing | **382 passing** (0 failures) | +1 (new file) |
| Tests | 7234 passing | **7274 passing** (0 failures) | +40 |

All thresholds met with wide margin. The suite ran clean at the config-pinned `maxWorkers: 4` on both the baseline and verification runs — no host-contention timeouts this cycle.

## Tests added (40, all passing)

**src/lib/claude.ts (+8)** — non-Error SDK stream throw stringified in retry warning (line 123); "Streaming error" fallback for message-less error events (253); post-drain re-check skipping `waitForWork` when an error lands mid-chunk (294, driven deterministically via manual iterator stepping); string curl exit-code parsing (400); both fallback arms of `err.code || err.stderr || "unknown error"` (424); chunk dropped entirely when remaining context space <= 100 chars (515); `<context>` wrapping and images-only prompt paths in the streaming request body (572-573).

**src/lib/stories-data.ts (+11, incl. new file `stories-data.fallback-metadata.test.ts`)** — `String(error)` arms for non-Error throws across all 5 DB-fallback catch blocks (74, 112, 146, 180, 210, 272); `isBuildPhase()` log-suppression arms (258, 271); null-data/null-error fallback without logging (258); null-description `?? null` arms (234, 268); fallback-metadata slug-empty `|| id` arm (232 — required mocking `@content/fallback-stories.json`, since all 8 real fallback stories have complete fields).

**src/lib/chat-action-detection.ts (+6)** — international +34 match with digit total != 9 (54); phone dedup across all three formats: international (56), 3-2-2-2 spaced (85), 9-consecutive-digit (99); plus reachability doc-tests for the comparator/overlap branches (see below).

**src/lib/image-optimization.ts (+4)** — metadata width/height fallback arms in both the main and variant paths (77-78, 138-139), maxWidth fallback (173), original-width 2048 fallback (254), non-Error rejection message (236). The test file fully mocks sharp, so these are stable.

**src/lib/rate-limit.ts (+2)** — degraded Upstash backend status shape (178); non-Error Upstash rejection stringified in the fallback log (233).

**src/lib/supabase.ts (+2)** — proxy client memoization (createClient called once across accesses, 44); non-function property returned unbound (56).

**src/lib/logger-sanitize.ts (+2)** — phone-like match with < 8 digits left unredacted (46); error with undefined stack (71).

**src/config/elevenlabs-agents.ts (+1)** — empty-string agent ID returns undefined (44). **This overturns a stale in-file "unreachable" comment**: the IDs are literals, but `as const` is type-only — a fresh module instance can exercise the real runtime guard. Comment replaced.

**src/components/immersive/language-switcher.tsx (+1)** — locale removed from `LOCALE_COVERAGE` treated as 0% and gated from the menu (62).

**src/hooks/use-stream-chat.ts (+1)** — HandledError catch with out-of-bounds assistantIndex after a mid-flight `resetMessages` (264).

**src/hooks/use-sse-stream.ts (+1)** — empty segments between consecutive `\n\n` delimiters skipped (52).

## Newly classified unreachable (verified this cycle, documented in test files)

- `translate-story.ts:58, 143, 247` — all 4 call sites of the private `patchStoryTranslationMetadata` pass truthy `translationStatus` (58); everything throwable in the parse try-block is an Error instance (143); `parseTranslationResponse` always pairs `success:false` with a non-empty error string (247).
- `use-sse-stream.ts:49` — `lines.pop() ?? ""`: `String.split` always returns >= 1 element, so `pop()` is never undefined.
- `use-stream-chat.ts:203` — `parseSseEvent` strictly validates to text/done/error; text/done are consumed by earlier branches, so this else-if is always true when reached.
- `use-voice-session.ts:111` — `typeof navigator` SSR fallback; navigator always exists in jsdom (same class as the line-75 window guard).
- `voice-chat.tsx:173` — retry guard: the error banner only renders after a submit that set a non-empty `lastMessage`, and the retry button is `disabled={isLoading}`.
- `story-editor-dialog/index.tsx:40, 50, 79, 84` and `image-editor-dialog.tsx:56, 109, 129` and `account-config-dialog.tsx:47` — `if (!story)` / `if (!platform)` handler guards, caller-guarded by the component's own `if (!story) return null` before any handler can be wired.
- Chart empty-state guards, all caller-gated by `length > 0` at the call site: `github-analytics-panel.tsx:254` (TrafficChart), `stripe-analytics-panel.tsx:244` (RevenueChart), `visitors-analytics-panel.tsx:343, 544` (TimeSeriesChart at line 165, UTMTable at 193).
- Private StatCard color fallbacks, all call sites pass valid literals: `github-analytics-panel.tsx:238, 246`; `stripe-analytics-panel.tsx:225, 531` (the 531 status map is exhaustively normalized server-side in `stripe-analytics/route.ts:61-79`); `visitors-analytics-panel.tsx:325`; `elevenlabs-analytics-panel.tsx:270, 471`.
- `chat-action-detection.ts:247, 260, 357, 376, 416` — the Jul 17 reachability analysis was independently re-derived and CONFIRMED: same-start candidates are impossible (landmark list has no lowercase-prefix pairs; the 6 address patterns have mutually exclusive anchors), which makes the sort tiebreaks and containment clauses unreachable; upstream dedup makes 416 unreachable.
- `language-switcher.tsx:115, 118` — defensive ref/empty-listbox guards in the keyboard handler.

## Carried forward unchanged

- Dead code (previously documented): `claude.ts:199-202, 469`; `chat-stream-timeouts.ts:55`; `image-optimization.ts:129-130`; `feature-flags/[key]/route.ts:41`; `health/route.ts:264`; `stories/[id]/image/route.ts:35-53`; `request-context.ts:49`; `use-media-query.ts:15`; `sentry-before-send.ts:8` (caller-guarded); `favorites/page.tsx:38` (observer callback pre-checks); `use-stories.ts:60, 97, 157, 340` (SSR + StrictMode guards); `posthog-provider.tsx:17`, `visitors-analytics-panel.tsx:27, 35`, `use-voice-session.ts:75` (SSR window guards).
- V8 instrumentation artifacts: `author-typewriter.tsx:40-105`; `chat-message-list.tsx:105-110`.
- Playwright-only components: `voice-agent-chat.tsx` (45.2% stmts) and `agents-dashboard/index.tsx` (49.3% stmts) remain the only substantial uncovered surface, gated on the journeys 9-12 authenticated-user fixture QA has flagged for many cycles.

## Verification

- Baseline: `npx vitest run --coverage` — 381/381 files, 7234/7234 tests, exit 0.
- Final: `npx vitest run --coverage` — 382/382 files, 7274/7274 tests, exit 0.
- Each agent verified its target branch arms individually against isolated `coverage-final.json` runs before the full-suite confirmation; `tsc --noEmit` and eslint clean on all touched files.
- No source files modified. Nothing committed — 13 modified test files plus 1 new test file (`src/lib/stories-data.fallback-metadata.test.ts`) are in the working tree for user review. The 2 uncommitted chat-action-detection tests from the Jul 17 cycle are preserved in the same file.
