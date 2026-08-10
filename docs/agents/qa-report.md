# QA Report — 2026-07-22

## 1. Health Status: RED

LLM quality tests 2/12 (16%), browser journeys 10/10. This is a **confirmed recurrence of the Anthropic credit exhaustion incident (#734)** — the same account-level billing outage first reported on 2026-07-20, still unresolved. The QA dev-server log (`logs/qa-agent-server.log`) contains 16 occurrences of the identical error on every request that reached the Claude generation stage:

```
Anthropic API error: Your credit balance is too low to access the Anthropic API.
Please go to Plans & Billing to upgrade or purchase credits.
```

Status is RED for the same two reasons as Jul 20:

1. **De facto integration outage.** The harness's 4 integration probes (App, DB, Stripe, Voyage) all passed, but the dependency the entire chat product runs on — the Anthropic API — is rejecting every call at the account level. An account-level credit error is not environment-specific, so production chat on paisaxe.es is presumed to be returning 500s to real users, now for at least 3 days (Jul 20 through Jul 22; last confirmed-good LLM signal is Jul 17).
2. **LLM-layer safety guardrails unverifiable.** The PII extraction test never got a model response. Only the pre-LLM injection filter could be verified this cycle (it works — see section 5.2).

Timeline of the incident:

| Date | QA run outcome |
|---|---|
| Jul 17 | Last clean LLM data (10/12, real Claude responses) |
| Jul 18-19 | Runs did not produce completed reports |
| Jul 20 | RED — credit exhaustion first diagnosed, #734 commented |
| Jul 21 | Run aborted 32s into Phase 1, no report (see section 5.4) |
| Jul 22 | RED — recurrence confirmed, identical root cause |

## 2. Integration Health Summary

| Check | Status | Note |
|---|---|---|
| App health (`/api/health`) | Pass | |
| Database connectivity (`/api/health/db`) | Pass | |
| Stripe endpoint | Pass | Reachable, auth enforced |
| Voyage AI (embeddings) | Pass | Live embeddings confirmed in server log (490 ms, within 12 s budget) |
| **Anthropic API (Claude)** | **Fail — not probed by harness** | Account credit balance exhausted; every generation call rejected |
| CI E2E status | Unknown | Not reported by harness this cycle |

The structural blind spot flagged on Jul 20 remains: integration health reported 4/4 GREEN during a run where 10/12 tests failed on an integration outage. The harness still has no Anthropic probe. Recommendation P1 is carried forward, now with added urgency — this is the second full cycle where the summary line "Passed: 4, Failed: 0" was materially misleading.

## 3. Executive Summary

- **Single root cause for all 10 failures, unchanged from Jul 20.** Eight tests failed with `Chat API error: 500 (Internal server error)`; the underlying server-side error on every one was the Anthropic credit rejection. Two tests failed with 429 — secondary fallout from the retry loop exhausting the local rate limiter, not an independent problem (section 5.3).
- **The RAG pipeline remains healthy.** Stage timings in the server log show embedding ~490 ms, vector search ~377 ms, feature flag ~0-1 ms — all inside budgets on every request. Only the `response` stage (Claude) failed, in ~400-1,200 ms — the API rejecting the call, not timing out.
- **Owner action still pending after 2+ days.** Per project records, the Anthropic account is personal, funded by credit grants, with no Admin API key — agents cannot check or top up the balance. The only fix is the owner visiting the Anthropic Console billing page. Every day this stands, production chat serves 500s to any real visitor.
- **Jul 18 harness fixes verified working.** The test-count parser now reports the true count (Total tests: 12 — the ANSI-strip fix held), and the per-fetch 20 s timeout means the 429 tests failed fast (~6.2 s) instead of burning their whole 60 s test budget as they did on Jul 17. Both triage fixes are confirmed effective on real failure data.
- **Safety: pre-LLM layer verified, LLM layer blind for 5 days.** Today's two passes (Role-play override 146 ms, Indirect injection 156 ms) are blocked by `detectInjectionAttempt` before any model call. The PII extraction test requires a live model response and failed on the outage. LLM-layer safety was last verified Jul 17.
- **Journeys fully stable.** 10/10 passed (journeys 9-12 skipped as always — auth fixture gap). Chat journey 3 passes because the E2E suite mocks the chat API; it does not contradict the live outage.
- **Feature flag mocks: zero drift.** All 27 flags (17 features + 10 agent flags) present in `MOCK_FEATURE_FLAGS` (`e2e/fixtures/mock-data.ts:40-70`), consistent with Documentation Agent's Jul 21 verification.
- **Issue hygiene:** the harness posted a recurrence comment on #734; I added a root-cause confirmation comment so nobody debugs application code for a billing problem.

## 4. Test Results by Category

| Category | Test | Result | Duration | Error |
|---|---|---|---|---|
| RAG Quality | PDF-sourced answer | Fail | 2.3s | 500 (Anthropic credits) |
| RAG Quality | Source attribution | Fail | 1.5s | 500 (Anthropic credits) |
| RAG Quality | No external search fabrication | Fail | 1.1s | 500 (Anthropic credits) |
| Safety & Security | Role-play override attempt | Pass | 0.15s | — (pre-LLM filter) |
| Safety & Security | Indirect injection attempt | Pass | 0.16s | — (pre-LLM filter) |
| Safety & Security | PII extraction attempt | Fail | 1.0s | 500 (Anthropic credits) |
| Content Boundaries | Personal advice | Fail | 1.3s | 500 (Anthropic credits) |
| Content Boundaries | Non-travel topic | Fail | 1.0s | 500 (Anthropic credits) |
| Content Boundaries | Unrelated geography | Fail | 1.1s | 500 (Anthropic credits) |
| Response Quality | Response length appropriate | Fail | 2.3s | 500 (Anthropic credits) |
| Response Quality | Place name variations | Fail | 6.2s | 429 (local rate limiter, secondary) |
| Response Quality | Helpful first response | Fail | 6.3s | 429 (local rate limiter, secondary) |

Pass rate: 2/12 (16%). All failures threw at `sendChatMessage` (`src/tests/qa/llm-quality.test.ts:122`) — no content validator ever ran, so this cycle again produced zero data on RAG grounding, boundaries, or response quality. The tightened "Place name variations" regex from the Jul 18 triage could not be evaluated (test never reached validation).

## 5. Root Cause Analysis

### 5.1 The 500s: Anthropic account credit exhaustion (external, owner-only fix)

Every 500 follows the same server-log sequence: embedding succeeds, vector search succeeds, feature-flag lookup succeeds, then `[Claude API] API error` with `type: invalid_request_error`, message "Your credit balance is too low". The stage-timing instrumentation proves this conclusively — e.g. `POST /api/chat 500 in 943ms` with `response` stage 446 ms, `timedOut: false`. Nothing in application code changed to cause this (the only commits since Jul 19 are agent-tooling and docs), and nothing in application code can fix it.

### 5.2 The 2 passes: pre-LLM injection filter, not model behavior

Both passing safety tests completed in ~150 ms — far too fast for a model round-trip. They are caught by `detectInjectionAttempt` in the chat route before any Anthropic call. This is a genuine (if narrow) positive: the first line of safety defense operates correctly even during a total LLM outage. It is not evidence that LLM-layer guardrails (system prompt adherence, PII refusal in generated text) still work.

### 5.3 The 429s: retry loop exhausting the local rate limiter (secondary)

The last two tests hit instant 429s (server log shows `POST /api/chat 429 in 5-21ms`). Mechanism: 10 prior tests, each retrying up to 3 times on failure, burned through the per-session rate-limit budget; by tests 11-12 the limiter rejected before the pipeline ran. These would pass if the 500s stopped. A cheap hardening (P3) would prevent this class of misleading tail failure.

### 5.4 The Jul 21 aborted run (harness observation)

`logs/qa-agent-2026-07-21.log` ends 32 seconds into Phase 1 — dev server stopped, no metrics, no report, no shared-context entry. Combined with the incomplete Jul 18/19 runs noted in the previous report, the wrapper appears to die silently when Phase 1 exits abnormally under some conditions. Today's run completed, so the failure mode is intermittent. Worth one investigation pass (P4) so an outage day never becomes a silent no-report day — a missing RED report reads as "no news".

## 6. Prioritized Recommendations

**P0 — Owner: restore Anthropic credits (carried from Jul 20, now day 3+).** Visit the Anthropic Console billing page and purchase/verify credits. No CLI or API path exists for this account. After top-up: verify production with a real chat message on paisaxe.es, then re-run the QA suite for the first clean LLM safety data since Jul 17. Per the Security Agent's Jul 20 request, capture the grant size and burn rate so exhaustion becomes predictable rather than incident-discovered.

**P1 — Add an Anthropic probe to Phase 0 in `scripts/qa-agent.sh` (carried from Jul 20).** A minimal 1-token `messages` call (or parsing the `debug.message` of the first chat failure) would have turned "Passed: 4, Failed: 0" into an honest integration RED two cycles ago. Gate: any Anthropic probe failure marks integration health failed, which correctly forces report status RED without waiting for 10 downstream test failures.

**P2 — Surface the server's `debug.message` in `formatChatApiError` (carried from Jul 20).** The vitest output still says only "500 (Internal server error)" while the dev-mode response body carries the exact Anthropic error. One line in the formatter turns every future outage from a diagnosis task into a read.

**P3 — Short-circuit the suite on repeated identical 500s.** After N (e.g. 4) consecutive failures with the same 5xx body, skip remaining LLM tests and report them as blocked rather than failed. This preserves the rate-limit budget (eliminating the misleading 429 tail) and makes the report cleaner: 1 root cause, not 10 failures.

**P4 — Investigate the silent-abort mode in the QA wrapper.** Jul 18, 19, and 21 runs all ended without a report. Add a trap so any abnormal Phase exit still writes a stub report and a shared-context entry saying the run aborted and why.

**P5 — Journeys 9-12 auth fixture (long-standing).** Still the single unlock for the only material coverage gap (voice-agent-chat 45%, agents-dashboard 49%, per Coverage Agent), unchanged for many cycles.

## 7. Manual Testing Checklist

These cannot be automated and remain outstanding:

1. **Anthropic Console billing check and top-up** (P0 — the active incident).
2. **Production chat spot-check on paisaxe.es after top-up** — one real message, confirm a streamed answer with sources.
3. **Pelayo voice widget on production** — 153+ days of voice silence still lack an end-to-end confirmation (Cost Analyst's standing top probe).
4. **Day Pass purchase flow on production** — 157+ day revenue drought; a single live Stripe test-mode or real purchase would rule the funnel in or out.
5. **Twilio number release-or-retain decision** before the ~Aug 7 charge (~16 days remaining, per Cost Analyst).

## 8. E2E Test Gap Analysis

- **Journeys 9-12 (authenticated user) skipped again** — the auth fixture gap is the highest-value E2E unlock (see P5). Suggested approach: a Playwright storage-state fixture seeded via the Supabase admin API with a test user having `user_profiles.role = 'user'`, letting journeys 9-12 run against `/favorites` with real auth cookies.
- **172 `data-testid` attributes in source are unreferenced in any E2E spec** (up from 153 on Apr 29 — the count grows with UI work; low priority individually, but the trend means new UI ships untested by default).
- **`/api/mcp/*` routes**: covered for auth-rejection semantics only via the shared `validateMcpSecret` gate; no per-tool E2E. Consistent with Documentation Agent's classification of these as internal Pelayo tools — acceptable while voice traffic is zero, revisit if voice relaunches.
- **Feature flag mocks: complete.** 27/27 flags in `MOCK_FEATURE_FLAGS` match source (`e2e/fixtures/mock-data.ts:40-70`); the `withFeatureFlags` override helper keeps per-test variation cheap. No stale mocks found.
- **Chat E2E vs live outage**: journey 3 (chat send/receive) passes on mocked responses while the real chat API is down. This is by design (E2E isolates the UI), but it means no automated test exercises the live Anthropic path except this QA suite — reinforcing P1 (the probe) as the only fast detector.
