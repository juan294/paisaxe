# Documentation Freshness Report
> Auto-generated on 2026-04-20 06:00:04

## CLAUDE.md Status

Last modified: **2026-04-19**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/admin/admin-page-lazy-mount.test.tsx
src/app/admin/page.test.tsx
src/app/admin/page.tsx
src/app/api/admin/analytics/route.test.ts
src/app/api/admin/analytics/route.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/github-analytics/route.ts
src/app/api/admin/stories/route.test.ts
src/app/api/admin/stories/route.ts
src/app/api/admin/stripe-analytics/route.test.ts
src/app/api/chat/route.test.ts
src/app/api/chat/route.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/checkout/day-pass/route.ts
src/app/api/cron/content-discovery/route.test.ts
src/app/api/cron/content-discovery/route.ts
src/app/api/cron/github-traffic-sync/route.test.ts
src/app/api/cron/github-traffic-sync/route.ts
src/app/api/cron/subscription-optimizer/route.test.ts
src/app/api/cron/subscription-optimizer/route.ts
src/app/api/favorites/route.test.ts
src/app/api/favorites/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/make-booking/route.ts
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
src/app/error.tsx
src/app/global-error.tsx
src/app/immersive/immersive-page-content.tsx
src/app/immersive/page.test.tsx
src/app/immersive/page.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/components/admin/admin-shell.test.tsx
src/components/admin/admin-shell.tsx
src/components/admin/agents-dashboard/cross-agent-insights.tsx
src/components/admin/agents-dashboard/markdown.test.ts
src/components/admin/agents-dashboard/markdown.ts
src/components/admin/agents-dashboard/optimizer-report-dialog.tsx
src/components/admin/agents-dashboard/safe-markdown.test.tsx
src/components/admin/agents-dashboard/safe-markdown.tsx
src/components/immersive/chat-upsell-cta.test.tsx
src/components/immersive/chat-upsell-cta.tsx
src/components/immersive/story-info-panel.test.tsx
src/components/immersive/story-info-panel.tsx
src/components/immersive/story-toolbar.test.tsx
src/components/immersive/story-toolbar.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat.tsx
src/components/seo/json-ld.tsx
src/hooks/use-feature-flags.test.ts
src/hooks/use-feature-flags.ts
src/hooks/use-stories.test.ts
src/hooks/use-stories.ts
src/hooks/use-story-keyboard-nav.test.ts
src/hooks/use-story-keyboard-nav.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-stream-chat.ts
src/lib/admin-auth.test.ts
src/lib/admin-auth.ts
src/lib/admin-formatters.test.ts
src/lib/admin-formatters.ts
src/lib/claude.test.ts
src/lib/claude.ts
src/lib/cron-auth.test.ts
src/lib/cron-auth.ts
src/lib/csrf.test.ts
src/lib/csrf.ts
src/lib/env.test.ts
src/lib/env.ts
src/lib/environment.ts
src/lib/feature-flags-server.test.ts
src/lib/feature-flags-server.ts
src/lib/i18n/ast.ts
src/lib/i18n/de.ts
src/lib/i18n/en.ts
src/lib/i18n/es.ts
src/lib/i18n/fr.ts
src/lib/i18n/pt.ts
src/lib/i18n/translations.test.ts
src/lib/logger.test.ts
src/lib/logger.ts
src/lib/proxy/auth-refresh.ts
src/lib/proxy/canonical-domain.ts
src/lib/proxy/cors.ts
src/lib/proxy/csp.ts
src/lib/proxy/csrf-proxy.ts
src/lib/proxy/index.ts
src/lib/proxy/maintenance.test.ts
src/lib/proxy/maintenance.ts
src/lib/proxy/root-redirect.ts
src/lib/proxy/story-rewrite.ts
src/lib/rate-limit.ts
src/lib/schemas.ts
src/lib/search.test.ts
src/lib/search.ts
src/lib/supabase.test.ts
src/lib/supabase.ts
src/proxy.test.ts
src/proxy.ts
src/test/i18n-mock.ts
```

### Database Migrations

```
supabase/migrations/076_admin_audit_log.sql
supabase/migrations/077_stripe_webhook_events.sql
```

### Scripts

```
scripts/check-env.ts
scripts/compress-images.ts
scripts/lib/print-shared-context-instructions.ts
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
cron/github-traffic-sync
cron/subscription-optimizer
favorites
feature-flags
health/db
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

## Changes Made This Run

No changes made. No documentation gaps found.

- Feature flags: All 17 `FeatureFlagKey` entries in `src/types/feature-flags.ts` are documented in `docs/project/features.md`. All 10 agent flags verified. Zero gaps.
- API routes: All 51 flagged routes confirmed internal (admin APIs, cron endpoints, webhooks, MCP voice-agent tools). No external-consumption routes require new documentation.
- Migrations 076 (`admin_audit_log`) and 077 (`stripe_webhook_events`) are internal infrastructure tables (audit log and Stripe deduplication) — no user-facing features to document.
- CLAUDE.md: Current (last modified 2026-04-19).
- features.md: Complete — no additions needed.

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-04-19 |
| README.md | 2026-02-16 |

---

*Report generated by Documentation Agent*
