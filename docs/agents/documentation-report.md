# Documentation Freshness Report
> Auto-generated on 2026-06-04 06:00:02

## CLAUDE.md Status

Last modified: **2026-05-03**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/about/page.tsx
src/app/api/admin/agent-config/route.ts
src/app/api/admin/agent-reports/route.test.ts
src/app/api/admin/agents/run/route.test.ts
src/app/api/admin/analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/stories/[id]/image/route.test.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/cron/content-discovery/route.test.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/github-traffic-sync/route.test.ts
src/app/api/cron/retry-booking-sms/route.test.ts
src/app/api/cron/subscription-optimizer/route.test.ts
src/app/api/health/db/route.test.ts
src/app/api/health/db/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/elevenlabs/route.ts
src/app/api/webhooks/translate/route.test.ts
src/app/api/webhooks/translate/route.ts
src/app/auth/callback/route.test.ts
src/app/error.tsx
src/app/favorites/page.test.tsx
src/app/favorites/page.tsx
src/app/global-error.tsx
src/app/immersive/immersive-data-loader.tsx
src/app/immersive/immersive-page-content.test.tsx
src/app/immersive/immersive-page-content.tsx
src/app/immersive/page.test.tsx
src/app/immersive/page.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/loading.test.tsx
src/app/loading.tsx
src/app/not-found.tsx
src/app/page.test.tsx
src/app/page.tsx
src/app/pricing/checkout/page.test.tsx
src/app/pricing/checkout/page.tsx
src/app/pricing/checkout/return/page.test.tsx
src/app/pricing/checkout/return/page.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/pricing/success/page.test.tsx
src/app/pricing/success/page.tsx
src/app/privacy/page.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/app/story/[slug]/opengraph-image.test.tsx
src/app/story/[slug]/page.test.tsx
src/app/story/[slug]/page.tsx
src/app/terms/page.tsx
src/components/admin/costs-analytics-panel/alerts.test.tsx
src/components/admin/costs-analytics-panel/alerts.tsx
src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx
src/components/admin/costs-analytics-panel/forecast.test.tsx
src/components/admin/costs-analytics-panel/forecast.tsx
src/components/admin/elevenlabs-analytics-panel.test.tsx
src/components/admin/story-card.tsx
src/components/admin/story-translations-tab.test.tsx
src/components/admin/story-translations-tab.tsx
src/components/auth/auth-provider.test.tsx
src/components/auth/auth-provider.tsx
src/components/immersive/accessibility.test.tsx
src/components/immersive/category-filter-badge.test.tsx
src/components/immersive/category-filter-badge.tsx
src/components/immersive/chat-actions.test.tsx
src/components/immersive/story-progress-bar.test.tsx
src/components/immersive/story-progress-bar.tsx
src/components/immersive/story-viewer.test.tsx
src/components/premium/voice-purchase-cta.test.tsx
src/components/premium/voice-purchase-cta.tsx
src/config/recurring-costs.ts
src/hooks/use-feature-flags.test.ts
src/hooks/use-feature-flags.ts
src/hooks/use-sse-stream.test.ts
src/hooks/use-stories.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-voice-access.test.ts
src/instrumentation.test.ts
src/lib/admin-api/stories.test.ts
src/lib/admin-auth.test.ts
src/lib/chat-action-detection.ts
src/lib/chat-stream-timeouts.ts
src/lib/claude.test.ts
src/lib/costs/manual-costs.ts
src/lib/cron-job-lock.test.ts
src/lib/elevenlabs-call-status.ts
src/lib/embedding-cache.test.ts
src/lib/health-timeouts.ts
src/lib/i18n/ast.ts
src/lib/i18n/de.ts
src/lib/i18n/en.ts
src/lib/i18n/es.ts
src/lib/i18n/fr.ts
src/lib/i18n/provider.tsx
src/lib/i18n/pt.ts
src/lib/i18n/resolve.test.ts
src/lib/i18n/translations.test.ts
src/lib/image-optimization.ts
src/lib/logger-sanitize.test.ts
src/lib/logger.test.ts
src/lib/rate-limit.test.ts
src/lib/rate-limit.ts
src/lib/search.test.ts
src/lib/sentry-before-send.test.ts
src/lib/stories-data.test.ts
src/lib/stories-data.ts
src/lib/stripe.ts
src/lib/supabase.ts
src/lib/translate-story.ts
src/lib/translation-locales.ts
src/lib/utils.test.ts
src/lib/utils.ts
src/test/__mocks__/server-only.ts
src/test/i18n-mock.ts
src/test/setup.ts
src/tests/hallucination-validator.test.ts
src/tests/qa/llm-quality.test.ts
src/types/immersive.test.ts
```

### Database Migrations

```
supabase/migrations/089_enable_rls_admin_audit_log.sql
supabase/migrations/090_fix_rls_operational_tables.sql
supabase/migrations/091_revoke_internal_function_access.sql
supabase/migrations/092_revoke_internal_function_access_fix.sql
```

### Scripts

```
scripts/check-verification-coverage.ts
scripts/cost-analyst-agent.sh
scripts/coverage-agent.sh
scripts/generate-icons.ts
scripts/generate-stories.test.ts
scripts/generate-stories.ts
scripts/performance-agent.sh
scripts/security-agent.sh
scripts/seed-database.test.ts
scripts/seed-database.ts
scripts/seed-images.ts
scripts/setup-elevenlabs-agents.ts
scripts/verification-config.test.ts
```

## Documentation Gaps

### Potentially Undocumented API Routes

These API routes may not be documented in CLAUDE.md:

```
admin/agent-reports
admin/agents-summary
admin/agents/run
admin/analytics
admin/costs-analytics
admin/costs-analytics/[id]
admin/elevenlabs-analytics
admin/feature-flags/[key]
admin/github-analytics
admin/marketing/accounts
admin/marketing/agent
admin/marketing/agent-logs
admin/marketing/dashboard
admin/marketing/posts
admin/marketing/schedule
admin/stories
admin/stories/[id]
admin/stories/[id]/content-images
admin/stories/[id]/image
admin/stories/[id]/image-source
admin/stories/[id]/status
admin/stories/[id]/translations
admin/stories/approve-all
admin/stories/bulk-delete
admin/stories/bulk-status
admin/stripe-analytics
admin/suggestions
admin/suggestions/[id]
admin/tunnel
chat
chat/stream
checkout/day-pass
checkout/embedded
checkout/health
cron/content-discovery
cron/fail-stale-bookings
cron/fail-stale-translations
cron/github-traffic-sync
cron/retry-booking-sms
cron/subscription-optimizer
favorites
feature-flags
health/db
health/live
mcp/make-booking
mcp/make-booking/status
mcp/places
mcp/weather
suggestions
voice-access
webhooks/elevenlabs
webhooks/stripe
webhooks/supabase
webhooks/translate

