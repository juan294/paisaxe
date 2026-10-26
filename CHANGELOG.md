# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.11.0] - 2026-10-26

### Fixed
- Voice-access lookup failures now offer recovery instead of treating an unknown entitlement as a reason to purchase. Checkout return pages confirm activation only after access is verified, preserve return-story navigation while pending, and use tier-neutral wording in all six locales. Signed-out visitors can sign in from the return page; failed sign-in attempts show a retryable error.
- Hidden story information can be restored on touch screens, and hidden controls no longer receive keyboard focus. Chat loading and error states can be closed without reloading the page, with focus restored to the trigger.
- Refund replay and the existing reconciliation path complete booking updates left behind by partial failures, while preserving duplicate-capture handling and notification idempotency.
- ElevenLabs webhook lookup failures now return a retryable error when the booking outcome could not be stored.
- Booking-tool timeouts stop dependent tool calls and disclose uncertain outcomes. Late quote writes cannot supersede a newer unaccepted offer.
- Marketing agents read actual scheduled posts through the existing admin boundary, count active stories correctly, and report unavailable context instead of silently omitting it.
- Test compilation and browser assertions now preserve the intended access states and wait for story navigation to hydrate before keyboard interaction.
- The local test transport creates its control socket with private permissions immediately, preventing intermittent startup rejection. Database delivery tests reuse the validated SQL session helper. Existing CI test counts and protected source pins now match the added integration cases.

### Changed
- The canonical outbound-booking tool supplies a per-booking idempotency token. The route accepts the validated body token alongside existing header clients and rejects conflicting tokens.
- Includes the separately reviewed Sutura v0.4.0 action pin already integrated into the repository. This release introduces no CI routing or release-process changes.

### Release scope and migration notes
- No new database migration or dependency upgrade is introduced.
- The canonical ElevenLabs tool configuration is checked in; deploying this web release does not publish that provider configuration. Live provider behavior remains unmeasured until a separately authorized provider update and verification.
- A tool timeout does not prove that an already-issued database or provider operation was cancelled. Existing payment and invoice idempotency remains in effect.

## [1.10.0] - 2026-10-25

### Added
- Explicit lifecycle for local database contract stacks: `contracts:oneshot`, `contracts:finish` and `contracts:lifecycle` (inspect, hold, sweep), with ownership receipts and checked disposal. Native catalog probes are bounded and keep their transport diagnostics.
- Workflows use Sutura's automatic routing planner (`.github/sutura-routing.json`): workflow changes and release pull requests select full verification. Hosted activation of the protected controls is coordinated in Sutura and is not part of this release.

