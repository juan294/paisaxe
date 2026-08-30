# QA Agent Report

**Status: RED**
**Date:** 2026-08-27

Root cause identified and isolated to a single line: this is a QA harness regression, not a product or LLM safety regression. Safety guardrails are unverified this cycle (not failing) because all 12 tests were blocked before any LLM traffic occurred.

## 1. Health Status: RED

- LLM Quality Tests: **0/12 (0%)** — all 12 tests failed identically with `Chat API error: 403 (Origin not allowed)`, none reached the LLM.
- Browser Journey Tests: **10/10 (100%)** — 1 skipped (unrelated, authenticated-user fixture), no regressions.
- Integration Health Checks: **5/5 passed** (App health, DB, Stripe reachability, Voyage AI, Anthropic).
- Per the safety-first rule, status is RED: safety guardrails (instruction override, role-play override, indirect injection) could not be exercised at all this cycle, so they cannot be marked as passing.

## 2. Integration Health Summary

| Check | Status | Detail |
|---|---|---|
| App health | PASS | `/api/health` returned healthy |
| Database (paisaxe.es) | PASS | Reachable |
| Stripe (`/api/checkout/health`) | PASS | Reachable (admin-auth enforced as expected) |
| Voyage AI | PASS | Embeddings endpoint reachable, HTTP 200 |
| Anthropic | PASS | Messages endpoint accepted minimal generation, HTTP 200 |

All upstream services are healthy. This confirms the 403s are an application-layer/proxy-layer issue local to the QA harness's own request shape, not a Voyage/Anthropic/Stripe/Supabase outage.

## 3. Executive Summary

Every one of the 12 LLM quality tests failed with the exact same error: `Chat API error: 403 (Origin not allowed)`, thrown from `src/tests/qa/llm-quality.test.ts:116`, from the very first attempt of `sendChatMessage()`'s POST to `/api/chat/stream`. No retries recovered it (403 is not retried — only 429 and network errors are), and no test got far enough to exercise RAG, safety, boundary, or quality assertions.

**Root cause (traced to source, not inferred):**

