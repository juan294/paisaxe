# QA Agent Report — 2026-06-16

## 1. Health Status: YELLOW

| Signal | Result |
|--------|--------|
| LLM quality tests | 0 / 12 — all failed (infrastructure, not assertion) |
| Browser journey tests | 10 / 10 passed (4 auth journeys skipped) |
| Integration health | 3 / 3 passed |
| Safety guardrails | Not verified this cycle (tests never reached the server) |

Status is YELLOW, not RED. The 12 LLM failures are a single harness/config defect (no server on the expected port), not safety-guardrail failures and not an application regression. Integration health is fully green, and every browser journey passes. However, this is now the **third consecutive cycle** in which the LLM quality safety net has produced no usable data — the inability to confirm safety/boundary/RAG behavior is a real and widening gap, which is why this is not GREEN.

Status would escalate to RED if: (a) any safety assertion actually failed, or (b) an integration health check (Stripe/Supabase) failed. Neither occurred this cycle.

## 2. Integration Health Summary

| Service | Status | Notes |
|---------|--------|-------|
| Supabase / App | Pass | 3/3 integration checks passed; app and DB healthy |
| Stripe / Payments | Pass | No auth failure this cycle (contrast with 2026-03-23 `Authentication required`) |
| External APIs | Pass | All reachable |

CI E2E status: unknown (not reported this run).

No integration failures. Per the RED rules, integration health does not force RED this cycle.

## 3. Executive Summary

- **All 12 LLM quality tests failed with `TypeError: fetch failed` / `ECONNREFUSED ::1:3000` and `127.0.0.1:3000`.** Every failure is identical: the test helper `getCsrfToken()` (`src/tests/qa/llm-quality.test.ts:26`) tries to `fetch(${API_URL}/)` and the connection is refused because **no server is listening on port 3000**.
- **Root cause is a known, already-filed harness bug: GitHub issue #635** (OPEN, `type: bug`, `priority: high`, `area: infra`) — "QA: LLM quality tests fail with ECONNREFUSED — port 3006 server vs port 3000 test default". No new issue needed; this report adds the third data point.
- **Browser journeys are stable: 10/10 passing**, 4 authenticated journeys skipped (require auth state). This confirms the chat panel, story navigation, health endpoint, and suggestion flow all render and function in a real browser.
- **No safety regression — but no safety confirmation either.** Because the connection was refused, the safety/boundary/RAG/quality assertions never executed. The guardrails themselves are not implicated; we simply have no signal on them for the third cycle running (Security agent flagged the same on Jun 14 and Jun 15).
- **E2E coverage improved:** `e2e/mcp.spec.ts` now exists, closing the long-standing `/api/mcp/*` 0%-coverage gap reported for ~10 consecutive QA cycles. Feature flag mocks are complete (all 17 `FeatureFlagKey` + 10 agent flags present).

## 4. Test Results by Category

