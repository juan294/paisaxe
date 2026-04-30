# QA Agent Report — 2026-04-30

## Status: RED

All 12 LLM quality tests fail with Chat API 403. Browser journeys recovered to 10/10 (from 1/10 on Apr 29). Integration health passes 3/3. Status is RED because safety guardrails (injection resistance, role-play override, PII extraction) cannot be confirmed while the API returns 403.

This is the 2nd consecutive RED cycle for LLM tests. Root cause is now precisely identified: Wave 2 CSRF hardening (SE-M2) enforces that POST requests must include an Origin header matching the allowed list. The QA test harness sends `fetch()` calls from Node.js without an Origin header, which the proxy rejects as a potential CSRF bypass. The E2E fix (`bab3c40e`) addressed Playwright browser tests (browsers auto-send Origin) but did not fix the non-browser QA harness.

---

## Integration Health Summary

| Service | Status | Notes |
|---------|--------|-------|
| Supabase | Pass | Reachable, healthy |
| Stripe | Pass | Auth and configuration confirmed |
| App health endpoint | Pass | `/api/health` returns healthy |
| CI E2E Status | Unknown | Not resolved this cycle |

Integration health passes 3/3. All failures are application-layer.

---

## Executive Summary

- **LLM quality tests**: 0/12 (0%). Second consecutive RED cycle. All fail on 403 before any assertion runs.
- **Browser journeys**: 10/10 (100%). Fully recovered from Apr 29 regression (1/10). The /immersive story render is working again.
- **Integration health**: 3/3. Services are reachable and healthy.
- **Safety tests**: Not reached. Cannot confirm safety guardrails this cycle.
- **Revenue/voice context**: 76-day revenue drought, 72-day Paisaxe voice silence (Cost Analyst Apr 30). Automated safety net remains broken for the second day.

---

## Test Results by Category

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| RAG Quality & Source Grounding | 3 | 0 | 3 | Blocked by 403 |
| Safety & Security | 3 | 0 | 3 | Blocked by 403 — safety unconfirmed |
| Content Boundaries | 3 | 0 | 3 | Blocked by 403 |
| Response Quality | 3 | 0 | 3 | Blocked by 403 |
| **LLM Total** | **12** | **0** | **12** | |
| Browser Journeys (Anonymous) | 6 | 6 | 0 | Fully passing |
| Browser Journeys (Error Handling) | 2 | 2 | 0 | Fully passing |
| Browser Journeys (New Features) | 2 | 2 | 0 | Fully passing |
| Browser Journeys (Authenticated) | 4 | 0 | 4 | Skipped — no auth session |
| **Journey Total** | **14** | **10** | **4** | 4 auth journeys intentionally skipped |
| Integration Health | 3 | 3 | 0 | Pass |

---

## Root Cause Analysis

### Chat API 403 — All LLM Tests

**Error**: `Chat API error: 403` at `src/tests/qa/llm-quality.test.ts:57`

**Mechanism**: The proxy middleware at `src/lib/proxy/csrf-proxy.ts:36` calls `validateOrigin()` before processing any POST request to `/api/chat`. `validateOrigin()` in `src/lib/csrf.ts:108-111` contains SE-M2 logic:

```
if no Origin header AND method is POST/PUT/PATCH/DELETE:
    return false  →  handleCsrfValidation returns 403 "Origin not allowed"
```

**Why the QA harness fails**: `sendChatMessage()` at `src/tests/qa/llm-quality.test.ts:40-48` uses Node.js `fetch()` with these headers:
- `Content-Type: application/json`
- `x-csrf-token: <token>`
- `Cookie: __csrf=<token>`

It does **not** include an `Origin` header. Node.js `fetch()` does not auto-add Origin the way a browser does. The proxy therefore rejects every POST with 403.

**Why browser journeys pass**: Playwright uses real Chromium. Browsers automatically attach `Origin: http://localhost:PORT` on all cross-origin state-changing requests, and `http://localhost:3000` is in `ALLOWED_ORIGINS` when `NODE_ENV=development` (`src/lib/proxy/cors.ts:16-17`).

**Why this is new**: Commits `1a3ba7c5` (`fix/wave2-qa-pipeline`) and `5023f7eb` (`fix/wave2-fe-voice`) introduced SE-M2 enforcement. The follow-up fix `bab3c40e` restored E2E coverage by documenting `PLAYWRIGHT_TEST_ORIGIN`, but the QA unit harness was not updated.

**The fix**: Add `'Origin': API_URL` to the fetch headers in `sendChatMessage()`:

```typescript
// src/tests/qa/llm-quality.test.ts line 42-46
headers: {
  'Content-Type': 'application/json',
  'x-csrf-token': csrfToken,
  'Cookie': `__csrf=${csrfToken}`,
  'Origin': API_URL,  // Add this line
},
```

