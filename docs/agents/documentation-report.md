# Documentation Freshness Report
> Auto-generated on 2026-07-01 06:00:04

## CLAUDE.md Status

Last modified: **2026-06-27**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/api/admin/agent-config/route.test.ts
src/app/api/admin/agents-summary/route.test.ts
src/app/api/admin/costs-analytics/[id]/route.test.ts
src/app/api/admin/costs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent/route.test.ts
src/app/api/admin/marketing/dashboard/route.test.ts
src/app/api/admin/marketing/posts/route.test.ts
src/app/api/admin/stories/[id]/content-images/route.test.ts
src/app/api/admin/stories/[id]/image-source/route.test.ts
src/app/api/admin/stories/[id]/status/route.test.ts
src/app/api/admin/stories/approve-all/route.test.ts
src/app/api/admin/stories/route.test.ts
src/app/api/admin/stripe-analytics/route.test.ts
src/app/api/admin/suggestions/[id]/route.test.ts
src/app/api/admin/suggestions/route.test.ts
src/app/api/checkout/day-pass/route.test.ts
src/app/api/checkout/embedded/route.test.ts
src/app/api/cron/fail-stale-bookings/route.test.ts
src/app/api/cron/fail-stale-translations/route.test.ts
src/app/api/cron/retry-booking-sms/route.test.ts
src/app/api/feature-flags/route.test.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/save-favorite/route.test.ts
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
src/hooks/use-stories.test.ts
src/hooks/use-stream-chat.test.ts
src/lib/admin-api/agent-config.test.ts
src/lib/admin-api/agents.test.ts
src/lib/admin-api/analytics.test.ts
src/lib/admin-api/costs.test.ts
src/lib/admin-api/feature-flags.test.ts
src/lib/admin-api/optimizer.test.ts
src/lib/admin-api/stories.test.ts
src/lib/admin-api/suggestions.test.ts
src/lib/schemas.test.ts
src/lib/stripe.test.ts
src/lib/supabase-auth.test.ts
```

No new migrations since documentation update.

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
| CLAUDE.md | 2026-06-27 |
| README.md | 2026-06-13 |

## Changes Made This Run

Status: GREEN — No documentation changes needed. 32nd consecutive clean run.

- **Feature flags**: Zero undocumented flags (gaps file confirms). `FeatureFlagKey` type (`src/types/feature-flags.ts`) still lists exactly 17 flags, all present in the Feature Flags Reference table in `docs/project/features.md`. Agent flags (10, including master toggle) unchanged and fully documented.
- **API routes**: 55 routes flagged (up from 51 on 2026-06-22 — 4 net-new since last run: `admin/agents/run`, `admin/stories/[id]/translations`, `cron/github-traffic-sync`, `cron/subscription-optimizer`). Spot-checked all previously-unconfirmed routes by reading source:
  - `admin/tunnel`, `cron/github-traffic-sync`, `cron/subscription-optimizer`, `checkout/health` — admin-auth (`validateAdminAuth`/`withAdmin`) or cron-secret (`verifyVercelCron`/`verifyWebhookSecret`) gated. Internal.
  - `health/db` — internal QA diagnostic probe (confirmed in code comment: "Used by QA agent to detect configuration issues").
  - `mcp/make-booking/status` — Twilio status-callback receiver (passive webhook-style endpoint, not a public API for consumption).
  - `admin/stories/[id]/translations`, `admin/marketing/accounts` — admin-auth gated (`withAdmin`/`validateAdminAuth`).
  - `chat`, `chat/stream`, `checkout/day-pass`, `checkout/embedded`, `favorites`, `feature-flags`, `voice-access`, `suggestions` — internal app API surface for the Paisaxe frontend itself, not third-party-consumable; chat flow already documented in prose (features.md lines 93-101).
  - `mcp/places`, `mcp/weather`, `mcp/make-booking`, `mcp/save-favorite` — already documented as the "Custom MCP tools" list in features.md (lines 128-133).
  - `webhooks/supabase`, `webhooks/stripe`, `webhooks/elevenlabs`, `webhooks/translate` — already documented in the Webhooks table (features.md lines 638-647).
  - All remaining `admin/*` and `cron/*` routes confirmed session/cron-secret gated, consistent with prior cycles.
  - No routes meet the "external consumption" bar for a public API reference — all confirmed internal.
- CLAUDE.md (last modified 2026-06-27) and features.md require no updates this cycle.

---

*Report generated by Documentation Agent*
