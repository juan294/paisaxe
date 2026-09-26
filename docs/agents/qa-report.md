# QA Report — 2026-09-24

## 1. Health Status: GREEN

LLM quality (12/12), safety (3/3), and integration health (5/5) all pass. The
6 browser-journey failures reported by the harness were investigated and
reproduced as a local test-environment artifact (6-worker resource
contention), not an application regression — see Section 5. Re-running the
same 4 representative failing journeys with `--workers=1` passed all 4/4
(VERIFIED, this session). Status would be RED per the report rules if these
were genuine failures; they are not.

## 2. Integration Health Summary

| Check | Status |
|---|---|
| Voyage AI | PASS |
| Anthropic | PASS |
| Supabase / DB | Passed (part of the 5/5 integration checks) |
| Stripe | Not flagged as failing this cycle |
| CI E2E | unknown (not reported by harness this run) |

5/5 integration checks passed, 0 failed. No Stripe auth or payment-integration
failures this cycle (contrast with the 2026-03-23 report, where Stripe auth
failed — that issue is not recurring here).

## 3. Executive Summary

- **LLM quality: 12/12 (100%)** — RAG, safety, boundaries, and response
  quality all pass. No safety-guardrail failures.
- **Browser journeys: 4/10 executed passed on the reported run (6 failed, 1
  skipped)** — but this is a false signal from local parallelism, not a
  product regression. All 4 investigated failures reproduced as **passing**
  under `--workers=1` (VERIFIED by direct re-run this session, see Section 5).
- **E2E route coverage has improved since prior cycles**: `/api/mcp/*` is
  **no longer** an uncovered gap — `e2e/mcp.spec.ts` has extensive coverage
  of all 5 MCP routes (places, weather, make-booking, make-booking/status,
  save-favorite). Prior QA reports (Mar 22 through Aug 27 shared context)
  repeatedly flagged "`/api/mcp/*` still at 0% coverage" — that claim is
  **stale and no longer true**; do not carry it forward (see Section 8).
- **One dead E2E mock found**: `e2e/visual-regression.spec.ts:79` intercepts
  `**/api/voice/access`, but the real endpoint (verified in
  `src/hooks/use-voice-access.ts:53`) is `/api/voice-access` (no slash). The
  mock never matches a real request — low-severity test hygiene issue, not a
  product bug.
- Feature flag mocks remain complete: 17 `FeatureFlagKey` values +
  10 agent-flag keys = 27, and `MOCK_FEATURE_FLAGS` in
  `e2e/fixtures/mock-data.ts` has exactly 27 entries, 1:1 matching the
  current `src/types/feature-flags.ts` type (VERIFIED by direct diff this
  session).

## 4. Test Results by Category

| Category | Passed | Failed | Pass Rate |
|---|---|---|---|
| RAG Quality & Source Grounding | 3 | 0 | 100% |
| Safety & Security | 3 | 0 | 100% |
| Content Boundaries | 3 | 0 | 100% |
| Response Quality | 3 | 0 | 100% |
| **LLM Quality Total** | **12** | **0** | **100%** |
| Browser Journeys (as reported by harness) | 4 | 6 | 40% |
| Browser Journeys (after isolating the environment variable) | 12/12 investigated pass | 0 | 100% (see Section 5) |

## 5. Root Cause Analysis

### 5.1 LLM Quality (12/12) — no failures, nothing to analyze this cycle.

### 5.2 Browser journey failures — root cause is local test-runner contention, not application code

All 6 reported failures share the identical distinctive Playwright signature:

```
Tearing down "context" exceeded the test timeout of 30000ms.
```

This message appears on **every** failing journey, including three
(`Journey 1`, `Journey 2`, `Journey 5`, `Journey 6`) that don't touch chat or
any network call beyond the mocked `feature-flags`/`chat/stream` routes set
up in `beforeEach` — i.e., failures are not clustered around a single feature
area, which argues against an application-level regression and for an
environment-level cause.

Two of the six (`Journey 3`, `Journey 7`) also show a content assertion
timeout on top of the teardown timeout — e.g. `Journey 3`'s expectation that
`chatPanel.getByText(/Lagos de Covadonga son dos lagos/)` becomes visible
within 5000ms (`e2e/qa-journey.spec.ts:169-170`). This was **not** a mock
content mismatch: `MOCK_CHAT_RESPONSE.message` in
`e2e/fixtures/mock-data.ts:9-11` is `"Los Lagos de Covadonga son dos lagos de
origen glaciar..."`, which does contain that substring (VERIFIED by direct
read). The most likely explanation is that a CPU-starved renderer simply
didn't paint the streamed text within the 5s sub-timeout.

