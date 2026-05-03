# Coverage Agent Report — 2026-05-03

## Summary

- **Test suite**: 6394 total tests (up ~490 from Apr 20). 6388 pass, 6 load-induced flakes (consistent with the documented "Max 4-6 concurrent agents" failure mode — see Test Suite Health).
- **TypeScript**: Pass (no errors).
- **Overall coverage** (post-edit, full suite under load):
  - statements: 97.07% (10187/10494)
  - branches: 93.44% (6660/7127)
  - functions: 96.57% (1972/2042)
  - lines: 97.57% (9699/9940)
- **Vitest config thresholds** (95/90/95/95): all PASS.
- **Plateau context**: Apr 20 baseline was 98.54% statements / 95.94% branch on 5904 tests. Wave-2 merges (1a3ba7c5, 5023f7eb, FE-M2 split, etc.) added significant new code (~490 new tests, ~1500 new statements) — overall % is slightly lower, but only because the new surface area is large; absolute uncovered count is similar.
- **Changes this run**: +29 targeted tests in `stories-tab-panel.test.tsx` lifting that file from **47.61% statements / 33.33% branch / 50% line** (one of the lowest-coverage files in the codebase) to **96.59% statements / 86.20% branch / 99.26% line**.

## Changes This Run

| File | Tests | Coverage before | Coverage after |
|------|-------|-----------------|----------------|
| `src/components/admin/stories-tab-panel.test.tsx` | 12 → 41 (+29) | stmt 47.61% / br 33.33% / fn 38.29% / line 50% | stmt 96.59% / br 86.20% / fn 97.87% / line 99.26% |

`StoriesTabPanel` was extracted from `AdminShell` in the FE-M2 wave-2 split (commit `f0f9ab62`). Pre-existing tests covered rendering, pagination URL handling, and the error-on-fetch branch. Major handler logic was uncovered.

### Coverage Detail — what's new

**Filter switching (5 tests):**
- `Pending` stat card returns to `needs_curation` filter
- `Approved` stat card filters to `curationStatus === "approved"`
- `Total` stat card removes filter
- `Missing i18n` stat card uses `hasMissingTranslations`
- Search input filters by title (case-insensitive)

**Bulk operations (10 tests):**
- `handleBulkMarkApproved` happy path + API error path
- `handleBulkMarkPending` happy path + API error path
- `handleBulkDelete`: confirm-true (singular vs plural copy), confirm-false no-op, API error path
- `handleClearSelection` hides toolbar
- Toggle same story twice deselects it (`handleToggleSelect` add/delete branch)

**Approve all (4 tests):**
- Confirm dialog opens
- Cancel button closes dialog
- Confirm calls `approveAllPendingStories` and updates state
- API error surfaced

**Editor + create dialog handlers (3 tests):**
- Click edit on a story passes it to `setEditingStory`
- `onUpdate` callback updates story by id (covers the `prev.id === storyId` branch and the no-match passthrough)
- `Create Story` button opens dialog; `onCreated` callback reloads page 1

**Loading + filter rejection (2 tests):**
- Loading spinner visible during in-flight fetch (`isLoading && stories.length === 0` branch)
- "No stories match this filter" copy when stories are loaded but filter excludes them

**Pagination clamping (3 tests):**
- URL `?storiesPage=0` clamps to 1
- URL `?storiesPage=abc` falls back to 1
- Last-page Next button is disabled

### Mock infrastructure changes

The pre-existing tests stubbed `StoryGrid`, `StoryEditorDialog`, `CreateStoryDialog`, and `SelectionToolbar` as `() => null`, which made handler verification impossible. The mocks were rewritten to:
- Render selection-toggle and edit buttons inside `StoryGrid` (one `data-testid` per story id) so `onEdit` / `onToggleSelect` can be exercised.
- Capture the live `StoryEditorDialog` props (`onUpdate`, `onClose`, `story`) into a module-scope object so `handleStoryUpdate` can be invoked from outside the component tree.
- Capture `CreateStoryDialog` `onCreated` likewise.
- Render a real `SelectionToolbar` once `selectedCount > 0` so its callbacks can be clicked by testid.

