# Documentation Freshness Report
> Auto-generated on 2026-03-25 06:00:05

## CLAUDE.md Status

Last modified: **2026-03-24**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/about/layout.test.tsx
src/app/about/layout.tsx
src/app/admin/page.test.tsx
src/app/admin/page.tsx
src/app/api/admin/agent-config/route.test.ts
src/app/api/admin/agent-config/route.ts
src/app/api/admin/agent-reports/route.test.ts
src/app/api/admin/agents-summary/route.test.ts
src/app/api/admin/agents-summary/route.ts
src/app/api/admin/agents/run/route.test.ts
src/app/api/admin/agents/run/route.ts
src/app/api/admin/costs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/github-analytics/route.test.ts
src/app/api/admin/marketing/accounts/route.test.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent/route.test.ts
src/app/api/admin/marketing/dashboard/route.test.ts
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
src/app/api/admin/suggestions/route.test.ts
src/app/api/admin/tunnel/route.test.ts
src/app/api/chat/route.test.ts
src/app/api/checkout/day-pass/route.test.ts
src/app/api/checkout/embedded/route.test.ts
src/app/api/checkout/health/route.test.ts
src/app/api/cron/content-discovery/route.test.ts
src/app/api/cron/content-discovery/route.ts
src/app/api/cron/github-traffic-sync/route.test.ts
src/app/api/cron/subscription-optimizer/route.test.ts
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/places/route.test.ts
src/app/api/mcp/weather/route.test.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/api/webhooks/stripe/route.test.ts
src/app/api/webhooks/supabase/route.test.ts
src/app/api/webhooks/translate/route.test.ts
src/app/coming-soon/page.test.tsx
src/app/favorites/page.test.tsx
src/app/immersive/immersive-page-content.test.tsx
src/app/immersive/layout.test.tsx
src/app/immersive/layout.tsx
src/app/immersive/page.test.tsx
src/app/immersive/page.tsx
src/app/layout.test.tsx
src/app/layout.tsx
src/app/pricing/checkout/page.tsx
src/app/pricing/loading.test.tsx
src/app/pricing/loading.tsx
src/app/privacy/layout.test.tsx
src/app/privacy/layout.tsx
src/app/providers.test.tsx
src/app/providers.tsx
src/app/story/[slug]/page.test.tsx
src/app/story/[slug]/page.tsx
src/app/terms/layout.test.tsx
src/app/terms/layout.tsx
src/components/admin/a11y-heading-focus.test.tsx
src/components/admin/admin-tabs.test.tsx
src/components/admin/agent-config-panel.test.tsx
src/components/admin/agent-config-panel.tsx
src/components/admin/agents-dashboard/agent-card.test.tsx
src/components/admin/agents-dashboard/agents-dashboard.test.tsx
src/components/admin/agents-dashboard/constants.test.ts
src/components/admin/agents-dashboard/constants.ts
src/components/admin/agents-dashboard/index.tsx
src/components/admin/agents-dashboard/markdown.test.ts
src/components/admin/agents-dashboard/optimizer-config-panel.test.tsx
src/components/admin/agents-dashboard/optimizer-config-panel.tsx
src/components/admin/agents-dashboard/optimizer-report-dialog.test.tsx
src/components/admin/agents-dashboard/terminal-display.test.tsx
src/components/admin/analytics-cache-context.test.tsx
src/components/admin/analytics-dashboard.test.tsx
src/components/admin/analytics-tabs.tsx
src/components/admin/costs-analytics-panel/alerts.test.tsx
src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx
src/components/admin/costs-analytics-panel/forecast.test.tsx
src/components/admin/costs-analytics-panel/index.tsx
src/components/admin/costs-analytics-panel/modals.test.tsx
src/components/admin/create-story-dialog.test.tsx
src/components/admin/date-input-focus.test.tsx
src/components/admin/elevenlabs-analytics-panel.test.tsx
src/components/admin/elevenlabs-analytics-panel.tsx
src/components/admin/feature-toggles-panel.test.tsx
src/components/admin/feature-toggles-panel.tsx
src/components/admin/github-analytics-panel.test.tsx
src/components/admin/github-analytics-panel.tsx
src/components/admin/image-editor-dialog.test.tsx
src/components/admin/maintenance-config-panel.test.tsx
src/components/admin/maintenance-config-panel.tsx
src/components/admin/marketing-dashboard/account-config-dialog.test.tsx
src/components/admin/marketing-dashboard/account-config-dialog.tsx
src/components/admin/marketing-dashboard/create-draft-dialog.test.tsx
src/components/admin/marketing-dashboard/create-draft-dialog.tsx
src/components/admin/marketing-dashboard/drafts-panel.test.tsx
src/components/admin/marketing-dashboard/marketing-dashboard.test.tsx
src/components/admin/marketing-dashboard/marketing-dashboard.tsx
src/components/admin/marketing-dashboard/post-row.test.tsx
src/components/admin/story-card.test.tsx
src/components/admin/story-editor-dialog/details-tab.test.tsx
src/components/admin/story-editor-dialog/image-tab.test.tsx
src/components/admin/story-editor-dialog/story-editor-dialog.test.tsx
src/components/admin/story-editor-dialog/story-editor-fullscreen.test.tsx
src/components/admin/story-editor-dialog/use-story-editor-save.test.ts
src/components/admin/story-editor-dialog/use-story-editor-state.test.ts
src/components/admin/story-translations-tab.test.tsx
src/components/admin/stripe-analytics-panel.test.tsx
src/components/admin/stripe-analytics-panel.tsx
src/components/admin/suggestions-panel.test.tsx
src/components/admin/suggestions-panel.tsx
src/components/admin/tunnel-control-panel.test.tsx
src/components/admin/visitor-voice-config-panel.tsx
src/components/admin/visitors-analytics-panel.test.tsx
src/components/admin/visitors-analytics-panel.tsx
src/components/admin/voice-agent-chat.tsx
src/components/auth/auth-provider.test.tsx
src/components/auth/auth-provider.tsx
src/components/auth/sign-in-prompt.test.tsx
src/components/auth/sign-in-prompt.tsx
src/components/immersive/author-typewriter.test.tsx
src/components/immersive/bookmark-button.test.tsx
src/components/immersive/chat-actions.test.tsx
src/components/immersive/language-switcher.test.tsx
src/components/immersive/question-prompts.test.tsx
src/components/immersive/question-prompts.tsx
src/components/immersive/related-stories.test.tsx
src/components/immersive/share-button.test.tsx
src/components/immersive/site-info-menu.test.tsx
src/components/immersive/story-progress-bar.test.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/suggest-place-dialog.test.tsx
src/components/immersive/toolbar-overflow-menu.test.tsx
src/components/immersive/voice-chat-elevenlabs.test.tsx
src/components/immersive/voice-chat.test.tsx
src/components/immersive/voice-chat.tsx
src/components/posthog-provider.test.tsx
src/components/seo/json-ld.test.tsx
src/components/seo/json-ld.tsx
src/components/site-footer.test.tsx
src/components/site-footer.tsx
src/components/ui/component-error-boundary.test.tsx
src/components/ui/logo.test.tsx
src/components/ui/select.test.tsx
src/config/elevenlabs-agents.test.ts
src/config/location.test.ts
src/config/recurring-costs.ts
src/config/service-registry.test.ts
src/config/service-registry.ts
src/config/service-tiers.test.ts
src/config/service-tiers.ts
src/hooks/use-admin-role.test.ts
src/hooks/use-favorites.test.ts
src/hooks/use-feature-flags-integration.test.ts
src/hooks/use-feature-flags.test.ts
src/hooks/use-focus-trap.test.ts
src/hooks/use-reduced-motion.test.ts
src/hooks/use-stories.test.ts
src/hooks/use-stream-chat.test.ts
src/hooks/use-voice-session.ssr.test.ts
src/hooks/use-voice-session.test.ts
src/lib/admin-api/agent-config.test.ts
src/lib/admin-api/agent-config.ts
src/lib/admin-api/index.ts
src/lib/admin-api/optimizer.test.ts
src/lib/chat-action-detection.test.ts
src/lib/chat-upsell-throttle.test.ts
src/lib/claude.test.ts
src/lib/content-discovery.test.ts
src/lib/costs/anthropic-costs.test.ts
src/lib/costs/anthropic-costs.ts
src/lib/costs/elevenlabs-costs.test.ts
src/lib/costs/forecast.test.ts
src/lib/costs/manual-costs.test.ts
src/lib/costs/recurring-costs.test.ts
src/lib/costs/tier-alerts.test.ts
src/lib/costs/twilio-costs.test.ts
src/lib/csrf-client.test.ts
src/lib/csrf.test.ts
src/lib/embedding-cache.test.ts
src/lib/freshness.test.ts
src/lib/i18n/detect-language.test.ts
src/lib/i18n/provider.test.tsx
src/lib/i18n/resolve.test.ts
src/lib/image-optimization.test.ts
src/lib/localize-story.test.ts
src/lib/platforms/index.test.ts
src/lib/platforms/x-client.test.ts
src/lib/posthog-query.test.ts
src/lib/posting-service.test.ts
src/lib/rate-limit.test.ts
src/lib/request-utils.test.ts
src/lib/rerank.test.ts
src/lib/search.test.ts
src/lib/seasonal-weighting.test.ts
src/lib/security-headers.test.ts
src/lib/stories-data.test.ts
src/lib/stories-data.ts
src/lib/stripe.test.ts
src/lib/subscription-optimizer.test.ts
src/lib/translate-story.test.ts
src/lib/twilio-sms.test.ts
src/proxy.test.ts
src/proxy.ts
src/test/setup.ts
src/tests/qa/llm-quality.test.ts
src/types/admin.test.ts
src/types/agent-config.ts
src/types/feature-flags.ts
src/types/immersive.test.ts
src/types/suggestions.test.ts
```

### Database Migrations

```
supabase/migrations/068_remove_agent_flags_from_db.sql
```

### Scripts

```
scripts/agent-ctl.sh
scripts/agents/cc-rpi-update.sh
scripts/cost-analyst-agent.sh
scripts/coverage-agent.sh
scripts/documentation-agent.sh
scripts/lib/agent-utils.sh
scripts/localization-agent.sh
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

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-03-24 |
| README.md | 2026-02-16 |

