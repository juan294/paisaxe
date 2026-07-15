# Documentation Freshness Report
> Auto-generated on 2026-07-14 06:00:03

## CLAUDE.md Status

Last modified: **2026-07-01**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/api/admin/agent-config/route.test.ts
src/app/api/admin/agents-summary/route.test.ts
src/app/api/admin/agents/run/route.test.ts
src/app/api/admin/agents/run/route.ts
src/app/api/admin/costs-analytics/[id]/route.test.ts
src/app/api/admin/costs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent/route.test.ts
src/app/api/admin/marketing/dashboard/route.test.ts
src/app/api/admin/stories/[id]/content-images/route.test.ts
src/app/api/admin/stories/[id]/image-source/route.test.ts
src/app/api/admin/stories/[id]/image/route.test.ts
src/app/api/admin/stories/[id]/route.test.ts
src/app/api/admin/stories/[id]/status/route.test.ts
src/app/api/admin/stories/approve-all/route.test.ts
src/app/api/admin/stories/route.test.ts
src/app/api/admin/stripe-analytics/route.test.ts
src/app/api/admin/suggestions/[id]/route.test.ts
src/app/api/admin/suggestions/route.test.ts
src/app/api/chat/route.ts
src/app/api/chat/stream/route.ts
src/app/api/checkout/day-pass/route.test.ts
src/app/api/checkout/embedded/route.test.ts
src/app/api/cron/fail-stale-bookings/route.test.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/retry-booking-sms/route.test.ts
src/app/api/favorites/route.test.ts
src/app/api/feature-flags/route.test.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/save-favorite/route.test.ts
src/app/api/mcp/weather/route.test.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/supabase/route.test.ts
src/app/api/webhooks/translate/route.test.ts
src/app/favorites/layout.test.tsx
src/app/favorites/page.test.tsx
src/app/global-error.test.tsx
src/app/immersive/layout.test.tsx
src/app/layout.test.tsx
src/app/pricing/checkout/page.test.tsx
src/app/pricing/page.test.tsx
src/app/robots.test.ts
src/app/sitemap.test.ts
src/app/story/[slug]/page.test.tsx
src/components/admin/admin-shell.test.tsx
src/components/admin/agent-config-panel.test.tsx
src/components/admin/agents-dashboard/terminal-display.test.tsx
src/components/admin/analytics-cache-context.test.tsx
src/components/admin/marketing-dashboard/drafts-panel.test.tsx
src/components/admin/marketing-dashboard/marketing-dashboard.test.tsx
src/components/admin/stories-tab-panel.test.tsx
src/components/admin/visitor-voice-config-panel.test.tsx
src/components/auth/auth-provider.test.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/suggest-place-dialog.test.tsx
src/components/immersive/voice-chat-elevenlabs.test.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat/chat-message-list.test.tsx
src/components/ui/component-error-boundary.test.tsx
src/hooks/use-favorites.test.ts
src/hooks/use-feature-flags.test.ts
src/hooks/use-realtime-feature-flags.test.ts
src/hooks/use-realtime-feature-flags.ts
src/hooks/use-stories.test.ts
src/hooks/use-stories.ts
src/hooks/use-stream-chat.test.ts
src/lib/admin-api/agent-config.test.ts
src/lib/admin-api/agents.test.ts
src/lib/admin-api/analytics.test.ts
src/lib/admin-api/costs.test.ts
src/lib/admin-api/feature-flags.test.ts
src/lib/admin-api/optimizer.test.ts
src/lib/admin-api/stories.test.ts
src/lib/admin-api/suggestions.test.ts
src/lib/admin-auth.test.ts
src/lib/chat-config.ts
src/lib/chat-safety.test.ts
src/lib/chat-safety.ts
src/lib/claude.test.ts
src/lib/client-logger.test.ts
src/lib/costs/anthropic-costs.test.ts
src/lib/costs/anthropic-pricing.test.ts
src/lib/costs/anthropic-pricing.ts
src/lib/costs/anthropic-usage.test.ts
src/lib/costs/elevenlabs-costs.test.ts
src/lib/costs/twilio-costs.test.ts
src/lib/embedding-cache.test.ts
src/lib/env.test.ts
src/lib/feature-flags-server.test.ts
src/lib/logger.test.ts
src/lib/models.test.ts
src/lib/models.ts
src/lib/platforms/x-client.test.ts
src/lib/proxy/auth-refresh.test.ts
src/lib/proxy/canonical-domain.test.ts
src/lib/proxy/cors.test.ts
src/lib/proxy/maintenance.test.ts
src/lib/proxy/request-id.test.ts
src/lib/realtime.test.ts
src/lib/realtime.ts
src/lib/schemas.test.ts
src/lib/services/booking-service.test.ts
src/lib/stories-data.ssr.test.ts
src/lib/stories-data.test.ts
src/lib/stories-data.ts
src/lib/stripe.test.ts
src/lib/supabase-auth.test.ts
src/lib/translate-story.test.ts
src/tests/qa/llm-quality.test.ts
```

No new migrations since documentation update.

### Scripts

```
scripts/qa-agent.sh
scripts/security-agent.sh
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
| CLAUDE.md | 2026-07-01 |
| README.md | 2026-06-13 |

## Changes Made This Run

**Date: 2026-07-14** — Status: GREEN. No documentation gaps found. Thirty-second consecutive clean run.

- Feature flags: Zero undocumented flags. Verified `FeatureFlagKey` in `src/types/feature-flags.ts` contains exactly 17 flags, all present in the Feature Flags Reference of `docs/project/features.md`. Verified all 10 agent flags (master `automated_agents` + 9 agents in `scripts/agent-config.defaults.json`) are documented in the Agent Flags table. No additions needed.
- API routes: All 55 flagged routes confirmed internal. The count rose from 51 (prior runs) to 55; spot-checked the routes not individually verified before — `admin/stories/bulk-delete` and `admin/stories/bulk-status` (both `validateAdminAuth`-gated bulk story operations), `admin/marketing/accounts` (`withAdmin`-gated marketing account management), and `checkout/health` (admin-gated Stripe pipeline diagnostic). None are for external consumption. Externally-relevant surfaces (chat flow, MCP voice-agent tools, webhooks, health probes) remain documented in features.md.
- No edits made to `docs/project/features.md` or `CLAUDE.md` — both accurate and complete as-is.

---

*Report generated by Documentation Agent*