```

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-05-03 |
| README.md | 2026-05-03 |

## Changes Made This Run

Run date: 2026-06-04
Status: GREEN — no documentation changes required. Clean run continues.

### Feature flags
No changes. The gaps file reported zero undocumented feature flags. Verified all 17 visitor/admin feature flags in `src/types/feature-flags.ts` (`FeatureFlagKey`) are present in the Feature Flags Reference table in `docs/project/features.md`. The 10 agent flags (Agents tab) are also fully documented. No additions or edits needed.

### API routes
No changes. All 51 flagged routes were confirmed internal — none are meant for external consumption, so no documentation was added:
- Admin APIs (`/api/admin/*`) — admin-auth gated, dashboard-only.
- Chat (`/api/chat`, `/api/chat/stream`) — app-internal RAG endpoints (already described in features.md).
- Checkout (`/api/checkout/*`) — app-internal Stripe flow.
- Cron jobs (`/api/cron/*`, incl. new `github-traffic-sync`, `fail-stale-bookings`) — Vercel Cron authenticated, server-only.
- App-internal user APIs (`/api/favorites`, `/api/feature-flags`, `/api/suggestions`, `/api/voice-access`).
- Health probes (`/api/health`, `/api/health/live`, `/api/health/db`) — `/api/health` and `/api/health/live` already documented in features.md; `/api/health/db` is an internal QA-agent diagnostic probe (verified in source), not an external contract.
- MCP voice-agent tools (`/api/mcp/*`) — invoked by the ElevenLabs/Pelayo agent, already documented under Premium Voice Agent.
- Webhooks (`/api/webhooks/*`) — signature-verified inbound from external services, already documented in the Infrastructure section.

### Source review
No new user-facing features, feature flags, or migrations (089–092 are RLS/grant hardening — no documentation surface) introduced anything requiring a `features.md` update.

---

*Report generated by Documentation Agent*
