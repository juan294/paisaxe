# Documentation Freshness Report
> Auto-generated on 2026-08-20 15:30:00

## Status

**GREEN** — No documentation gaps found. Thirty-second consecutive clean run.

## Changes Made This Run

No changes required. All API routes verified as internal-only (admin APIs, cron endpoints, webhooks, MCP voice-agent tools, internal health probes, client-side access checks). All 27 feature flags (17 Features + 10 Agent flags) documented in `docs/project/features.md`. Feature Flags Reference section confirmed complete and current.

## CLAUDE.md Status

Last modified: **2026-08-19**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent-logs/route.ts
src/app/api/admin/suggestions/route.test.ts
src/app/api/admin/suggestions/route.ts
src/app/api/admin/voice-session/route.test.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/cron/retry-booking-sms/route.test.ts
src/app/api/cron/retry-booking-sms/route.ts
src/app/api/feature-flags/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/places/route.test.ts
src/app/api/mcp/places/route.ts
src/app/api/voice-access/route.test.ts
src/app/api/voice-access/route.ts
src/app/api/voice-session/route.test.ts
src/app/api/voice-session/route.ts
src/app/api/webhooks/stripe/route.postgrest-integration.test.ts
src/app/api/webhooks/stripe/route.test.ts
src/app/api/webhooks/stripe/route.ts
src/app/error.test.tsx
src/app/error.tsx
src/app/favorites/error.test.tsx
src/app/favorites/error.tsx
src/app/favorites/page.test.tsx
src/app/favorites/page.tsx
src/app/immersive/error.test.tsx
src/app/immersive/error.tsx
src/app/not-found.test.tsx
src/app/not-found.tsx
src/app/pricing/checkout/return/page.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/components/admin/admin-shell.tsx
src/components/auth/sign-in-prompt.test.tsx
src/components/auth/sign-in-prompt.tsx
src/components/immersive/author-typewriter.test.tsx
src/components/immersive/author-typewriter.tsx
src/components/immersive/language-switcher.gating.test.tsx
src/components/immersive/language-switcher.test.tsx
src/components/immersive/language-switcher.tsx
src/components/immersive/navigation-hint.test.tsx
src/components/immersive/navigation-hint.tsx
src/components/immersive/question-prompts.test.tsx
src/components/immersive/question-prompts.tsx
src/components/immersive/share-button.test.tsx
src/components/immersive/share-button.tsx
src/components/immersive/site-info-menu.test.tsx
src/components/immersive/site-info-menu.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/toolbar-overflow-menu.test.tsx
src/components/immersive/toolbar-overflow-menu.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat.tsx
src/components/immersive/voice-chat/chat-message-list.test.tsx
src/components/immersive/voice-chat/chat-message-list.tsx
src/components/premium/voice-purchase-cta.test.tsx
src/components/premium/voice-purchase-cta.tsx
src/components/ui/component-error-boundary.test.tsx
src/components/ui/component-error-boundary.tsx
src/hooks/use-feature-flags.ts
src/hooks/use-share-story.test.ts
src/hooks/use-share-story.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-stream-chat.ts
src/instrumentation.test.ts
src/instrumentation.ts
src/lib/admin-auth.test.ts
src/lib/admin-auth.ts
src/lib/claude.test.ts
src/lib/claude.ts
src/lib/collect-files.ts
src/lib/costs/elevenlabs-costs.ts
src/lib/costs/twilio-costs.ts
src/lib/cron-auth.ts
src/lib/email.ts
src/lib/embedding-cache.test.ts
src/lib/embedding-cache.ts
src/lib/embeddings.test.ts
src/lib/embeddings.ts
src/lib/encryption.ts
src/lib/env.ts
src/lib/error-boundary-styles.ts
src/lib/health-timeouts.ts
src/lib/i18n/ast.ts
src/lib/i18n/coverage.ts
src/lib/i18n/de.ts
src/lib/i18n/en.ts
src/lib/i18n/es.ts
src/lib/i18n/fr.ts
src/lib/i18n/locale-coverage.generated.ts
src/lib/i18n/locale-coverage.test.ts
src/lib/i18n/pt.ts
src/lib/i18n/translations.test.ts
src/lib/logger-migration.test.ts
src/lib/mcp-auth.ts
src/lib/meta-invariants.test.ts
src/lib/proxy/cors.test.ts
src/lib/proxy/cors.ts
src/lib/rate-limit.test.ts
src/lib/rate-limit.ts
src/lib/search.test.ts
src/lib/search.ts
src/lib/sentry-before-send.test.ts
src/lib/sentry-before-send.ts
src/lib/sentry-client-config.test.ts
src/lib/sentry-client-init.test.ts
src/lib/sentry-client-init.ts
src/lib/services/booking-service.test.ts
src/lib/services/booking-service.ts
src/lib/services/elevenlabs-call-service.ts
src/lib/services/elevenlabs-webhook-service.ts
src/lib/stories-server.test.ts
src/lib/stories-server.ts
src/lib/stripe.test.ts
src/lib/stripe.ts
src/lib/supabase-admin.test.ts
src/lib/supabase-admin.ts
src/lib/twilio-sms.ts
src/lib/utils.test.ts
src/lib/utils.ts
src/proxy.ts
src/test/i18n-mock.ts
src/test/local-supabase.ts
```

### Database Migrations

```
supabase/migrations/109_booking_sms_dead_letter.sql
```

### Scripts

```
scripts/check-verification-coverage.ts
scripts/generate-locale-coverage.ts
scripts/qa-llm-quality-helpers.test.ts
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
admin/voice-session
chat/stream
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
voice-session
webhooks/elevenlabs
webhooks/stripe
webhooks/supabase
webhooks/translate

```

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-08-19 |
| README.md | 2026-07-28 |

---

*Report generated by Documentation Agent*