### Changed
- The booking chat shows only the model's answer. Text the model writes before a tool call, such as announcing that it will search, no longer reaches the visitor, so the reply now appears when the model finishes instead of word by word (#1037). A call that fails partway shows no partial text; a failure before anything reached the visitor is retried once. The idle timeout resets while the model writes, so a long answer no longer ends in `response_timeout` (#1045).
- Sentry moves to 11 (`@sentry/nextjs` and `@sentry/core` ^11.8.0). One shared init configuration pins the v10 data-collection defaults for the client, server and edge runtimes, and capability-link redaction covers events, spans and the trace context (#1033).
- Dependency updates (#1022 to #1024). Stripe 23 / stripe-js 10 stays held in Dependabot until its planned migration (#1034). CI uses `supabase/setup-cli@v3`.
- The `booking-gate-closed` release probe also checks the operator route (#1015).

### Fixed
- The admin Features tab lists `experience_booking` in a new Booking category, so the flag can be switched from the panel (#1036).
- PayPal's `PAYMENT.CAPTURE.REFUNDED` event for a refund the app made is recorded as a confirmation, not logged as an out-of-order warning (#1038).
- Migration 131 converges the fresh-reset and 1.9.0 production shapes of `pending_bookings`. Legacy rows without a request key keep it empty and are held from retention; a trigger requires the key on every new row (#1032).
- Story photos: each story shows its own file again, and the Asturian cheese photo is restored.
- The 1.5 s auth verification deadline starts after the browser auth client loads, so a slow first load no longer reports `Auth verification timeout` (#1025).
- Code scanning findings: PayPal webhook event types no longer resolve to inherited object properties, the replay template pattern runs in linear time, the agents summary strips nested HTML comments, and the keep-alive Edge Function no longer returns its internal error text (deployed separately, see below).
- Scheduled agents log why a report was rejected and keep the rejected output. The coverage agent measures without the local Supabase stack, as hosted CI does. The QA agent reports a failed production build, with a hint when the build hits the V8 heap limit, and judges live-weather answers clause by clause (#1014).
- The nightly production license check and its failure reporting work again.

### Security
- Next.js 16.4.2 (Image Optimization and `use cache` remote code execution, Server Actions denial of service). Production received it as a hotfix on 2026-10-22 (#1043); this release carries it to `develop`'s line.
- Sentry session user data is scrubbed before transport.
- `undici` 7.30.1, `zod` 4.6.6 and `vite` 8.3.5 clear the current npm audit advisories.
- `postcss-selector-parser` is pinned to 7.1.6 under `@tailwindcss/typography` (Dependabot alert #138; the built CSS is unchanged).
- The ci-cadence full workflows no longer use the setup-node dependency cache (code scanning cache-poisoning alerts 1 to 16).

### Release scope and migration notes
- Includes migration 131 (`legacy_request_key_retention_hold`). Apply it to production in a transaction (`supabase db push`, so its `SET LOCAL lock_timeout` takes effect) and verify the converged `pending_bookings` shape before the release pull request merges.
- The keep-alive change is a Supabase Edge Function. Merging does not deploy it; it needs a separately authorized `supabase functions deploy keep-alive`.
- Booking retention scheduling stays inactive; migration 131 runs no redaction.

## [1.9.0] - 2026-10-14

### Added
- Structured image provenance and owner review, a disclosed illustration fallback, and authored-content source and overlap validation tools.
- PayPal Transaction Search in the operator panel, using the official PayPal Server SDK.
- Isolated database contract verification and recorded provider adapter replay fixtures.

### Changed
- Consolidated client caches with identity-scoped invalidation, checked indexed access, and stricter admin and tooling contracts.
- Refined booking cards, voucher and payment-return pages, operator presentation, locale handling, keyboard navigation and legal-footer access.
- Bound retrieval and reranking work; require supplied evidence in guide responses and more conservative driving, snow and allergy advice.
- Retired the release-PR Vercel Preview exception; release artifact verification runs in GitHub Actions.

### Fixed
- Admin catalog totals, approval filtering and photo curation behavior.
- Real Stripe checkout verification now uses an owned local database and rejects live-mode keys and unsafe direct test invocations.
- Stripe entitlement lifecycle and paid voice access boundaries.
- Request authentication, local-operation isolation, database privileges and booking retention boundaries.
- Frontend performance, shared palette consistency and CI coverage evidence handling.

### Release scope and migration notes
- Release scope is the 71 owner-approved stories. The owner closed further answer-quality rechecking and full replacement-knowledge completion for this release; historical failed diagnostics remain recorded and no full replacement corpus is promoted by this release.
- Includes migrations 127–130 for database boundaries, booking retention, Stripe entitlements and authored content. Deployment must verify remote migration posture before affected features are used.
- Existing photo credits require the separately authorized structured owner-review batch after provenance-aware code is deployed; unchanged uploaded images and original credits are preserved.

## [1.8.0] - 2026-10-07

### Added
- Conversational booking of local experiences with a PayPal sandbox deposit, behind the `experience_booking` flag (off in production until enabled): booking domain with quotes, holds and capacity (migrations 112-126); voucher access gate with guest sessions and metering; tool-calling booking chat; PayPal order, approval, capture, webhook and reconciliation cron; cancellation with refund; operator view; balance invoice through PayPal Invoicing; phone-confirmation stretch (authorize, call, capture or void); Zapier notification on confirmed and refunded; Postman collection and local runner.
- Release probes `booking-gate-closed`, `booking-access-boundary` and `booking-roundtrip`; `Release artifact smoke` workflow and the CI cadence adapter (legacy routing).
- MIT license and a Hackathon section in the README.

### Changed
- Chat runs on Claude Sonnet 5.5 with low effort and room for thinking in every response cap.
- After "Accept offer" the server creates the payment order and shows the payment card itself.
- Booking assistant searches the catalog first, proposes only bookable experiences and answers in the visitor's language.
- Vercel builds no Preview for Dependabot or feature pull requests.
- `@tailwindcss/typography` is a dev dependency (build-time only).

### Fixed
- Booking replies cut off mid-word when thinking used up the 1,024-token cap.
- Story viewer and related stories no longer render an image without a source.
- Local development: the browser can reach the local Supabase (voucher sign-in).
- Release gate 6 no longer requires a postal code Stripe does not show for Spain; live-database tests have a 20 s budget.

## [1.7.0] - 2026-10-03

See the [v1.7.0 release](https://github.com/juan294/paisaxe/releases/tag/v1.7.0).

## [1.6.0] - 2026-08-04

### Added

- Fail-closed E2E Pro release verification: deployed build identity and
  tree-hash readback, a declared release-required probe set, candidate-bound
  evidence, an authenticated local-datastore oracle with a deterministic seed,
  and a release analyzer that rejects missing, stale, or mismatched proof.
- A single authoritative release checklist covering rehearsal, preview
  verification, production promotion, rollback, and tag-last publication.
- `retry-booking-sms` Vercel Cron job — retries failed SMS booking confirmations every 10 minutes (`/api/cron/retry-booking-sms`)
- Durable cron job locking via `cron_job_locks` DB table and `src/lib/cron-job-lock.ts` (`acquireCronJobLease` / `releaseCronJobLease` helpers backed by DB RPC)
- `/api/health` response now includes `rate_limit` field reporting backend status (`upstash`, `memory`, or `blocked`)
- `check-verification-coverage` CI gate — verifies TypeScript surfaces (scripts, e2e, edge) and live integration gate are wired in CI
- `prelaunch:live` npm script — real Stripe/Supabase E2E gate that fails (not skips) when credentials are absent
- `FeatureFlagsProvider` `enabled` prop for disabling background polling in SSR/test contexts
- ADR-0017: decision not to migrate client hooks to SWR/TanStack Query
- ADR-0018: Edge Runtime not feasible for chat stream endpoint
- Playwright E2E specs for voice-agent chat (`e2e/voice-agents.spec.ts`) and MCP tool endpoints (`e2e/mcp.spec.ts`)
- `require_live_gate` dispatch input for Stripe E2E workflow
- Preview smoke CI: Sentry DSN gate — fails if `sentry.status` is not `"configured"` on preview deployments
- DB migration 087: RLS + service-role-only access on sensitive operational tables (`booking_sms_jobs`, `elevenlabs_webhook_events`, `translate_webhook_events`, `stripe_webhook_events`, `marketing_accounts`)
- DB migration 088: `cron_job_locks` table and `try_acquire_cron_job_lock` / `release_cron_job_lock` DB functions for durable cron exclusion
- `PublicStory` / `PublicStoryRow` types and `PUBLIC_STORY_SELECT` constant — strips private fields (`sourcePdf`, `suggestionId`) from client-side cache
- `src/lib/chat-route-utils.ts` — shared `buildEnrichedChatMessage` and `buildRateLimitHeaders` helpers extracted from chat routes
- 30+ Spanish i18n keys added and diacritics corrected (`src/lib/i18n/es.ts`)
- Tiered pricing model: `src/lib/pricing.ts` (`PRICING_TIERS`, `buildCheckoutUrl`) — day/weekly/monthly passes sourced from one shared constant (UX-H2)
- `src/lib/supabase-admin.ts` — service-role admin client extracted from `supabase.ts` and guarded with `server-only` (AR-M1)
- Sentry `onRequestError` hook in `instrumentation.ts` — unhandled server-side route/RSC/server-action errors now reach Sentry (DO-H1)
- `SUPABASE_STORAGE_LIMIT_MB` env var for the `/api/health` storage-usage threshold (DO-L1)
- `lint:deps` npm script + CI step (`madge --circular`) guarding against circular dependencies (AR-S1)
- `docs/operations/pre-launch-security-checklist.md` — manual pre-launch security gates (Gitleaks history, dynamic auth-bypass probes) (SE-S1)
- ADR-0023: voice-chat lazy-load chunk-split intentionally deferred post-launch (PE-L1)
- Locale-coverage gating in the language switcher — locales below the translation-coverage threshold are gated (UX-M3)
- Branded global error and 404 pages (logo + brand accent) (UX-M4)
- Direct unit tests for `withChatStreamStageTiming` and `chat-route-utils`; authenticated happy-path checkout E2E assertion (QA-L1, QA-L2, QA-M2)

### Fixed

- Required CI checks can no longer pass vacuously when their test discovery,
  preview deployment, or probe execution produced no meaningful evidence.
- Bearer-authenticated favorites requests now propagate the validated token to
  PostgREST, so RLS evaluates the caller instead of an anonymous cookie client.
- Compatible dependency updates close the current production security
  advisories while preserving the existing Next.js release line.
- Voice-agent configuration uses the supported ElevenLabs Flash model and
  webhook admin-client construction now occurs only after authentication.
- Rate-limit production detection now uses `VERCEL_ENV === "production"` instead of `NODE_ENV` — fixes false 429s in CI and Vercel preview deployments
- `NEXT_PUBLIC_*` env getters use literal `process.env.X` access — fixes undefined values in client bundle caused by Turbopack dynamic bracket-notation inlining (#556)
- Auth provider: null-safe state updates + `deferInitialAuth` correctly defers loading state and calls `setIsLoading(false)` synchronously (#556)
- Checkout return URL: `returnTo` parameter is `encodeURIComponent`-encoded; `useSearchParams` wrapped in `<Suspense>` to prevent hydration errors
- Voice Purchase CTA: `returnTo` encoded; `signInWithGoogle(checkoutUrl)` ensures post-OAuth redirect lands at checkout
- SSRF hardening: admin image ingestion resolves DNS and rejects resolved private IP ranges (not just parse-time hostname check)
- Chat stream: per-stage timeouts (embedding 8s, search 5s, feature flag 2s) prevent indefinite hangs on slow upstream calls
- Search rerank: 2.5s timeout with fallback to top-N candidates if Voyage reranking times out
- Immersive deep-link guard keyed on `${slug}:${voice}` — allows re-triggering on genuine URL changes without repeating for filter-only re-renders
- Story progress bar replaced `<div role="progressbar">` with `<nav>` + `<button>` per segment for proper keyboard navigation
- Favorites page: mobile overlay always visible (not hover-only); focus-visible rings added to interactive elements
- `loading.tsx`, `error.tsx`, `not-found.tsx`: `role="status"`, `aria-live="polite"`, and focus-visible rings added
- Marketing credentials: `getDecryptedCredentials` now throws on plain-format credentials; `isPlainCredentials` type guard removed
- Health endpoint always returns HTTP 200 (was HTTP 503 on degraded state); degraded condition signalled in JSON body only
- Translate webhook removed session-scoped `pg_advisory_lock`; uses row-level lease claims exclusively (safe across pooled connections)
- MCP `make-booking` degrades gracefully when conversation ID cannot be persisted — returns 202 with `recovery_action` instead of 500
- Cron routes: unified dual-auth (`verifyVercelCron` + `verifyWebhookSecret`) across all handlers
- Health DB route: structured error logging; generic external error message (no Supabase error codes exposed publicly)
- `.env.example` comment for `NEXT_PUBLIC_SENTRY_DSN` fixed to prevent false positive in `check-env` script
- `voyageai` package pinned to `0.1.0` — v0.2.x ESM build is broken (CJS interop failure)
- QA harness: `Origin` header added to all HTTP requests; performance budget thresholds updated to match current Lighthouse scores
- Anthropic monthly cost estimate updated to $25/mo; billing URL corrected in recurring costs config
- Stripe webhook honours `purchase_type` — weekly/monthly passes grant the correct 7/30-day access (was always 24h) (BE-B1)
- Voice (ElevenLabs) session and microphone are torn down on chat unmount — no abandoned billable sessions or stuck mic indicator (FE-H1)
- Chat/voice surfaces show an actionable error on timeout/connection loss instead of a silent stalled spinner (FE-H2)
- Chat rate limiting: requests without a trusted forwarded IP no longer share one bucket — closes a self-DoS / billing-amplification path (BE-H1)
- Voice booking is no longer marked failed on an ElevenLabs timeout — the row is left recoverable for webhook/cron reconciliation (BE-H2)
- Upsell CTAs carry an explicit tier (or show a price range) instead of a hardcoded €1.99 that bypassed tier selection (UX-H2)
- Hero and related-story images use meaningful `alt` text instead of `alt=""` (UX-M5)
- SMS-completion RPC retries after a successful send to prevent duplicate confirmation SMS (BE-M2)
- SSE reader lock released on abort/error; chat-list rows memoized and auto-scroll guarded; 20-turn cap enforced client-side (FE-M2, FE-M3)
- Cron auth fallback to an admin session is now logged (`[CRON_AUTH_FALLBACK]`) (BE-M1)
- `favoritesPostSchema` bounded to 200 ids; Stripe webhook grant RPC wrapped in a 10s timeout (BE-L1, BE-L2)
- Removed the artificial 300ms favorites loading delay (UX-L2)
- `/api/health` degrades overall status in production when cron auth is misconfigured (still HTTP 200) (DO-L2)
- Removed unused `ChatRequest` export; `subscription-optimizer` writes its context file atomically (AR-L1, BE-M4)

### Changed

- The default Claude model moves to Sonnet 5, and routine production,
  development, and GitHub Action dependencies are refreshed.
- `npm run typecheck` now runs 4 sub-commands: `typecheck:app`, `typecheck:scripts`, `typecheck:e2e`, `typecheck:edge`
- `npm run lint` now includes `lint:scripts` sub-command
- `npm run check-migrations` is now an npm script (replaces inline `npx tsx scripts/check-migrations.ts` in CI)
- Stories localStorage cache stores `PublicStory[]` (excludes `sourcePdf` and `suggestionId` from client-side cache)
- Upptime monitor for liveness uses `/api/health/live`; `/api/health` is used for diagnostics and release gates
- Single brand accent (green `#22c55e`) tokenized via `--primary`; conversion surfaces use the token instead of raw `green-*` literals (UX-H1, UX-S1)
- Mobile immersive controls: ambient/autoplay promoted to a visible affordance; navigation tap zones changed to a symmetric 50/50 split (UX-M1, UX-M2)
- Context provider values (`auth`, `feature-flags`, `stories`) memoized; PostHog analytics init deferred to browser idle (FE-M1, PE-M3)
- Proxy skips CSP-header and CSRF-cookie decoration on `/api/*` responses (CSRF validation is still enforced on mutating requests) (PE-M2)
- `feature-flags` route selects only the columns it returns instead of `select("*")` (PE-L2)
- `develop-smoke` CI surfaces failed/timed-out preview deploys via warning annotations + a job summary (DO-M2)
- Component memoization for heavy immersive presentational children; lazy `useRef` seed instead of per-render `Math.random()` (FE-L1, FE-L2)

### Security

- Service-role admin client and the `costs` barrel are marked `server-only`, making the secret boundary compiler-enforced (AR-M1, AR-M2)
- MCP Places egress and the CSP `'unsafe-inline'` PPR tradeoff documented with their compensating controls; pre-launch security checklist added (SE-L1, SE-L2, SE-S1)

## [1.5.1] - 2026-05-01

Single-bug-fix patch release. Restores the author-pill typewriter animation
on the immersive page.

### Fixed

- Author-pill typewriter cycle no longer resets on every parent re-render. The
  `useEffect` previously listed `t` (the i18n function) as a dependency, but
  `t` was a fresh function reference on every parent render — so the 30-second
  HOME_HOLD timer was being cancelled and restarted before it ever finished.
  The pill effectively stuck on "JG" forever and the rotating Spanish messages
  never appeared. Component now uses an empty deps array, hardcoded Spanish
  messages, and reads `prefers-reduced-motion` directly via `window.matchMedia`
  into a `useRef` (matches the chapa project's pattern).

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
