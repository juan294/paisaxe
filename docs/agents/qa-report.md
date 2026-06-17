# QA Agent Report — 2026-06-17

## 1. Health Status: YELLOW

| Signal | Result |
|--------|--------|
| LLM quality tests | 0 / 12 — all skipped (harness preflight, not assertion) |
| Browser journey tests | 10 / 10 passed (4 auth journeys skipped) |
| Integration health | 3 / 3 passed |
| Safety guardrails | Not verified this cycle (tests never reached the server) |

Status is YELLOW, not RED. The LLM test suite failure is a single harness/config defect (no server on the expected port), not a safety-guardrail failure and not an application regression. Integration health is fully green, and every browser journey passes. However, this is now the **fourth consecutive cycle** in which the LLM quality safety net has produced no usable data. The inability to confirm safety, boundary, RAG, and quality behavior is a real and widening gap.

Status would escalate to RED if: (a) any safety assertion actually failed, or (b) an integration health check (Stripe/Supabase) failed. Neither occurred this cycle.

## 2. Integration Health Summary

| Service | Status | Notes |
|---------|--------|-------|
| Supabase / App | Pass | 3/3 integration checks passed; app and DB healthy |
| Stripe / Payments | Pass | No auth failure this cycle |
| External APIs | Pass | All reachable |

CI E2E status: unknown (not reported this run).

No integration failures. Per the RED rules, integration health does not force RED this cycle.

## 3. Executive Summary

- **All 12 LLM quality tests failed at preflight.** The `beforeAll` harness check (`src/tests/qa/llm-quality.test.ts:27`) attempts to reach `GET /api/health` on `http://localhost:3000` and throws `QA HARNESS: no server reachable at http://localhost:3000` before any test body executes. All 12 tests are skipped, not individually failed.
- **Root cause is the known, already-filed harness bug: GitHub issue #635** (OPEN, `type: bug`, `priority: high`, `area: infra`). This is the fourth consecutive cycle with this failure. The Jun 16 triage added the clearer preflight error message; the permanent fix (webServer config) is still pending.
- **Browser journeys are stable: 10/10 passing**, 4 authenticated journeys skipped (require auth state). Chat panel, story navigation, health endpoint, suggestion flow, and multi-turn chat all verified in a real browser.
- **No safety regression — but no safety confirmation either.** The guardrails themselves are not implicated; there is simply no signal on them for the fourth cycle running. Security agent (Jun 15, Jun 16) flagged the same gap: "Re-confirm safety guardrails once #635 lands."
- **E2E coverage gap is low-priority this cycle.** The test gap analysis reports 163 `data-testid` attributes in source that are not referenced in any E2E spec. No high or medium priority gaps were identified.
- **Cost Analyst context**: 124-day revenue drought and 120-day voice silence remain unexplained. Manual production verification of the Pelayo voice widget and Day Pass purchase flow on paisaxe.es is the highest-priority outstanding action across agents.

## 4. Test Results by Category

