# Test Coverage Report (ARCHIVED)

> **ARCHIVED**: This standalone report has been consolidated into the unified Codebase Health Check.
> See `docs/health-report-[DATE].md` for the latest coverage data.
> This file is kept for historical reference only and is no longer updated.

> Last updated: 2026-03-08

## Summary

- **Total tests:** 5059 passed
- **Test files:** 292 passed (100%)
- **Statement coverage:** 96.53%
- **Branch coverage:** 89.60%
- **Function coverage:** 94.75%
- **Line coverage:** 97.37%
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
| `src/app/api/admin/stories/[id]/route.ts` | API |
| `src/app/api/admin/stories/[id]/image/route.ts` | API |
| `src/app/api/admin/stories/[id]/image-source/route.ts` | API |
| `src/app/api/admin/stories/[id]/status/route.ts` | API |
| `src/app/api/admin/stories/[id]/translations/route.ts` | API |
| `src/app/api/admin/stories/approve-all/route.ts` | API |
| `src/app/api/admin/stories/bulk-delete/route.ts` | API |
| `src/app/api/admin/stories/bulk-status/route.ts` | API |
| `src/app/api/admin/stories/content-images/route.ts` | API |
| `src/app/api/admin/suggestions/[id]/route.ts` | API |
| `src/app/api/admin/marketing/accounts/route.ts` | API |
| `src/app/api/admin/marketing/schedule/route.ts` | API |
| `src/app/api/chat/stream/route.ts` | API |
| `src/app/api/cron/content-discovery/route.ts` | API |
| `src/app/api/cron/github-traffic-sync/route.ts` | API |
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
| `src/components/admin/agent-config-panel.tsx` | Admin |
| `src/components/admin/curation-badge.tsx` | Admin |
| `src/components/admin/placeholder-badge.tsx` | Admin |
| `src/components/admin/selection-toolbar.tsx` | Admin |
| `src/components/admin/story-grid.tsx` | Admin |
| `src/components/admin/visitor-voice-config-panel.tsx` | Admin |
| `src/components/admin/costs-analytics-panel/alerts.tsx` | Admin |
| `src/components/admin/costs-analytics-panel/chart.tsx` | Admin |
| `src/components/admin/costs-analytics-panel/forecast.tsx` | Admin |
| `src/components/admin/costs-analytics-panel/index.tsx` | Admin |
| `src/components/admin/costs-analytics-panel/modals.tsx` | Admin |
| `src/components/admin/costs-analytics-panel/skeletons.tsx` | Admin |
| `src/components/admin/marketing-dashboard/create-draft-dialog.tsx` | Marketing |
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
| `src/lib/admin-auth.ts` | Lib |
| `src/lib/asturianu.ts` | Lib |
| `src/lib/chat-config.ts` | Lib |
| `src/lib/chat-safety.ts` | Lib |
| `src/lib/credentials.ts` | Lib |
| `src/lib/csrf.ts` | Lib |
| `src/lib/csrf-client.ts` | Lib |
| `src/lib/email.ts` | Lib |
| `src/lib/embedding-cache.ts` | Lib |
| `src/lib/embeddings.ts` | Lib |
| `src/lib/encryption.ts` | Lib |
| `src/lib/freshness.ts` | Lib |
| `src/lib/mood-mapping.ts` | Lib |
| `src/lib/og-image-helpers.ts` | Lib |
| `src/lib/realtime.ts` | Lib |
| `src/lib/related-stories.ts` | Lib |
| `src/lib/rerank.ts` | Lib |
| `src/lib/search.ts` | Lib |
| `src/lib/shuffle.ts` | Lib |
| `src/lib/stories-data.ts` | Lib |
| `src/lib/stripe.ts` | Lib |
| `src/lib/supabase-auth.ts` | Lib |
| `src/lib/supabase-browser.ts` | Lib |
| `src/lib/supabase.ts` | Lib |
| `src/lib/unsplash-placeholders.ts` | Lib |
| `src/lib/utils.ts` | Lib |
| `src/lib/validation.ts` | Lib |
| `src/lib/costs/elevenlabs-costs.ts` | Costs |
| `src/lib/costs/forecast.ts` | Costs |
| `src/lib/costs/manual-costs.ts` | Costs |
| `src/lib/costs/recurring-costs.ts` | Costs |
| `src/lib/costs/twilio-costs.ts` | Costs |
| `src/lib/i18n/de.ts` | i18n |
| `src/lib/i18n/en.ts` | i18n |
| `src/lib/i18n/es.ts` | i18n |
| `src/lib/i18n/fr.ts` | i18n |
| `src/lib/i18n/resolve.ts` | i18n |
| `src/lib/i18n/pt.ts` | i18n |
| `src/lib/i18n/use-translation.ts` | i18n |
| `src/lib/admin-api/analytics.ts` | Admin API |
| `src/lib/admin-api/agents.ts` | Admin API |
| `src/lib/admin-api/agent-config.ts` | Admin API |
| `src/lib/admin-api/costs.ts` | Admin API |
| `src/lib/admin-api/feature-flags.ts` | Admin API |
| `src/lib/admin-api/stories.ts` | Admin API |
| `src/lib/admin-api/suggestions.ts` | Admin API |
| `src/types/admin.ts` | Types |
| `src/types/auth.ts` | Types |
| `src/types/feature-flags.ts` | Types |
| `src/types/immersive.ts` | Types |
| `src/types/marketing.ts` | Types |
| `src/components/immersive/voice-chat.tsx` | Immersive |
| `src/components/admin/agents-dashboard/constants.ts` | Admin |
| `src/components/admin/agents-dashboard/use-agent-runner.ts` | Admin |
| `src/components/admin/agents-dashboard/use-agent-terminal.ts` | Admin |
| `src/components/admin/story-editor-dialog/types.ts` | Admin |
| `src/components/admin/marketing-dashboard/stat-card.tsx` | Marketing |
| `src/components/admin/marketing-dashboard/constants.ts` | Marketing |
| `src/components/admin/marketing-dashboard/account-card.tsx` | Marketing |
| `src/components/admin/story-card.tsx` | Admin |
| `src/app/api/admin/agent-config/route.ts` | API |
| `src/app/privacy/layout.tsx` | App |
| `src/app/terms/layout.tsx` | App |
| `src/app/favorites/page.tsx` | App |
| `src/components/admin/agents-dashboard/agent-card.tsx` | Admin |

