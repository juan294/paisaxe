# QA Agent Report

**Status:** GREEN
**Date:** 2026-09-14
**Pass rate:** 12/12 LLM quality tests (100%), 10/10 browser journeys (100%, 1 skipped — known auth-fixture gap)

> Note: this file previously showed `Status: ABORTED / exit status 1` from a run stamped 12:14:01. That was a stale artifact of an earlier failed invocation earlier the same minute — `logs/qa-agent-2026-09-14.log` shows a second, complete run starting 12:14:12 that finished all phases (0 through 6) cleanly, matching the metrics fed into this report. Verified by reading the log directly; superseded below.

## 1. Health Status: GREEN

All three status-determining categories are clean this cycle:
- **Safety**: 3/3 safety tests passed (prompt injection, indirect injection, role-play override). No guardrail failures.
- **Integration health**: 5/5 passed, including Stripe.
- **Overall pass rate**: 100% (12/12 LLM tests, 10/10 journeys).

No RED or YELLOW triggers found.

## 2. Integration Health Summary

| Check | Result | Detail |
|---|---|---|
| App health | PASS | HTTP 200 |
| Database connectivity | PASS | 82ms latency (log), 101ms on live re-check via `/api/health/db` |
| Stripe endpoint | PASS | Reachable, HTTP 401 (admin auth correctly enforced — this is the expected/healthy response, not a failure) |
| Voyage AI (embeddings) | PASS | OK |
| Anthropic (generation) | PASS | OK |
| CI E2E status | PASS | Run `34754897283` (log, Phase 0.5). Independently re-verified via `gh run list --branch develop`: "E2E Tests", "CI", and "Lighthouse CI" workflows all green as of 2026-09-13T11:36:56Z. This resolves the "CI E2E Status: unknown" note in the invocation context — it was unknown to the harness snapshot, not actually failing. |

**Adjacent, out-of-scope finding**: a separate "Security Scan" workflow run on develop (2026-09-13, run `34754897279`) failed on its `npm audit` job. This is Security Agent's domain (their Sep 10 report already flagged 6 non-exploitable dev-tooling advisories), not a QA/LLM/E2E concern, and does not affect this report's GREEN status. Flagged here only for cross-agent visibility.

## 3. Executive Summary

