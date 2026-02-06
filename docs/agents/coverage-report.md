# Test Coverage Report

> Last updated: 2026-02-06
> Scheduled: nightly at 2:00 CET via `scripts/coverage-agent.sh`

## Summary

- **Total tests:** 2630
- **Test files:** 184
- **Statement coverage:** 67.45%
- **Branch coverage:** 61.45%
- **Function coverage:** 63.25%
- **Line coverage:** 68.07%

*Note: Coverage percentages appear lower due to expanded coverage scope that now includes more previously-uncovered files.*

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
| `src/hooks/use-realtime-feature-flags.ts` | Hooks |
| `src/hooks/use-story-filters.ts` | Hooks |
| `src/hooks/use-viewed-stories.ts` | Hooks |
| `src/hooks/use-visitor-voice-access.ts` | Hooks |
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

## Files Below 100%

| File | Stmts | Branch | Funcs | Lines | Reason |
|------|-------|--------|-------|-------|--------|
| `src/proxy.ts` | 98% | 97% | 100% | 98% | Line 12 is a type import only executed at compile time |
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
| `src/app/auth/callback/route.ts` | 71% | 100% | 25% | 71% | Supabase Auth cookie handling (setAll catch block unreachable in jsdom) |
| `src/app/favorites/page.tsx` | 86% | 77% | 82% | 89% | Complex RSC with suspense boundaries |
| `src/app/immersive/page.tsx` | 69% | 46% | 69% | 70% | Complex client interactions with story navigation |
| `src/components/provider.tsx` | 60% | 50% | 100% | 60% | PostHog analytics initialization (browser-only) |
| `src/components/admin/*` (multiple) | 0-42% | 0-48% | 0-40% | 0-42% | Complex admin UI components with browser-specific interactions |
| `src/components/immersive/fullscreen-button.tsx` | ~80% | ~75% | ~80% | ~80% | Fullscreen API not available in jsdom (requestFullscreen/exitFullscreen) |
| `src/components/immersive/share-button.tsx` | 96% | 93% | 100% | 100% | Minor branch for window.location origin edge case |
| `src/components/immersive/toolbar-overflow-menu.tsx` | 96% | 93% | 91% | 96% | Line 69: ref cleanup edge case |
| `src/components/immersive/volume-button.tsx` | 0% | 0% | 0% | 0% | Audio control component - requires browser audio APIs |
| `src/hooks/use-feature-flags.ts` | 86% | 70% | 100% | 84% | Fetch retry logic edge cases |
| `src/hooks/use-reduced-motion.ts` | 92% | 50% | 100% | 100% | SSR check branch |
| `src/hooks/use-stories.ts` | 97% | 88% | 100% | 99% | LocalStorage quota exceeded handling |
| `src/lib/admin-api.ts` | 46% | 44% | 46% | 47% | Contains many fetch wrappers - tested via API route tests |
| `src/lib/admin-auth.ts` | 73% | 100% | 25% | 73% | Server-side cookie handling |
| `src/lib/chat-action-detection.ts` | 97% | 75% | 100% | 99% | Regex edge cases |
| `src/lib/claude.ts` | 43% | 33% | 50% | 43% | Anthropic API streaming - requires live API for full coverage |
| `src/lib/image-optimization.ts` | 95% | 69% | 100% | 96% | Sharp library edge cases |
| `src/lib/localize-story.ts` | 100% | 87% | 100% | 100% | Branch coverage only - all statements covered |
| `src/lib/rate-limit.ts` | 97% | 82% | 100% | 97% | Token bucket edge case |
| `src/lib/costs/manual-costs.ts` | 93% | 92% | 100% | 93% | Supabase admin client null-check branches |
| `src/lib/rerank.ts` | 89% | 86% | 100% | 89% | Voyage API error handling |
| `src/lib/seasonal-weighting.ts` | 100% | 83% | 100% | 100% | Branch coverage only |
| `src/lib/translate-story.ts` | 86% | 80% | 100% | 86% | Claude API translation calls and metadata edge cases |
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

7. **Claude API streaming** (`src/lib/claude.ts` streaming functions): The Anthropic SDK streaming requires live API access. Core response generation is tested; streaming edge cases are covered by E2E tests.

8. **Fullscreen API** (`src/components/immersive/fullscreen-button.tsx`): The browser Fullscreen API (requestFullscreen/exitFullscreen) is not available in jsdom. iOS modal flow is tested.

9. **Admin tunnel route** (`src/app/api/admin/tunnel/route.ts`): Uses child_process spawn/exec for Cloudflare tunnel management. This is a development-only feature that requires actual shell execution and cannot be meaningfully tested in jsdom/vitest without mocking the entire child_process module, which would provide no real test value.

## Changes Made This Run

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
- **2026-02-06**: Coverage Agent run -- 2630 tests, 184 files (+82 tests, +7 files, +2.04% statement coverage)
  - Created 7 new test files: location config, privacy/terms pages, health/db route, manual-costs CRUD, toolbar-overflow-menu, chat-upsell-cta
  - Enhanced 3 existing test files: twilio-costs (+6), translate-story (+7), share-button (+4)
  - 6 files reached 100%: location, privacy/page, terms/page, health/db, twilio-costs, chat-upsell-cta
  - 4 files significantly improved: manual-costs (0→93%), overflow-menu (52→96%), share-button (79→96%), translate-story (66→86%)
