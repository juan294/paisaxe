# Test Coverage Report

> Last updated: 2026-02-10
> Scheduled: nightly at 2:00 CET via `scripts/coverage-agent.sh`

## Summary

- **Total tests:** 3641 passed, 1 skipped
- **Test files:** 238 passed (100%)
- **Statement coverage:** 79.01%
- **Branch coverage:** 70.06%
- **Function coverage:** 72.47%
- **Line coverage:** 79.82%
- **TypeScript:** ✅ No errors

*Note: Coverage percentages fluctuate slightly as coverage scope expands to include more files.*

## Files at 100%

| File | Category |
|------|----------|
| `src/agents/index.ts` | Agents |
| `src/app/error.tsx` | App |
| `src/app/global-error.tsx` | App |
| `src/app/layout.tsx` | App |
| `src/app/loading.tsx` | App |
| `src/app/not-found.tsx` | App |
| `src/app/opengraph-image.tsx` | App |
| `src/app/page.tsx` | App |
| `src/app/providers.tsx` | App |
| `src/app/robots.ts` | App |
| `src/app/sitemap.ts` | App |
| `src/app/admin/error.tsx` | Admin |
| `src/app/admin/loading.tsx` | Admin |
| `src/app/api/admin/analytics/route.ts` | API |
| `src/app/api/admin/feature-flags/[key]/route.ts` | API |
| `src/app/api/admin/marketing/agent-logs/route.ts` | API |
| `src/app/api/admin/marketing/posts/route.ts` | API |
| `src/app/api/admin/stories/route.ts` | API |
| `src/app/api/admin/stories/[id]/image-source/route.ts` | API |
| `src/app/api/chat/stream/route.ts` | API |
| `src/app/api/feature-flags/route.ts` | API |
| `src/app/api/health/db/route.ts` | API |
| `src/app/coming-soon/page.tsx` | App |
| `src/app/privacy/page.tsx` | App |
| `src/app/terms/page.tsx` | App |
| `src/app/favorites/error.tsx` | App |
| `src/app/favorites/layout.tsx` | App |
| `src/app/favorites/loading.tsx` | App |
| `src/app/immersive/error.tsx` | App |
| `src/app/immersive/layout.tsx` | App |
| `src/app/immersive/loading.tsx` | App |
| `src/app/pricing/page.tsx` | App |
| `src/app/story/[slug]/opengraph-image.tsx` | App |
| `src/app/story/[slug]/page.tsx` | App |
| `src/components/a11y/lang-sync.tsx` | A11y |
| `src/components/a11y/skip-link.tsx` | A11y |
| `src/components/admin/admin-tabs.tsx` | Admin |
| `src/components/admin/curation-badge.tsx` | Admin |
| `src/components/admin/placeholder-badge.tsx` | Admin |
| `src/components/admin/selection-toolbar.tsx` | Admin |
| `src/components/admin/story-grid.tsx` | Admin |
| `src/components/admin/visitor-voice-config-panel.tsx` | Admin |
| `src/components/auth/sign-in-prompt.tsx` | Auth |
| `src/components/immersive/chat-upsell-cta.tsx` | Immersive |
| `src/components/immersive/favorite-button.tsx` | Immersive |
| `src/components/immersive/freshness-badge.tsx` | Immersive |
| `src/components/immersive/mood-overlay.tsx` | Immersive |
| `src/components/immersive/privacy-notice.tsx` | Immersive |
| `src/components/immersive/question-prompts.tsx` | Immersive |
| `src/components/immersive/related-stories.tsx` | Immersive |
| `src/components/immersive/skeleton-chat-message.tsx` | Immersive |
| `src/components/immersive/skeleton-story-card.tsx` | Immersive |
| `src/components/immersive/skeleton-story-detail.tsx` | Immersive |
| `src/components/immersive/story-filters.tsx` | Immersive |
| `src/components/seo/json-ld.tsx` | SEO |
| `src/components/ui/button.tsx` | UI |
| `src/components/ui/card.tsx` | UI |
| `src/components/ui/dialog.tsx` | UI |
| `src/components/ui/input.tsx` | UI |
| `src/components/ui/logo.tsx` | UI |
| `src/components/ui/skeleton.tsx` | UI |
| `src/components/ui/tooltip.tsx` | UI |
| `src/config/elevenlabs-agents.ts` | Config |
| `src/config/location.ts` | Config |
| `src/hooks/use-admin-role.ts` | Hooks |
| `src/hooks/use-auth.ts` | Hooks |
| `src/hooks/use-favorites.ts` | Hooks |
| `src/hooks/use-feature-flags.ts` | Hooks |
| `src/hooks/use-realtime-feature-flags.ts` | Hooks |
| `src/hooks/use-story-filters.ts` | Hooks |
| `src/hooks/use-viewed-stories.ts` | Hooks |
| `src/hooks/use-visitor-voice-access.ts` | Hooks |
| `src/hooks/use-voice-access.ts` | Hooks |
| `src/lib/asturianu.ts` | Lib |
| `src/lib/chat-config.ts` | Lib |
| `src/lib/chat-safety.ts` | Lib |
| `src/lib/embedding-cache.ts` | Lib |
| `src/lib/embeddings.ts` | Lib |
| `src/lib/freshness.ts` | Lib |
| `src/lib/mood-mapping.ts` | Lib |
| `src/lib/og-image-helpers.ts` | Lib |
| `src/lib/realtime.ts` | Lib |
| `src/lib/related-stories.ts` | Lib |
| `src/lib/search.ts` | Lib |
| `src/lib/shuffle.ts` | Lib |
| `src/lib/stories-data.ts` | Lib |
| `src/lib/supabase-auth.ts` | Lib |
| `src/lib/supabase-browser.ts` | Lib |
| `src/lib/supabase.ts` | Lib |
| `src/lib/unsplash-placeholders.ts` | Lib |
| `src/lib/utils.ts` | Lib |
| `src/lib/validation.ts` | Lib |
| `src/lib/costs/twilio-costs.ts` | Costs |
| `src/lib/i18n/de.ts` | i18n |
| `src/lib/i18n/en.ts` | i18n |
| `src/lib/i18n/es.ts` | i18n |
| `src/lib/i18n/fr.ts` | i18n |
| `src/lib/i18n/provider.tsx` | i18n |
| `src/lib/i18n/pt.ts` | i18n |
| `src/lib/i18n/use-translation.ts` | i18n |
| `src/types/admin.ts` | Types |
| `src/types/auth.ts` | Types |
| `src/types/feature-flags.ts` | Types |
| `src/types/immersive.ts` | Types |
| `src/types/marketing.ts` | Types |
| `src/lib/admin-api/analytics.ts` | Admin API |
| `src/lib/admin-api/agents.ts` | Admin API |
| `src/lib/admin-api/costs.ts` | Admin API |
| `src/lib/admin-api/feature-flags.ts` | Admin API |
| `src/lib/admin-api/suggestions.ts` | Admin API |
| `src/lib/admin-auth.ts` | Lib |
| `src/components/immersive/voice-chat.tsx` | Immersive |

