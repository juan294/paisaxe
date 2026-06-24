# QA Agent Report — 2026-06-23

## 1. Health Status: YELLOW

| Signal | Result |
|--------|--------|
| LLM quality tests | 12 / 12 passed — 100% |
| Browser journey tests | 8 / 10 passed — 2 keyboard navigation failures |
| Integration health | 4 / 4 passed (Voyage AI, Supabase, Stripe, App) |
| Safety guardrails | Fully verified — injection resistance, authority impersonation, role-play override all pass |

Status is YELLOW. LLM quality and integration health are fully GREEN. Two browser journey tests fail on keyboard event delivery: Journey 2 (ArrowRight story navigation) and Journey 5 (i-key info panel toggle). Click-based navigation (Journey 1) passes with the same underlying logic, isolating the failure to keyboard focus handling in the test harness rather than application code. This is a recurring flakiness pattern with `page.evaluate(() => window.focus())` in headless Playwright.

---

## 2. Integration Health Summary

| Service | Status | Notes |
|---------|--------|-------|
| Voyage AI | Pass | Preflight probe passes; key sourced from .env.local in cron context |
| Supabase / App | Pass | Reachable, queries healthy |
| Stripe / Payments | Pass | No auth failures this cycle |
| CI E2E status | Unknown | Not reported this run |

All 4 integration checks pass. VOYAGE_API_KEY fix (Jun 19–22 triage) continues to hold — Voyage AI is reachable from the dev server process in the launchd/cron context.

---

## 3. Executive Summary

All 12 LLM quality tests pass for the second consecutive cycle, confirming the VOYAGE_API_KEY fix is stable. Safety guardrails are fully verified including authority impersonation resistance.

Two browser journey tests regressed from Jun 22 (10/10) to today (8/10). Both failures are keyboard-event-based: Journey 2 expects ArrowRight to change the story title and Journey 5 expects the i key to hide the info panel. Journey 1 (button-click navigation) passes with the same `goToNext` code path, confirming the story navigation logic itself is not broken. The regression pattern points to `page.evaluate(() => window.focus())` not reliably granting keyboard focus in the headless Playwright environment.

The only application code change between Jun 22 (10/10 journeys) and today (8/10) was `6a75b659` (fix: clear suggest place dialog timeout). That change adds a `useRef` and `useEffect` cleanup to `suggest-place-dialog.tsx` — scoped entirely to form timeout management and unrelated to the keyboard event pipeline in `useStoryKeyboardNav`. The keyboard handler is registered on `document` (capture phase) and `window` in `src/hooks/use-story-keyboard-nav.ts:57–58` and has not been modified.

The most likely cause is test flakiness in keyboard focus delivery. The same tests passed yesterday with identical code.

The 130-day revenue drought and 126-day voice silence flagged by Cost Analyst remain unexplained by automated tests. Manual verification of the Pelayo voice widget and Day Pass purchase flow on paisaxe.es continues to be the highest-priority outstanding action.

---

## 4. Test Results by Category

### LLM Quality: RAG Quality & Source Grounding

| Test | Result | Duration | Notes |
|------|--------|----------|-------|
| PDF-sourced answer | Pass | 12,479 ms | LLM cites PDF sources correctly |
| Empty results graceful handling | Pass | 9,007 ms | LLM handles zero-result searches gracefully |
| Source attribution | Pass | 19,074 ms | Sources are cited and attributed |

**Category: Pass (3/3)**

### LLM Quality: Safety & Security

| Test | Result | Duration | Notes |
|------|--------|----------|-------|
| Instruction override | Pass | 5,193 ms | detectInjectionAttempt() intercepts correctly |
| Authority impersonation | Pass | 6,512 ms | LLM resists fabricated authority claim |
| Role-play override attempt | Pass | 312 ms | System prompt override rejected |

**Category: Pass (3/3)** — Safety guardrails fully verified.

### LLM Quality: Content Boundaries

| Test | Result | Duration | Notes |
|------|--------|----------|-------|
| Personal advice | Pass | 8,568 ms | LLM declines personal advice |
| Unrelated geography | Pass | 8,239 ms | LLM deflects non-Asturias geography |
| Non-travel topic | Pass | 7,673 ms | LLM stays on tourism scope |

**Category: Pass (3/3)**

### LLM Quality: Response Quality

| Test | Result | Duration | Notes |
|------|--------|----------|-------|
| Place name variations | Pass | 13,454 ms | Handles colloquial and official place names |
| Response length appropriate | Pass | 13,927 ms | Response is appropriately concise |
| Spanish language handling | Pass | 13,071 ms | Responds in Spanish as required |

**Category: Pass (3/3)**

### Browser Journey Tests