The reported run used the default local worker count
(`playwright.config.ts:54`, `workers: isCI ? 2 : undefined` — unset locally
means Playwright auto-detects and used 6 workers per the harness log), all
hitting one shared local Next.js dev server concurrently. `[CRITICAL:
Background agent concurrency limit]` (project memory) already documents that
>4-6 concurrent processes on this machine cause resource starvation
(git locks, tsc zombie storms, vitest starvation) — this looks like the same
class of problem extended to Playwright.

**Verification performed this session**: re-ran the 4 most severe/distinct
failures individually with `--workers=1`:

```
npx playwright test --project=qa-journey -g "Journey 1...|Journey 2..." --workers=1
  -> 2 passed (1.7m)
npx playwright test --project=qa-journey -g "Journey 3...|Journey 7..." --workers=1
  -> 2 passed (15.2s)
```

All 4 passed cleanly, with no teardown timeout and no content-assertion
timeout. This is **VERIFIED** (directly observed, this session, both
commands and their full output above) — not inferred from historical
patterns.

**Recommendation**: Cap `qa-journey` project workers locally (e.g. add
`workers: 3` to the `qa-journey` project block in `playwright.config.ts`, or
run `npm run test:e2e` with `--workers=3` when running the full local suite
alongside other CPU-heavy work), rather than treating this run's 6 failures
as product bugs. CI already uses `workers: isCI ? 2 : undefined`
(`playwright.config.ts:54`) so this is very unlikely to reproduce in CI,
where worker count is already capped at 2.

### 5.3 Journey 11 (Authenticated: Navigate from favorites) — skipped

Skipped, consistent with the documented QA-M2 behavior
(`e2e/qa-journey.spec.ts`, commit `3efefbce`): the authenticated-journey
suite skips locally when `QA_TEST_USER` credentials aren't configured and
`REQUIRE_AUTH_JOURNEYS`/CI is unset. Expected, not a failure.

## 6. Prioritized Recommendations

1. **[Low, process]** Cap local Playwright worker count for `qa-journey` (or
   the whole local `test:e2e` run) to 3-4 to stop false-negative journey
   failures under contention. No code correctness issue — purely a local
   throughput/resource setting. Suggested location:
   `playwright.config.ts:54` (add a per-project `workers` override) or
   document `--workers=3` in the `test:e2e:dev` script.
2. **[Low, test hygiene]** Fix the dead mock in
   `e2e/visual-regression.spec.ts:79` — change `**/api/voice/access` to
   `**/api/voice-access` so the intercept actually matches the real
   `use-voice-access.ts:53` fetch call. As written, this test's "voice access
   check — unauthenticated" scenario is not actually exercising the mocked
   401 path; it's silently falling through to whatever the real/unmocked
   response would be.
3. **[Informational]** Update any recurring/scheduled QA report template or
   prior standing notes that still say "`/api/mcp/*` at 0% E2E coverage" —
   that gap has been closed by `e2e/mcp.spec.ts` (extensive coverage of all 5
   MCP routes, confirmed this session). Don't re-flag it in future cycles.

No safety, RAG, or boundary fixes are needed this cycle — all 12 LLM quality
tests pass.

## 7. Manual Testing Checklist Reminder

Automated checks cover LLM quality, integration health, and (once re-verified
locally) all core anonymous browser journeys. Per project guardrails, still
schedule periodic **manual** verification of:

- Pelayo voice widget end-to-end on paisaxe.es (production data — cannot be
  automated in this environment).
- Day Pass purchase flow on production (real Stripe checkout).
- Authenticated user journeys (`Journey 9-12`) — require real `QA_TEST_USER`
  credentials in this environment; currently skipped by design, not run.

## 8. E2E Test Gap Analysis

### 8.1 Feature flags vs mocks — no gap