## Files Below 100%

| File | Stmts | Branch | Funcs | Lines | Reason |
|------|-------|--------|-------|-------|--------|
| `src/proxy.ts` | 97% | 93% | 94% | 98% | Lines 21 (NODE_ENV guard), 253 (mock limitation in cookie callback) |
| `src/app/admin/page.tsx` | 56% | 61% | 47% | 58% | Complex admin UI with many interactive states that require browser-specific testing |
| `src/app/api/admin/agent-reports/route.ts` | 92% | 100% | 100% | 92% | File system operations with fs.stat edge cases |
| `src/app/api/admin/elevenlabs-analytics/route.ts` | 91% | 81% | 95% | 90% | Some ElevenLabs API response edge cases not testable without live API |
| `src/app/api/admin/marketing/accounts/route.ts` | 76% | 85% | 100% | 76% | Error handling branches for database constraint violations |
| `src/app/api/admin/marketing/agent/route.ts` | 81% | 71% | 100% | 81% | Complex AI agent response handling edge cases |
| `src/app/api/admin/marketing/dashboard/route.ts` | 86% | 65% | 86% | 86% | Complex aggregation logic with multiple database queries |
| `src/app/api/admin/marketing/schedule/route.ts` | 96% | 97% | 100% | 96% | Minor edge cases in PUT validation |
| `src/app/api/admin/stories/[id]/content-images/route.ts` | 90% | 79% | 100% | 90% | Edge cases in image URL parsing |
| `src/app/api/admin/stories/[id]/image/route.ts` | 90% | 88% | 100% | 90% | Supabase storage error handling paths |
| `src/app/api/admin/stories/[id]/status/route.ts` | 95% | 92% | 100% | 95% | RLS policy bypass branch |
| `src/app/api/admin/stories/bulk-delete/route.ts` | 88% | 90% | 100% | 88% | Cascade delete edge cases |
| `src/app/api/admin/stories/bulk-status/route.ts` | 89% | 93% | 100% | 89% | Partial update scenarios |
| `src/app/api/chat/route.ts` | 91% | 70% | 100% | 91% | Claude API streaming edge cases |
| `src/app/api/favorites/route.ts` | 93% | 100% | 70% | 92% | Middleware auth bypass path not reachable in tests |
| `src/app/api/health/route.ts` | 90% | 61% | 100% | 90% | Database storage calculation branches |
| `src/app/api/suggestions/route.ts` | 88% | 94% | 67% | 88% | Rate limiting internal state management |
| `src/app/api/voice-access/route.ts` | 84% | 100% | 50% | 84% | getSupabaseClient helper function coverage |
| `src/app/api/webhooks/supabase/route.ts` | 95% | 95% | 100% | 100% | HMAC validation branch |
| `src/app/auth/callback/route.ts` | 73% | 100% | 25% | 73% | Supabase Auth cookie handling (setAll catch block unreachable in jsdom) |
| `src/app/favorites/page.tsx` | 86% | 77% | 82% | 89% | Complex RSC with suspense boundaries |
| `src/app/immersive/page.tsx` | 69% | 46% | 69% | 70% | Complex client interactions with story navigation |
| `src/components/posthog-provider.tsx` | 62% | 29% | 78% | 57% | PostHog analytics initialization — dynamic imports hard to test in vitest |
| `src/components/admin/*` (multiple) | 0-42% | 0-48% | 0-40% | 0-42% | Complex admin UI components with browser-specific interactions |
| `src/components/immersive/fullscreen-button.tsx` | 94% | 91% | 100% | 100% | Remaining: fullscreenchange event edge cases |
| `src/components/immersive/share-button.tsx` | 96% | 93% | 100% | 100% | Minor branch for window.location origin edge case |
| `src/components/immersive/toolbar-overflow-menu.tsx` | 96% | 93% | 91% | 96% | Line 69: ref cleanup edge case |
| `src/components/immersive/volume-button.tsx` | 0% | 0% | 0% | 0% | Audio control component - requires browser audio APIs |
| `src/hooks/use-feature-flags.ts` | 100% | 91% | 100% | 100% | Branch-only gaps in deferred loading conditionals |
| `src/hooks/use-reduced-motion.ts` | 92% | 50% | 100% | 100% | SSR check branch |
| `src/hooks/use-stories.ts` | 97% | 88% | 100% | 99% | LocalStorage quota exceeded handling |
| `src/lib/admin-api/stories.ts` | 93% | 93% | 92% | 93% | Lines 276-289: bulk operation edge cases |
| `src/lib/admin-api/optimizer.ts` | 100% | 83% | 100% | 100% | Branch-only gap in optimizer config |
| `src/lib/chat-action-detection.ts` | 97% | 75% | 100% | 99% | Regex edge cases |
| `src/lib/claude.ts` | 99% | 90% | 100% | 99% | Line 323: unreachable TypeScript safety net in retry loop |
| `src/lib/image-optimization.ts` | 95% | 69% | 100% | 96% | Sharp library edge cases |
| `src/lib/localize-story.ts` | 100% | 87% | 100% | 100% | Branch coverage only - all statements covered |
| `src/lib/rate-limit.ts` | 97% | 82% | 100% | 97% | Token bucket edge case |
| `src/lib/costs/manual-costs.ts` | 93% | 92% | 100% | 93% | Supabase admin client null-check branches |
| `src/lib/rerank.ts` | 89% | 86% | 100% | 89% | Voyage API error handling |
| `src/lib/seasonal-weighting.ts` | 100% | 83% | 100% | 100% | Branch coverage only |
| `src/lib/translate-story.ts` | 97% | 84% | 100% | 97% | Lines 235, 241: internal throw statements in error handling |
| `src/lib/i18n/detect-language.ts` | 91% | 83% | 100% | 97% | Navigator.languages fallback |
| `src/lib/i18n/resolve.ts` | 92% | 88% | 100% | 92% | Translation key fallback chain |
| `src/lib/i18n/index.ts` | 0% | 0% | 0% | 0% | Re-export only file (no executable code) |
| `src/lib/i18n/types.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/analytics.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/elevenlabs-analytics.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/index.ts` | 0% | 0% | 0% | 0% | Re-export only file (no executable code) |

