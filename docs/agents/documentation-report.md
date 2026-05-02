# Documentation Freshness Report
> Auto-generated on 2026-05-02 06:00:04

## CLAUDE.md Status

Last modified: **2026-05-01**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/about/about-page.test.tsx
src/app/about/page.tsx
src/app/admin/admin-page-lazy-mount.test.tsx
src/app/admin/error.test.tsx
src/app/admin/error.tsx
src/app/admin/page.test.tsx
src/app/api/admin/agent-config/route.test.ts
src/app/api/admin/agent-config/route.ts
src/app/api/admin/agent-reports/route.ts
src/app/api/admin/agents-summary/route.test.ts
src/app/api/admin/agents-summary/route.ts
src/app/api/admin/agents/run/route.ts
src/app/api/admin/analytics/route.test.ts
src/app/api/admin/analytics/route.ts
src/app/api/admin/costs-analytics/[id]/route.ts
src/app/api/admin/costs-analytics/route.test.ts
src/app/api/admin/costs-analytics/route.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/github-analytics/route.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent-logs/route.ts
src/app/api/admin/marketing/agent/route.test.ts
src/app/api/admin/marketing/agent/route.ts
src/app/api/admin/marketing/dashboard/route.test.ts
src/app/api/admin/marketing/dashboard/route.ts
src/app/api/admin/marketing/posts/route.test.ts
src/app/api/admin/marketing/posts/route.ts
src/app/api/admin/stories/[id]/content-images/route.test.ts
src/app/api/admin/stories/[id]/content-images/route.ts
src/app/api/admin/stories/[id]/image-source/route.test.ts
src/app/api/admin/stories/[id]/image-source/route.ts
src/app/api/admin/stories/[id]/image/route.test.ts
src/app/api/admin/stories/[id]/image/route.ts
src/app/api/admin/stories/[id]/status/route.test.ts
src/app/api/admin/stories/[id]/status/route.ts
src/app/api/admin/stories/approve-all/route.test.ts
src/app/api/admin/stories/approve-all/route.ts
src/app/api/admin/stories/route.test.ts
src/app/api/admin/stories/route.ts
src/app/api/admin/stripe-analytics/route.test.ts
src/app/api/admin/stripe-analytics/route.ts
src/app/api/admin/suggestions/[id]/route.test.ts
src/app/api/admin/suggestions/[id]/route.ts
src/app/api/admin/suggestions/route.test.ts
src/app/api/admin/suggestions/route.ts
src/app/api/chat/route.test.ts
src/app/api/chat/route.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/checkout/day-pass/route.test.ts
src/app/api/checkout/day-pass/route.ts
src/app/api/checkout/embedded/route.test.ts
src/app/api/checkout/embedded/route.ts
src/app/api/cron/content-discovery/route.test.ts
src/app/api/cron/content-discovery/route.ts
src/app/api/cron/fail-stale-bookings/route.test.ts
src/app/api/cron/fail-stale-bookings/route.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/fail-stale-translations/route.ts
src/app/api/cron/github-traffic-sync/route.test.ts
src/app/api/cron/github-traffic-sync/route.ts
src/app/api/cron/subscription-optimizer/route.test.ts
src/app/api/cron/subscription-optimizer/route.ts
src/app/api/favorites/route.test.ts
src/app/api/favorites/route.ts
src/app/api/feature-flags/route.test.ts
src/app/api/feature-flags/route.ts
src/app/api/health/live/route.test.ts
src/app/api/health/live/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/make-booking/route.ts
src/app/api/mcp/places/route.test.ts
src/app/api/mcp/places/route.ts
src/app/api/mcp/weather/route.test.ts
src/app/api/mcp/weather/route.ts
src/app/api/suggestions/route.test.ts
src/app/api/suggestions/route.ts
src/app/api/voice-access/route.test.ts
src/app/api/voice-access/route.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/elevenlabs/route.ts
src/app/api/webhooks/stripe/route.test.ts
src/app/api/webhooks/stripe/route.ts
src/app/api/webhooks/supabase/route.test.ts
src/app/api/webhooks/supabase/route.ts
src/app/api/webhooks/translate/route.test.ts
src/app/api/webhooks/translate/route.ts
src/app/auth/callback/route.test.ts
src/app/auth/callback/route.ts
src/app/error.test.tsx
src/app/error.tsx
src/app/favorites/error.test.tsx
src/app/favorites/error.tsx
src/app/favorites/layout.test.tsx
src/app/favorites/layout.tsx
src/app/global-error.tsx
src/app/immersive/error.test.tsx
src/app/immersive/error.tsx
src/app/immersive/immersive-flags-context.fe-h1.test.tsx
src/app/immersive/immersive-page-content.test.tsx
src/app/immersive/immersive-page-content.tsx
src/app/layout.tsx
src/app/loading.test.tsx
src/app/loading.tsx
src/app/not-found.test.tsx
src/app/not-found.tsx
src/app/pricing/checkout/page.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/privacy/page.test.tsx
src/app/privacy/page.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/app/terms/page.test.tsx
src/app/terms/page.tsx
src/components/admin/admin-shell.test.tsx
src/components/admin/admin-shell.tsx
src/components/admin/analytics-cache-context.test.tsx
src/components/admin/analytics-cache-context.tsx
src/components/admin/github-analytics-panel.test.tsx
src/components/admin/stories-tab-panel.test.tsx
src/components/admin/stories-tab-panel.tsx
src/components/admin/voice-agent-chat.tsx
src/components/auth/auth-provider.test.tsx
src/components/auth/auth-provider.tsx
src/components/immersive/accessibility.test.tsx
src/components/immersive/author-typewriter.test.tsx
src/components/immersive/author-typewriter.tsx
src/components/immersive/bookmark-button.tsx
src/components/immersive/chat-actions.test.tsx
src/components/immersive/chat-actions.tsx
src/components/immersive/chat-upsell-cta.test.tsx
src/components/immersive/chat-upsell-cta.tsx
src/components/immersive/fullscreen-button.tsx
src/components/immersive/mood-overlay.tsx
src/components/immersive/related-stories.tsx
src/components/immersive/share-button.test.tsx
src/components/immersive/share-button.tsx
src/components/immersive/site-info-menu.test.tsx
src/components/immersive/site-info-menu.tsx
src/components/immersive/story-progress-bar.test.tsx
src/components/immersive/story-progress-bar.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/suggest-place-button.tsx
src/components/immersive/suggest-place-dialog.test.tsx
src/components/immersive/suggest-place-dialog.tsx
src/components/immersive/surprise-me-button.test.tsx
src/components/immersive/surprise-me-button.tsx
src/components/immersive/toolbar-overflow-menu.tsx
src/components/immersive/ux-fixes.test.tsx
src/components/immersive/voice-chat-elevenlabs.test.tsx
src/components/immersive/voice-chat-elevenlabs.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat.tsx
src/components/immersive/voice-chat/chat-composer.tsx
src/components/immersive/voice-chat/chat-error-banner.tsx
src/components/immersive/voice-chat/chat-header.tsx
src/components/immersive/voice-chat/chat-message-list.tsx
src/components/posthog-provider.test.tsx
src/components/posthog-provider.tsx
src/components/premium/voice-purchase-cta.test.tsx
src/components/premium/voice-purchase-cta.tsx
src/components/ui/button.test.tsx
src/components/ui/button.tsx
src/components/ui/stat-card.test.tsx
src/components/ui/stat-card.tsx
src/hooks/use-chat-mode.test.ts
src/hooks/use-chat-mode.ts
src/hooks/use-feature-flags-integration.test.ts
src/hooks/use-feature-flags.provider.test.tsx
src/hooks/use-feature-flags.test.ts
src/hooks/use-feature-flags.ts
src/hooks/use-media-query.test.ts
src/hooks/use-media-query.ts
src/hooks/use-sse-stream.test.ts
src/hooks/use-sse-stream.ts
src/hooks/use-stories.cache-hit.test.ts
src/hooks/use-stories.hydration.test.ts
src/hooks/use-stories.provider.test.tsx
src/hooks/use-stories.test.ts
src/hooks/use-stories.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-stream-chat.ts
src/hooks/use-voice-access.ts
src/instrumentation.ts
src/lib/admin-api/stories.ts
src/lib/admin-auth.test.ts
src/lib/admin-auth.ts
src/lib/claude.ts
src/lib/content-discovery.test.ts
src/lib/content-discovery.ts
src/lib/costs/elevenlabs-costs.test.ts
src/lib/costs/elevenlabs-costs.ts
src/lib/costs/twilio-costs.test.ts
src/lib/costs/twilio-costs.ts
src/lib/cron-auth.test.ts
src/lib/cron-auth.ts
src/lib/csrf.test.ts
src/lib/csrf.ts
src/lib/embedding-cache.test.ts
src/lib/embedding-cache.ts
src/lib/embeddings.test.ts
src/lib/embeddings.ts
src/lib/env.test.ts
src/lib/env.ts
src/lib/i18n/ast.ts
src/lib/i18n/de.ts
src/lib/i18n/en.ts
src/lib/i18n/es.ts
src/lib/i18n/fr.ts
src/lib/i18n/pt.ts
src/lib/logger-migration.test.ts
src/lib/logger-sanitize.test.ts
src/lib/models.test.ts
src/lib/models.ts
src/lib/proxy/auth-refresh.test.ts
src/lib/proxy/canonical-domain.test.ts
src/lib/proxy/cors.test.ts
src/lib/proxy/cors.ts
src/lib/proxy/csrf-proxy.test.ts
src/lib/proxy/csrf-proxy.ts
src/lib/proxy/maintenance.ts
src/lib/proxy/root-redirect.test.ts
src/lib/proxy/story-rewrite.test.ts
src/lib/rate-limit.test.ts
src/lib/rate-limit.ts
src/lib/schemas.ts
src/lib/search.test.ts
src/lib/search.ts
src/lib/security-headers.test.ts
src/lib/stories-data.test.ts
src/lib/stories-data.ts
src/lib/stories-server.test.ts
src/lib/stories-server.ts
src/lib/stripe.test.ts
src/lib/stripe.ts
src/lib/supabase-auth.test.ts
src/lib/supabase-auth.ts
src/lib/supabase-browser.test.ts
src/lib/supabase-browser.ts
src/lib/supabase.test.ts
src/lib/supabase.ts
src/lib/twilio-sms.ts
src/proxy.test.ts
src/proxy.ts
src/test/i18n-mock.ts
src/test/setup.ts
src/types/voice-access.ts
```

### Database Migrations

```
supabase/migrations/084_fix_grant_day_pass_atomicity.sql
supabase/migrations/085_atomic_outcome_message_and_stale_booking_cleanup.sql
supabase/migrations/086_switch_to_hnsw_index.sql
```

### Scripts

```
scripts/process-pdfs.test.ts
scripts/process-pdfs.ts
scripts/seed-database.test.ts
scripts/seed-database.ts
scripts/sync-translation-status.test.ts
scripts/sync-translation-status.ts
scripts/tests/__stubs__/extracted-stories.ts
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
| CLAUDE.md | 2026-05-01 |
| README.md | 2026-05-01 |

## Changes Made This Run

Status: GREEN. No documentation changes required this cycle. Twentieth consecutive clean run.

- Feature flags: UNDOCUMENTED_FEATURE_FLAGS section in gaps file is empty. All flags currently in source remain documented in `docs/project/features.md` (Feature Flags Reference table).
- API routes: All 51 flagged routes confirmed internal (admin APIs, cron endpoints, webhooks, MCP voice-agent tools, health probes, internal chat/checkout/feature-flags/favorites/suggestions/voice-access). None are intended for external (third-party) consumption, so no public API documentation required.
- CLAUDE.md: Current (last modified 2026-05-01).
- features.md: Complete — no additions needed.
- No new feature flags or user-facing features introduced by recent source changes.

---

*Report generated by Documentation Agent*
