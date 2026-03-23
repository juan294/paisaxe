# Documentation Freshness Report
> Auto-generated on 2026-03-23 06:00:05

## Health Status: GREEN

All feature flags and key API routes are documented. No documentation gaps found.

## CLAUDE.md Status

Last modified: **2026-03-21**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated. All are test files — no documentation updates needed.

### Source Files (src/)

```
src/app/api/mcp/make-booking/route.test.ts
src/app/api/mcp/places/route.test.ts
src/app/api/mcp/weather/route.test.ts
src/app/api/webhooks/elevenlabs/route.test.ts
src/app/coming-soon/page.test.tsx
src/app/favorites/page.test.tsx
src/components/admin/admin-tabs.test.tsx
src/components/admin/agents-dashboard/agent-card.test.tsx
src/components/admin/agents-dashboard/markdown.test.ts
src/components/admin/agents-dashboard/optimizer-config-panel.test.tsx
src/components/admin/analytics-dashboard.test.tsx
src/components/admin/costs-analytics-panel/alerts.test.tsx
src/components/admin/costs-analytics-panel/forecast.test.tsx
src/components/admin/elevenlabs-analytics-panel.test.tsx
src/components/admin/feature-toggles-panel.test.tsx
src/components/admin/github-analytics-panel.test.tsx
src/components/admin/maintenance-config-panel.test.tsx
src/components/admin/story-card.test.tsx
src/components/admin/story-translations-tab.test.tsx
src/components/admin/stripe-analytics-panel.test.tsx
src/components/admin/tunnel-control-panel.test.tsx
src/components/auth/auth-provider.test.tsx
src/components/immersive/site-info-menu.test.tsx
src/components/immersive/story-progress-bar.test.tsx
src/components/immersive/story-viewer.test.tsx
src/components/immersive/suggest-place-dialog.test.tsx
src/components/immersive/toolbar-overflow-menu.test.tsx
src/config/elevenlabs-agents.test.ts
src/config/location.test.ts
src/hooks/use-feature-flags.test.ts
src/hooks/use-stories.test.ts
src/hooks/use-stream-chat.test.ts
src/lib/claude.test.ts
src/lib/subscription-optimizer.test.ts
src/lib/translate-story.test.ts
```

No new migrations since documentation update.

## Documentation Gaps Analysis

### Feature Flags — All Documented

All 16 feature flags flagged by the gap detection script are already documented in `docs/project/features.md` (Feature Flags Reference, lines 660-717). The gap detection was checking against CLAUDE.md rather than features.md.

| Flag | Documented In |
|------|---------------|
| `ambient_discovery` | features.md — Experience Flags |
| `asturianu_touches` | features.md — Experience Flags |
| `autoplay_button` | features.md — Experience Flags |
| `booking_system` | features.md — Voice Flags |
| `contextual_prompts` | features.md — Discovery Flags |
| `fullscreen_button` | features.md — Experience Flags |
| `maintenance_mode` | features.md — System Flags |
| `mood_discovery` | features.md — Discovery Flags |
| `randomized_order` | features.md — Discovery Flags |
| `related_stories` | features.md — Discovery Flags |
| `seasonal_surfacing` | features.md — Discovery Flags |
| `sms_booking_confirmation` | features.md — Voice Flags |
| `story_freshness` | features.md — Discovery Flags |
| `story_sharing` | features.md — Social Flags |
| `surprise_me` | features.md — Discovery Flags |
| `user_story_suggestions` | features.md — Social Flags |

### API Routes — Internal, No Documentation Needed

All 49 API routes flagged are internal endpoints consumed by the admin panel, cron system, or external webhooks. Key routes that serve external consumers (webhooks, MCP tools, health) are already documented in `docs/project/features.md`:

- **Webhooks** (4 endpoints): Documented in features.md Infrastructure section (lines 624-629)
- **MCP tools** (3 endpoints): Documented in features.md Voice section (lines 128-132)
- **Health** (`/api/health`): Documented in features.md Infrastructure section (line 590)
- **Admin routes** (30 endpoints): Internal admin panel CRUD — not for external consumption
- **Cron routes** (3 endpoints): Internal Vercel Cron triggers
- **Checkout routes** (3 endpoints): Internal Stripe checkout flow

## Changes Made This Run (2026-03-23)

- **No feature flag updates needed** — all 16 flagged items were already documented in `docs/project/features.md`
- **No API route documentation added** — all flagged routes are internal; externally-consumed routes (webhooks, MCP, health) are already documented
- **Updated this report** with detailed gap resolution analysis
- **Recommendation**: Update the gap detection script to check `docs/project/features.md` in addition to `CLAUDE.md` to avoid false positives

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-03-21 |
| README.md | 2026-02-16 |

## Cross-Agent Recommendations

- **Coverage Agent**: No documentation-related coverage concerns.
- **Security Agent**: No sensitive information in documentation. No changes needed.
- **QA Agent**: Gap detection script produces false positives for feature flags — it checks CLAUDE.md but flags are documented in features.md. Consider fixing the script.
- **Performance Agent**: No documentation-related performance concerns.
- **Code Quality Agent**: The documentation gap detection script (`scripts/documentation-agent.sh` or related) should be updated to also scan `docs/project/features.md` for feature flag documentation.
- **Cost Analyst Agent**: No cost-related documentation concerns.
- **Localization Agent**: No localization-related documentation concerns.

---

*Report generated by Documentation Agent*
