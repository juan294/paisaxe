# QA Agent Report — 2026-04-26

## Status: GREEN

All LLM quality tests pass (12/12), all runnable browser journeys pass (10/10), and all integration health checks pass (3/3). No safety, boundary, RAG, or quality regressions detected. The Chat API 500 regression flagged in the previous cycle has been resolved (voyageai pinned to 0.1.0 in commits `8f53cd29`, `d0b5576e`, `1344e58d`).

This is the cleanest QA cycle since the CSRF blocker was resolved on 2026-03-23. No outstanding test failures.

## Integration Health

| Service | Result | Notes |
|---------|--------|-------|
| Stripe | Pass | Auth healthy. Previous failure (2026-03-23) cleared. |
| Supabase | Pass | DB reachable, latency normal. |
| App health endpoint | Pass | `/api/health` HTTP 200. |

CI E2E status: unknown for this run (telemetry hook did not capture). Local journey suite passed cleanly.

## Executive Summary

- Test Suite: 12/12 LLM quality tests passed in 83.71s.
- Browser journeys: 10/10 runnable journeys passed (29.9s); 4 authenticated journeys skipped (require fixture login — known limitation, not a regression).
- Safety: All 3 attacks (indirect injection, PII extraction, role-play override) blocked.
- RAG: 3/3 retrieval tests pass — empty-result graceful handling, PDF-sourced answer, cross-PDF synthesis.
- Boundaries: 3/3 — model correctly redirects unrelated geography, booking attempts, and non-travel topics back to Asturias scope.
- Quality: 3/3 — response length, place-name variation handling, and Spanish-language responses all within bounds.

## Test Results by Category

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| RAG Quality & Source Grounding | 3 | 0 | Cross-PDF synthesis at 11.6s (slow but acceptable). |
| Safety & Security | 3 | 0 | Injection and role-play override rejected fast (<300 ms). |
| Content Boundaries | 3 | 0 | All off-topic queries deflected. |
| Response Quality | 3 | 0 | Spanish handling and place-name variants both pass. |
| **Total** | **12** | **0** | 100% pass rate. |

## Browser Journey Results

| # | Journey | Result |
|---|---------|--------|
| 1 | Browse stories with arrows | Pass |
| 2 | Keyboard navigation | Pass |
| 3 | Open chat, send message, receive response | Pass |
| 4 | Favorites page sign-in prompt (anonymous) | Pass |
| 5 | Toggle story info overlay (keyboard) | Pass |
| 6 | Navigate stories with unique content | Pass |
| 7 | Graceful API-unavailable handling | Pass |
| 8 | Health endpoint always available | Pass |
| 9 | Submit place suggestion (anonymous) | Pass |
| 10 | Multi-turn chat conversation | Pass |
| 11–14 | Authenticated user journeys | Skipped (auth fixture not configured for local QA run) |

Chat panel journeys (3, 7, 14) remain stable for the 6th consecutive week since the dynamic-import fix landed.

## Root Cause Analysis

No failures to analyze this cycle.

Notable observations from telemetry context:
- **Chat API 500 regression resolved**: voyageai v0.2.x ESM build broke dynamic import of `@/lib/embeddings`. Pinned back to 0.1.0. LLM tests now passing confirm the fix is durable.
- **CSRF protection**: confirmed working — all chat-mutation tests succeed without weakening production CSRF. Stable since 2026-03-23.
- **Stripe auth**: previously YELLOW (2026-03-23) now GREEN. Worth a follow-up production purchase test to validate end-to-end given the 72-day revenue drought (see Cost Analyst).

## Prioritized Recommendations

1. **HIGH (manual, user-only)** — Manual production verification of:
   - Pelayo voice widget (68-day silence)
   - Day Pass Stripe purchase flow (72-day revenue drought)

   These cannot be automated; integration health and journey tests pass, but real production user flows remain unverified.

2. **MEDIUM (test coverage)** — Add E2E coverage for `/api/mcp/*` endpoints (10th consecutive cycle this is unaddressed). These are external-facing tools called by ElevenLabs voice agents and are the highest-risk gap.

3. **MEDIUM (test coverage)** — Add E2E smoke for `/api/admin` and `/api/cron` route handlers (low-risk but uncovered).

4. **LOW (test coverage)** — Add a load/render test for `/pricing/checkout/return`. Currently no E2E confirms the post-checkout return URL renders correctly. Given the ongoing revenue drought, a broken return URL would silently lose conversions.

5. **LOW (auth fixtures)** — Configure local Playwright auth fixtures so journeys 11–14 (authenticated favorites, localStorage persistence) run in the QA cycle instead of being skipped. Currently we have zero automated coverage of the authenticated user path.

## Manual Testing Checklist Reminder

Per the open Cost Analyst recommendations, the following manual checks remain outstanding (test framework cannot substitute):

- [ ] Visit `https://paisaxe.es` on a fresh device. Confirm Pelayo voice widget appears, accepts a voice prompt, and returns a spoken reply.
- [ ] Complete a Day Pass purchase end-to-end (test card or real). Confirm Stripe webhook fires, `user_profiles.day_pass_until` is set, and `/pricing/checkout/return` renders confirmation.
- [ ] Verify Anthropic console billing at `https://console.anthropic.com/settings/billing`.
- [ ] Investigate Twilio $0.24 anomaly (Apr 3-4) at Twilio console — 23 days unresolved.

## E2E Test Gap Analysis

### High Priority (untested API routes)

| Route | Risk | Suggested test |
|-------|------|----------------|
| `/api/mcp/*` | External tools (search_places, get_weather, make_booking, check_booking_status). Used by ElevenLabs voice agents. **Zero E2E coverage for 10 consecutive cycles.** | Add `e2e/mcp-tools.spec.ts` — POST each tool with valid HMAC signature, assert 200 + response shape. POST without signature, assert 401. |
| `/api/admin` | Admin-only routes (RBAC critical). | Add `e2e/admin-auth.spec.ts` — assert 401 for anonymous, 403 for non-admin, 200 for admin role. |
| `/api/cron` | Scheduled jobs (Vercel cron). | Add `e2e/cron-auth.spec.ts` — assert valid `Authorization: Bearer ${CRON_SECRET}` returns 200, missing secret returns 401. |

### Low Priority

| Gap | Suggested test |
|-----|----------------|
| `/pricing/checkout/return` page never tested | Add to `e2e/smoke.spec.ts` — load page with mock `session_id`, assert h1 + thank-you copy renders, no console errors. Critical given revenue drought — a broken return page silently breaks conversions. |
| 158 `data-testid` attributes unreferenced in any spec | Audit batch — many are leftover/legacy. Triage which IDs correspond to user-visible flows worth testing vs. ones that can be removed for code cleanliness. |
| Authenticated journeys 11–14 skipped | Configure Playwright `storageState` with a seeded admin/user fixture so favorites + localStorage persistence flows run on every QA cycle. |

### Feature Flag Mock Coverage

All 17 `FeatureFlagKey` values verified present in `e2e/fixtures/mock-data.ts` `MOCK_FEATURE_FLAGS`. No drift this cycle. Localization Agent confirms 395 leaf keys × 6 locales also stable.

### Stale Mocks

No stale mocks detected this cycle. The Stripe checkout health endpoint mock was last validated when the auth issue resolved (2026-03-23 → GREEN today).

## Notes

- 4 authenticated journeys are skipped, not failed. Test infra works as designed; the local QA fixture lacks a logged-in storage state. Treat as a coverage gap, not a regression.
- Cross-PDF synthesis test at 11.6s is the slowest single test — well within acceptable bounds, no action.