## Tests Not Worth Writing

These are deliberately untested and considered acceptable:

1. **Type-only files** (`src/types/*.ts`, `src/lib/i18n/types.ts`): Pure TypeScript type definitions have no runtime code to test.

2. **Re-export files** (`src/types/index.ts`, `src/lib/i18n/index.ts`): These only re-export from other modules with no logic.

3. **Auth callback cookie handling** (`src/app/auth/callback/route.ts` lines 20-25): The `setAll` catch block in Supabase cookie handling is unreachable in jsdom/vitest because the browser cookie API never throws in the test environment.

4. **PostHog analytics initialization** (`src/components/provider.tsx`): Browser-only analytics code that requires a real browser environment.

5. **Audio controls** (`src/components/immersive/volume-button.tsx`): Requires browser audio APIs not available in jsdom.

6. **Complex admin UI components**: These components (content-dashboard, agent-chat, marketing-dashboard, etc.) have complex interactive states that are better tested via Playwright E2E tests rather than unit tests.

7. **Claude API unreachable safety net** (`src/lib/claude.ts` line 323): A TypeScript-required `throw` after a retry loop that can never actually execute — the loop always either returns or throws the actual error. At 99.35% statement coverage.

8. **Fullscreen API edge cases** (`src/components/immersive/fullscreen-button.tsx`): Desktop Fullscreen API is now mocked and tested (94% coverage). Remaining gap: Mac with touchpad detection edge case (line 19).

