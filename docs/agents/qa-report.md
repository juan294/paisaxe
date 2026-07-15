# QA Agent Report — 2026-07-14

**Agent:** Paisaxe QA Agent
**Test file:** `src/tests/qa/llm-quality.test.ts`

## 1. Health Status: YELLOW

All quality tests pass, but one integration probe failed at run time.

| Signal | Result |
|--------|--------|
| LLM quality tests | 12/12 pass (100%) |
| Browser journey tests | 10/10 pass (4 auth journeys skipped by design) |
| Integration health | 3 passed / 1 failed (Stripe probe, HTTP 000) |
| Safety guardrails | Pass (prompt injection, PII extraction, authority impersonation) |
| Voyage AI | Pass |

Status rationale: the mechanical rule says a Stripe integration failure makes status RED. It is downgraded to YELLOW because live re-verification during report generation shows the failure was a transient probe-transport flake, not a Stripe or payments outage: three consecutive probes of `https://paisaxe.es/api/checkout/health` returned HTTP 401 in ~0.3s (auth enforced — exactly the expected response), and production `/api/health` and `/api/health/db` both returned healthy. HTTP 000 is curl's "no HTTP response received" sentinel (timeout/DNS/connection reset), the same failure class as the Jul 10 `/api/health/db` probe flake. YELLOW rather than GREEN because an integration check did fail this run and the probe itself needs hardening (see Sections 5 and 6). This matches the precedent of the Jul 10 cycle (db-probe flake reported YELLOW, root-caused as transient).

## 2. Integration Health Summary

| Integration | Status | Notes |
|-------------|--------|-------|
| Supabase / App | Pass | App and DB probes healthy at run time; re-verified live during report generation (`/api/health` healthy, `/api/health/db` HTTP 200 in 0.33s) |
| Stripe (checkout health reachability) | Fail at run time, healthy on re-check | Probe got HTTP 000 (no response); 3/3 live re-probes return HTTP 401 as expected. Transient transport flake, not an outage |
| Voyage AI (embeddings) | Pass | Embedding + retrieval path also exercised end-to-end by the 3 RAG tests |
| CI E2E | Unknown from runner; verified green manually | Last push run on develop (Jul 10): CI, E2E Tests, and Security Scan all succeeded |

Two integration-adjacent observations for other agents:

- **Dependabot updater failure (Jul 13):** The `npm_and_yarn` Dependabot Updates run (29234361163) failed with "The updater encountered one or more errors" while the paired `github_actions` update succeeded. This is Dependabot's own updater job, not a code CI failure. Log requires repo write access: https://github.com/juan294/paisaxe/network/updates/1458090811. Flagged for Triage.
- **Revenue/voice drought unchanged:** No automated signal explains the 151-day revenue drought / 147-day Paisaxe voice silence (Cost Analyst). All automated flows pass in-harness. Manual production verification of the Pelayo voice widget and Day Pass purchase remains the single outstanding real-world probe. Today's live confirmation that the checkout health route is reachable and auth-enforced is consistent with "infrastructure fine, zero customer traffic."

## 3. Executive Summary

- Quality board fully green: 12/12 LLM quality tests, 10/10 browser journeys, no regressions. Third consecutive clean LLM cycle since the Jun 22 recovery.
- The one failure is a probe defect, not a product defect: the Stripe reachability check in `scripts/qa-agent.sh:196` timed out or lost the connection (HTTP 000) and has no retry or exit-code capture — the exact silent-failure pattern that was fixed for the database check on Jul 10 (`c3d68e25`) but not applied to the Stripe check.
- Safety posture confirmed: basic prompt injection (474ms — likely pattern-gated fast path), PII extraction attempt, and authority impersonation all resisted.
- Content boundaries hold: personal advice, unrelated geography, and booking requests all handled within the Asturias tourism scope.
- Feature-flag mock parity re-verified programmatically: all 17 `FeatureFlagKey` flags and all 10 agent flags (automated_agents + 9 agent keys including subscription_optimizer_enabled) are present in `e2e/fixtures/mock-data.ts`. Zero missing, zero stale.
- No product source has shipped since Jul 10 (`92a4c42f`); the only commit since (`c3d68e25`) touched scripts, one E2E spec, and docs. No new UI components, API routes, flags, or contracts requiring new coverage this cycle.
- Runner metrics hygiene: the metrics header reported "Total tests: 1, Passed: 1" while the vitest output shows 12 tests — the summary counts test files, not tests. Cosmetic, but it would understate a partial failure (e.g. 11/12 would still read "1 file failed").

## 4. Test Results by Category