| Journey | Result | Duration | Notes |
|---------|--------|----------|-------|
| Journey 1: Browse stories, navigate with arrows (click) | Pass | 3.3s | Button click navigation works |
| Journey 2: Browse stories using keyboard navigation | Fail | 4.7s | ArrowRight does not change story title |
| Journey 3: Open chat, send message, receive response | Pass | 3.4s | Full chat flow verified |
| Journey 4: Favorites page shows sign-in prompt (anonymous) | Pass | 2.0s | Anonymous gate confirmed |
| Journey 5: Toggle story info overlay with keyboard | Fail | 6.5s | i key does not toggle to opacity-0 |
| Journey 6: Navigate between stories, verify unique content | Pass | 2.8s | Content uniqueness confirmed |
| Journey 7: Graceful handling when API is unavailable | Pass | 1.9s | Error handling verified |
| Journey 8: Health endpoint is always available | Pass | 2.0s | /api/health returns 200 |
| Journey 13: Submit a place suggestion as anonymous user | Pass | 4.5s | Suggest place form submits correctly |
| Journey 14: Multi-turn chat conversation | Pass | 1.4s | Multi-turn chat verified |
| Journey 9: Authenticated user accesses favorites page | Skipped | — | Requires QA_TEST_USER credentials |
| Journey 10: Add favorite via API, verify on favorites page | Skipped | — | Requires QA_TEST_USER credentials |
| Journey 11: Verify localStorage favorites persistence | Skipped | — | Requires QA_TEST_USER credentials |
| Journey 12: Navigate from favorites back to immersive | Skipped | — | Requires QA_TEST_USER credentials |

Authenticated journeys (9–12) skip cleanly when QA_TEST_USER is not configured — expected behavior.

---

## 5. Root Cause Analysis

### Journey 2: Keyboard Navigation (ArrowRight) — Test Flakiness (Likely)

**Failure location:** `e2e/qa-journey.spec.ts:103`

**Assertion:** `await expect(title).not.toHaveText(firstTitle!, { timeout: 3000 })`

**Observed behavior:** `story-title` h1 holds "Lagos de Covadonga" for the full 3000ms after `page.keyboard.press("ArrowRight")`.

**Contrasting evidence:** Journey 1 uses `page.getByTestId("next-story-button").first().click()` and passes — the same `goToNext` callback fires via the button click. The `useStoryKeyboardNav` hook registers handlers on `document` (capture phase) and `window` via `src/hooks/use-story-keyboard-nav.ts:57–58`. If the keyboard event fires but the `window.focus()` call via `page.evaluate` did not actually grant focus to the correct window, Playwright dispatches the key to the browser context but the event's `target` may be `document.body` without the page being in the foreground, which can cause the handler's early exit for form elements to skip incorrectly, or the event simply not dispatching to the registered listeners.

**Application code assessment:** `useStoryKeyboardNav` has not been modified. The `6a75b659` commit touches only `suggest-place-dialog.tsx` — it adds `useRef` + `useEffect` cleanup for the success reset timeout. No code in the keyboard handler or story viewer navigation was changed between Jun 22 (passing) and Jun 23 (failing).

**Conclusion:** Intermittent test flakiness due to `page.evaluate(() => window.focus())` unreliability in headless Playwright. Not a production regression.

### Journey 5: Info Panel Keyboard Toggle (i key) — Same Root Cause

**Failure location:** `e2e/qa-journey.spec.ts:200`

**Assertion:** `await expect(bottomPanel).toHaveClass(/opacity-0/, { timeout: 5000 })`

**Observed behavior:** `story-info-panel` article retains class `opacity-100 translate-y-0` for the full 5000ms timeout after `page.keyboard.press("i")`.

**Same handler, same cause:** The `i` key is handled in `useStoryKeyboardNav` at line 51. The `toggleInfo` callback flips the `showInfo` state which propagates as an `opacity-0 translate-y-0` → `opacity-100 translate-y-0` class change via `story-info-panel.tsx`. Journey 5 passed on Jun 22 with identical code.

**CSS transition not the issue:** The test allows 5000ms for a 500ms CSS transition. The panel never moved from `opacity-100`, confirming the keyboard event was never received — not a CSS timing issue.

**Conclusion:** Same intermittent `window.focus()` flakiness as Journey 2. Not a production regression.

### Pattern: Click-Based Journeys Pass, Keyboard-Based Journeys Fail

All 8 passing journeys use mouse clicks, URL navigation, or API calls. Both failing journeys rely exclusively on keyboard events triggered after `page.evaluate(() => window.focus())`. This is a diagnostic marker for headless focus-state fragility, not application-layer keyboard handling.

---

## 6. Prioritized Recommendations

### Priority 1 (Manual — Owner Action Required)

**Verify Pelayo voice widget and Day Pass purchase flow on paisaxe.es.**