## Files Below 100%

| File | Stmts | Branch | Funcs | Lines | Reason |
|------|-------|--------|-------|-------|--------|
| `src/proxy.ts` | 98% | 94% | 96% | 98% | NODE_ENV guard at module load, cookie callback |
| `src/app/admin/page.tsx` | 97% | 84% | 100% | 99% | Line 821: dead code StatCard `<div>` fallback |
| `src/app/immersive/immersive-page-content.tsx` | 90% | 85% | 94% | 91% | Dynamic import loading/error states |
| `src/components/posthog-provider.tsx` | 61% | 41% | 77% | 63% | PostHog analytics — browser-only dynamic imports |
| `src/components/admin/voice-agent-chat.tsx` | 45% | 42% | 39% | 46% | ElevenLabs SDK integration — better suited for E2E |
| `src/components/admin/agents-dashboard/index.tsx` | 48% | 47% | 52% | 50% | Complex admin dashboard — better suited for E2E |
| `src/components/admin/story-editor-dialog/index.tsx` | 62% | 76% | 58% | 69% | Complex dialog — better suited for E2E |
| `src/components/admin/create-story-dialog.tsx` | 76% | 72% | 66% | 76% | Complex dialog — better suited for E2E |
| `src/components/admin/suggestions-panel.tsx` | 93% | 87% | 87% | 92% | Callbacks to mocked child dialogs |
| `src/components/admin/marketing-dashboard/marketing-dashboard.tsx` | 98% | 83% | 100% | 100% | Minor branch gaps in JSX ternaries |
| `src/components/admin/marketing-dashboard/drafts-panel.tsx` | 95% | 86% | 85% | 97% | onCreated callback in mocked dialog |
| `src/components/immersive/story-viewer.tsx` | 92% | 86% | 90% | 93% | Complex animation/gesture handlers |
| `src/components/immersive/voice-dialog.tsx` | 88% | 82% | 87% | 88% | Voice permission/media stream edge cases |
| `src/components/immersive/author-typewriter.tsx` | 85% | 64% | 100% | 100% | requestAnimationFrame timing branches |
| `src/hooks/use-voice-session.ts` | 93% | 85% | 100% | 96% | SSR guard (typeof window, unreachable in jsdom) |
| `src/hooks/use-reduced-motion.ts` | 92% | 50% | 100% | 100% | SSR guard (typeof window, unreachable in jsdom) |
| `src/lib/claude.ts` | 99% | 89% | 100% | 99% | Unreachable TypeScript safety net in retry loop |
| `src/lib/content-discovery.ts` | 93% | 79% | 100% | 92% | Complex async processing edge cases |
| `src/lib/geo-optimization.ts` | 94% | 68% | 100% | 96% | Sharp library edge cases |
| `src/lib/system-optimizer.ts` | 97% | 67% | 93% | 98% | Defensive fallback branches |
| `src/lib/i18n/provider.tsx` | 96% | 100% | 90% | 95% | es/en lazy loaders never called (pre-cached by design) |
| `src/lib/platforms/x-client.ts` | 98% | 85% | 100% | 98% | Unreachable `error instanceof Error` in defensive code |
| `src/lib/i18n/index.ts` | 0% | 0% | 0% | 0% | Re-export only (no executable code) |
| `src/lib/i18n/types.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/lib/admin-api/index.ts` | 0% | 0% | 0% | 0% | Re-export only (no executable code) |
| `src/lib/costs/index.ts` | 0% | 0% | 0% | 0% | Re-export only (no executable code) |
| `src/types/analytics.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/index.ts` | 0% | 0% | 0% | 0% | Re-export only (no executable code) |
| `src/types/agent-config.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/agents-dashboard.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/costs-analytics.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/revenue-analytics.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/types/voice-analytics.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/components/admin/costs-analytics-panel/types.ts` | 0% | 0% | 0% | 0% | Type definitions only (no executable code) |
| `src/components/admin/marketing-dashboard/index.ts` | 0% | 0% | 0% | 0% | Re-export only (no executable code) |

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