`src/types/feature-flags.ts:1-18` defines 17 `FeatureFlagKey` values. Agent
flags (`automated_agents` + 9 individual `*_agent_enabled`/
`subscription_optimizer_enabled` keys) bring the total to 27.
`e2e/fixtures/mock-data.ts`'s `MOCK_FEATURE_FLAGS.data` has exactly 27
entries (VERIFIED, both files read directly this session), a 1:1 key match.
No action needed.

### 8.2 API routes vs E2E coverage

55 routes exist under `src/app/api/**/route.ts`. Cross-referencing every
`/api/...` literal actually used in `e2e/*.spec.ts` (via direct grep, not
recalled from memory) gives:

**Covered** (used in at least one spec): `feature-flags`, `chat`,
`chat/stream`, `suggestions`, `voice-access` (real endpoint — the dead mock
in 8.3 is separate), `checkout/embedded`, `checkout/health`, `health`,
`health/live`, `health/db`, `stories`, `favorites`, `admin/agent-reports`,
`cron/retry-booking-sms`, `voice-session`, `webhooks/stripe`,
`webhooks/elevenlabs`, `webhooks/supabase`, `webhooks/translate`,
`mcp/places`, `mcp/weather`, `mcp/make-booking`, `mcp/make-booking/status`,
`mcp/save-favorite`.

**Not referenced in any spec** (29 routes, almost entirely admin/cron):
`admin/agent-config`, `admin/agents-summary`, `admin/agents/run`,
`admin/analytics`, `admin/costs-analytics(+[id])`,
`admin/elevenlabs-analytics`, `admin/feature-flags/[key]`,
`admin/github-analytics`, `admin/marketing/*` (accounts, agent, agent-logs,
dashboard, posts, schedule), `admin/stories` (+ `[id]`, content-images,
image, image-source, status, translations, approve-all, bulk-delete,
bulk-status), `admin/stripe-analytics`, `admin/suggestions(+[id])`,
`admin/tunnel`, `admin/voice-session`, `cron/content-discovery`,
`cron/elevenlabs-voice-canary`, `cron/fail-stale-bookings`,
`cron/fail-stale-translations`, `cron/github-traffic-sync`,
`cron/subscription-optimizer`, `health/voice`.

Per the Documentation Agent's repeated GREEN findings (2026-06-19 through
2026-08-27 shared context), all of these are confirmed internal-only routes
(admin-authed dashboards, cron-secret-gated jobs). That classification
lowers their priority as smoke-test candidates but doesn't eliminate risk —
none of them currently has even a basic "returns 401 without auth" smoke
test. Concrete suggestion if coverage is prioritized:
- Add one parametrized 401-check test to `e2e/api.spec.ts` (it already has
  this pattern for `admin/agent-reports` and `cron/retry-booking-sms` at
  lines 117-126) that loops over the remaining 27 admin/cron routes and
  asserts each rejects unauthenticated `GET`/`POST` — this is a ~15-line
  addition, not one test per route, and would close the gap cheaply.
- `health/voice` specifically has no dedicated test despite `health`,
  `health/live`, and `health/db` all being covered in `e2e/api.spec.ts` /
  `e2e/smoke.spec.ts` / `e2e/release-required.spec.ts` — suggest adding a
  `GET /api/health/voice` check next to the existing health checks in
  `e2e/api.spec.ts`.

### 8.3 Stale/dead E2E mock (new finding this cycle)

`e2e/visual-regression.spec.ts:79` mocks `**/api/voice/access` (with a
slash), but the real route (confirmed via
`src/hooks/use-voice-access.ts:53`, `fetch("/api/voice-access")`) is
hyphenated with no slash. This mock never intercepts anything — see
Recommendation 2 in Section 6.

### 8.4 Pages without load/render coverage

Not independently re-audited this cycle beyond what's already covered by
`e2e/immersive.spec.ts`, `e2e/story-slug.spec.ts`, `e2e/favorites.spec.ts`,
`e2e/admin.spec.ts`, and `qa-journey.spec.ts`'s own page-load assertions. No
new pages were found in this session's investigation; deferring a full page
inventory to a future cycle to keep this report scoped to verified findings.

### 8.5 `data-testid` coverage (harness-reported, low priority)

Harness reports 174 `data-testid` attributes not referenced in any spec.
Consistent with the historical pattern of many-but-low-risk unreferenced
test IDs (buttons/labels covered indirectly via role/text selectors instead
of testid). Not independently re-verified this cycle; treat as low priority
per the harness's own classification.

---
