# Documentation Freshness Report
> Auto-generated on 2026-08-27 06:00:05

## Status

**GREEN** — No documentation gaps. All feature flags documented, all routes classified as internal (no public documentation needed).

## Changes Made This Run

- Reviewed 58 API routes from gaps file against source code
- Confirmed all routes are internal-only (admin, cron, webhooks, MCP, health, access checks)
- Verified Feature Flags Reference table in `docs/project/features.md` is complete (17 visitor/admin flags + 10 agent flags)
- Updated route classification section with summary of findings
- No feature flags added to documentation (UNDOCUMENTED_FEATURE_FLAGS section was empty)
- No new API documentation additions (all routes correctly classified as internal per policy)

## CLAUDE.md Status

Last modified: **2026-08-19**

## Files Modified Since Documentation Update

These source files have been modified since CLAUDE.md was last updated and may need documentation updates.

### Source Files (src/)

```
src/app/api/admin/costs-analytics/route.test.ts
src/app/api/admin/costs-analytics/route.ts
src/app/api/admin/elevenlabs-analytics/route.test.ts
src/app/api/admin/elevenlabs-analytics/route.ts
src/app/api/admin/marketing/agent-logs/route.test.ts
src/app/api/admin/marketing/agent-logs/route.ts
src/app/api/admin/suggestions/route.test.ts
src/app/api/admin/suggestions/route.ts
src/app/api/admin/voice-session/route.test.ts
src/app/api/admin/voice-session/route.ts
src/app/api/chat/stream/route.test.ts
src/app/api/chat/stream/route.ts
src/app/api/cron/elevenlabs-voice-canary/route.test.ts
src/app/api/cron/elevenlabs-voice-canary/route.ts
src/app/api/cron/retry-booking-sms/route.test.ts
src/app/api/cron/retry-booking-sms/route.ts
src/app/api/feature-flags/route.ts
src/app/api/health/route.test.ts
src/app/api/health/route.ts
src/app/api/health/voice/route.test.ts
src/app/api/health/voice/route.ts
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
src/config/agent-prompts.test.ts
src/config/agent-prompts.ts
src/config/elevenlabs-owned-agents.ts
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
src/lib/costs/elevenlabs-costs.test.ts
src/lib/costs/elevenlabs-costs.ts
src/lib/costs/twilio-costs.ts
src/lib/cron-auth.ts
src/lib/elevenlabs-credentials.test.ts
src/lib/elevenlabs-credentials.ts
src/lib/elevenlabs-observability.test.ts
src/lib/elevenlabs-observability.ts
src/lib/elevenlabs-signed-session.test.ts
src/lib/elevenlabs-signed-session.ts
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
src/lib/logger-sanitize.test.ts
src/lib/logger-sanitize.ts
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
src/lib/services/elevenlabs-call-service.test.ts
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
scripts/coverage-workflow.test.ts
scripts/elevenlabs-scoped-ops.test.ts
scripts/elevenlabs-scoped-ops.ts
scripts/generate-locale-coverage.ts
scripts/performance-agent.sh
scripts/qa-agent.sh
scripts/qa-llm-quality-helpers.test.ts
scripts/release/analyze-release-run.test.ts
scripts/release/analyze-release-run.ts
scripts/release/check-elevenlabs-voice-preflight.test.ts
scripts/release/required-probes.test.ts
scripts/release/required-probes.ts
scripts/report-coverage.sh
scripts/setup-elevenlabs-agents.ts
```

## Documentation Gaps

### Route Classification Summary

**58 API routes reviewed** — all confirmed internal (admin APIs, cron endpoints, webhooks, MCP voice-agent tools, internal health probes, client-side access checks). Per CLAUDE.md policy, internal routes do not require public documentation.

**Routes verified as internal:**
- Admin routes (`/api/admin/*`) — server-only, require `role='admin'` via RLS
- Cron routes (`/api/cron/*`) — scheduled jobs, protected by cron-auth
- Webhook routes (`/api/webhooks/*`) — signature-verified inbound integrations
- MCP routes (`/api/mcp/*`) — ElevenLabs voice agent tools, exposed via closed `/immersive` interface
- Health routes (`/api/health/*`) — internal diagnostics and monitoring
- Internal access routes (`/api/voice-access`, `/api/voice-session`) — client-side feature checks

**Result:** No external-consumption API routes identified. Zero documentation additions needed.

## Documentation File Ages

| File | Last Modified |
|------|--------------|
| docs/health-report-2026-02-16.md | 2026-02-16 |
| CLAUDE.md | 2026-08-19 |
| README.md | 2026-07-28 |

---

*Report generated by Documentation Agent*
