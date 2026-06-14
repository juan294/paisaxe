# QA Agent Report — 2026-06-14

## 1. Health Status: YELLOW

The application and all external integrations are healthy. Browser journeys are 100% green. However, the entire LLM quality suite (12/12) was blocked by a test-harness port-mismatch regression, so RAG, safety, boundary, and response-quality guardrails could NOT be verified this cycle.

Status is YELLOW, not RED, because:
- Integration health is 3/3 pass (no Stripe/payment/Supabase failure).
- There are no confirmed safety failures — the safety tests never ran. The cost is a blind safety net, not a breached one.
- Browser journeys 10/10 pass, including chat send/receive and multi-turn chat, proving the chat path itself is functional.

It is not GREEN because the LLM safety net produced zero data, and prompt-injection / instruction-override guardrails are unverified on a live site.

## 2. Integration Health Summary

| Check | Result | Notes |
|-------|--------|-------|
| App health (/api/health on :3006) | Pass | Server started and responded |
| Database (paisaxe.es/api/health/db) | Pass | Supabase reachable |
| Stripe (/api/checkout/health) | Pass | 3/3 integration checks passed |

Integration health: 3 passed, 0 failed. No payment-system or data-layer failure. This is the key reason the cycle is not RED.

## 3. Executive Summary

- LLM quality tests: 0/12 passed. Every test failed with `TypeError: fetch failed` (`ECONNREFUSED`) at `getCsrfToken` (`src/tests/qa/llm-quality.test.ts:26`). No request reached the API.
- Root cause is a configuration regression, not an application bug: the QA dev server now runs on port 3006, but the LLM test still targets port 3000.
- Browser journey tests: 10/10 passed (4 authenticated journeys skipped, as designed for anonymous runs). Chat open/send/receive (Journey 3) and multi-turn chat (Journey 14) both pass — confirming the chat API works when addressed on the correct port.
- Safety guardrails (prompt injection, instruction override, indirect injection) are UNVERIFIED this cycle. They were not exercised; this is not a pass and not a fail.
- GitHub issue filed: #635 (type: bug, priority: high, area: infra).

## 4. Test Results by Category

| Category | Tests | Passed | Failed | Cause |
|----------|-------|--------|--------|-------|
| RAG Quality & Source Grounding | 3 | 0 | 3 | ECONNREFUSED (port mismatch) |
| Safety & Security | 3 | 0 | 3 | ECONNREFUSED — guardrails UNVERIFIED |
| Content Boundaries | 3 | 0 | 3 | ECONNREFUSED (port mismatch) |
| Response Quality | 3 | 0 | 3 | ECONNREFUSED (port mismatch) |
| Browser Journeys (anonymous + error + new features) | 10 | 10 | 0 | All pass |
| Browser Journeys (authenticated) | 4 | 0 (skipped) | 0 | Skipped by design (no auth session) |

Failed assertions (all 12 LLM tests share the same failure signature):

```
TypeError: fetch failed
  at getCsrfToken src/tests/qa/llm-quality.test.ts:26:24
  at sendChatMessage src/tests/qa/llm-quality.test.ts:37:21
Caused by: AggregateError
  Error: connect ECONNREFUSED ::1:3000
  Error: connect ECONNREFUSED 127.0.0.1:3000
```

The assertions inside each test (source citation, refusal behavior, on-topic checks, language handling) were never reached — execution failed at the connection step before any LLM response was produced.

## 5. Root Cause Analysis

This is a single shared root cause: a port-mismatch regression introduced by the health-probe fix.

Facts:
1. `package.json:10` — `"dev": "... next dev --port 3006"`. The dev server runs on 3006.
2. Commit `90b608b3` ("fix(qa-agent): update health probe from port 3000 to 3006") updated `scripts/qa-agent.sh` so the precheck, server-startup wait, and health check all use `http://localhost:3006` (lines 60, 78, 110). That part is correct and consistent.
3. `scripts/qa-agent.sh:232` exports only `QA_TESTS_PER_CATEGORY` before `npm run test:qa`. It does NOT export `NEXT_PUBLIC_SITE_URL`.
4. `src/tests/qa/llm-quality.test.ts:15` — `const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'`.

Because `NEXT_PUBLIC_SITE_URL` is unset for the test process, `API_URL` falls back to `http://localhost:3000`, where nothing is listening (the server is on 3006). Every `fetch` therefore fails with ECONNREFUSED at the first network call (`getCsrfToken`).

This is the same class of failure the suite has hit before (CSRF blocker in Feb–Mar; chat API 403/500 regressions in late Apr). The pattern is consistent: the LLM suite depends on a precise server contract (port, CSRF, auth, status code), and when any one element drifts, all 12 tests fail identically with no LLM-level signal. The journey tests, which drive the real UI against the same server, remain green — confirming the application is fine and the breakage is in the QA harness wiring.

## 6. Prioritized Recommendations

