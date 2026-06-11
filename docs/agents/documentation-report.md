# Documentation Freshness Report
> Auto-generated on 2026-06-11 06:08:26

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
src/lib/i18n/story-translations-coverage.test.ts
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
scripts/qa-agent.sh
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

## Changes Made This Run (2026-06-11)

No documentation changes were required this run. Verification details:

- **Feature flags**: The gaps file listed zero undocumented flags. Verified independently against source: `src/types/feature-flags.ts` defines exactly 17 `FeatureFlagKey` values, all present in the Feature Flags Reference tables in `docs/project/features.md`. `scripts/agent-config.defaults.json` defines 9 agent flags plus the master toggle (10 total), all documented in the Agent Flags table. Zero gaps.
- **API routes**: All 51 flagged routes confirmed internal — admin panel APIs (`admin/*`), cron endpoints (`cron/*`), webhook receivers (`webhooks/*`), MCP voice-agent tools (`mcp/*`), app-internal user APIs (chat, checkout, favorites, feature-flags, suggestions, voice-access), and health probes (`health/*`). None are intended for external consumption; no new documentation required. The webhook and MCP endpoints that matter to operators are already documented in features.md (Infrastructure and Premium Voice Agent sections).
- **Recent source changes**: No commits touching `src/app/api` or feature flag sources since 2026-06-09. Recent modified files are tests, agent scripts, i18n/story-translation content (covered by the Localization agent), and RLS hardening migrations (089-092) — none introduce user-facing features or flags.
- **features.md**: Complete. No additions, deletions, or restructuring performed.

---

*Report generated by Documentation Agent*
