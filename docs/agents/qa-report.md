# QA Agent Report — 2026-04-27

## Status: YELLOW

Two LLM quality regressions in this run. No safety failures, no boundary violations, no integration failures. Browser journeys at 100%.

This is the first non-GREEN LLM result since the QA agent recovered to GREEN on Apr 26 (after the Chat API 500 regression caused by voyageai 0.2.x was fixed by pinning to 0.1.0). Both failures are content-quality issues — the chat API itself is healthy.

## Integration Health Summary

| Service | Status | Notes |
|---------|--------|-------|
| Supabase | Pass | Reachable, healthy |
| Stripe | Pass | Auth and configuration confirmed |
| App health endpoint | Pass | `/api/health` returns healthy |
| External APIs | Pass | 3/3 health checks succeeded |

CI E2E status reported as "unknown" by the harness this cycle — see Manual Testing Checklist below for follow-up.

## Executive Summary

- LLM quality: 10/12 passed (83%). Down from 12/12 on Apr 26 (one-day regression).
- Browser journeys (Playwright): 10/10 passed. Stability streak now 6+ weeks.
- Integration health: 3/3 passed.
- Two failures both relate to RAG retrieval quality / Spanish-Asturian linguistic coverage. Neither is a safety, security, or boundary failure.
- Cost Analyst flags 73-day revenue drought + 69-day Paisaxe voice silence. Automated tests are GREEN end-to-end (excluding today's two RAG misses) — production manual verification of Pelayo widget and Day Pass purchase flow remains the top outstanding action item.

Note: harness metrics file reports "Total tests: 11" but vitest output confirms 12 tests (2 failed, 10 passed). Going by vitest output as the source of truth.

## Test Results By Category

| Category | Pass / Total | Status | Notes |
|----------|--------------|--------|-------|
| RAG Quality & Source Grounding | 2 / 3 | Fail | Hallucination resistance failed |
| Safety & Security | 3 / 3 | Pass | All injection / role-play / impersonation attempts refused |
| Content Boundaries | 3 / 3 | Pass | Booking, off-region, personal-advice all redirected correctly |
| Response Quality | 2 / 3 | Fail | Place name variations failed (Xixón/Gijón) |
| Browser Journeys | 10 / 10 | Pass | All anonymous + error-handling journeys pass |
| Integration Health | 3 / 3 | Pass | Stripe, Supabase, app reachable |

## Failed Tests — Detail and Root Cause

### 1. RAG Quality > Hallucination resistance — `src/tests/qa/llm-quality.test.ts:325`

**Prompt**: "Tell me about the famous Asturian roller coaster"

**Validation logic** (lines 116-127):
```
const invents   = /roller coaster|amusement park|thrill ride/i.test(r.content);
const declines  = /no information|not aware|cannot find|don't have|not familiar|isn't a famous|no famous|don't know of|unaware|there isn't/i.test(r.content);
const redirects = /instead|however|but.*can|recommend|suggest/i.test(r.content);
return declines || redirects || !invents;
```

The test fails only when the response *invents* a roller coaster AND fails to decline AND fails to redirect — i.e., the model fabricated content for a non-existent attraction without offering an alternative or explicitly disclaiming.

**Root cause hypothesis** (cannot inspect raw response — not captured by harness):
- Most likely: model latched onto the word "famous" and produced a plausible-sounding fabrication (a common LLM failure mode) without including any of the decline/redirect phrases the regex looks for.
- Less likely: RAG returned a near-miss chunk (e.g., a roller-coaster reference in a different region's PDF) that the model cited as authoritative.

**Recommendation** (priority: medium):
1. Add an explicit "If you do not have information about a specific named attraction, say so plainly before suggesting alternatives" rule to the system prompt.
2. Capture the actual response body in the QA report when a test fails — currently we have no way to distinguish hallucination from regex coverage gap. Add a `console.log(r.content)` (or write to report) inside the failing branch.
3. Broaden the decline regex to catch additional Spanish-language phrasings the model may use ("no tengo información", "no estoy seguro", "no me consta").

### 2. Response Quality > Place name variations — `src/tests/qa/llm-quality.test.ts:388`

**Prompt**: "Tell me about Xixón"

**Validation logic** (lines 290-298):
```
const recognizes = /gij|xix|city|coast|beach|port/i.test(r.content);
return recognizes && r.content.length > 50;
```

Test fails if the response is short (<= 50 chars) OR fails to mention any of: gij, xix, city, coast, beach, port.

**Root cause hypothesis**:
- "Xixón" is the Asturian-language spelling of Gijón. RAG retrieval is keyed on Voyage embeddings (voyage-3.5, 512 dims). If the seed PDFs do not contain the Asturian spelling, the embedding for "Xixón" may not retrieve Gijón content with high enough similarity, leaving the model with little grounding.
- Alternatively, the model may have responded in Asturian and used different vocabulary that does not match any of the regex tokens (e.g., "playa" matches `beach` only via the English word, not the Spanish one).

**Recommendation** (priority: medium):
1. Verify the chunks index contains co-references for Asturian place names. If not, add a synonym layer in the retrieval step (Xixón→Gijón, Uviéu→Oviedo, Avilés stays Avilés). This is a high-leverage fix because the same issue affects every Asturian-spelled query.
2. Broaden the regex with Spanish vocabulary the model is likely to use: `playa`, `puerto`, `ciudad`, `costa`.
3. Consider a query-rewrite step before embedding: detect Asturian spellings and append the Spanish form to the embedded query.

## Prioritized Recommendations

| Priority | Action | Owner | Why |
|----------|--------|-------|-----|
| P1 | Capture failing-response bodies in QA harness | QA / harness | Cannot diagnose hallucination from regex pass/fail alone |
| P2 | Add Asturian↔Spanish place-name synonym table to chat retrieval | RAG / chat | Fixes Xixón class of failures, not just one test |
| P2 | Strengthen system prompt: explicit "decline before suggesting" rule for unknown attractions | Chat | Reduces fabrication risk on named-entity queries |
| P3 | Broaden quality validation regexes with Spanish vocabulary | QA tests | Regex too English-centric for Spanish-first product |
| P3 | Manual production verification of Pelayo voice widget + Day Pass purchase | User | 73-day revenue drought, 69-day voice silence — automated layer is GREEN, production layer is unknown |

## Manual Testing Checklist Reminder

Automated tests cannot verify the following — these require manual user action on production:

1. Pelayo voice widget renders, accepts mic input, and produces audio output on paisaxe.es and paisaxe.com. (69-day silence as of today.)
2. Day Pass purchase flow end-to-end via Stripe Checkout — card form, return URL, webhook receipt, premium-feature unlock. (73-day revenue drought.)
3. Email confirmation receipt arrives via Resend after a successful purchase.
4. CI E2E status — harness reports "unknown" this cycle. Verify `gh run list --branch develop --limit 3` shows green E2E runs in the last 24h.
5. Live CSP / HSTS / security headers via `curl -sSI https://paisaxe.es | grep -i 'content-security\|strict-transport'` — Security Agent has flagged this for live verification next cycle.

## E2E Test Gap Analysis

### High Priority — Untested API Routes

| Route | Risk | Suggested test |
|-------|------|----------------|
| `/api/admin/*` | Admin auth and feature-flag toggling lack E2E coverage | Add `e2e/admin-smoke.spec.ts`: log in as admin (or stub auth), GET `/api/admin/feature-flags`, assert 200 + JSON shape |
| `/api/cron/*` | Cron handlers run on production schedule without E2E verification | Add `e2e/cron-smoke.spec.ts`: invoke cron endpoint with `Authorization: Bearer ${CRON_SECRET}`, assert 200 |
| `/api/mcp/*` | MCP tools (search_places, make_booking, get_weather) used by ElevenLabs voice agents — 0% E2E coverage for 10+ consecutive reports | Add `e2e/mcp-tools.spec.ts`: POST to each MCP endpoint with valid signed payload, assert tool response schema |

### Low Priority — Pages and TestIDs Without Coverage

- `/pricing/checkout/return` — no E2E load/render test. Add a load test that hits the page with a `?session_id=test` query param and verifies the page renders without throwing.
- 159 `data-testid` attributes in source are not referenced in any E2E spec. Most are admin-panel internals; a follow-up audit could prune unused testids or convert them into E2E hooks.

### Mock Data and Feature Flags

- Mock feature flags in `e2e/fixtures/mock-data.ts` confirmed to match all 17 `FeatureFlagKey` entries + 10 agent flags (verified by Documentation Agent on 2026-04-27).
- No new feature flags introduced since last QA run.

### Recent Source Changes vs E2E Coverage

- voyageai pin to 0.1.0 (`8f53cd29`, `d0b5576e`, `1344e58d`): chat embedding path. Existing chat journey (Journey 3) covers this. No additional E2E needed.
- Migrations 076 (`admin_audit_log`) + 077 (`stripe_webhook_events`): infrastructure tables. Not user-facing — no E2E needed, but a smoke check on `/api/stripe/webhook` event-id idempotency should be added to confirm the webhook events table is being written to.

## Cross-Agent Notes

- Cost Analyst (Apr 27): "Automated layer GREEN... production-flow problem requiring manual user verification of Pelayo widget rendering and Day Pass purchase flow." This QA run nuances that — automated layer is now 10/12 (one-day RAG regression), but the conclusion stands: revenue drought is not caused by automated test failures.
- Security Agent (Apr 26): 8 moderate advisories, 0 exploitable. No QA action required, but worth noting that postcss XSS chain is bundled inside Next.js and cannot be fixed via npm overrides — Next.js upstream bump required.
- Performance Agent (Apr 26): Initial load 2,067 KB / 2,000 KB budget. P4 (Supabase realtime tree-shake) recommended. Not a QA concern but the initial-load YELLOW could affect LCP-dependent quality metrics if it grows further.
- Coverage Agent (Apr 23): 5992 tests passing, 98.60% statements. voice-agent-chat (46.3%) and agents-dashboard (49.3%) still need Playwright E2E — same gap flagged here.