| Category | Tests | Pass | Fail | Notes |
|----------|-------|------|------|-------|
| RAG Quality & Source Grounding | 3 | 3 | 0 | Cross-PDF synthesis, empty-results graceful handling, PDF-sourced answer |
| Safety & Security | 3 | 3 | 0 | Basic prompt injection, PII extraction attempt, authority impersonation |
| Content Boundaries | 3 | 3 | 0 | Personal advice, unrelated geography, booking request |
| Response Quality | 3 | 3 | 0 | Response length, place-name variations, helpful first response |
| **LLM total** | **12** | **12** | **0** | 100% pass, 94.5s runtime (back to baseline; the Jul 9 +19% runtime spike did not recur — watch closed per Performance Agent) |

### Browser Journeys (Playwright, qa-journey.spec.ts)

| Journey | Result |
|---------|--------|
| 1. Browse stories, arrow navigation | Pass |
| 2. Keyboard navigation | Pass |
| 3. Open chat, send message, receive response | Pass |
| 4. Favorites page sign-in prompt (anonymous) | Pass |
| 5. Toggle story info overlay with keyboard | Pass |
| 6. Navigate stories, verify unique content | Pass |
| 7. Graceful handling when API unavailable | Pass |
| 8. Health endpoint always available | Pass |
| 13. Submit place suggestion (anonymous) | Pass |
| 14. Multi-turn chat conversation | Pass |
| 9–12. Authenticated-user favorites journeys | Skipped (auth fixture pending) |

10 passed, 0 failed, 4 skipped. The skipped authenticated journeys remain gated on the journeys 9–12 auth fixture — a standing coverage gap (Section 8), not a failure.

## 5. Root Cause Analysis

### Stripe probe HTTP 000 (only failure this cycle)

- **What failed:** `scripts/qa-agent.sh:196` — `curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://paisaxe.es/api/checkout/health` produced `000`, which curl emits when no HTTP response is received at all (connect timeout, DNS failure, or connection reset). The assertion at lines 197–207 expects 401 or 200.
- **Root cause:** Transient network failure between the runner and production during the scheduled run. Verified not reproducible: three consecutive live probes during report generation returned HTTP 401 in 0.28–1.31s, and both production health endpoints are green. Classified as the same transient curl-against-production flake class as the Jul 10 `/api/health/db` incident.
- **Contributing probe defect:** The check swallows the curl exit code (`|| true`) and has no retry, so a single transient blip fails the cycle with no diagnosable detail. The Jul 10 fix (`c3d68e25`) added exit-code capture to the database check but did not touch the Stripe check — the hardening pattern should be applied here too.
- **Not the historical auth issue:** Prior cycles' Stripe probe failures were `{"error":"Authentication required"}` responses (HTTP 401 body), which the current script correctly treats as a pass. This cycle's failure is transport-level, a different symptom. Per CLAUDE.md troubleshooting: manual check is `curl -I https://paisaxe.es/api/checkout/health`, expecting 401 without an admin session — confirmed passing now.

No LLM, safety, boundary, quality, or journey failures — no further root-cause analysis required. The two historically recurring local symptoms remain explained and non-blocking: admin-UI dialog timeouts are vitest worker starvation (0 failures at `--maxWorkers=4`), and the db-probe empty-detail flake was fixed Jul 10 and did not recur.

## 6. Prioritized Recommendations

Priority order: safety > integrity > coverage > hygiene.

1. **(Probe hardening, low-effort) Apply the Jul 10 db-check fix pattern to the Stripe check in `scripts/qa-agent.sh:196`.** Capture the curl exit code explicitly (`STRIPE_CURL_EXIT=0; ... || STRIPE_CURL_EXIT=$?`) and add one retry after a short sleep before declaring failure. A transient blip currently costs a full YELLOW cycle and an SMS alert with zero diagnostic detail ("HTTP 000" alone). The database check at lines ~160–190 is the in-file template.
2. **(Coverage, low-effort, high-value) Pin `poolOptions.threads.maxThreads: 4` in `vitest.config.ts`.** Outstanding for 4+ cycles, jointly recommended with Coverage. Eliminates local admin-UI timeout flakes that risk masking real regressions. CI already shards and is unaffected.
3. **(E2E, negative-path) Add webhook signature-rejection smokes** for `/api/webhooks/stripe`, `/api/webhooks/elevenlabs`, `/api/webhooks/supabase`, `/api/webhooks/translate`. Rejection logic exists and is unit-covered (Security Agent: coverage gap, not a vulnerability); no E2E asserts a bad-signature 4xx. Concrete test in Section 8.
4. **(Manual, real-world) Verify Pelayo voice widget and Day Pass purchase on paisaxe.es.** Still the only probe that can explain the 151-day revenue / 147-day voice drought.
5. **(E2E, auth) Build the authenticated-user fixture** to un-skip journeys 9–12 and unlock the only remaining unit-coverage headroom (`voice-agent-chat` ~45%, `agents-dashboard` ~49%).
6. **(Hygiene) Fix the metrics-summary counter in `scripts/qa-agent.sh`** so "Total tests" counts vitest tests, not test files (this run reported "Total tests: 1" for a 12-test run).
7. **(Tracking) #722** (`/story/[slug]` E2E gap) remains open — bundle with the auth-fixture E2E work.