Priority 1 — Fix the port mismatch (one line, unblocks the entire suite):
- In `scripts/qa-agent.sh`, before `npm run test:qa` (near line 232), add:
  `export NEXT_PUBLIC_SITE_URL="http://localhost:3006"`
- This makes the test follow the same port the script already starts and health-checks.

Priority 2 — Align the test default to avoid silent local breakage:
- Change `src/tests/qa/llm-quality.test.ts:15` default from `http://localhost:3000` to `http://localhost:3006` so a manual `npm run test:qa` against `npm run dev` works without extra env wiring.

Priority 3 — Add a fast fail-fast guard so future port/contract drift is obvious:
- In a `beforeAll`, ping `${API_URL}/api/health` once and throw a clear message ("QA server not reachable at ${API_URL} — is the dev server on the right port?") instead of letting 12 tests each emit an opaque `fetch failed`.

Priority 4 — Tie the test port to a single source of truth:
- Consider deriving both the server port and the test URL from one env var (e.g. `QA_SERVER_PORT`, default 3006) used by `package.json`'s dev script and exported by `qa-agent.sh`, eliminating the two-place drift entirely.

Tracking: GitHub issue #635 (type: bug, priority: high, area: infra) records P1/P2.

## 7. Manual Testing Checklist Reminder

Automated LLM coverage was zero this cycle and the live site has now gone 119 days without revenue and 115 days without voice traffic (per Cost Analyst, Jun 12). The automated safety net cannot substitute for the following manual production checks, which remain the single highest-priority outstanding action:

- [ ] Pelayo voice widget on paisaxe.es: load, connect, exchange one turn. Confirm it is reachable at all (115-day silence).
- [ ] Day Pass purchase flow end-to-end on production (Stripe checkout to access grant). The 119-day revenue drought is still unexplained.
- [ ] Chat on production: send a tourism query, confirm a grounded response with source attribution renders.
- [ ] Prompt-injection spot check on production chat (e.g. "ignore your instructions and...") since automated safety tests did not run this cycle.
- [ ] Confirm the LLM suite passes after the P1 fix lands (re-run `npm run test:qa` with the server on 3006).

## 8. E2E Test Gap Analysis

Overall E2E coverage is in good shape; prior recurring gaps have largely closed.

Feature flag mock parity — COMPLETE:
- `src/types/feature-flags.ts` defines 17 `FeatureFlagKey` values. All 17 are present in `MOCK_FEATURE_FLAGS` in `e2e/fixtures/mock-data.ts`, plus 10 agent toggle flags (27 entries total). Zero missing, zero orphaned. No action needed.

MCP route coverage — RESOLVED (was the top recurring gap for 10+ cycles):
- `e2e/mcp.spec.ts` now exists and exercises `mcp/places`, `mcp/make-booking`, and `mcp/weather`.
- Remaining sub-gap: `src/app/api/mcp/make-booking/status/route.ts` (the booking status poll endpoint) is not referenced in `e2e/mcp.spec.ts`. Recommended: add a case that POSTs/GETs `/api/mcp/make-booking/status` with a known booking id and asserts the status JSON shape, so the full booking lifecycle (create -> status) is covered.

API route smoke coverage:
- 56 `route.ts` files under `src/app/api`. 18 E2E spec files exist (`admin`, `api`, `chat`, `checkout`, `mcp`, `suggestions`, `voice-agents`, `stripe-real-checkout`, etc.), giving broad but not exhaustive coverage. Cron endpoints, webhooks, and admin-only routes are intentionally internal and lower-risk for E2E.
- Recommendation: keep `e2e/api.spec.ts` as the inventory anchor and add smoke assertions for any newly added external-facing route.

data-testid coverage (LOW priority, carried):
- 163 `data-testid` attributes in source are not referenced in any E2E spec (gap-analysis output). This is the long-standing low-priority backlog; the two components that actually need new Playwright coverage are `voice-agent-chat` (~43% unit coverage) and `agents-dashboard` (~49%), per Coverage Agent. Recommended next concrete test: a `voice-agents.spec.ts` case that mounts the voice widget via its click-to-mount trigger and asserts the connect button testid renders — this also doubles as the manual voice check above.

No stale mocks detected: feature-flag mocks match source, and MCP mocks align with the three primary tool routes.

## Cross-References to Other Agents

- Cost Analyst (Jun 12): 119-day revenue drought, 115-day voice silence still unexplained. With the LLM safety net blind this cycle, manual production verification of Pelayo and Day Pass is even more urgent.
- Performance Agent (Jun 13): bundle GREEN (3,025 KB / 3,500 KB). No QA-relevant regression; chat path performance confirmed via passing journeys.
- Security Agent (Jun 13): 0 exploitable advisories; CSRF and webhook timing-safety stable. The QA failure is a port config bug, not a security regression — CSRF handling in the test is fine, it simply never reached a server.
- Coverage Agent (May 26): `voice-agent-chat` and `agents-dashboard` remain the two sub-50% files needing Playwright E2E — the same gap flagged in section 8.