9. **Admin tunnel route** (`src/app/api/admin/tunnel/route.ts`): Uses child_process spawn/exec for Cloudflare tunnel management. This is a development-only feature that requires actual shell execution and cannot be meaningfully tested in jsdom/vitest without mocking the entire child_process module, which would provide no real test value.

## Changes Made This Run

### Test files created (2026-02-10):
- `src/lib/admin-api/analytics.test.ts` (32 tests) - Full coverage for all 5 analytics fetch functions
- `src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx` (33 tests) - Rendering, modals, date range, tier alerts, forecast, usage metrics
- `src/components/admin/story-editor-dialog/use-story-editor-save.test.ts` (36 tests) - Details save, image upload/URL, translations, approve, mark-needs-curation

### Test files modified (2026-02-10):
- `src/lib/supabase-auth.test.ts` (+5 tests) - Cookie callbacks (getAll, setAll delegation), server client creation
- `src/hooks/use-feature-flags.test.ts` (+4 tests) - Cache behavior: fresh cache hit, dedup in-flight, fetch fail with cached data, useEffect catch block
- `src/lib/translate-story.test.ts` (+4 tests) - DB update error, API failure, pre-existing translations, missing locale
- `src/components/immersive/voice-chat.test.tsx` (+8 tests) - initialMessage, voice fallback, ReactMarkdown components, upsell dismiss, purchase CTA
- `src/lib/claude.test.ts` (+9 tests) - SDK path (callWithSDK, streamWithSDK) via NODE_ENV=production dynamic imports
- `src/proxy.test.ts` (+7 tests) - Cookie setAll callback, auth session refresh error logging, Supabase auth error