| Category | Tests | Passed | Failed | Reason |
|----------|-------|--------|--------|--------|
| RAG Quality & Source Grounding | 3 | 0 | 3 | ECONNREFUSED — no server on :3000 |
| Safety & Security | 3 | 0 | 3 | ECONNREFUSED — server never reached |
| Content Boundaries | 3 | 0 | 3 | ECONNREFUSED — server never reached |
| Response Quality | 3 | 0 | 3 | ECONNREFUSED — server never reached |
| **LLM total** | **12** | **0** | **12** | **Harness/port defect (#635)** |
| Browser journeys (Playwright) | 14 | 10 | 0 | 4 skipped (auth-gated) |

Failed assertions (the actual error, identical across all 12):

```
TypeError: fetch failed
  ❯ getCsrfToken src/tests/qa/llm-quality.test.ts:26:24
  ❯ sendChatMessage src/tests/qa/llm-quality.test.ts:37:21
Caused by: AggregateError
  - connect ECONNREFUSED ::1:3000
  - connect ECONNREFUSED 127.0.0.1:3000
```

## 5. Root Cause Analysis

**Single root cause for all 12 failures — environment, not code or model behavior.**

1. `src/tests/qa/llm-quality.test.ts:15` resolves the target as:
   `const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';`
   With `NEXT_PUBLIC_SITE_URL` unset in the agent environment, it falls back to `http://localhost:3000`.

2. `vitest.config.qa.ts` has **no `webServer` / global-setup hook** — unlike Playwright, the QA vitest config does not start a Next.js server. It assumes one is already running on port 3000.

3. The agent run did not have a dev/prod server listening on 3000 (the project's E2E server runs on a different port — Playwright uses `3100` by default per `playwright.config.ts:6`, and issue #635 references `3006`). Result: every `fetch` is refused at the TCP layer before any HTTP request is made.

4. The Playwright journey suite passes precisely **because** `playwright.config.ts` auto-starts its own `webServer` (`npm run dev/start -- --port ${e2ePort}`). The QA LLM suite has no equivalent, so it is the only suite that fails.

This is exactly the failure mode tracked in **issue #635** and corroborated by the Security agent's notes (2026-06-14: "Port-mismatch (#635) is a harness config bug, not a security regression — CSRF intact, no test reached a server"; 2026-06-15: "Safety guardrails unverified 2 cycles running"). This run makes it three.

**Not the cause:** prompt quality, RAG retrieval, model behavior, CSRF protection (the CSRF logic is never reached), Stripe, or Supabase.

## 6. Prioritized Recommendations

**P0 — Fix the QA harness port/server (resolves all 12 failures at once). Ref: #635.**
Pick one of:
- **Option A (preferred): add a `webServer`-equivalent to the QA run.** Give `vitest.config.qa.ts` a `globalSetup` that boots `npm run start -- --port 3000` (and tears it down), mirroring how Playwright manages its server. This makes the suite self-contained like the journey suite.
- **Option B: align the URL with the running server.** In the agent script, export `NEXT_PUBLIC_SITE_URL=http://localhost:<the-port-the-agent-starts>` before `npm run test:qa`, and ensure the agent actually starts a server on that port. The port the harness uses (3006 per #635) must match the URL.
- **Option C (minimum viable signal): run LLM QA against a known-good deployed preview.** Set `NEXT_PUBLIC_SITE_URL` to a Vercel preview/staging URL so the suite tests a real running app instead of needing a local server. (Watch rate limits — `sendChatMessage` already retries on 429.)

**P1 — Make the harness fail loud and early.** Add a `beforeAll` preflight in the QA suite that pings `${API_URL}/api/health` and emits a clear `QA HARNESS: no server reachable at <url> — see issue #635` message instead of 12 opaque `fetch failed` stacks. This converts 3 cycles of silent blindness into an immediate, actionable signal.

**P2 — Manual production verification remains the top operational priority.** With the automated LLM net blind for a third cycle AND a 123-day revenue drought / 119-day Paisaxe voice silence (Cost Analyst, 2026-06-16), the only current confirmation that production chat, the Pelayo voice widget, and the Day Pass purchase flow actually work is manual. This is doubly urgent precisely because the automated safety net is down. See checklist below.

**P3 — Once #635 is fixed, immediately re-run and confirm safety guardrails** (injection resistance, PII extraction refusal, indirect injection, on-topic boundaries). These are the assertions that have gone unverified for three cycles.

## 7. Manual Testing Checklist Reminder

Automated tests cannot cover these — verify manually on production (paisaxe.es):

- [ ] **Day Pass purchase flow** — complete a real Stripe checkout end-to-end (highest priority: 123-day revenue drought).
- [ ] **Pelayo voice widget** — load, connect, and hold a short conversation (119-day voice silence; confirm the click-to-mount ElevenLabs chunk loads).
- [ ] **Text chat on production** — send a query, confirm a grounded response with source attribution renders.
- [ ] **Safety spot-check** — manually attempt one prompt-injection and one off-topic query against production chat while #635 keeps the automated safety tests offline.
- [ ] **Authenticated journeys** — the 4 skipped Playwright auth journeys (favorites add/persist/navigate) should be spot-checked with a real signed-in session.

## 8. E2E Test Gap Analysis

**Improvements since prior cycles:**
- **`/api/mcp/*` coverage gap closed.** `e2e/mcp.spec.ts` now exists. The three MCP routes (`make-booking`, `places`, `weather`) previously flagged at 0% E2E for ~10 consecutive QA cycles now have a spec. Recommend a quick confirmation that all three routes are actually exercised by it.
- **Feature flag mocks complete.** All 17 `FeatureFlagKey` values (`src/types/feature-flags.ts:1-17`) are present in `MOCK_FEATURE_FLAGS` (`e2e/fixtures/mock-data.ts:40`), plus 10 agent flags. **Zero drift.** No stale or missing flag mocks.

**Remaining gaps (LOW priority):**
- **163 `data-testid` attributes in source are not referenced by any E2E spec.** These are predominantly admin-dashboard and editor controls reachable only by authenticated/admin sessions. Highest-value targets for new coverage (consistent with Coverage agent 2026-06-16, which flags these as Playwright-only):
  - `voice-agent-chat` (~45% unit coverage) — add a journey: open the voice widget, assert connect state via its testid, send/receive one turn.
  - `agents-dashboard/index` (~49%) — admin-only; add an authenticated journey that loads the dashboard and asserts a tab/panel testid renders.
  - `story-editor-dialog/index.tsx` save/approve/curate handlers — E2E-only; add an admin journey that opens the editor and exercises save.

**Suggested concrete tests:**
- QA LLM suite preflight: `await fetch(${API_URL}/api/health)` in `beforeAll`, assert HTTP 200, else throw a labeled harness error referencing #635 (selector: `/api/health`).
- MCP spec assertion check: verify `e2e/mcp.spec.ts` covers POST `/api/mcp/make-booking`, `/api/mcp/places`, `/api/mcp/weather` (routes: `src/app/api/mcp/{make-booking,places,weather}/route.ts`).
- Voice widget journey: navigate to a page mounting the widget, click the mount trigger, assert the `voice-agent-chat` container testid becomes visible.

## 9. Cross-Agent Notes Incorporated

- **Security (2026-06-14/15):** confirmed #635 is a harness config bug, CSRF intact, no server reached — consistent with this run's root cause. Safety guardrails unverified for a 3rd cycle.
- **Coverage (2026-06-16):** suite green at 98.67% statements; `basic-markdown.tsx` (react-markdown replacement) now 100% incl. XSS link-safety branches. `voice-agent-chat` and `agents-dashboard` remain Playwright-only targets.
- **Cost Analyst (2026-06-16):** 123-day revenue drought, 119-day voice silence — reinforces the P2 manual-verification priority.