`API_URL` defaults to `http://localhost:3000`, which is already in `ALLOWED_ORIGINS` for development. This is safe: it mirrors what a browser sends and does not weaken CSRF protection (the double-submit token check still runs after origin validation passes).

---

## Prioritized Recommendations

### P0 — Fix QA harness Origin header (blocks all LLM quality data)

**File**: `src/tests/qa/llm-quality.test.ts:43`

Add `'Origin': API_URL` to the fetch headers in `sendChatMessage()`. The `API_URL` constant is already defined at line 15. This is a one-line fix that unblocks all 12 tests.

This has been RED for 2 consecutive cycles. Safety tests have not run since Apr 26 (GREEN run). This fix should be done before the next QA run.

### P1 — Manual production verification (76-day revenue drought)

The automated layer provides no revenue signal when broken. Manual checks on production are overdue:
- Pelayo voice widget renders and activates on paisaxe.es
- Day Pass purchase flow completes end-to-end (Stripe checkout → access granted)

### P2 — MCP E2E coverage (0%, 10th consecutive report)

`/api/mcp/*` has zero E2E test coverage. This is the highest-risk uncovered route group. Suggested test:

```typescript
// e2e/mcp.spec.ts
test('MCP health responds', async ({ request }) => {
  const res = await request.get('/api/mcp/health');
  expect(res.status()).toBeLessThan(500);
});
```

### P3 — Admin and cron E2E smoke tests

From the gap analysis: `/api/admin` and `/api/cron` have no E2E references. Suggested minimal smoke tests:
- `/api/admin/*` — verify 401/403 for unauthenticated access
- `/api/cron/*` — verify 401 without cron secret

### P4 — 153 untested data-testid attributes

153 `data-testid` values exist in source but are not referenced in any E2E spec. Priority targets:
- `data-testid="story-title"` — recently regressed (Apr 29) and recovered; confirm resilience with an explicit assertion
- `data-testid` on voice widget components — relevant to the revenue/voice silence investigation
- `data-testid` on Day Pass / pricing components

---

## Manual Testing Checklist

The following cannot be verified by automated tests and require manual verification:

- [ ] Pelayo voice widget renders on paisaxe.es (voice silence: 72 days)
- [ ] Pelayo initiates a conversation when clicked
- [ ] Day Pass purchase flow opens Stripe Checkout
- [ ] Day Pass purchase completes and grants access
- [ ] Admin dashboard loads at /admin for authenticated admin user
- [ ] Story content displays correctly in immersive view (verify after Apr 29 regression fix)
- [ ] Chat responds in Spanish to Spanish queries

---

## E2E Test Gap Analysis

### High Priority — Untested API Route Groups

| Route Group | Coverage | Recommended Test |
|-------------|----------|-----------------|
| `/api/mcp/*` | None (10th consecutive report) | Smoke: GET /api/mcp/health, verify < 500 |
| `/api/admin/*` | No E2E spec references | Auth gate: unauthenticated → 401/403 |
| `/api/cron/*` | No E2E spec references | Auth gate: missing secret → 401 |

### Feature Flag Mock Completeness

Documentation Agent confirmed flag count stable at 17 in `FeatureFlagKey` + 10 agent flags. No new flags since last QA cycle. No mock-data gaps detected.

### Skipped Authenticated Journeys

Journeys 9–12 (authenticated user) are intentionally skipped — no auth session in the QA harness. These cover:
- Journey 9: Favorites page for authenticated user
- Journey 10: Add favorite via API
- Journey 11: localStorage favorites persistence
- Journey 12: Navigate from favorites back to immersive

These journeys skipping is expected behavior, not a regression.

### Low Priority — Untested Pages and Components

- `/pricing/checkout/return` — no E2E load/render test
- 153 `data-testid` attributes in source not referenced in any E2E spec

For the `data-testid` gap, the highest-value additions would be:
- Voice widget interactive states (`data-testid` in voice-agent-chat components)
- Day Pass / checkout flow components
- `story-title` render path (confirm resilience after Apr 29 regression)

---

## Cross-Agent Context

The following patterns from other agents are relevant to this cycle:

- **Performance Agent (Apr 29)**: +55 KB from wave-2 merges, total headroom at 14 KB. FE-M1 voice-chat sub-component extraction created new shared chunk. Prod build needed before wave-3. P4 (Supabase realtime tree-shake) not yet implemented.
- **Security Agent (Apr 29)**: Flagged Chat API 403 as blocking safety test confirmation. Recommended `git diff HEAD~5 -- src/app/api/chat/route.ts` to identify auth changes. SE-M2 origin enforcement is working as designed — the harness needs to comply, not bypass.
- **Cost Analyst (Apr 30)**: April closes at $0 revenue, $85.56 spend. Cumulative operational loss ~$371. QA fix on May 1 is the first post-fix verification opportunity.
- **Coverage Agent (Apr 20)**: voice-agent-chat (46.3%) and agents-dashboard/index (49.3%) still require Playwright E2E. These are unchanged.

---