1. `scripts/qa-agent.sh:187-203` (QA-H3, issue #870) intentionally changed the harness to run the production artifact — `npm run build` then `npm run start -- --port 3006` — instead of `npm run dev`, so the QA gate exercises the same Anthropic SDK transport real traffic uses. This is correct and working as intended for the model-call path.
2. A side effect of that change: `next start` runs with `NODE_ENV=production`, not `"development"`.
3. `src/lib/proxy/cors.ts:15-17` only appends `http://localhost:3006` to `ALLOWED_ORIGINS` when `process.env.NODE_ENV === "development"`:
   ```
   if (process.env.NODE_ENV === "development") {
     ALLOWED_ORIGINS.push("http://localhost:3006");
   }
   ```
   Under `next start` this branch never runs, so `http://localhost:3006` is never in `ALLOWED_ORIGINS`.
4. `scripts/qa-agent.sh:501` sets `export NEXT_PUBLIC_SITE_URL="http://localhost:3006"`, which `src/tests/qa/llm-quality.test.ts:20` reads as `API_URL` and sends as the `Origin` header on every POST (`llm-quality.test.ts:84`).
5. `src/lib/csrf.ts:108-113` (`validateOrigin`) rejects any request whose `Origin` header isn't in the allowed list — `http://localhost:3006` isn't, so it returns `false`.
6. `src/lib/proxy/csrf-proxy.ts:36-41` (`handleCsrfValidation`) turns that `false` into `403 { error: "Origin not allowed" }` before the request ever reaches the chat route handler.

**Why Playwright didn't hit this:** `playwright.config.ts:202` passes `PLAYWRIGHT_TEST_ORIGIN: baseURL` to its own `next build && next start` server, and `cors.ts:26-28` allow-lists that origin independently of `NODE_ENV` (gated only on `VERCEL_ENV` being unset). The vitest QA harness has no equivalent — it sets `NEXT_PUBLIC_SITE_URL` for the test client but never tells the server process which origin to trust.

This is a regression introduced by the QA-H3 production-parity change: it fixed the Anthropic transport-parity problem but silently broke the dev-only origin allowlist for the one case (a QA-only `next start` server) that isn't real dev and isn't Playwright either.

## 4. Test Results by Category

| Category | Passed | Failed | Notes |
|---|---|---|---|
| RAG Quality & Source Grounding | 0 | 3 | Blocked pre-LLM by 403 |
| Safety & Security | 0 | 3 | Blocked pre-LLM by 403 — **guardrails unverified, not failing** |
| Content Boundaries | 0 | 3 | Blocked pre-LLM by 403 |
| Response Quality | 0 | 3 | Blocked pre-LLM by 403 |
| **Total** | **0** | **12** | **0% pass rate** |

Failed assertion (identical across all 12, per `sendChatMessage`):
```
Error: Chat API error: 403 (Origin not allowed)
 -> sendChatMessage src/tests/qa/llm-quality.test.ts:116:13
```

## 5. Root Cause Analysis

- **Not a prompt issue.** No prompt was ever sent to Claude — Anthropic health check (Phase 0) independently confirmed the API accepts a minimal generation.
- **Not a RAG/retrieval issue.** No query reached the retrieval pipeline.
- **Not a model-behavior issue.** No model output was ever produced or evaluated.
- **Is a harness/infra issue.** A one-line env condition (`cors.ts:15`) written for the pre-QA-H3 world (`npm run dev`) doesn't cover the current QA-H3 world (`npm run start`). This is the same class of harness fragility flagged repeatedly in shared context this year (silent `set -e` deaths, ANSI-strip bugs, mtime-based build-freshness checks) — a check written for one runtime mode silently doesn't fire in another.

## 6. Prioritized Recommendations

**P1 — Fix the origin allowlist for the QA harness's production server (blocks all LLM quality signal):**
Two options, either sufficient:
- (a) In `scripts/qa-agent.sh`, before starting `next start` (around line 203), also `export PLAYWRIGHT_TEST_ORIGIN="http://localhost:3006"` — reuses the existing `cors.ts:26-28` mechanism, which is `VERCEL_ENV`-gated rather than `NODE_ENV`-gated and therefore fires correctly under `next start`. Lowest-diff fix.
- (b) Generalize `cors.ts:26` to a more accurately-named env var (e.g. `LOCAL_TEST_ORIGIN`) checked by both `playwright.config.ts` and `qa-agent.sh`, since "PLAYWRIGHT_TEST_ORIGIN" is no longer Playwright-exclusive once QA-H3 also runs a local production server. Slightly larger diff, clearer naming.

Recommend (a) now to restore signal immediately, file (b) as a follow-up naming cleanup.

**P2 — Once the origin check is fixed, re-run the full 12-test suite before trusting any other conclusion.** Safety, RAG, boundary, and quality results from prior cycles (last confirmed green: 2026-06-22) cannot be assumed to still hold — 66 days have passed with zero verified LLM-layer signal in between except this blocked run.

**P3 — Add a harness-level guard so a 403-on-every-test presents as a distinct "harness blocked" result, not a generic 0% pass rate.** The current output is indistinguishable from "the model failed every safety/quality check," which is a much scarier (and wrong) signal. A preflight probe (single POST to `/api/chat/stream` before the main suite, asserting non-403) would let the harness fail fast with an unambiguous message instead of running — and miscategorizing — all 12 tests.

## 7. Manual Testing Checklist Reminder

Automated LLM safety/quality signal is unavailable this cycle. Until P1 lands and the suite re-runs green, manually verify on paisaxe.es before any release:
- [ ] Chat responds to a basic Asturias tourism query with source attribution
- [ ] Chat refuses an instruction-override / role-play-override prompt
- [ ] Chat declines to fabricate information when RAG returns no results
- [ ] Chat stays on-topic when asked for personal advice or off-topic content

## 8. E2E Test Gap Analysis

**HIGH PRIORITY:**
- `/api/stories` (`src/app/api/stories/route.ts`) has no E2E spec referencing it. It has a unit test (`route.test.ts`) but zero smoke coverage in `e2e/*.spec.ts`. Recommended test: add a case to `e2e/api.spec.ts` asserting `GET /api/stories` returns 200 with a non-empty array — this is the endpoint the immersive story list is built from, and it has been untested at the E2E layer since before the last commit to that route (`36f78a18`, FE-H1 logging fix).

**MEDIUM PRIORITY:**
- Feature flags: none missing — `MOCK_FEATURE_FLAGS` in `e2e/fixtures/mock-data.ts` is in parity with `FeatureFlagKey` (consistent with Documentation Agent's 2026-08-27 flag-count check).

**LOW PRIORITY:**
- 179 `data-testid` attributes in `src/` are not referenced in any `e2e/*.spec.ts` file (up slightly from the 174 raw count in the harness's own dedupe pass — same underlying gap, long-carried, not new this cycle). No single component stands out as a new, unreviewed addition; this remains a broad, low-risk backlog item rather than a regression.
- No new pages found without at least a partial load/render test.

No new API routes, feature flags, or pages have been added since the last documentation-agent GREEN pass (2026-08-27) that aren't already covered by this list — the `/api/stories` gap is the only actionable, concrete item.

---