### Test files modified (2026-03-08):

**API Routes — error paths and edge cases:**
- `src/app/api/admin/suggestions/[id]/route.test.ts` (+7 tests) — PUT/DELETE validation, PGRST116 error, catch blocks
- `src/app/api/cron/github-traffic-sync/route.test.ts` (+12 tests) — Full sync path, dailyMap merge, upsert/insert errors, GitHub API errors
- `src/app/api/admin/stories/[id]/translations/route.test.ts` (+13 tests) — GET/PATCH/POST auth, validation, JSON parse, catch blocks
- `src/app/api/admin/marketing/schedule/route.test.ts` (+8 tests) — DB errors and catch blocks for all HTTP methods
- `src/app/api/admin/marketing/agent/route.test.ts` (+6 tests) — Message validation, persona file errors, system prompt context
- `src/app/api/admin/marketing/posts/route.test.ts` (+4 tests) — Catch blocks for POST/PATCH/DELETE
- `src/app/api/admin/marketing/agent-logs/route.test.ts` (+2 tests) — DB error branch, outer catch block
- `src/app/api/cron/content-discovery/route.test.ts` (+3 tests) — Admin auth, runDiscovery throws (Error and non-Error)
- `src/app/api/cron/subscription-optimizer/route.test.ts` (+3 tests) — readFile catch, shared context write, usageMetrics merge
- `src/app/api/admin/stories/route.test.ts` (+3 tests) — Suggestion update failure, catch block, slug error
- `src/app/api/admin/stories/[id]/route.test.ts` (+3 tests) — Slug error, not found after update, catch block
- `src/app/api/admin/stories/content-images/route.test.ts` (+3 tests) — Empty ID, page scoring, null chunks
- `src/app/api/admin/stories/[id]/image/route.test.ts` (+6 tests) — Empty ID, blur placeholder, fetch failures
- `src/app/api/admin/stories/approve-all/route.test.ts` (+2 tests) — Catch block, null data fallback
- `src/app/api/admin/stories/bulk-delete/route.test.ts` (+2 tests) — Catch block, null data fallback
- `src/app/api/admin/stories/bulk-status/route.test.ts` (+2 tests) — Catch block, null data fallback
- `src/app/api/admin/stories/[id]/status/route.test.ts` (+1 test) — Empty story ID
- `src/app/api/webhooks/elevenlabs/route.test.ts` (+5 tests) — Missing secret, DB error, invalid JSON, transcript types
- `src/app/api/mcp/places/route.test.ts` (+3 tests) — Rate limiting, non-ok HTTP response
- `src/app/api/mcp/weather/route.test.ts` (+3 tests) — Rate limiting, empty API key
- `src/app/api/mcp/make-booking/route.test.ts` (+4 tests) — Phone normalization, date/time formatting
- `src/app/api/admin/costs-analytics/route.test.ts` (+2 tests) — ElevenLabs/PostHog fetch failures
- `src/app/api/admin/stripe-analytics/route.test.ts` (+2 tests) — Payment status mapping branches
- `src/app/api/admin/agent-reports/route.test.ts` (+1 test) — File stat ISO date
- `src/app/api/admin/marketing/accounts/route.test.ts` (+4 tests) — Catch blocks for all methods
- `src/app/api/chat/route.test.ts` (+2 tests) — MAX_INPUT_LENGTH check, dev error debug info
- `src/app/api/admin/tunnel/route.test.ts` (+2 tests) — pgrep throw, spawn throw
- `src/app/api/admin/elevenlabs-analytics/route.test.ts` (+3 tests) — Auth failure, non-ok API, agent name fallback
- `src/app/api/admin/github-analytics/route.test.ts` (+2 tests) — Daily query failure, outer catch
- `src/app/api/admin/agents-summary/route.test.ts` (+3 tests) — Unknown health, no summary, outer catch

