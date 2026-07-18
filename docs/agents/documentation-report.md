# Documentation Freshness Report
> Auto-generated on 2026-07-18 06:00:05

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
src/app/api/webhooks/translate/route.ts
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
src/components/immersive/language-switcher.test.tsx
src/components/immersive/story-info-panel.test.tsx
src/components/immersive/story-info-panel.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/story-viewer.tsx
src/components/immersive/suggest-place-dialog.test.tsx
src/components/immersive/voice-chat-elevenlabs.test.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat/chat-message-list.test.tsx
src/components/ui/component-error-boundary.test.tsx
src/config/elevenlabs-agents.test.ts
src/hooks/use-favorites.test.ts
src/hooks/use-feature-flags.test.ts
src/hooks/use-realtime-feature-flags.test.ts
src/hooks/use-realtime-feature-flags.ts
src/hooks/use-sse-stream.test.ts
src/hooks/use-sse-stream.ts
src/hooks/use-stories.test.ts
src/hooks/use-stories.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-stream-chat.ts
src/hooks/use-voice-session.test.ts
src/lib/admin-api/agent-config.test.ts
src/lib/admin-api/agents.test.ts
src/lib/admin-api/analytics.test.ts
src/lib/admin-api/costs.test.ts
src/lib/admin-api/feature-flags.test.ts
src/lib/admin-api/optimizer.test.ts
src/lib/admin-api/stories.test.ts
src/lib/admin-api/suggestions.test.ts
src/lib/admin-auth.test.ts
src/lib/chat-action-detection.test.ts
src/lib/chat-config.ts
src/lib/chat-safety.test.ts
src/lib/chat-safety.ts
src/lib/chat-stream-timeouts.ts
src/lib/claude.test.ts
src/lib/claude.ts
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
src/lib/image-optimization.test.ts
src/lib/logger-sanitize.test.ts
src/lib/logger-sanitize.ts
src/lib/logger.test.ts
src/lib/models.test.ts
src/lib/models.ts
src/lib/platforms/x-client.test.ts
src/lib/proxy/auth-refresh.test.ts
src/lib/proxy/canonical-domain.test.ts
src/lib/proxy/cors.test.ts
src/lib/proxy/maintenance.test.ts
src/lib/proxy/request-id.test.ts
src/lib/rate-limit.test.ts
src/lib/realtime.test.ts
src/lib/realtime.ts
src/lib/schemas.test.ts
src/lib/services/booking-service.test.ts
src/lib/stories-data.fallback-metadata.test.ts
src/lib/stories-data.ssr.test.ts
src/lib/stories-data.test.ts
src/lib/stories-data.ts
src/lib/stripe.test.ts
src/lib/supabase-auth.test.ts
src/lib/supabase.test.ts
src/lib/translate-story.test.ts
src/lib/translate-story.ts
src/tests/qa/llm-quality.test.ts
```

No new migrations since documentation update.

### Scripts

```
scripts/performance-agent.sh
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

---

## Agent Analysis — 2026-07-18

Status: GREEN — No documentation gaps found. Thirty-second consecutive clean run.

### Feature Flags

Zero undocumented flags in the gaps file. Independently verified against source:

- `FeatureFlagKey` in `src/types/feature-flags.ts` defines exactly 17 flags — all 17 present in the Feature Flags Reference tables (Features tab) in `docs/project/features.md`.
- `scripts/agent-config.defaults.json` defines 9 agent flags plus the `master_enabled` toggle (surfaced as `automated_agents`) = 10 agent flags — all 10 present in the Agent Flags table (Agents tab).
- Counts unchanged since prior runs. No additions, renames, or removals.

### API Routes

55 routes flagged this run (up from 51 in prior reports — a gap-script counting difference, not new surface area). Verified via `git log --diff-filter=A` that zero new route files have been added since 2026-06-21; every flagged route pre-dates the last clean run and was previously classified.

All 55 confirmed internal, by category:

- `admin/*` (30): gated by `validateAdminAuth()` / admin RBAC. Spot-checked `admin/agent-reports` (admin-auth-gated, returns empty in production — reads local gitignored report files) and `admin/tunnel` (admin-auth-gated AND hard-disabled in production via `NODE_ENV` check). Both internal.
- `cron/*` (6): Vercel cron endpoints, cron-secret gated.
- `webhooks/*` (4): inbound service webhooks (Stripe, ElevenLabs, Supabase, translation) — already documented in the features.md Webhooks table.
- `mcp/*` (5): ElevenLabs voice-agent tool endpoints — already documented under "Custom MCP tools" in features.md.
- `chat`, `chat/stream`: internal app API, flow already documented in "How text chat works under the hood".
- `checkout/*` (3), `favorites`, `feature-flags`, `suggestions`, `voice-access`: internal client-side app APIs.
- `health/db`, `health/live`: monitoring probes — `health/live` already documented in the Infrastructure section.

No route is intended for external third-party consumption; none require public API documentation.

### Changes Made This Run

None. No gaps existed:

- `docs/project/features.md` — no additions needed (flag reference complete and accurate, 17 + 10 flags verified against source).
- CLAUDE.md — current (last modified 2026-07-01); no stale instructions found.
- No new feature flags, API routes, or user-facing behavior changes since the 2026-06-22 run.

---

*Report generated by Documentation Agent*