### Coverage improvements (2026-02-10):
- **src/lib/admin-api/analytics.ts**: 67% → 100% (+33%)
- **src/lib/supabase-auth.ts**: 73% → 100% (+27%)
- **src/hooks/use-feature-flags.ts**: 86% → 100% (+14%)
- **src/lib/translate-story.ts**: 85% → 97% (+12%)
- **src/components/admin/costs-analytics-panel** (3 files): 35-43% → covered (+33 tests)
- **src/components/admin/story-editor-dialog/use-story-editor-save.ts**: 0% → covered (+36 tests)
- **src/components/immersive/voice-chat.tsx**: 87% → 100% (+13%)
- **src/lib/claude.ts**: 92% → 99% (+7%)
- **src/proxy.ts**: 92% → 97% (+5%)

### Overall improvement (2026-02-10):
- Statement coverage: 73.68% → 79.01% (+5.33%)
- Branch coverage: 65.86% → 70.06% (+4.20%)
- Function coverage: 65.97% → 72.47% (+6.50%)
- Line coverage: 74.62% → 79.82% (+5.20%)
- Total tests: 3160 → 3641 (+481 tests)
- Test files: 213 → 238 (+25 files)

---

### Test files created (2026-02-09):
- `src/hooks/use-focus-trap.test.tsx` (7 tests) - Tab/Shift+Tab wrapping, Escape key, focus restoration
- `src/components/posthog-provider.test.tsx` (11 tests) - Provider rendering, guard conditions, context propagation
- `src/app/immersive/immersive-page-content.test.tsx` (5 tests) - Loading, rendering, no-results, query params

### Test files modified (2026-02-09):
- `src/lib/claude.test.ts` (+8 tests) - stderr handling, context truncation, stream async generator
- `src/app/api/admin/costs-analytics/route.test.ts` (+4 tests) - ElevenLabs cost, recurring costs, usage metrics, POST error
- `src/app/api/checkout/day-pass/route.test.ts` (+3 tests) - Missing env vars, dev error details
- `src/components/admin/analytics-tabs.test.tsx` (+6 tests) - Keyboard shortcuts (Cmd+key, modifiers, input focus)
- `src/components/immersive/fullscreen-button.test.tsx` (+5 tests) - Desktop fullscreen API (requestFullscreen, exitFullscreen, fullscreenchange)
- `src/components/immersive/suggest-place-dialog.test.tsx` (+5 tests) - Place name >100 chars, success timer, loading cancel, empty error fallback
- `src/components/immersive/voice-chat-elevenlabs.test.tsx` (+8 tests) - onConnect/onDisconnect/onError callbacks, empty agentId, connecting state, mute toggle, user message prefix, endSession error

### Coverage improvements (2026-02-09):
- **src/hooks/use-focus-trap.ts**: 58% → 97% (+39%)
- **src/components/admin/analytics-tabs.tsx**: 43% → 100% (+57%)
- **src/components/immersive/voice-chat-elevenlabs.tsx**: 80% → 100% (+20%)
- **src/app/api/admin/costs-analytics/route.ts**: 59% → 96% (+37%)
- **src/components/immersive/fullscreen-button.tsx**: 79% → 94% (+15%)
- **src/components/immersive/suggest-place-dialog.tsx**: 70% → 89% (+19%)
- **src/app/api/checkout/day-pass/route.ts**: 71% → 83% (+12%)
- **src/app/immersive/immersive-page-content.tsx**: 70% → 81% (+11%)
- **src/lib/claude.ts**: 57% → 58% (+1%)
- **src/components/posthog-provider.tsx**: 56% → 62% (+6%)

### Overall improvement (2026-02-09):
- Statement coverage: 72.40% → 73.68% (+1.28%)
- Branch coverage: 64.65% → 65.86% (+1.21%)
- Function coverage: 65.15% → 65.97% (+0.82%)
- Line coverage: 73.34% → 74.62% (+1.28%)
- Total tests: 3099 → 3160 (+61 tests)
- Test files: 210 → 213 (+3 files)

---