**Library files:**
- `src/lib/costs/recurring-costs.test.ts` (+3 tests) — endDate filtering, PLATFORM_SERVICES fallback
- `src/lib/costs/manual-costs.test.ts` (+2 tests) — updateManualCost/getManualCost catch blocks
- `src/lib/i18n/resolve.test.ts` (+1 test) — String intermediate traversal
- `src/lib/i18n/provider.test.tsx` (+1 test) — Asturian locale lazy loader
- `src/lib/costs/elevenlabs-costs.test.ts` (+3 tests) — Zero counts, zero timestamps, missing billing_period
- `src/lib/csrf.test.ts` (+1 test) — Cookie parsing with missing __csrf
- `src/lib/csrf-client.test.ts` (+2 tests) — Server-side guard, POST without CSRF token
- `src/lib/content-discovery.test.ts` (+4 tests) — Processing errors, empty drafts, insert/fetch errors
- `src/lib/posthog-query.test.ts` (+1 test) — Retry warning log
- `src/lib/translate-story.test.ts` (+2 tests) — No text block, invalid JSON response
- `src/lib/twilio-sms.test.ts` (+1 test) — Natural language time format
- `src/lib/stripe.test.ts` (+1 test) — Unknown purchase type error
- `src/lib/platforms/index.test.ts` (+1 test) — Client returns null on 403
- `src/lib/platforms/x-client.test.ts` (+2 tests) — data.detail error field, non-Error throw