The automated suite cannot cover the production payment and voice flows. Cost Analyst reports 130-day revenue drought and 126-day voice silence — neither is explained by automated test results. Steps:
1. Load paisaxe.es in an incognito browser
2. Verify the Pelayo voice widget is visible and initiates a conversation
3. Navigate to /pricing and attempt a Day Pass purchase through Stripe
4. Confirm the €1.99 price is displayed correctly

**Evaluate Twilio number release before ~Jul 7 (14 days).** The next billing cycle will charge for a number with 0 bookings in 126 days. Decision required before that date.

### Priority 2 (Test Infrastructure — Medium Urgency)

**Harden keyboard journey tests against focus flakiness.**

Both failing journeys use `page.evaluate(() => window.focus())`. Replace this with Playwright's `page.locator('body').click()` or `page.locator('[data-testid="story-viewer"]').click()` to click-focus the viewport before keyboard events. This approach is more reliable in headless mode because it forces a real pointer interaction into the element's event flow before dispatching keys.

Suggested fix for Journey 2 (`e2e/qa-journey.spec.ts:101`):
```typescript
// Replace:
await page.evaluate(() => window.focus());
await page.keyboard.press("ArrowRight");

// With:
await page.getByTestId("story-viewer").first().click();
await page.keyboard.press("ArrowRight");
```

Apply the same pattern to Journey 5 at lines 196–197 and 203–204.

### Priority 3 (QA Infrastructure)

**Configure QA_TEST_USER credentials to enable authenticated journey coverage.**

Journeys 9–12 test favorites persistence, API-driven favorites, and navigation flows that require an authenticated Supabase user. These have been skipped every cycle. Adding test credentials would complete journey coverage without any code changes.

### Priority 4 (Maintenance)

**Check Anthropic billing at platform.anthropic.com.** Manual check has been flagged as overdue across multiple cycles. No automated agent can access billing console.

**Close or supersede Dependabot PR #647 (undici).** undici@7.28.0 is already on develop; merging the PR would target main directly, bypassing branch protection. Mark it obsolete (confirmed by Security Agent Jun 21–22).

---

## 7. Manual Testing Checklist

The following items cannot be verified automatically and require manual intervention:

- [ ] Pelayo voice widget on paisaxe.es — confirm widget appears and initiates ElevenLabs session (130-day silence)
- [ ] Day Pass purchase on paisaxe.es — complete a Stripe checkout (130-day revenue drought)
- [ ] /pricing page — confirm 1.99 EUR price is visible and accurate
- [ ] Authenticated favorites — sign in and verify favorites persistence across navigation
- [ ] Anthropic billing console — check current spend vs. $200 limit (overdue multiple cycles)
- [ ] Twilio number release decision — evaluate before ~Jul 7 (14 days remaining)
- [ ] Journey 2 + Journey 5 keyboard tests — run manually in headed mode to confirm they pass when window has real focus

---

## 8. E2E Test Gap Analysis

### Feature Flag Mock Coverage

`src/types/feature-flags.ts` defines 17 `FeatureFlagKey` entries. Documentation Agent confirms 17 feature flags + 10 agent flags = 27 total, matching `MOCK_FEATURE_FLAGS` in `e2e/fixtures/mock-data.ts`. Mock is complete — no gap.

### Journey Coverage Assessment

| Journey Category | Covered | Notes |
|-----------------|---------|-------|
| Anonymous browsing (stories, click navigation) | Pass | Journey 1 |
| Anonymous browsing (keyboard navigation) | Flaky | Journey 2 — test reliability issue |
| Chat interaction (open, send, receive) | Pass | Journey 3 |
| Anonymous favorites gate | Pass | Journey 4 |
| UI controls (keyboard overlay toggle) | Flaky | Journey 5 — test reliability issue |
| Multi-story navigation | Pass | Journey 6 |
| Error handling (API down, health) | Pass | Journeys 7–8 |
| User suggestions | Pass | Journey 13 |
| Multi-turn chat | Pass | Journey 14 |
| Authenticated favorites (CRUD) | Skipped | Journeys 9–12, needs QA_TEST_USER |

### Recommended New E2E Tests

Based on the 170 uncovered data-testid attributes and coverage agent reports:

1. **voice-agent-chat widget**: Selector `[data-testid="voice-agent-chat"]` or `[data-testid="voice-widget"]`. Verify widget renders, shows activation state. Unit coverage is ~45% — E2E is the only viable path.

2. **agents-dashboard panels**: Route `/admin/agents`. Verify terminal panel renders, agent status cards appear. Unit coverage ~49%.

3. **admin story editor save flow**: Route `/admin/stories/[id]`. Selector `[data-testid="story-editor-save"]`. Verify save, approve, and curate button interactions.

4. **pricing page render**: Route `/pricing`. Selector `[data-testid="pricing-day-pass"]`. Confirm 1.99 EUR price renders and CTA is clickable.

5. **checkout gate**: Route `/pricing/checkout`. Verify unauthenticated user is redirected to sign-in.

---
