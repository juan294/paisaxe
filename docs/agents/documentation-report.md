# Documentation Freshness Report
> Auto-generated on 2026-04-26 06:00:05

## CLAUDE.md Status

Last modified: **2026-04-24**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/api/admin/feature-flags/[key]/route.test.ts
src/app/api/admin/feature-flags/[key]/route.ts
src/app/api/admin/stories/[id]/route.test.ts
src/app/api/admin/stories/[id]/route.ts
src/app/api/admin/stories/approve-all/route.test.ts
src/app/api/admin/stories/approve-all/route.ts
src/app/api/admin/stories/bulk-delete/route.test.ts
src/app/api/admin/stories/bulk-delete/route.ts
src/app/api/admin/stories/bulk-status/route.test.ts
src/app/api/admin/stories/bulk-status/route.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/fail-stale-translations/route.ts
src/app/api/feature-flags/route.se-h1.test.ts
src/app/api/feature-flags/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/make-booking/route.ts
src/app/api/voice-access/route.test.ts
src/app/api/voice-access/route.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/elevenlabs/route.ts
src/app/api/webhooks/stripe/route.test.ts
src/app/api/webhooks/stripe/route.ts
src/app/api/webhooks/translate/route.test.ts
src/app/api/webhooks/translate/route.ts
src/app/favorites/page.anon.test.tsx
src/app/favorites/page.test.tsx
src/app/favorites/page.tsx
src/app/immersive/immersive-flags-context.fe-h1.test.tsx
src/app/immersive/immersive-page-content.test.tsx
src/app/immersive/immersive-page-content.tsx
src/app/immersive/page.test.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/pricing/page.test.tsx
src/app/pricing/page.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/components/admin/agents-dashboard/cross-agent-insights.tsx
src/components/admin/agents-dashboard/markdown.test.ts
src/components/admin/agents-dashboard/optimizer-report-dialog.tsx
src/components/admin/elevenlabs-analytics-panel.test.tsx
src/components/admin/visitors-analytics-panel.test.tsx
src/components/auth/auth-provider.test.tsx
src/components/auth/auth-provider.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/suggest-place-button.tsx
src/components/immersive/suggest-place-button.ux-h1.test.tsx
src/config/next-externals.test.ts
src/hooks/use-favorites.anonymous.test.ts
src/hooks/use-favorites.test.ts
src/hooks/use-favorites.ts
src/hooks/use-feature-flags.provider.test.tsx
src/hooks/use-feature-flags.ts
src/hooks/use-stories.hydration.test.ts
src/hooks/use-stories.provider.test.tsx
src/hooks/use-stories.test.ts
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
supabase/migrations/082_translation_lease_10min.sql
supabase/migrations/083_sms_outbox_atomic_enqueue.sql
```

### Scripts

```
scripts/performance-agent.sh
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

## Changes Made This Run

Date: 2026-04-26

Status: GREEN — No documentation changes required. Twentieth consecutive clean run.

- Feature flags: `UNDOCUMENTED_FEATURE_FLAGS` section in gaps file is empty. All flags already documented in `docs/project/features.md` (Feature Flags Reference table).
- API routes: 51 flagged routes reviewed against the "internal vs external" rule. All are internal:
  - `admin/*` — admin-only dashboard endpoints (auth-gated via Supabase + `user_profiles.role = 'admin'`)
  - `cron/*` — scheduled jobs invoked by Vercel Cron (CRON_SECRET protected)
  - `webhooks/*` — third-party callbacks (Stripe, ElevenLabs, Supabase, translate) protected by HMAC signature verification
  - `mcp/*` — voice-agent tool endpoints called only by ElevenLabs Pelayo agent
  - `chat`, `chat/stream`, `favorites`, `feature-flags`, `health/db`, `voice-access`, `suggestions`, `checkout/*` — internal application APIs consumed only by the Paisaxe frontend
- No new user-facing features, flags, or external endpoints introduced since last run.
- No edits made to `CLAUDE.md` or `docs/project/features.md`.

---

*Report generated by Documentation Agent*