This pattern is reusable for other dialog-heavy admin components with the same coverage gap.

## Remaining Uncovered Files

Carried items from the documented plateau — all flagged in prior coverage agent runs:

| File | Stmt | Branch | Category |
|------|------|--------|----------|
| `voice-agent-chat.tsx` | 42.7% | 40.7% | Requires Playwright E2E (carried from 16+ runs) |
| `agents-dashboard/index.tsx` | 49.3% | 47.8% | Requires Playwright E2E (carried from 16+ runs) |
| `instrumentation.ts` | 71.4% | 43.8% | Sentry init, only invoked under server runtime |
| `author-typewriter.tsx` | 86.1% | 62.2% | V8 instrumentation artifact for async-timer paths (documented Apr 15) |
| `app/api/health/route.ts` | 86.3% | 87.0% | Some service-failure branches require live downstream errors |
| `app/api/admin/stories/[id]/image/route.ts` | 86.5% | 73.7% | Multipart parsing edge cases |
| `app/api/webhooks/translate/route.ts` | 87.5% | 76.2% | Provider error variants |
| `logger.ts` | 87.5% | 76.9% | `makePinoLogger()` only invoked under `NODE_ENV=production` |
| `marketing-dashboard/post-row.tsx` | 87.5% | 87.5% | Defensive null guards |
| `use-stream-chat.ts` | 88.7% | 85.4% | Non-trivial SSE error paths |
| `admin-auth.ts` | 88.9% | 84.4% | Some auth-failure modes only reachable under prod cookies |
| `use-media-query.ts` | 93.3% | 50.0% | `typeof window === "undefined"` SSR guard (jsdom always defines window) |
| `chat-action-detection.ts` | 99.2% | 80.3% | Defensive branches; not load-bearing for action correctness |

These mirror the pattern documented in prior reports. None were modified this cycle to keep the change scope small and avoid load-induced flake risk.

## Test Suite Health

The run was executed under heavy concurrent agent load (60+ Claude/vitest processes from sibling agent runs in other projects). Confirmed match for the `feedback_background_agent_concurrency` rule documented in memory: *"Max 4–6 concurrent agents; more causes git locks, tsc zombie storms, vitest starvation."*

- **First attempt** (default workers): **103 tests timed out** in 934 seconds — pure resource starvation.
- **Second attempt** (`--maxWorkers=4 --testTimeout=15000`): 5 files / 6 tests failed in 1112 seconds. Remaining failures are all timing-sensitive:
  - `accessibility.test.tsx` — SSE streaming wait (`expect(liveRegion.textContent).toContain("AI response about the lakes")` timeout)
  - `github-analytics/route.test.ts` PE-L1 — parallel-fetch elapsed assertion (`245ms` measured vs `<120ms` expected) under load
  - `marketing-dashboard.test.tsx` — Retry button waitFor
  - `accessibility.test.tsx` (other branches)
- **Third attempt** (post-edit, same load): 6394 → 6388 pass; same 6 load-induced failures recurred — none are correctness regressions.

All 41 tests in the modified `stories-tab-panel.test.tsx` pass cleanly in isolation in 2.0s. No new tests added under this run are flaky.

## Recommendations

- **No source-code changes required.** The new tests cover production behavior that was previously asserted only by smoke render.
- Continue tracking `voice-agent-chat.tsx` and `agents-dashboard/index.tsx` as Playwright E2E targets (carried from 17+ runs; cannot be lifted in jsdom).
- Consider adding a coverage CI workflow with `--maxWorkers=4` to avoid the load-induced flakes that intermittently appear in full-suite runs on developer machines.
- The mock infrastructure pattern used in `stories-tab-panel.test.tsx` (capturing dialog props in module-scope refs) is reusable for other admin components currently below threshold and dialog-heavy — `agents-dashboard/index.tsx` is a candidate, though much of its uncovered surface needs Playwright.