### Test files created (2026-02-06):
- `src/config/location.test.ts` (11 tests) - Tests for getRegionIds, getRegion, getRegionCoordinates
- `src/app/privacy/page.test.tsx` (6 tests) - Tests for privacy policy page rendering
- `src/app/terms/page.test.tsx` (6 tests) - Tests for terms of service page rendering
- `src/app/api/health/db/route.test.ts` (8 tests) - Tests for database health check endpoint
- `src/lib/costs/manual-costs.test.ts` (14 tests) - Tests for CRUD operations on manual cost entries
- `src/components/immersive/toolbar-overflow-menu.test.tsx` (12 tests) - Tests for overflow menu and item components
- `src/components/immersive/chat-upsell-cta.test.tsx` (8 tests) - Tests for upsell CTA with auth flows

### Test files modified (2026-02-06):
- `src/lib/costs/twilio-costs.test.ts` (+6 tests) - Added fetchTwilioCostsByDay tests
- `src/lib/translate-story.test.ts` (+7 tests) - Added updateStoryTranslation and getStoryTranslations tests
- `src/components/immersive/share-button.test.tsx` (+4 tests) - Added stopPropagation, AbortError, share fallback, slug fallback tests

### Coverage improvements (2026-02-06):
- **src/config/location.ts**: 66% → 100%
- **src/app/privacy/page.tsx**: 0% → 100%
- **src/app/terms/page.tsx**: 0% → 100%
- **src/app/api/health/db/route.ts**: 0% → 100%
- **src/lib/costs/manual-costs.ts**: 0% → 93%
- **src/lib/costs/twilio-costs.ts**: 50% → 100%
- **src/lib/translate-story.ts**: 66% → 86%
- **src/components/immersive/chat-upsell-cta.tsx**: 5% → 100%
- **src/components/immersive/toolbar-overflow-menu.tsx**: 52% → 96%
- **src/components/immersive/share-button.tsx**: 79% → 96%

### Overall improvement (2026-02-06):
- Statement coverage: 65.41% → 67.45% (+2.04%)
- Branch coverage: 59.57% → 61.45% (+1.88%)
- Function coverage: 61.07% → 63.25% (+2.18%)
- Line coverage: 65.68% → 68.07% (+2.39%)
- Total tests: 2548 → 2630 (+82 tests)
- Test files: 177 → 184 (+7 files)

## How It Works

1. Runs `npx vitest run --coverage` to measure current coverage
2. Identifies files below 100% statement coverage
3. Reads source + test files, **including actual type definitions**
4. Writes missing tests with **correctly typed mocks**
5. **Runs `npm run typecheck` to validate TypeScript** — fixes any errors before proceeding
6. Re-runs full suite to verify nothing broke
7. Updates this file with the results
8. Logs output to `logs/coverage-agent-YYYY-MM-DD.log`

### Type Safety Requirements

