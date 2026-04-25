# Documentation Freshness Report
> Auto-generated on 2026-04-25 06:00:05

## Changes Made This Run

**Status: GREEN** — No documentation gaps found. Twentieth consecutive clean run.

- **Feature flags**: Verified all 17 `FeatureFlagKey` values in `src/types/feature-flags.ts` against `docs/project/features.md`. All documented. Zero gaps.
- **Agent flags**: All 10 agent flags (Agents tab) verified against `docs/project/features.md`. Zero gaps.
- **API routes**: All 51 flagged routes confirmed internal — admin dashboard APIs, Vercel cron jobs, internal chat/checkout/favorites APIs, webhooks already documented in Infrastructure section, MCP voice-agent tools already documented in Voice section. No external-consumption routes require new documentation.
- **Recent migrations (079-081)**: `webhook_idempotency_rpcs`, `fail_stale_translations_support`, `fail_stale_story_translations_locked` — internal infrastructure, no user-facing features or flags introduced.
- **No changes made to `docs/project/features.md`** — all content remains accurate.

## CLAUDE.md Status

Last modified: **2026-04-24**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/api/admin/stories/[id]/route.test.ts
src/app/api/admin/stories/[id]/route.ts
src/app/api/admin/stories/bulk-status/route.test.ts
src/app/api/admin/stories/bulk-status/route.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/fail-stale-translations/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/make-booking/route.ts
src/app/api/voice-access/route.test.ts
src/app/api/voice-access/route.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/elevenlabs/route.ts
src/app/api/webhooks/translate/route.test.ts
src/app/api/webhooks/translate/route.ts
src/app/favorites/page.test.tsx
src/app/favorites/page.tsx
src/app/immersive/immersive-page-content.test.tsx
src/app/immersive/immersive-page-content.tsx
src/app/immersive/page.test.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/components/admin/elevenlabs-analytics-panel.test.tsx
src/components/auth/auth-provider.test.tsx
src/components/auth/auth-provider.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/suggest-place-button.tsx
src/hooks/use-favorites.test.ts
src/hooks/use-favorites.ts
src/hooks/use-feature-flags.provider.test.tsx
src/hooks/use-feature-flags.ts
src/hooks/use-stories.provider.test.tsx
src/hooks/use-stories.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-stream-chat.ts
src/hooks/use-visitor-voice-access.test.ts
src/hooks/use-visitor-voice-access.ts
src/hooks/use-voice-access.test.ts
src/hooks/use-voice-access.ts
src/instrumentation.test.ts
src/instrumentation.ts
src/lib/env.ts
src/lib/logger-sanitize.ts
src/lib/logger.test.ts
src/lib/logger.ts
src/lib/mcp-auth.ts
src/lib/proxy/cors.ts
src/lib/proxy/csp.ts
src/lib/request-context.ts
src/lib/schemas.ts
src/lib/security-headers.test.ts
src/lib/sentry-before-send.test.ts
src/lib/stories-server.ts
src/lib/stripe.ts
src/lib/supabase.test.ts
src/lib/supabase.ts
src/types/index.ts
src/types/sse.test.ts
src/types/sse.ts
src/types/suggestions.ts
```

### Database Migrations

```
supabase/migrations/053_pending_bookings.sql
supabase/migrations/079_webhook_idempotency_rpcs.sql
supabase/migrations/080_fail_stale_translations_support.sql
supabase/migrations/081_fail_stale_story_translations_locked.sql
```

### Scripts

```
scripts/run-stripe-e2e.ts
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
cron/fail-stale-translations
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

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-04-24 |
| README.md | 2026-04-24 |

---

*Report generated by Documentation Agent*
