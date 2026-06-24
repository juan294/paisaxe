# Documentation Freshness Report
> Auto-generated on 2026-06-24 06:00:11

## CLAUDE.md Status

Last modified: **2026-06-13**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/admin/admin-page-suspense.test.tsx
src/app/admin/page.tsx
src/app/api/admin/agents/run/route.test.ts
src/app/api/admin/agents/run/route.ts
src/app/api/admin/agents/run/state.ts
src/app/api/admin/costs-analytics/[id]/route.ts
src/app/api/admin/feature-flags/[key]/route.test.ts
src/app/api/admin/feature-flags/[key]/route.ts
src/app/api/admin/marketing/accounts/route.test.ts
src/app/api/admin/marketing/accounts/route.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent-logs/route.ts
src/app/api/admin/marketing/agent/route.test.ts
src/app/api/admin/marketing/agent/route.ts
src/app/api/admin/marketing/dashboard/route.test.ts
src/app/api/admin/marketing/dashboard/route.ts
src/app/api/admin/marketing/posts/route.test.ts
src/app/api/admin/marketing/posts/route.ts
src/app/api/admin/marketing/schedule/route.test.ts
src/app/api/admin/marketing/schedule/route.ts
src/app/api/admin/stories/[id]/content-images/route.test.ts
src/app/api/admin/stories/[id]/content-images/route.ts
src/app/api/admin/stories/[id]/image-source/route.test.ts
src/app/api/admin/stories/[id]/image-source/route.ts
src/app/api/admin/stories/[id]/image/route.test.ts
src/app/api/admin/stories/[id]/image/route.ts
src/app/api/admin/stories/[id]/route.test.ts
src/app/api/admin/stories/[id]/route.ts
src/app/api/admin/stories/[id]/status/route.test.ts
src/app/api/admin/stories/[id]/status/route.ts
src/app/api/admin/stories/approve-all/route.test.ts
src/app/api/admin/stories/approve-all/route.ts
src/app/api/admin/stories/bulk-delete/route.test.ts
src/app/api/admin/stories/bulk-delete/route.ts
src/app/api/admin/stories/bulk-status/route.test.ts
src/app/api/admin/stories/bulk-status/route.ts
src/app/api/admin/stories/route.test.ts
src/app/api/admin/stories/route.ts
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
src/app/api/cron/content-discovery/route.ts
src/app/api/cron/fail-stale-bookings/route.test.ts
src/app/api/cron/fail-stale-bookings/route.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/fail-stale-translations/route.ts
src/app/api/cron/github-traffic-sync/route.test.ts
src/app/api/cron/github-traffic-sync/route.ts
src/app/api/cron/retry-booking-sms/route.test.ts
src/app/api/cron/retry-booking-sms/route.ts
src/app/api/cron/subscription-optimizer/route.test.ts
src/app/api/cron/subscription-optimizer/route.ts
src/app/api/favorites/route.test.ts
src/app/api/favorites/route.ts
src/app/api/feature-flags/route.test.ts
src/app/api/feature-flags/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/make-booking/route.ts
src/app/api/mcp/places/route.test.ts
src/app/api/mcp/places/route.ts
src/app/api/mcp/save-favorite/route.test.ts
src/app/api/mcp/save-favorite/route.ts
src/app/api/mcp/weather/route.test.ts
src/app/api/mcp/weather/route.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/elevenlabs/route.ts
src/app/api/webhooks/stripe/route.test.ts
src/app/api/webhooks/stripe/route.ts
src/app/api/webhooks/translate/route.test.ts
src/app/api/webhooks/translate/route.ts
src/app/auth/callback/route.test.ts
src/app/error.test.tsx
src/app/error.tsx
src/app/favorites/page.test.tsx
src/app/favorites/page.tsx
src/app/global-error.test.tsx
src/app/immersive/immersive-page-content.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/not-found.test.tsx
src/app/not-found.tsx
src/app/pricing/checkout/page.test.tsx
src/app/pricing/checkout/page.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/providers.tsx
src/app/story/[slug]/page.test.tsx
src/app/story/[slug]/page.tsx
src/components/admin/agents-dashboard/terminal-display.test.tsx
src/components/admin/agents-dashboard/terminal-display.tsx
src/components/admin/marketing-dashboard/drafts-panel.test.tsx
src/components/admin/marketing-dashboard/drafts-panel.tsx
src/components/admin/marketing-dashboard/marketing-dashboard.test.tsx
src/components/admin/marketing-dashboard/marketing-dashboard.tsx
src/components/admin/voice-agent-chat.tsx
src/components/auth/auth-provider.memostability.test.tsx
src/components/auth/auth-provider.test.tsx
src/components/auth/auth-provider.tsx
src/components/immersive/chat-upsell-cta.test.tsx
src/components/immersive/chat-upsell-cta.tsx
src/components/immersive/fullscreen-button.tsx
src/components/immersive/language-switcher.gating.test.tsx
src/components/immersive/language-switcher.test.tsx
src/components/immersive/language-switcher.tsx
src/components/immersive/navigation-hint.test.tsx
src/components/immersive/navigation-hint.tsx
src/components/immersive/related-stories.test.tsx
src/components/immersive/related-stories.tsx
src/components/immersive/story-info-panel.test.tsx
src/components/immersive/story-info-panel.tsx
src/components/immersive/story-progress-bar.test.tsx
src/components/immersive/story-progress-bar.tsx
src/components/immersive/story-toolbar.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/suggest-place-dialog.tsx
src/components/immersive/voice-chat-elevenlabs.test.tsx
src/components/immersive/voice-chat-elevenlabs.tsx
src/components/immersive/voice-chat/chat-message-list.tsx
src/components/markdown/basic-markdown.test.tsx
src/components/posthog-provider.idlecallback.test.tsx
src/components/posthog-provider.tsx
src/components/premium/voice-purchase-cta.test.tsx
src/components/premium/voice-purchase-cta.tsx
src/components/ui/button.test.tsx
src/components/ui/button.tsx
src/components/ui/component-error-boundary.tsx
src/config/next-externals.test.ts
src/hooks/use-favorites.test.ts
src/hooks/use-favorites.ts
src/hooks/use-feature-flags.test.ts
src/hooks/use-feature-flags.ts
src/hooks/use-sse-stream.test.ts
src/hooks/use-sse-stream.ts
src/hooks/use-stories.test.ts
src/hooks/use-stories.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-stream-chat.ts
src/hooks/use-voice-access.ts
src/instrumentation.test.ts
src/instrumentation.ts
src/lib/admin-api/agent-config.ts
src/lib/admin-api/agents.ts
src/lib/admin-api/analytics.ts
src/lib/admin-api/costs.ts
src/lib/admin-api/feature-flags.ts
src/lib/admin-api/optimizer.ts
src/lib/admin-api/stories.ts
src/lib/admin-api/suggestions.ts
src/lib/admin-auth.test.ts
src/lib/admin-auth.ts
src/lib/chat-config.ts
src/lib/chat-route-utils.test.ts
src/lib/chat-stream-timeouts.test.ts
src/lib/chat-stream-timeouts.ts
src/lib/claude.test.ts
src/lib/claude.ts
src/lib/client-logger.test.ts
src/lib/client-logger.ts
src/lib/content-discovery.ts
src/lib/costs/anthropic-costs.test.ts
src/lib/costs/anthropic-costs.ts
src/lib/costs/anthropic-pricing.test.ts
src/lib/costs/anthropic-pricing.ts
src/lib/costs/anthropic-usage.test.ts
src/lib/costs/anthropic-usage.ts
src/lib/costs/elevenlabs-costs.ts
src/lib/costs/index.ts
src/lib/costs/manual-costs.test.ts
src/lib/costs/manual-costs.ts
src/lib/costs/twilio-costs.ts
src/lib/cron-auth.test.ts
src/lib/cron-auth.ts
src/lib/email.ts
src/lib/embedding-cache.test.ts
src/lib/embedding-cache.ts
src/lib/embeddings.test.ts
src/lib/embeddings.ts
src/lib/env.ts
src/lib/feature-flags-server.test.ts
src/lib/feature-flags-server.ts
src/lib/i18n/ast.ts
src/lib/i18n/de.ts
src/lib/i18n/en.ts
src/lib/i18n/es.ts
src/lib/i18n/fr.ts
src/lib/i18n/provider.initiallocale.test.tsx
src/lib/i18n/provider.test.tsx
src/lib/i18n/pt.ts
src/lib/i18n/use-translation.ts
src/lib/localize-story.test.ts
src/lib/localize-story.ts
src/lib/logger.test.ts
src/lib/logger.ts
src/lib/models.test.ts
src/lib/models.ts
src/lib/platforms/x-client.ts
src/lib/posthog-query.test.ts
src/lib/posthog-query.ts
src/lib/posting-service.test.ts
src/lib/posting-service.ts
src/lib/pricing.test.ts
src/lib/pricing.ts
src/lib/proxy/auth-refresh.ts
src/lib/proxy/cors.ts
src/lib/proxy/csp.ts
src/lib/proxy/maintenance.test.ts
src/lib/proxy/maintenance.ts
src/lib/rate-limit.test.ts
src/lib/rate-limit.ts
src/lib/request-utils.test.ts
src/lib/request-validation.test.ts
src/lib/request-validation.ts
src/lib/rerank.test.ts
src/lib/rerank.ts
src/lib/schemas.test.ts
src/lib/schemas.ts
src/lib/services/booking-service.test.ts
src/lib/services/booking-service.ts
src/lib/services/elevenlabs-call-service.test.ts
src/lib/services/elevenlabs-call-service.ts
src/lib/services/elevenlabs-webhook-service.test.ts
src/lib/services/elevenlabs-webhook-service.ts
src/lib/stories-data.test.ts
src/lib/stories-data.ts
src/lib/stories-server.test.ts
src/lib/stories-server.ts
src/lib/stripe.test.ts
src/lib/stripe.ts
src/lib/supabase-admin.test.ts
src/lib/supabase-admin.ts
src/lib/supabase.test.ts
src/lib/supabase.ts
src/lib/translate-story.test.ts
src/lib/translate-story.ts
src/lib/twilio-sms.ts
src/lib/validation.test.ts
src/lib/validation.ts
src/proxy.test.ts
src/proxy.ts
src/tests/qa/llm-quality.test.ts
src/types/navigator.d.ts
```

### Database Migrations

```
supabase/migrations/094_create_story_from_suggestion.sql
supabase/migrations/095_stripe_webhook_audit_shape.sql
supabase/migrations/096_marketing_post_stats.sql
supabase/migrations/097_anthropic_usage.sql
supabase/migrations/098_voice_saved_places.sql
supabase/migrations/099_grant_day_pass_purchase_type.sql
```

### Scripts

```
scripts/agents/cc-rpi-update.sh
scripts/check-verification-coverage.ts
scripts/generate-stories.ts
scripts/qa-agent.sh
scripts/run-prelaunch-gate.test.ts
scripts/run-prelaunch-gate.ts
scripts/security-agent.sh
scripts/seed-database.ts
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
mcp/save-favorite
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
| CLAUDE.md | 2026-06-13 |
| README.md | 2026-06-13 |

