# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-04-26

Pre-launch remediation sprint. All Wave 1 (launch-blocking) and Wave 2 (post-launch high/medium)
pre-launch audit findings resolved. 44 E2E failures cleared, booking persistence repaired,
admin routes hardened with Zod validation and audit logging.

### Added

- Embedded Stripe checkout replacing hosted checkout (no redirect, better UX)
- Request correlation IDs for distributed tracing across logs, Sentry, and response headers
- Resend email integration for transactional email delivery
- Content discovery agent for automatic attraction/place discovery
- Subscription optimizer agent for weekly cost analysis
- Author attribution pill with typewriter animation on story cards
- About, Privacy, and Terms pages with full 6-language i18n support
- Site footer with legal links and content attribution
- Visual regression testing via Playwright screenshot comparisons
- GitHub traffic analytics dashboard in admin panel
- Component-level `ErrorBoundary` for graceful error isolation
- Mobile navigation improvements: 30/70 left/right tap zones, first-visit navigation hint
- Approve All bulk action for stories moderation
- Return-to-story flow after voice day-pass payment
- Pricing loading skeleton
- GitHub social link on author pill

### Fixed

**Security & Admin**
- Admin routes now validate all mutation input via Zod schemas
- Audit logging added to all admin write routes (`[ADMIN_AUDIT]` structured log)
- Rate limiter uses `x-vercel-forwarded-for` (non-spoofable) as primary IP source; logs `[RATE_LIMIT_DEGRADED]` on Redis fallback
- Static pages (`/about`, `/privacy`, `/terms`) skip auth bootstrap
- Open redirect in proxy patched; CSP tightened with XSS canary E2E test
- ElevenLabs MCP tool endpoints require `x-mcp-secret` header
- Post-audit env trimming, CSRF origin check, HSTS skipped in development

**Booking & Voice**
- Booking persistence repaired against live Supabase schema (Wave 1 blocker)
- SMS outbox table added for durable booking SMS delivery with automatic retry
- Idempotency propagated through webhook and booking pipelines
- ElevenLabs webhook signature verification aligned with SDK format
- ElevenLabs webhook transcript parsing handles both array and string formats
- Server-side voice agent authentication; anonymous user UX normalized

**Chat & AI**
- Chat first-token latency reduced by parallelizing independent pre-stream steps
- Stream aborts propagate cleanly through SSE pipeline
- `voyageai` pinned to `0.1.0` (v0.2.x ESM build broke `/api/chat` route)
- Turbopack `resolveAlias` added to force voyageai CJS build in local dev

**Health & Observability**
- Health endpoint returns 503 on degraded state instead of 200
- Health payload split into public/privileged views
- Sensitive server errors routed through structured logger
- Logger sanitization isolated from Edge runtime
- Sentry PII handling hardened; Replay integrations removed to eliminate PII capture

**Performance**
- Story hero images compressed ~14 MB → ~6 MB
- Admin analytics consolidated to HogQL batch queries
- Bundle quick wins landed (deferred imports, tree-shaking)
- PostHog upgraded to resolve protobufjs/dompurify CVEs

**DevOps & CI**
- Migration numbering validator (`scripts/check-migrations.ts`) runs on every CI push
- Env scanner (`scripts/check-env.ts`) extended to cover `scripts/` directory
- Runbooks aligned with 503-on-degraded health behavior
- Preview smoke test updated for new required CI check
- Dependabot pinned to `develop` branch

**UX & i18n**
- Locale diacritics corrected across fr/de/pt/es translations
- Keyboard navigation for language switcher; aria-labels, aria-pressed, aria-busy improvements
- Color contrast and accessible disabled button states
- Keyboard hints hidden on iPad/tablet touch devices
- Pricing heading responsive scaling

**E2E**
- All 44 E2E failures resolved across public paths, booking flows, and admin flows
- Playwright CI retries added to absorb transient network flakes

### Changed

- `/api/health` public payload trimmed; full diagnostic payload requires admin auth
- Rate limiting degrades gracefully to in-memory when Redis is unavailable (logged, not thrown)
- `useStories` localStorage bootstrap moved to `useEffect` (removed sync render-time call)
- Anonymous favorites state normalized to single model
- `favorites/page.tsx` uses `requiresAuth` from `useFavorites` hook directly

## [1.3.0] - 2026-04-XX

Security hardening (audit remediation phases 1–10), content pipeline additions, and proxy
architecture decomposition.

## [1.2.0] - 2026-02-XX

Asturian language support and UI improvements.

## [1.1.0] - 2026-02-XX

Stripe payments, voice booking agent, and admin dashboard expansion.

## [1.0.0] - 2026-02-XX

Initial production release.