The coverage agent MUST ensure all generated tests pass TypeScript validation:
- Mock objects must match their real interface exactly
- No extra properties on mock returns (e.g., `{ valid: true }` union types shouldn't have `error` property)
- Nullable types must be properly annotated (`as Date | null`)
- Always read actual type definitions before creating mocks

Run manually anytime:
```bash
./scripts/coverage-agent.sh
```

## History

- **2026-01-26**: Initial coverage agent run -- 705 tests, 48 files
- **2026-01-28**: Post-Phase 7 refresh -- 1247 tests, 102 files
- **2026-01-30**: Coverage Agent run -- 1998 tests, 127 files (+5.64% statement coverage)
- **2026-02-02**: Coverage Agent run -- 2197 tests, 142 files (+199 tests, +15 test files)
  - Added tests for: encryption, credentials, platforms module, immersive components (freshness-badge, question-prompts, user-submitted-badge, surprise-me-button, mood-overlay, suggest-place-dialog, suggest-place-button), voice-purchase-cta
  - Previously 0% files now covered: freshness-badge (100%), question-prompts (100%), user-submitted-badge (100%), surprise-me-button (100%), mood-overlay (100%), suggest-place-button (100%), encryption (100%), credentials (100%), platforms/types (100%), platforms/index (~93%), platforms/x-client (~94%)
- **2026-02-03**: Coverage Agent run -- 2294 tests, 152 files (+2.81% statement coverage)
  - Added tests for: voice-access API, suggestions API, agent-reports API, pricing pages, story page redirect, admin-tabs, theme-toggle, fullscreen-button
  - Previously 0% files now covered: voice-access (84%), suggestions (88%), agent-reports (92%), pricing/page (71%), pricing/success (100%), story/[slug]/page (100%), admin-tabs (100%), theme-toggle (100%), fullscreen-button (~80%)
- **2026-02-05**: Coverage Agent run -- 2488 tests, 171 files (+194 tests, +19 files)
  - Fixed failing checkout/day-pass tests (missing env var stubs)
  - Created `src/app/api/mcp/make-booking/status/route.test.ts` (9 tests) - Twilio status callback tests
  - Enhanced `src/lib/stripe.test.ts` (13 tests total) - Added tests for getStripeClient, createDayPassCheckoutSession, verifyWebhookSignature
  - Enhanced `src/app/pricing/page.test.tsx` (16 tests total) - Added checkout flow tests, error handling, loading states
  - Coverage improvements:
    - **src/lib/stripe.ts**: 28% → 96% (+68%)
    - **src/app/pricing/page.tsx**: 57% → 100% (+43%)
    - **src/app/api/mcp/make-booking/status/route.ts**: 0% → 100% (+100%)
  - Documented admin/tunnel/route.ts as untestable (child_process/shell operations)
- **2026-02-06 (morning)**: Coverage Agent run -- 2630 tests, 184 files (+82 tests, +7 files, +2.04% statement coverage)
  - Created 7 new test files: location config, privacy/terms pages, health/db route, manual-costs CRUD, toolbar-overflow-menu, chat-upsell-cta
  - Enhanced 3 existing test files: twilio-costs (+6), translate-story (+7), share-button (+4)
  - 6 files reached 100%: location, privacy/page, terms/page, health/db, twilio-costs, chat-upsell-cta
  - 4 files significantly improved: manual-costs (0→93%), overflow-menu (52→96%), share-button (79→96%), translate-story (66→86%)
- **2026-02-06 (afternoon)**: Coverage Agent verification run -- 2754 tests, 196 files (✅ all passing)
  - **Fixed**: Test setup for `NEXT_PUBLIC_SITE_URL` env var (was causing 13 test failures in layout/SEO tests)
  - **Fixed**: Proxy test NODE_ENV mocking issue (added `vi.unstubAllEnvs()` to cleanup)
  - **Verified**: TypeScript type safety (0 errors)
  - **Status**: Test suite is healthy and stable
- **2026-02-09**: Coverage Agent run -- 3160 tests, 213 files (+61 tests, +3 files, +1.28% statement coverage)
  - Created 3 new test files: use-focus-trap, posthog-provider, immersive-page-content
  - Enhanced 7 existing test files: claude (+8), costs-analytics (+4), checkout/day-pass (+3), analytics-tabs (+6), fullscreen-button (+5), suggest-place-dialog (+5), voice-chat-elevenlabs (+8)
  - 2 files reached 100%: analytics-tabs, voice-chat-elevenlabs
  - 6 files significantly improved: use-focus-trap (58→97%), costs-analytics (59→96%), fullscreen-button (79→94%), suggest-place-dialog (70→89%), checkout/day-pass (71→83%), immersive-page-content (70→81%)
- **2026-02-10**: Coverage Agent run -- 3641 tests, 238 files (+481 tests, +25 files, +5.33% statement coverage)
  - Created 3 new test files: admin-api/analytics (32 tests), costs-analytics-panel (33 tests), use-story-editor-save (36 tests)
  - Enhanced 6 existing test files: supabase-auth (+5), use-feature-flags (+4), translate-story (+4), voice-chat (+8), claude (+9), proxy (+7)
  - 7 files reached 100%: admin-api/analytics, supabase-auth, use-feature-flags, admin-auth, voice-chat, admin-api/agents, admin-api/costs
  - 3 files near-100%: claude (99%), proxy (97%), translate-story (97%)
  - Largest single-run improvement to date: +5.33% statement coverage, +481 tests
  - Used 8 parallel background agents for maximum throughput