| Category | Tests | Passed | Skipped | Reason |
|----------|-------|--------|---------|--------|
| RAG Quality & Source Grounding | 3 | 0 | 3 | Harness preflight failed — no server on :3000 |
| Safety & Security | 3 | 0 | 3 | Harness preflight failed — server never reached |
| Content Boundaries | 3 | 0 | 3 | Harness preflight failed — server never reached |
| Response Quality | 3 | 0 | 3 | Harness preflight failed — server never reached |
| **LLM total** | **12** | **0** | **12** | **Harness port defect (#635)** |
| Browser journeys (Playwright) | 14 | 10 | 0 | 4 skipped (auth-gated journeys 9-12) |

Failed test output (the actual error, same as prior cycles — now with cleaner preflight message):

```
FAIL src/tests/qa/llm-quality.test.ts
Error: QA HARNESS: no server reachable at http://localhost:3000 — start
the app before running npm run test:qa, or set NEXT_PUBLIC_SITE_URL.
See issue #635 for the permanent fix (webServer config).
  at src/tests/qa/llm-quality.test.ts:34:11
```

## 5. Root Cause Analysis

**Single root cause for all 12 skips — environment configuration, not code or model behavior.**

1. `src/tests/qa/llm-quality.test.ts:15` resolves the target as:
   `const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';`
   With `NEXT_PUBLIC_SITE_URL` unset in the agent environment, it falls back to `http://localhost:3000`.

2. `vitest.config.qa.ts` has no `webServer` / global-setup hook — unlike Playwright, the QA vitest config does not start a Next.js server. It assumes one is already running on port 3000.

3. The agent run does not have a dev/prod server listening on 3000. The Playwright journey suite passes precisely because `playwright.config.ts` auto-starts its own `webServer`. The QA LLM suite has no equivalent.

4. The Jun 16 triage added a preflight `beforeAll` that converts the 12 opaque ECONNREFUSED stacks into a single, actionable harness error pointing at issue #635. The underlying problem is unchanged.

**Not the cause:** prompt quality, RAG retrieval, model behavior, CSRF protection, Stripe, or Supabase.

**Consecutive cycle count**: 4 (Jun 14, Jun 15, Jun 16, Jun 17 — all the same root cause).

## 6. Prioritized Recommendations

**P0 — Fix the QA harness port/server (resolves all 12 skips at once). Ref: #635.**

Pick one of:
- **Option A (preferred): add a `webServer`-equivalent to the QA run.** Give `vitest.config.qa.ts` a `globalSetup` that starts `npm run build && npm run start -- --port 3000` before tests and tears it down after. This makes the suite self-contained, matching how Playwright manages its server.
- **Option B (quick workaround): set `NEXT_PUBLIC_SITE_URL` to a deployed URL.** Point the QA agent at the staging or production deployment (`https://paisaxe.es`). No server startup needed; tests run against live infrastructure. Downside: mutates real data, incurs Anthropic API costs per CI run.
- **Option C (minimal, avoids build cost): run `npm run dev -- --port 3000` in the background before `npm run test:qa`.** Modify the agent shell script to start the dev server, wait for the health endpoint, run the suite, then kill the server. Works today with no code changes to the test harness.

Until one of these is implemented, the safety net remains dark.

**P1 — Manual production verification of Pelayo and Day Pass (not a code task).**

The Cost Analyst reports 124 days without revenue and 120 days without voice usage. This is the 4th consecutive QA cycle flagging this. Manual verification on paisaxe.es is the only way to determine whether the Pelayo voice widget and the Day Pass checkout flow are working for real users.

**P2 — Expand E2E coverage for authenticated user journeys.**

Journeys 9-12 (add/verify favorites, localStorage persistence, navigation) are skipped in every cycle because they require authenticated state. Adding an auth fixture to `e2e/qa-journey.spec.ts` would bring the covered journey count from 10 to 14.

**P3 — Reduce untagged `data-testid` gap.**

163 `data-testid` attributes in source are not referenced in any E2E spec. This is low-priority but represents components with no E2E-level verification. Prioritize coverage for: voice agent chat widget, story editor dialog (save/approve/curate handlers), and agents dashboard — all flagged by the Coverage agent as Playwright-only targets.

## 7. Manual Testing Checklist

The following cannot be automated and require manual verification on the live site (paisaxe.es):

- [ ] Pelayo voice widget loads and initiates a conversation
- [ ] Day Pass purchase flow completes end-to-end (Stripe checkout to access grant)
- [ ] Admin dashboard loads and displays data for an authenticated admin user
- [ ] Chat API returns responses with source attribution (confirms RAG pipeline is live)
- [ ] Story navigation (arrows, keyboard) works on mobile viewport
- [ ] Booking flow via Pelayo completes without error (ElevenLabs + make_booking webhook)

## 8. E2E Test Gap Analysis

**Overall gap severity: LOW** — No new high or medium priority gaps identified this cycle.

### Identified gaps

**Authenticated user journeys (medium-priority):**
- Journeys 9-12 in `e2e/qa-journey.spec.ts` are marked with `-` (skipped). These cover: favorites page access, add-favorite via API, localStorage persistence across navigation, navigate favorites to immersive. All require auth state. Recommended fix: add a `storageState` fixture with a pre-authenticated session.

**data-testid coverage (low-priority):**
- 163 `data-testid` attributes in source are not referenced in any E2E spec. Priority targets for new E2E tests, in order of risk:
  1. `data-testid="voice-agent-chat"` — voice agent chat widget (voice-agent-chat.tsx is at ~45% unit coverage; no E2E)
  2. `data-testid="agents-dashboard"` — agents dashboard (agents-dashboard at ~49% unit coverage; no E2E)
  3. `data-testid="story-editor-*"` — story editor save/approve/curate handlers (E2E-only per Coverage agent)

**Feature flag mock completeness (Pass):**
- All 17 `FeatureFlagKey` values and 10 agent flags are confirmed present in source. No gaps.

**API routes without E2E smoke tests (carried, medium-priority):**
- `/api/mcp/*` — `e2e/mcp.spec.ts` now exists (closed in Jun 16 report), but depth of coverage is unverified.
- Remaining routes without dedicated smoke tests should be audited when #635 is resolved and the full LLM suite runs cleanly.

---