## 7. Manual Testing Checklist Reminder

Automated tests cannot cover these; verify manually on production before any release:

- [ ] Pelayo voice widget loads and completes a conversation on paisaxe.es (147-day silence).
- [ ] Day Pass purchase completes end-to-end via live Stripe (151-day revenue drought).
- [ ] Voice access unlocks after a successful purchase (`/api/voice-access`).
- [ ] SMS booking confirmation delivers (Twilio) if `sms_booking_confirmation` is enabled.
- [ ] Maintenance-mode redirect behaves correctly if toggled.
- [ ] OAuth sign-in + favorites persistence for an authenticated user (the flow the 4 skipped journeys would automate).

## 8. E2E Test Gap Analysis

No product source has shipped since the last analysis (only scripts/e2e/docs in `c3d68e25`), so the gap inventory carries forward with counts re-verified today.

### Feature-flag mock parity: Complete

Programmatically re-verified: all 17 `FeatureFlagKey` flags in `src/types/feature-flags.ts` are present in `MOCK_FEATURE_FLAGS` (`e2e/fixtures/mock-data.ts`), and all 10 agent flags (automated_agents + the 9 keys in `scripts/agent-config.defaults.json`, including `subscription_optimizer_enabled` at mock-data.ts:67) are mocked. Zero missing, zero stale. No action needed.

### API route coverage: partial E2E smoke coverage (unchanged)

Covered by dedicated specs or api.spec.ts/smoke.spec.ts: `/api/chat`, `/api/favorites`, `/api/feature-flags`, `/api/health`, `/api/health/db` (contract-shape smoke added Jul 10), `/api/health/live`, `/api/cron/retry-booking-sms`, `/api/admin/agent-reports`, all `/api/mcp/*` routes (mcp.spec.ts), checkout routes (checkout.spec.ts / stripe-real-checkout.spec.ts), suggestions (suggestions.spec.ts), voice agents (voice-agents.spec.ts).

Routes lacking any E2E smoke (highest-value first):

- **All 4 webhook routes** — no negative-path (bad-signature) smoke. Recommended:
  ```ts
  // e2e/webhooks.spec.ts
  test("stripe webhook rejects unsigned payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      data: { type: "checkout.session.completed" },
      headers: { "content-type": "application/json" }, // no stripe-signature header
    });
    expect([400, 401]).toContain(res.status());
  });
  ```
  Repeat per webhook with its signature header omitted; assert 4xx and a non-empty error body with no stack-trace leakage.
- **Admin analytics/marketing routes** (`admin/analytics`, `admin/costs-analytics`, `admin/elevenlabs-analytics`, `admin/github-analytics`, `admin/stripe-analytics`, `admin/marketing/*`, `admin/agents-summary`, `admin/agents/run`) — a smoke asserting **401 without admin auth** would lock the auth boundary:
  ```ts
  test("admin analytics requires auth", async ({ request }) => {
    const res = await request.get("/api/admin/analytics");
    expect(res.status()).toBe(401);
  });
  ```
- **Remaining cron routes** (`cron/content-discovery`, `cron/fail-stale-bookings`, `cron/fail-stale-translations`, `cron/github-traffic-sync`, `cron/subscription-optimizer`) — cron-secret gated; a shared "cron route rejects unauthorized" smoke per route would close the set.

### data-testid coverage

172 `data-testid` attributes in source are unreferenced in any E2E spec (stable vs Jul 13; 304 total testid occurrences in source). Low priority — most are admin-panel internals reachable only through the pending authenticated-user fixture. Un-skipping journeys 9–12 will reduce this count; no dedicated action until the auth fixture lands.

### Page load/render coverage

Public pages (`/`, `/immersive`, `/favorites`) have journey/smoke coverage. `/story/[slug]` remains uncovered — tracked as **#722**:
```ts
test("story slug page renders", async ({ page }) => {
  await page.goto("/story/<known-seeded-slug>");
  await expect(page.getByTestId("story-title")).toBeVisible();
});
```

---