**Components and hooks:**
- `src/hooks/use-voice-session.test.ts` (+2 tests) — localStorage.setItem throw
- `src/hooks/use-admin-role.test.ts` (+2 tests) — User change re-check, logout ref reset
- `src/components/immersive/chat-actions.test.tsx` (+3 tests) — No assistant messages, double-click copy, clipboard failure
- `src/components/immersive/author-typewriter.test.tsx` (+7 tests) — Unmount during phases, full cycle, click propagation
- `src/components/immersive/story-viewer.test.tsx` (+10 tests) — Form element guards, chat keyboard, auto-play, navigator.share
- `src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx` (+7 tests) — StatCard types, label skip, modals, alerts
- `src/components/admin/marketing-dashboard/drafts-panel.test.tsx` (+3 tests) — onCreated callback, clipboard failure, create dialog
- `src/components/admin/marketing-dashboard/marketing-dashboard.test.tsx` (+7 tests) — Disconnect/toggle errors, config dialog callbacks
- `src/app/immersive/immersive-page-content.test.tsx` (+2 tests) — Mood select, mood dismiss
- `src/app/admin/page.test.tsx` (+1 test) — Missing translations branch
- `src/components/admin/elevenlabs-analytics-panel.test.tsx` (+6 tests) — Status breakdown, zero calls, unknown language
- `src/components/admin/suggestions-panel.test.tsx` (+5 tests) — Location labels, notes error, reject, filter
- `src/components/admin/visitors-analytics-panel.test.tsx` (+9 tests) — localStorage, URL formatting, chart rendering
- `src/components/admin/stripe-analytics-panel.test.tsx` (+9 tests) — Revenue chart, refunds, empty states
- `src/components/admin/agent-config-panel.test.tsx` (+4 tests) — Missing prompt, save success, null config
- `src/components/admin/maintenance-config-panel.test.tsx` (+3 tests) — Save success, preview toggle
- `src/components/admin/marketing-dashboard/account-config-dialog.test.tsx` (+1 test) — Dialog close
- `src/components/admin/marketing-dashboard/create-draft-dialog.test.tsx` (+1 test) — Dialog close

### Coverage improvements (2026-03-08):

**API routes reaching 100% line coverage:**
- `suggestions/[id]/route.ts`: 73% → 100%
- `github-traffic-sync/route.ts`: 76% → 100%
- `translations/route.ts`: 78% → 100%
- `marketing/schedule/route.ts`: 80% → 98%
- `marketing/accounts/route.ts`: 89% → 100%
- `stories/route.ts`: 90% → 100%
- `stories/[id]/route.ts`: 88% → 100%
- `stories/content-images/route.ts`: 90% → 100%
- `stories/[id]/image/route.ts`: 89% → 100%
- `stories/[id]/status/route.ts`: 95% → 100%
- `stories/approve-all/route.ts`: 84% → 100%
- `stories/bulk-delete/route.ts`: 88% → 100%
- `stories/bulk-status/route.ts`: 89% → 100%
- `content-discovery/route.ts`: 90% → 100%

**Library files reaching 100%:**
- `csrf.ts`: 95% → 100%
- `csrf-client.ts`: 95% → 100%
- `costs/recurring-costs.ts`: 93% → 100%
- `costs/manual-costs.ts`: 92% → 100%
- `costs/elevenlabs-costs.ts`: 72% branch → 100% branch
- `i18n/resolve.ts`: 91% → 100%
- `stripe.ts`: 96% → 100%
- `translate-story.ts`: 97% → 100% stmts