## Changes Made This Run

Run date: 2026-06-24. Status: GREEN -- No documentation changes required. Thirty-second consecutive clean run.

### Feature Flags
- No undocumented feature flags. The `UNDOCUMENTED_FEATURE_FLAGS` gap section was empty.
- Verified all 17 flags in `src/types/feature-flags.ts` (`FeatureFlagKey`) are documented in the Feature Flags Reference of `docs/project/features.md` (17 Features-tab flags across 5 categories). Count stable, zero gaps.
- All 10 agent flags (Agents tab) remain documented and accurate.

### API Routes
- All 56 flagged routes confirmed internal -- no external-consumption routes require documentation.
  - `admin/*` -- admin-only, gated by `validateAdminAuth()` / `withAdmin` / `withAdminRead`.
  - `cron/*` -- scheduled jobs protected by `cron-auth`.
  - `webhooks/*` -- server-to-server, signature/shared-secret verified.
  - `mcp/*` -- Pelayo voice-agent tool endpoints (internal, used by ElevenLabs agent config).
  - `chat`, `chat/stream`, `favorites`, `feature-flags`, `suggestions`, `voice-access`, `checkout/*` -- client-driven app routes consumed by the Paisaxe frontend only.
  - `health/*` -- internal liveness/diagnostic probes (Upptime, CI smoke).

### CLAUDE.md
- Current as of 2026-06-13. No new feature flags, user-facing migrations, or external-facing API routes since the last run. No additions needed.

---

*Report generated by Documentation Agent*
