# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-05-01

Pre-launch audit remediation (Wave 1 + Wave 2). Security hardening, performance improvements,
observability, and refactoring across all layers. No new user-facing features — this release
makes the codebase production-ready.

### Added

- `/api/health/live` liveness endpoint — always returns 200; used by Upptime. `/api/health` repurposed as diagnostics (may return 503 on degraded state)
- `withAdminRead()` HOF in `admin-auth.ts` — cookie-scoped Supabase client that respects RLS for admin GET routes; mutations retain service-role `withAdmin`
- Honeypot spam mitigation on `POST /api/suggestions` — hidden `website` field; silent 200 on bot trigger; `[HONEYPOT_TRIGGERED]` structured log
- Structured `[CRON_SUCCESS]` / `[CRON_FAILURE]` telemetry (with `job` + `duration_ms`) on all 5 cron handlers
- Develop-push smoke CI job — probes `/api/health/live` and `/api/health` on Vercel preview after every push to `develop`
- `StoriesTabPanel` admin component with server-side pagination (`?storiesPage=N` URL-persisted)
- `StatCard` shared UI component extracted from admin shell
- `readSseStream` async utility (`src/hooks/use-sse-stream.ts`) — SSE buffer parsing extracted from `use-stream-chat`, now independently testable
- `glass` and `glassIcon` CVA Button variants — replaces 10+ inline glassmorphism class copies across immersive components
- Typed Supabase factory functions (`createTypedSupabaseClient`, `createTypedBrowserClient`) covering all 20 tables
- `CHAT_MODEL` constant in `src/lib/models.ts` — centralized model name reference
- 30-second in-process LRU role cache in admin auth (`user_id → role`) — eliminates two sequential Supabase round-trips per request
- Lazy singleton `getAdminClient()` for service-role Supabase client
- `stripe_webhook_events` audit trail with idempotent insert
- `amount_paid` column on `voice_purchases` table (migration 084)
- `voice-chat` sub-components: `chat-header`, `chat-message-list`, `chat-composer`, `chat-error-banner`, and `useChatMode` hook
- `[CRON_AUTH_REJECTED]` structured log with reason (`missing_secret` | `header_missing` | `mismatch`) in `verifyVercelCron`; `cron_auth` probe in `/api/health`

### Fixed

- **BE-B2** `grant_day_pass_idempotent` database function made atomic — EXCEPTION sub-block prevents partial commits locking users out (migration 084)
- **UX-B1** Mobile share URL corrected from `/stories/${id}` (404) to `/story/${slug || id}`
- **UX-B2** Hardcoded English strings on pricing, checkout, and voice pages localized across all 6 locales
- **UX-B3** Voice Pass amber/yellow gradients unified to green palette
- **UX-B4** `aria-modal="true"` added to voice-chat dialog; `aria-hidden` on background carousel
- Admin GET routes (`/api/admin/stories`, `/api/admin/github-analytics`) migrated to `withAdminRead` — RLS now enforced on reads
- Non-PGRST116 admin profile lookup errors now log `[ADMIN_PROFILE_LOOKUP_FAILED]` and return 500 instead of masking as 403
- `voice-chat.tsx` monolith reduced 428 → ~190 lines via component extraction
- `admin-shell.tsx` monolith reduced 801 → 253 lines via `StoriesTabPanel` + `StatCard` extraction
- `AuthProvider` always mounted — `deferInitialAuth` prop set by pathname instead of conditionally unmounting, preventing full tree remount on navigation
- PostHog provider tree stabilized to prevent reshape on dynamic import init
- Voice-chat prefetch gated behind feature flag and hover intent
- `useMediaQuery` caches `window.matchMedia` result across renders

### Security

- **SE-M3** Admin read paths use cookie-scoped Supabase client (RLS-aware); mutations retain service-role
- npm overrides for postcss/uuid CVEs; checkout open redirect closed; admin image SSRF hardened
- CSRF double-submit and allowlist validation strengthened
- Honeypot on public suggestion endpoint
- ESLint `console.*` ignore-list fully removed — all 25 previously-exempted API routes now enforced
- Stripe `apiVersion` pinned to `2026-04-22.dahlia` — future SDK bumps won't silently change API behavior
- Bearer-over-session-cookie precedence covered by test

### Performance

- **PE-H1** pgvector index switched from IVFFlat to HNSW with `ef_search` session parameter (migration 086) — lower latency at high recall
- **PE-H2** Embedding cache promoted from in-process LRU to Upstash Redis (24h TTL, graceful in-memory fallback when Redis unavailable)
- **PE-H3** `rerankChunks` + `getRelatedImages` parallelized via `Promise.all`
- **PE-H4** Anthropic SDK dynamic import hoisted to module level — eliminates per-request import overhead on chat hot path
- Chat embedding lookup and feature flag fetch now run in parallel

### Changed

- Admin stories panel is server-side paginated — no longer loads all stories into memory
- `useFeatureFlags()` and `useStories()` now throw when called outside their providers (was silent stale data)
- Mic permission deferred to user click on voice chat orb (was requested on mount)
- All API routes now use Pino structured logger; `console.*` removed from API layer entirely

### Removed

- Dead UI components: `auth-button.tsx`, `favorite-button.tsx`, `skeleton-story-detail.tsx`, `story-filters.tsx`
- `agentConfigUpdateSchema` export from `src/lib/schemas.ts` (was unused)
- `ADMIN_SECRET_KEY` from `.env.example` (stale reference)
- Empty `src/services/.gitkeep` placeholder
- `preserveSymlinks: true` from `tsconfig.json`
- ESLint 25-file `console.*` ignore-list (all migrated to structured logger)

### Testing

- Test suite: 6,059 → **6,347 tests** (332 → 341 files)
- New integration tests for data pipeline scripts (`process-pdfs`, `seed-database`, `sync-translation-status`)
- All Playwright `waitForTimeout` calls replaced with event-driven waits
- E2E Stripe integration workflow added to CI

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

## [1.3.0] - 2026-04-20

Security hardening (audit remediation phases 1–10), content pipeline additions, and proxy
architecture decomposition.

## [1.2.0] - 2026-02-03

Asturian language support and UI improvements.

## [1.1.0] - 2026-01-31

Stripe payments, voice booking agent, and admin dashboard expansion.

## [1.0.0] - 2026-01-31

Initial production release.