**Components:**
- `agent-config-panel.tsx`: 97% → 100%
- `create-draft-dialog.tsx`: 96% → 100%
- `costs-analytics-panel/alerts.tsx`: 97% → 100%
- `costs-analytics-panel/chart.tsx`: 97% → 100%
- `costs-analytics-panel/forecast.tsx`: 97% → 100%
- `costs-analytics-panel/index.tsx`: 95% → 100%
- `marketing-dashboard.tsx`: 75% → 98%
- `drafts-panel.tsx`: 87% → 95%
- `story-viewer.tsx`: 87% → 92%

### Overall improvement (2026-03-08):
- Statement coverage: 93.08% → 96.53% (+3.45%)
- Branch coverage: 85.83% → 89.60% (+3.77%)
- Function coverage: 91.84% → 94.75% (+2.91%)
- Line coverage: 93.90% → 97.37% (+3.47%)
- Total tests: 4782 → 5059 (+277 tests)
- Test files: 292 (0 new files, 50+ enhanced)

---

### Test files modified (2026-03-07):
- `src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx` (+12 tests) - CostChart direct tests ($Xk format, empty data, SVG bars), ServiceBreakdownTable direct tests (empty, manual edit/delete, notes, dashboard links), formatDateShort, TierAlertsSection expand-after-collapse re-fetch
- `src/components/admin/agents-dashboard/agent-card.test.tsx` (+7 tests) - Keyboard Enter/Space navigation, stopPropagation for run/stop buttons, stopped/success last run status
- `src/app/api/admin/marketing/dashboard/route.test.ts` (+3 tests) - Posts fetch error, schedules fetch error, failed posts + recent posts stats
- `src/hooks/use-voice-session.test.ts` (+3 tests) - Existing localStorage state, malformed JSON, missing conversationCount field
- `src/components/immersive/author-typewriter.test.tsx` (+1 test) - Full animation cycle (erase/type loop past HOME_HOLD)
- `src/components/admin/marketing-dashboard/drafts-panel.test.tsx` (+2 tests) - Delete fetch error, mark-as-posted fetch error
- `src/app/api/admin/elevenlabs-analytics/route.test.ts` (+3 tests) - Local config fallback naming, truncated ID fallback, status breakdown with failed
- `src/proxy.test.ts` (+2 tests) - Invalid Supabase URL catch block, setAll cookie update on response
- `src/app/favorites/page.test.tsx` (+2 tests) - IntersectionObserver triggers loadMore, guard clause when hasMore is false

### Coverage improvements (2026-03-07):
- **src/components/admin/agents-dashboard/agent-card.tsx**: 61% → 100% (+39%)
- **src/app/favorites/page.tsx**: 85% → 100% (+15%)
- **src/components/immersive/author-typewriter.tsx**: 72% → 85% (+13%)
- **src/components/admin/costs-analytics-panel/chart.tsx**: 89% → 97% (+8%)
- **src/hooks/use-voice-session.ts**: 87% → 93% (+6%)
- **src/components/admin/costs-analytics-panel/alerts.tsx**: 95% → 97% (+2%)
- **src/app/api/admin/marketing/dashboard/route.ts**: 85% → 90% (+5%)
- **src/components/admin/marketing-dashboard/drafts-panel.tsx**: 83% → 87% (+4%)
- **src/proxy.ts**: 97% → 98% (+1%)

### Overall improvement (2026-03-07):
- Statement coverage: 92.65% → 93.08% (+0.43%)
- Branch coverage: 85.24% → 85.83% (+0.59%)
- Function coverage: 91.52% → 91.84% (+0.32%)
- Line coverage: 93.51% → 93.90% (+0.39%)
- Total tests: 4748 → 4782 (+34 tests)
- Test files: 292 (0 new files, 9 enhanced)

---