- Zero test failures across all 12 LLM quality tests and all 10 executed browser journeys this cycle.
- No prompt, retrieval, or safety regressions to root-cause — this section of the report is a clean run, not a null result masking a broken harness (integration health and CI E2E are independently confirmed green, so there's no reason to suspect the 100% pass rate is an artifact of tests not running).
- The recurring "MCP routes at 0% E2E coverage" gap flagged in QA reports going back to at least 2026-03-22 (9-10 consecutive prior cycles) appears **closed**: `e2e/mcp.spec.ts` now contains 30 tests covering all 5 `/api/mcp/*` routes (`make-booking`, `make-booking/status`, `places`, `save-favorite`, `weather`) — auth-secret enforcement, validation, and both flat and MCP tool-call payload formats. Verified by reading the spec file directly.
- Feature flag mock parity confirmed independently: all 17 user-facing `FeatureFlagKey` values (`src/types/feature-flags.ts`) plus all 10 agent-toggle flags are present in `e2e/fixtures/mock-data.ts` (`MOCK_FEATURE_FLAGS`, 27 entries). Zero gaps.
- All 9 top-level pages (`/`, `/about`, `/admin`, `/coming-soon`, `/favorites`, `/immersive`, `/pricing`, `/privacy`, `/terms`) have at least one E2E reference (mostly via `visual-regression.spec.ts` plus dedicated functional specs). No page-load coverage gaps.
- One journey remains skipped: "Navigate from favorites back to immersive" (authenticated user, `qa-journey.spec.ts:528`) — this is the long-standing journeys 9-12 authenticated-fixture gap that Coverage Agent has flagged multiple times (most recently Jul 23), not a new regression.
- `src/app/api/health/voice/route.ts` (authorized deep health check for the 5 ElevenLabs voice agents) returns 404 on production (`paisaxe.es`), even with a valid-shaped `Authorization: Bearer` header. Confirmed via `git ls-tree origin/main` that this route file exists on `develop` but has never shipped to `main` — this is an unreleased route, not a broken one. Worth noting for the next release checklist since it's a genuinely useful probe (ElevenLabs credential/fingerprint check) currently only exercisable on preview/local.

## 4. Test Results by Category

| Category | Passed | Failed | Notes |
|---|---|---|---|
| RAG Quality & Source Grounding | 3/3 | 0 | PDF-sourced answer, hallucination resistance, cross-PDF synthesis |
| Safety & Security | 3/3 | 0 | Basic prompt injection, indirect injection, role-play override |
| Content Boundaries | 3/3 | 0 | Booking request, personal advice, non-travel topic |
| Response Quality | 3/3 | 0 | Place name variations, response length, Spanish language handling |
| **Total** | **12/12** | **0** | 100% pass rate |

| Journey Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Anonymous User (Journeys 1-6) | 6/6 | 0 | 0 |
| Error Handling (Journeys 7-8) | 2/2 | 0 | 0 |
| New Features (Journeys 13-14) | 2/2 | 0 | 0 |
| Authenticated User (Journeys 9-12) | 0/1 executed | 0 | 1 (no auth fixture) |
| **Total** | **10/10 executed** | **0** | **1** |

## 5. Root Cause Analysis

No failures this cycle — nothing to root-cause. For historical continuity: the last RED cycle (Chat API 403 regression, 2026-04-29) and the CSRF-token blocker (resolved 2026-03-23) are both long since closed and have shown no recurrence in the 12/12 + 10/10 results here.

## 6. Prioritized Recommendations

1. **(Low, informational)** Add `/api/health/voice` to the next release checklist's post-deploy verification list once it ships to `main` — it's the only automated way to confirm ElevenLabs agent credentials/fingerprint without a manual widget click, and it's currently unreachable on production simply because it hasn't been released yet (confirmed via `git ls-tree origin/main`), not because of a bug.
2. **(Low)** Unlock the authenticated-user Playwright fixture for journeys 9-12 (`qa-journey.spec.ts`) — this is the same standing ask Coverage Agent has made since at least Jul 18 for `voice-agent-chat.tsx` and `agents-dashboard/index.tsx` vitest coverage, and it would let this report stop reporting "1 skipped" every cycle.
3. **(Low)** 174 `data-testid` attributes in source have no E2E spec reference. This is a large surface but low priority — the gap analysis doesn't distinguish testids that are already indirectly covered (e.g. via role/text selectors) from truly untested UI. Recommend a follow-up pass that cross-references testids against components with zero E2E imports at all, rather than a raw testid grep, to get a more actionable subset.
4. No action needed on Stripe, Voyage, Anthropic, Supabase, or CI — all confirmed healthy this cycle.

## 7. Manual Testing Checklist Reminder

Automated coverage does not replace manual verification for:
- Pelayo voice widget end-to-end purchase/booking flow on `paisaxe.es` (per Cost Analyst's repeated asks — deferred pending the ElevenLabs account-separation decision, tracked separately, not a QA blocker).
- Day Pass Stripe checkout with a real card in production.
- Visual/UX review of any admin dashboard changes not covered by Playwright (`voice-agent-chat`, `agents-dashboard` remain Playwright-only per Coverage Agent).

## 8. E2E Test Gap Analysis

**Feature flags**: 0 gaps. 27/27 flags (17 user-facing + 10 agent) present in `e2e/fixtures/mock-data.ts`, verified against `src/types/feature-flags.ts` directly.

**API routes**: Of the 58 routes under `src/app/api/`, the following have no E2E reference. All are admin-only, cron-only, or internal per Documentation Agent's repeated verification (Jul 20 - Aug 27) — this list is provided for completeness, not as new findings:
- `admin/*` (agent-config, agents-summary, agents/run, analytics, costs-analytics[+/[id]], elevenlabs-analytics, feature-flags/[key], github-analytics, marketing/*, stories/* [content-images, image-source, image, [id], status, translations, approve-all, bulk-delete, bulk-status, route], stripe-analytics, suggestions[+/[id]], tunnel, voice-session)
- `cron/*` (content-discovery, elevenlabs-voice-canary, fail-stale-bookings, fail-stale-translations, github-traffic-sync, subscription-optimizer)
- `health/voice` (unreleased to `main`, see Executive Summary)

**Pages**: 0 gaps. All 9 top-level pages have at least one E2E reference.

**MCP routes**: 0 gaps (closed this cycle — see Executive Summary). `e2e/mcp.spec.ts` covers auth, validation, and payload-format handling for all 5 tools.

**data-testid**: 174 attributes in source with no direct E2E selector reference (low priority, see Recommendation 3).

---
