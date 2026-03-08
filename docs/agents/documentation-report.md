# Documentation Freshness Report
> Auto-generated on 2026-03-08 06:00:04

## CLAUDE.md Status

Last modified: **2026-03-07**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/about/layout.test.tsx
src/app/about/layout.tsx
src/app/admin/page.test.tsx
src/app/admin/page.tsx
src/app/api/admin/agent-reports/route.test.ts
src/app/api/admin/agents-summary/route.test.ts
src/app/api/admin/costs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/marketing/accounts/route.test.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent/route.test.ts
src/app/api/admin/marketing/posts/route.test.ts
src/app/api/admin/marketing/schedule/route.test.ts
src/app/api/admin/stories/[id]/content-images/route.test.ts
src/app/api/admin/stories/[id]/image/route.test.ts
src/app/api/admin/stories/[id]/route.test.ts
src/app/api/admin/stories/[id]/status/route.test.ts
src/app/api/admin/stories/[id]/translations/route.test.ts
src/app/api/admin/stories/approve-all/route.test.ts
src/app/api/admin/stories/bulk-delete/route.test.ts
src/app/api/admin/stories/bulk-status/route.test.ts
src/app/api/admin/stories/route.test.ts
src/app/api/admin/stripe-analytics/route.test.ts
src/app/api/admin/suggestions/[id]/route.test.ts
src/app/api/admin/tunnel/route.test.ts
src/app/api/chat/route.test.ts
src/app/api/cron/content-discovery/route.test.ts
src/app/api/cron/github-traffic-sync/route.test.ts
src/app/api/cron/subscription-optimizer/route.test.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/places/route.test.ts
src/app/api/mcp/weather/route.test.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/immersive/immersive-page-content.test.tsx
src/app/immersive/layout.test.tsx
src/app/immersive/layout.tsx
src/app/immersive/page.test.tsx
src/app/immersive/page.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/privacy/layout.test.tsx
src/app/privacy/layout.tsx
src/app/story/[slug]/page.test.tsx
src/app/story/[slug]/page.tsx
src/app/terms/layout.test.tsx
src/app/terms/layout.tsx
src/components/admin/agent-config-panel.test.tsx
src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx
src/components/admin/elevenlabs-analytics-panel.test.tsx
src/components/admin/maintenance-config-panel.test.tsx
src/components/admin/marketing-dashboard/account-config-dialog.test.tsx
src/components/admin/marketing-dashboard/create-draft-dialog.test.tsx
src/components/admin/marketing-dashboard/drafts-panel.test.tsx
src/components/admin/marketing-dashboard/marketing-dashboard.test.tsx
src/components/admin/story-editor-dialog/story-editor-dialog.test.tsx
src/components/admin/stripe-analytics-panel.test.tsx
src/components/admin/suggestions-panel.test.tsx
src/components/admin/visitors-analytics-panel.test.tsx
src/components/auth/sign-in-prompt.test.tsx
src/components/auth/sign-in-prompt.tsx
src/components/immersive/author-typewriter.test.tsx
src/components/immersive/chat-actions.test.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat.tsx
src/components/seo/json-ld.tsx
src/components/site-footer.test.tsx
src/components/site-footer.tsx
src/hooks/use-admin-role.test.ts
src/hooks/use-voice-session.test.ts
src/lib/content-discovery.test.ts
src/lib/costs/elevenlabs-costs.test.ts
src/lib/costs/manual-costs.test.ts
src/lib/costs/recurring-costs.test.ts
src/lib/csrf-client.test.ts
src/lib/csrf.test.ts
src/lib/i18n/provider.test.tsx
src/lib/i18n/resolve.test.ts
src/lib/platforms/index.test.ts
src/lib/platforms/x-client.test.ts
src/lib/posthog-query.test.ts
src/lib/stripe.test.ts
src/lib/translate-story.test.ts
src/lib/twilio-sms.test.ts
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

### Potentially Undocumented Feature Flags

These feature flags may not be documented in CLAUDE.md:

```
ambient_discovery
asturianu_touches
autoplay_button
booking_system
contextual_prompts
fullscreen_button
maintenance_mode
mood_discovery
randomized_order
related_stories
seasonal_surfacing
sms_booking_confirmation
story_freshness
story_sharing
surprise_me
user_story_suggestions

```

## Changes Made This Run (2026-03-08)

### Feature Flags — No gaps found
All 16 flags reported as "undocumented" are already fully documented in `docs/project/features.md` (Feature Flags Reference, lines 660-718). The gap detection was comparing against CLAUDE.md, but `features.md` is the canonical location. No changes needed.

### API Routes — No external-facing gaps
All 50 listed API routes are internal:
- `admin/*` (30 routes): Internal admin panel APIs, consumed only by the admin dashboard
- `cron/*` (3 routes): Vercel Cron jobs, not externally callable
- `webhooks/*` (4 routes): Already documented in features.md Infrastructure section (line 625)
- `mcp/*` (4 routes): Already documented in features.md Premium Voice Agent section (line 128)
- `chat/stream`, `checkout/*`, `favorites`, `feature-flags`, `health/db`, `suggestions`, `voice-access`: Internal implementation endpoints for features already documented

No additional external documentation needed.

### Source File Changes — Infrastructure only
Recent commits are performance/infrastructure changes (PPR, ISR, function regions, TTFB optimization). No new user-facing features requiring documentation updates. Modified source files are predominantly test files (+277 tests from coverage agent run).

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-03-07 |
| README.md | 2026-02-16 |

---

*Report generated by Documentation Agent*