### Test files created (2026-03-06):
- `src/lib/admin-api/agent-config.test.ts` (20 tests) - fetchAgentConfig, updateAgentConfig, enableAgent, disableAgent
- `src/app/api/admin/agent-config/route.test.ts` (17 tests) - GET/PUT handlers with fs operations, error paths
- `src/components/admin/suggestions-panel.test.tsx` (21 tests) - Rendering, filtering, approve/dismiss, refresh, error states

### Test files modified (2026-03-06):
- `src/components/admin/costs-analytics-panel/modals.test.tsx` (+5 tests) - Custom service fields onChange, category change, date/notes onChange
- `src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx` (+5 tests) - Delete error, empty state add cost, edit modal success/error
- `src/app/api/webhooks/stripe/route.test.ts` (+2 tests) - Catch block, null payment_intent fallback
- `src/app/api/webhooks/translate/route.test.ts` (+1 test) - Catch block (unexpected error)
- `src/lib/rerank.test.ts` (+1 test) - Null data fallback path
- `src/app/privacy/layout.test.tsx` (+1 test) - Render children
- `src/app/terms/layout.test.tsx` (+1 test) - Render children
- `src/app/api/mcp/make-booking/route.test.ts` (enhanced) - Additional coverage for booking flow
- `src/app/api/mcp/places/route.test.ts` (enhanced) - Additional coverage for Places API
- `src/app/api/mcp/weather/route.test.ts` (enhanced) - Additional coverage for Weather API

### Coverage improvements (2026-03-06):
- **src/lib/admin-api/agent-config.ts**: 3% → 100% (+97%)
- **src/app/api/admin/agent-config/route.ts**: 0% → 100% (+100%)
- **src/components/admin/costs-analytics-panel/modals.tsx**: 72% → 100% (+28%)
- **src/components/admin/suggestions-panel.tsx**: 54% → 89% (+35%)
- **src/lib/rerank.ts**: 89% → 100% (+11%)
- **src/app/privacy/layout.tsx**: 50% → 100% (+50%)
- **src/app/terms/layout.tsx**: 50% → 100% (+50%)
- **src/components/admin/costs-analytics-panel/index.tsx**: 76% → 95% (+19%)

### Overall improvement (2026-03-06):
- Statement coverage: 88.29% → 92.65% (+4.36%)
- Branch coverage: 80.18% → 85.24% (+5.06%)
- Function coverage: 85.30% → 91.52% (+6.22%)
- Line coverage: 89.25% → 93.51% (+4.26%)
- Total tests: 4243 → 4748 (+505 tests)
- Test files: 274 → 292 (+18 files)

---

### Test files created (2026-02-16):
- `src/components/admin/agents-dashboard/constants.test.ts` (18 tests) - relativeTime, formatElapsed, AGENT_FLAG_KEYS, AGENT_NAMES, HEALTH_* constants
- `src/components/admin/story-editor-dialog/types.test.ts` (12 tests) - generateSlug with accents/ñ/special chars, CATEGORIES, LOCATIONS, DURATIONS
- `src/components/admin/agents-dashboard/use-agent-runner.test.ts` (13 tests) - handleRunAgent, handleStopAgent, polling lifecycle, recordRunResult
- `src/components/admin/agents-dashboard/use-agent-terminal.test.ts` (13 tests) - openTerminal, closeTerminal, log polling, stream completion, exit codes
- `src/components/admin/story-editor-dialog/use-story-editor-state.test.ts` (20 tests) - Form initialization, handlers, change tracking, resetAndClose
- `src/components/admin/costs-analytics-panel/modals.test.tsx` (16 tests) - AddCostModal and EditCostModal forms, submission, loading
- `src/components/admin/marketing-dashboard/stat-card.test.tsx` (6 tests) - Rendering, locale formatting, color classes, error styling
- `src/components/admin/marketing-dashboard/post-row.test.tsx` (10 tests) - Content, platform badge, status display, scheduled dates, external links