## Changes Made This Run (2026-03-25)

### Feature Flags — No changes needed

All 16 flags listed as "undocumented" (`ambient_discovery`, `asturianu_touches`, `autoplay_button`, `booking_system`, `contextual_prompts`, `fullscreen_button`, `maintenance_mode`, `mood_discovery`, `randomized_order`, `related_stories`, `seasonal_surfacing`, `sms_booking_confirmation`, `story_freshness`, `story_sharing`, `surprise_me`, `user_story_suggestions`) are already fully documented in `docs/project/features.md` Feature Flags Reference (lines 660–717). The gaps detection script was comparing against CLAUDE.md rather than the dedicated features doc — this is a false positive.

### API Routes — No changes needed

All 50 routes listed as "undocumented" are internal:
- **28 admin routes** (`/api/admin/*`) — serve the admin dashboard; described functionally in the Admin Panel section of features.md
- **4 webhook routes** (`/api/webhooks/*`) — already documented in the Infrastructure section of features.md (line 623–631)
- **4 MCP routes** (`/api/mcp/*`) — already documented in the Premium Voice Agent section of features.md (line 128–133)
- **3 cron routes** (`/api/cron/*`) — internal scheduled job handlers
- **3 checkout routes** (`/api/checkout/*`) — serve the pricing/payment UI; described in Revenue Analytics section
- **Remaining** (`chat/stream`, `favorites`, `feature-flags`, `health/db`, `suggestions`, `voice-access`) — internal endpoints serving visitor UI features already described in features.md

None are meant for external consumption. No API reference documentation needed.

### Recommendation

Update the gaps detection script to check `docs/project/features.md` in addition to CLAUDE.md to avoid false positives in future runs.

---

*Report generated by Documentation Agent*