### Test files modified (2026-02-16):
- `src/components/admin/story-card.test.tsx` (+17 tests) - Selection mode, translation badges, subtitle display
- `src/app/api/admin/marketing/accounts/route.test.ts` (+11 tests) - PATCH method, error paths for GET/POST/DELETE
- `src/components/immersive/story-viewer.test.tsx` (+7 tests) - Mobile overflow menu, bookmarks, image source attribution
- `src/components/admin/marketing-dashboard/drafts-panel.test.tsx` (+8 tests) - Copy, mark-as-posted, delete, error handling, singular count
- `src/components/admin/marketing-dashboard/marketing-dashboard.test.tsx` (+15 tests) - Upcoming/recent posts, schedules, toggle/disconnect, retry, empty state
- `src/components/admin/marketing-dashboard/account-card.test.tsx` (+3 tests) - Configure, resume, disconnect button handlers

### Coverage improvements (2026-02-16):
- **src/components/admin/agents-dashboard/constants.ts**: 0% → 100%
- **src/components/admin/agents-dashboard/use-agent-runner.ts**: 27% → 100%
- **src/components/admin/agents-dashboard/use-agent-terminal.ts**: 27% → 100%
- **src/components/admin/story-editor-dialog/types.ts**: 0% → 100%
- **src/components/admin/story-editor-dialog/use-story-editor-state.ts**: 71% → 98%
- **src/components/admin/marketing-dashboard/stat-card.tsx**: 0% → 100%
- **src/components/admin/marketing-dashboard/account-card.tsx**: 53% → 100%
- **src/components/admin/marketing-dashboard/constants.ts**: 0% → 100%
- **src/components/admin/marketing-dashboard/drafts-panel.tsx**: 43% → 83%
- **src/components/admin/marketing-dashboard/marketing-dashboard.tsx**: 46% → 73%
- **src/components/admin/costs-analytics-panel/modals.tsx**: 41% → 72%
- **src/components/admin/story-card.tsx**: 38% → 100%

### Overall improvement (2026-02-16):
- Statement coverage: 85.92% → 88.29% (+2.37%)
- Branch coverage: 77.65% → 80.18% (+2.53%)
- Function coverage: 82.16% → 85.30% (+3.14%)
- Line coverage: 86.79% → 89.25% (+2.46%)
- Total tests: 4075 → 4243 (+168 tests)
- Test files: 266 → 274 (+8 files)

---

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
- **2026-03-06**: Coverage Agent run -- 4748 tests, 292 files (+505 tests, +18 files, +4.36% statement coverage)
  - Created 3 new test files: admin-api/agent-config (20 tests), api/admin/agent-config route (17 tests), suggestions-panel (21 tests)
  - Enhanced 10 existing test files: costs modals (+5), costs panel (+5), stripe webhook (+2), translate webhook (+1), rerank (+1), privacy/terms layouts (+2), MCP routes (make-booking, places, weather)
  - 7 files reached 100%: admin-api/agent-config, agent-config route, costs modals, rerank, privacy layout, terms layout, costs-analytics skeletons
  - 3 files significantly improved: suggestions-panel (54→89%), costs panel (76→95%), agent-config (3→100%)
- **2026-02-16**: Coverage Agent run -- 4243 tests, 274 files (+168 tests, +8 files, +2.37% statement coverage)
  - Created 8 new test files: agents-dashboard constants/use-agent-runner/use-agent-terminal, story-editor types/use-story-editor-state, costs-analytics modals, marketing stat-card/post-row
  - Enhanced 6 existing test files: story-card (+17), accounts route (+11), story-viewer (+7), drafts-panel (+8), marketing-dashboard (+15), account-card (+3)
  - 8 files reached 100%: agents constants, use-agent-runner, use-agent-terminal, story-editor types, stat-card, account-card, marketing constants, story-card
  - 4 files significantly improved: drafts-panel (43→83%), marketing-dashboard (46→73%), modals (41→72%), use-story-editor-state (71→98%)
