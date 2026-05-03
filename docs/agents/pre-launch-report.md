# Pre-Launch Codebase Audit
> Generated on 2026-05-03 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

## 1. Executive Summary

Paisaxe has a serious engineering foundation: modern Next.js App Router, broad route-level tests, structured operational docs, and mature patterns around webhooks, queues, health checks, and feature flags. The current launch posture is still not acceptable. The audit found one launch-blocking security issue, multiple high-severity before-launch reliability and observability risks, and several conversion/accessibility defects that directly affect the visitor and admin workflows. The green local unit suite is valuable, but it does not cover enough of the production integration, database privilege, migration-apply, or recovery surfaces to justify a public launch today.

**Top 3 strengths:**
- The core local verification gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` passed; Vitest reported 349 files and 6421 tests passing.
- The codebase already has structured separation for many launch concerns: proxy pipeline, health endpoints, cron routes, webhook idempotency RPCs, feature flags, and route-specific test files.
- The architecture is well documented for its stage, including RPI workflow, production safety rules, migration policy, branch protection docs, and operational runbooks.

**Top 5 risks:**
- `SE-B1`: inherited Supabase default grants appear to expose post-070 operational tables, including `booking_sms_jobs` PII, to anon/authenticated roles.
- `BE-H1`: multiple cron/webhook workers still use session-scoped advisory locks across pooled RPC calls, despite an existing migration documenting that pattern as unsafe.
- `BE-H2` / `QA-H1`: SMS outbox failures are recorded but have no autonomous retry worker after the webhook is acknowledged.
- `DO-H1`: production error tracking can be silently disabled while `/api/health` and preview smoke checks still pass.
- `UX-H4`: anonymous paid voice purchase/sign-in can drop the user's checkout/story intent and send them back to the wrong point in the funnel.

**Verdict: NOT READY**. The launch-blocker `SE-B1` is sufficient on its own under the command threshold. Even if that is cleared, the product remains conditional until the high-severity before-launch issues around job locking, SMS recovery, observability gating, migration validation, startup latency, conversion continuity, and accessibility are resolved or explicitly accepted.

## 2. System Architecture Overview

Paisaxe is a Next.js 16 App Router application deployed from `main`, with development on `develop`. Public routes are centered on `/immersive`, story redirects under `/story/[slug]`, favorites, pricing/checkout, legal/about pages, and voice/chat entry points. Server-side behavior sits under `src/app/api`, with browser-facing chat/favorites/suggestions/checkout routes, admin CRUD/analytics routes, cron jobs, MCP tool routes, and webhooks for Stripe, ElevenLabs, Supabase, and translation.

The main runtime flow for chat is: client chat UI -> `/api/chat/stream` -> validation/rate limit/safety -> Voyage embeddings -> Supabase vector search/RPC -> Voyage rerank -> Anthropic streaming response. The main voice booking flow is: MCP booking route -> pending booking claim -> ElevenLabs outbound call -> webhook outcome -> SMS job. Admin workflows route through Supabase auth/RBAC and route-local database operations.

The application has a broad `src/lib` integration layer for Supabase, Anthropic, Voyage, Stripe, Twilio, PostHog, feature flags, proxy behavior, logging, and operational utilities. Supabase migrations define the persistent state for stories, suggestions, feature flags, pending bookings, booking SMS jobs, webhook idempotency tables, translation leases, and cost/analytics tables.

Systemic concerns are concentrated in four areas: database contract drift across TypeScript/Zod/Postgres, route handlers that still act as service layers, production readiness gates that check naming or health shape but not actual deployment invariants, and client startup surfaces that do global auth/flag work on public pages.

## 3. End-to-End Flow Analysis

**Immersive discovery:** `/` redirects into `/immersive`, which streams story data and feature flags into a client story viewer. Runtime feature flags hide optional tools, but several optional controls are still statically imported into the story viewer module graph. The full story catalog is fetched, hydrated, and persisted to localStorage, creating payload and memory growth risk as content expands.

**Chat:** `/api/chat/stream` waits for several third-party stages before the first SSE byte: Upstash rate limiting, Voyage embedding, Supabase search, Voyage rerank, image lookup, feature flags, and Anthropic orchestration. Several stages do not have explicit route-level timeout/fallback budgets.

**Voice booking:** `/api/mcp/make-booking` creates pending booking state, calls ElevenLabs, persists the conversation id, then waits for an ElevenLabs webhook to complete the booking and SMS path. The audit found unrecovered partial failures around call initiation, conversation-id persistence, and SMS delivery retry.

**Payments/paid voice:** Pricing and checkout routes send anonymous users through Google sign-in, but `returnTo`/checkout/story intent is not preserved consistently. That makes the paid voice funnel fragile at the exact point a user has chosen to pay.

**Operations/release:** GitHub Actions cover lint/typecheck/test/build and several specialty workflows. Migrations are checked for naming/sequence, but not applied against a disposable database in CI. Health endpoints exist, but docs and monitoring contracts diverge from implementation, and production observability can be unconfigured while smoke checks stay green.

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model

The frontend is a Next.js 16 App Router surface with a server root layout mounting global client providers for PostHog, i18n, feature flags, auth, skip links, and language sync. Public traffic primarily routes through `/immersive`, where server story/flag data enters `ImmersivePageContent` and client state drives filtering, story index, mood selection, chat opening, favorites, and feature-gated controls. Admin is a client-rendered shell with auth/role gates, URL-driven tabs, dynamically imported panels, and panel-local state for CRUD, analytics, marketing, suggestions, and agents.

### Findings

#### FE-H1 Admin stories pagination loses the active tab and routes the user out of the stories panel
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/admin/admin-shell.tsx:89-100, src/components/admin/admin-shell.tsx:242-249, src/components/admin/stories-tab-panel.tsx:73-80, src/components/admin/stories-tab-panel.tsx:126-130
- **What's happening:** `AdminShell` treats `?tab=` as canonical and defaults to `analytics` when missing. `StoriesTabPanel` pushes `?storiesPage=${clamped}`, dropping `tab=stories`; the shell then switches back to analytics.
- **Why it matters:** Story curation pagination is a core admin workflow before launch. Losing the active panel makes review/edit operations brittle.
- **Recommendation:** Preserve existing query params when changing stories pagination and explicitly retain `tab=stories`; centralize admin query-param writes.
- **Expected impact:** Stable admin routing and fewer tab state-loss bugs.
- **Effort estimate:** S

#### FE-M1 Chat analytics use a PostHog React context that is not actually wrapping the chat subtree
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/posthog-provider.tsx:58-68, src/components/posthog-provider.tsx:116-126, src/components/immersive/voice-chat.tsx:15, src/components/immersive/voice-chat.tsx:71, src/components/immersive/voice-chat.tsx:156-163
- **What's happening:** The app-owned PostHog context exposes the real client, while `posthog-js/react`'s provider is rendered as a sibling with `null` children. `VoiceChat` calls `usePostHog` from `posthog-js/react`.
- **Why it matters:** Chat funnel analytics can silently depend on package fallback behavior instead of the initialized app client.
- **Recommendation:** Use the app-owned PostHog hook or wrap descendants with the `posthog-js/react` provider correctly.
- **Expected impact:** Reliable launch telemetry for chat interactions.
- **Effort estimate:** S

#### FE-M2 Global providers still perform auth and flag side effects on routes that are intended to defer them
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/layout.tsx:140-148, src/app/providers.tsx:15-39, src/components/auth/auth-provider.tsx:23-31, src/components/auth/auth-provider.tsx:37-73, src/hooks/use-feature-flags.ts:125-163
- **What's happening:** `deferInitialAuth` changes initial loading state but `AuthProvider` still initializes Supabase auth on mount. The root `FeatureFlagsProvider` also fetches `/api/feature-flags` when no server flags are supplied.
- **Why it matters:** Public/static pages pay global client work and network side effects even when auth/flags are not needed.
- **Recommendation:** Split providers by route need or make deferred auth actually lazy; seed or scope feature flags closer to flag-gated UI.
- **Expected impact:** Less startup JS/network work on public routes.
- **Effort estimate:** M

#### FE-M3 Query-param reads sit in broad client route shells instead of narrow Suspense islands
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/app/pricing/page.tsx:1-16, src/app/pricing/checkout/page.tsx:1-30, src/app/pricing/success/page.tsx:1-14, src/app/pricing/checkout/return/page.tsx:1-19, src/app/immersive/immersive-page-content.tsx:1-17, src/app/immersive/immersive-page-content.tsx:81, src/components/admin/admin-shell.tsx:15-17, src/components/admin/admin-shell.tsx:87-91
- **What's happening:** Several route-level client components call `useSearchParams()` directly, embedding query-param reads in large client shells.
- **Why it matters:** Query-param hooks can force larger hydration boundaries and reduce the value of PPR/static shells.
- **Recommendation:** Keep route files server-rendered where possible and wrap small query-param client children in Suspense.
- **Expected impact:** Smaller hydration islands and faster perceived loading on conversion routes.
- **Effort estimate:** M

#### FE-M4 Immersive deep-link handling is guarded by a one-shot boolean and can ignore later URL changes
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/immersive/immersive-page-content.tsx:69, src/app/immersive/immersive-page-content.tsx:149-164, src/app/favorites/page.tsx:219-222, src/app/pricing/success/page.tsx:66-68, src/app/pricing/checkout/return/page.tsx:70-72
- **What's happening:** `/immersive?story=...` is handled only while `deepLinkHandled.current` is false. Later changes to `story` or `voice` query params in the same mounted session are ignored.
- **Why it matters:** Favorites, share links, and payment return paths can diverge from the URL after client navigation.
- **Recommendation:** Track the last handled `{story, voice}` tuple or make the effect idempotent against current URL and story index.
- **Expected impact:** Reliable deep links and return behavior.
- **Effort estimate:** S

#### FE-M5 Runtime feature flags gate immersive tools after their code is already statically imported
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/components/immersive/story-viewer.tsx:8-33, src/components/immersive/story-viewer.tsx:278-289, src/components/immersive/story-viewer.tsx:366-390, src/components/immersive/story-viewer.tsx:392-458, src/app/immersive/immersive-page-content.tsx:20-28
- **What's happening:** `StoryViewer` statically imports optional controls and panels, then hides them with runtime flags.
- **Why it matters:** Public immersive traffic pays initial bundle cost for disabled or rarely used tools.
- **Recommendation:** Move heavier flag-gated tools into dynamic islands or lazy menu/panel boundaries.
- **Expected impact:** Smaller initial immersive bundle.
- **Effort estimate:** M

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model

Backend entry points are Next.js API routes under `src/app/api`: browser-facing chat/favorites/suggestions/checkout, admin CRUD/analytics, MCP routes, cron routes, and third-party webhooks. Persistence goes through Supabase from route handlers or service helpers, using cookie-scoped clients for user/RLS access and service-role clients for admin, webhook, cron, and background jobs. Durable workflow state lives in migrations for pending bookings, SMS jobs, webhook idempotency, translation leases, feature flags, stories, suggestions, and cost tables.

### Findings

#### BE-H1 Session-scoped advisory locks are still used through pooled RPC calls
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/cron/github-traffic-sync/route.ts:70-73, src/app/api/cron/github-traffic-sync/route.ts:211-212, src/app/api/cron/subscription-optimizer/route.ts:40-43, src/app/api/cron/subscription-optimizer/route.ts:125-126, src/app/api/cron/content-discovery/route.ts:44-47, src/app/api/cron/content-discovery/route.ts:80-81, src/app/api/webhooks/translate/route.ts:252-255, src/app/api/webhooks/translate/route.ts:407-411, supabase/migrations/081_fail_stale_story_translations_locked.sql:1-8
- **What's happening:** Several cron/webhook workers acquire `pg_try_advisory_lock` in one Supabase RPC and release with `pg_advisory_unlock` in a later RPC. Migration 081 documents that this pattern is unsafe with PostgREST/Supavisor transaction pooling.
- **Why it matters:** Locks can leak, fail to serialize intended jobs, or unlock on the wrong backend connection.
- **Recommendation:** Move each locked job into a single RPC using `pg_try_advisory_xact_lock`, with claim/work transition inside one transaction where possible.
- **Expected impact:** Reliable cron and translation worker serialization without pool-dependent lock behavior.
- **Effort estimate:** M

#### BE-H2 SMS outbox has no independent worker after webhook acknowledgement
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/elevenlabs/route.ts:529-533, src/app/api/webhooks/elevenlabs/route.ts:550-584, supabase/migrations/079_webhook_idempotency_rpcs.sql:29-46, supabase/migrations/079_webhook_idempotency_rpcs.sql:158-199, supabase/migrations/079_webhook_idempotency_rpcs.sql:237-255, vercel.json:4-24
- **What's happening:** Failed SMS sends are marked in `booking_sms_jobs` and the webhook returns HTTP 200. The queue has claim/fail/complete RPCs, but the only visible claimant is the same webhook request; `vercel.json` has no SMS retry cron.
- **Why it matters:** A transient Twilio/network failure can leave confirmation SMS delivery failed indefinitely after booking state is committed.
- **Recommendation:** Add a scheduled SMS worker that claims retryable `booking_sms_jobs`, sends via Twilio, and completes/fails with bounded attempts and alerting.
- **Expected impact:** Durable delivery semantics match the outbox design.
- **Effort estimate:** M

#### BE-M1 Failed ElevenLabs call initiation leaves booking idempotency claims stuck
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/make-booking/route.ts:372-391, src/app/api/mcp/make-booking/route.ts:434-495, src/app/api/cron/fail-stale-bookings/route.ts:19-27, supabase/migrations/053_pending_bookings.sql:23-29
- **What's happening:** The booking route inserts an `initiating` row before calling ElevenLabs. If `initiateCall` fails, the route returns 500 without marking the row failed.
- **Why it matters:** A transient upstream failure blocks retry by idempotency key until stale cleanup runs.
- **Recommendation:** On call-initiation failure, update the row to `failed` with an error reason or wrap claim/failure in an RPC.
- **Expected impact:** Immediate retry clarity and cleaner booking state.
- **Effort estimate:** S

#### BE-M2 Request validation is inconsistent for malformed JSON and dynamic IDs
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/favorites/route.ts:49-56, src/app/api/admin/stories/[id]/route.ts:19-24, src/app/api/admin/stories/[id]/route.ts:89-99, src/app/api/admin/stories/[id]/route.ts:133-137, src/app/api/admin/stories/bulk-status/route.ts:15-20, src/app/api/admin/stories/bulk-status/route.ts:79-84, src/app/api/mcp/make-booking/route.ts:269-283, src/app/api/mcp/make-booking/route.ts:497-506
- **What's happening:** Some routes parse JSON without a 400 parse-error path, and several dynamic params flow directly into UUID-backed filters.
- **Why it matters:** Bad input becomes noisy server errors and inconsistent API contracts.
- **Recommendation:** Add shared `readJsonBody` and `uuidParam` helpers and use Zod for params as well as bodies.
- **Expected impact:** Cleaner API behavior and lower operational noise.
- **Effort estimate:** M

#### BE-M3 Stripe webhook audit insert does not match the deployed table shape
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:59-68, src/app/api/webhooks/stripe/route.ts:70-82, supabase/migrations/077_stripe_webhook_events.sql:1-4, supabase/migrations/084_fix_grant_day_pass_atomicity.sql:55-58
- **What's happening:** The route inserts `stripe_event_id`, `event_type`, and `payload`, but the migration creates `stripe_webhook_events(event_id, created_at)`.
- **Why it matters:** Audit logging silently fails and route-level duplicate shortcut behavior does not work as intended.
- **Recommendation:** Migrate the table to the intended audit shape or rely on an expanded atomic RPC.
- **Expected impact:** Accurate webhook audit trail.
- **Effort estimate:** S

#### BE-M4 Story conversion from user suggestion is not atomic
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/admin/stories/route.ts:137-158, src/app/api/admin/stories/route.ts:168-186, supabase/migrations/028_story_suggestions.sql:5-15, supabase/migrations/028_story_suggestions.sql:63-68
- **What's happening:** Creating a story from a suggestion inserts the story and separately updates suggestion status. If the second write fails, the route logs and still returns success.
- **Why it matters:** Admin curation state and conversion metrics can diverge.
- **Recommendation:** Move story creation plus suggestion status update into one RPC/transaction.
- **Expected impact:** Consistent curation state.
- **Effort estimate:** M

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model

Paisaxe's performance boundary includes a global client provider shell, PPR primary experience at `/immersive`, dynamic API routes, Supabase, Upstash, Voyage, Anthropic, Google Places, OpenWeather, PostHog, Vercel Analytics, and ElevenLabs. Build completed successfully with Cache Components enabled; `/immersive`, `/coming-soon`, and `/story/[slug]` are Partial Prerendered. Runtime latency risk concentrates in client startup providers, story catalog hydration, chat retrieval/generation, and MCP tool endpoints.

### Findings

#### PE-H1 Public pages still do global auth and feature-flag startup work
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/providers.tsx:15-39, src/components/auth/auth-provider.tsx:23-31, src/components/auth/auth-provider.tsx:37-54, src/hooks/use-feature-flags.ts:91-123, src/hooks/use-feature-flags.ts:202-207, src/app/immersive/immersive-page-content.tsx:47-51
- **What's happening:** `deferInitialAuth` does not skip Supabase auth initialization, and root feature flags fetch without initial flags while `/immersive` mounts a nested seeded provider.
- **Why it matters:** Anonymous visits pay avoidable Supabase and flag API startup costs.
- **Recommendation:** Make deferred auth truly lazy and seed/scope flags to avoid duplicate requests.
- **Expected impact:** Better public TTI/p95 and lower Supabase load.
- **Effort estimate:** M

#### PE-H2 Chat streaming p99 is gated by unbounded third-party stages before first SSE byte
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/app/api/chat/stream/route.ts:118-145, src/app/api/chat/stream/route.ts:173-178, src/lib/embeddings.ts:28-38, src/lib/search.ts:83-105, src/lib/rerank.ts:27-55, src/lib/rate-limit.ts:120-125
- **What's happening:** The stream waits for multiple third-party calls before creating the SSE stream, and several calls lack explicit stage timeout/fallback deadlines.
- **Why it matters:** Slow Upstash, Voyage, Supabase, or rerank calls delay first token and tie up serverless execution.
- **Recommendation:** Add per-stage budgets, degradation paths, stage timings, and an early SSE status event after validation.
- **Expected impact:** Bounded chat p99 and faster perceived TTFT.
- **Effort estimate:** M

#### PE-M1 Immersive hydrates and persists an unbounded full story catalog
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/immersive/page.tsx:36-50, src/lib/stories-server.ts:42-53, src/types/immersive.ts:147-169, src/types/immersive.ts:172-193, src/hooks/use-stories.ts:93-103
- **What's happening:** `/immersive` fetches all approved active stories with `select=*`, maps full rows, passes the full array to the client, and persists it to localStorage.
- **Why it matters:** DB response size, RSC payload, hydration memory, and localStorage cost scale with story count.
- **Recommendation:** Introduce a slim public story list projection and fetch detail-only data on demand.
- **Expected impact:** Smaller payloads and lower browser memory/IO.
- **Effort estimate:** M

#### PE-M2 Story metadata generation does full-row N+1 database work for redirect pages
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/story/[slug]/page.tsx:13-22, src/app/story/[slug]/page.tsx:45-47, src/lib/stories-data.ts:27-40, src/lib/stories-data.ts:168-176
- **What's happening:** Static params and metadata fetch full story rows even though the page redirects to `/immersive?story=...`.
- **Why it matters:** Build and rendering work scale linearly with story count.
- **Recommendation:** Use a cached slim metadata query selecting only needed fields.
- **Expected impact:** Faster builds and less Supabase load.
- **Effort estimate:** S

#### PE-M3 MCP POST tool calls bypass the cache strategy used by equivalent GET routes
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/app/api/mcp/places/route.ts:236-245, src/app/api/mcp/places/route.ts:324-330, src/app/api/mcp/places/route.ts:337-392, src/app/api/mcp/weather/route.ts:104-105, src/app/api/mcp/weather/route.ts:169-175, src/app/api/mcp/weather/route.ts:187-236
- **What's happening:** Weather and Places GET responses set cache headers, but equivalent POST tool calls invoke third-party APIs uncached.
- **Why it matters:** Voice/tool integrations can increase latency, quota use, and cost.
- **Recommendation:** Add application-level cache keyed by normalized POST arguments with TTLs matching GET behavior.
- **Expected impact:** Lower API volume and faster repeated MCP calls.
- **Effort estimate:** M

#### PE-L1 Unused export checks have explicit blind spots in UI code
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** knip.json:3-15, knip.json:38-56
- **What's happening:** Knip reported no unused exports, but config ignores `src/components/ui/**`.
- **Why it matters:** The reusable UI layer can accumulate unused exports and bundle creep.
- **Recommendation:** Remove broad ignores or replace them with specific exceptions.
- **Expected impact:** Stronger dead-code prevention.
- **Effort estimate:** S

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model

Paisaxe deploys from `main` through Vercel, with production promotion controlled by `develop` -> `main` PRs. CI is GitHub Actions-based: core CI runs lint/typecheck, env-doc checks, migration numbering checks, tests, coverage, and build; separate workflows cover E2E, security, Lighthouse, bundle, and preview smoke. Observability spans Pino logs, optional Sentry, Vercel logs, PostHog/Vercel analytics, Upptime reference config, and Markdown runbooks.

### Findings

#### DO-H1 Production error tracking can be silently disabled while health and release gates still pass
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .env.example:115-119, sentry.server.config.ts:4-12, sentry.client.config.ts:4-12, src/app/api/health/route.ts:41-44, src/app/api/health/route.ts:185-190, .github/workflows/preview-smoke.yml:87-108
- **What's happening:** Sentry is marked required for production but initializes only when `NEXT_PUBLIC_SENTRY_DSN` exists. `/api/health` reports `sentry: "unconfigured"` but excludes that from overall status; preview smoke only checks 200 and `healthy`.
- **Why it matters:** Production can ship blind to runtime exceptions while gates remain green.
- **Recommendation:** Treat production Sentry DSN as a deployment prerequisite via health, smoke, or env safety check.
- **Expected impact:** Hard signal before shipping without error traces.
- **Effort estimate:** S

#### DO-H2 Database migrations are not applied in CI; only filenames are checked
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:59-63, scripts/check-migrations.ts:93-98, docs/operations/migration-policy.md:87-94, docs/operations/migration-policy.md:144-156
- **What's happening:** CI checks env docs and migration naming/sequence, but does not apply migrations against a disposable database.
- **Why it matters:** SQL syntax, ordering, grant, and schema drift failures can reach release undetected.
- **Recommendation:** Add a migration validation job with local Supabase reset and minimal post-migration smoke queries.
- **Expected impact:** Deterministic migration failures before release.
- **Effort estimate:** M

#### DO-M1 Health-check and monitoring runbooks contradict the implemented health contract
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/operations/operations.md:7-12, docs/operations/operations.md:120-127, src/app/api/health/route.ts:146-160, src/app/api/health/live/route.ts:22-35, .github/upptime/.upptimerc.yml:18-24
- **What's happening:** Docs say `/api/health/live` returns `{ "status": "ok" }` and `/api/health` returns HTTP 503 when degraded; code returns `{ "status": "live" }` for liveness and 200 from `/api/health` with body-based degradation.
- **Why it matters:** Incident responders and monitors can use the wrong contract.
- **Recommendation:** Update runbooks and alerting language to match current behavior.
- **Expected impact:** Less response confusion and fewer false assumptions.
- **Effort estimate:** S

#### DO-M2 Public database diagnostics endpoint exposes backend error detail
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/health/db/route.ts:11-24, src/app/api/health/db/route.ts:42-50, src/app/api/health/db/route.ts:60-70, src/lib/proxy/maintenance.ts:8-12
- **What's happening:** `/api/health/db` is public and returns Supabase error messages/codes/raw exception text; API routes bypass maintenance mode.
- **Why it matters:** Public diagnostics can leak dependency/schema/configuration clues.
- **Recommendation:** Restrict the endpoint, remove raw backend fields, or fold it into private diagnostics.
- **Expected impact:** Reduced operational information exposure.
- **Effort estimate:** S

#### DO-M3 Request IDs are generated but not bound into server log context
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/proxy.ts:14-17, src/proxy.ts:61-67, src/lib/logger.ts:61-64, src/lib/request-context.ts:59-69, src/lib/sentry-before-send.ts:43-48
- **What's happening:** Proxy forwards `x-request-id`, and logger can include `request_id`, but the request-context wrapper is not applied at the route boundary.
- **Why it matters:** Correlation across Vercel requests, app logs, and Sentry will be inconsistent.
- **Recommendation:** Add a route-handler wrapper that calls `withRequestContext(request, handler)`.
- **Expected impact:** Faster incident triage through consistent request correlation.
- **Effort estimate:** M

#### DO-M4 Production branch protection documentation conflicts on approval requirements
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** CLAUDE.md:74-78, docs/operations/branch-protection.md:3-12, docs/operations/branch-protection.md:15-24
- **What's happening:** `CLAUDE.md` says `main` requires 0 approvals, while branch-protection docs say 1 approval.
- **Why it matters:** Release operators and agents have contradictory production merge guidance.
- **Recommendation:** Align all release docs to the current verified policy.
- **Expected impact:** Clearer production release procedure.
- **Effort estimate:** S

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model

Security boundaries include Next.js API routes, `src/proxy.ts`, Supabase/Postgres migrations, service-role DB access, Supabase browser/session auth, admin RBAC, and third-party integrations for AI, payments, voice/SMS, maps/weather, rate limiting, analytics, and error capture. Public routes include chat, suggestions, feature flags, checkout, voice access, MCP tools, and webhooks. Admin routes use `validateAdminAuth()` plus CSRF proxy checks; server-to-server webhook/MCP/cron routes are CSRF-exempt and rely on signatures or shared secrets. `npm audit` returned 0 vulnerabilities.

### Findings

#### SE-B1 Default anon/authenticated SELECT grants expose post-070 operational tables with booking SMS PII
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/070_default_anon_privileges.sql:13-24, supabase/migrations/079_webhook_idempotency_rpcs.sql:29-42, supabase/migrations/077_stripe_webhook_events.sql:1-4
- **What's happening:** Migration 070 sets default privileges so future public tables get `SELECT` for `anon` and `authenticated`. Later migrations create `booking_sms_jobs` with phone/message/provider/error fields and `stripe_webhook_events` without visible RLS or revokes.
- **Why it matters:** Supabase anon keys are public. If these grants apply as written, unauthenticated clients can read booking SMS job rows containing customer phone numbers and message contents.
- **Recommendation:** Revoke `anon`/`authenticated` privileges on operational webhook/job tables, enable RLS with service-role-only policies where needed, and add a migration check for sensitive post-default-grant tables.
- **Expected impact:** Prevents public reads of webhook/job internals and booking PII.
- **Effort estimate:** M

#### SE-H1 Admin image URL ingestion still has SSRF bypass paths through redirects and DNS resolution
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/admin/stories/[id]/image/route.ts:20-52, src/app/api/admin/stories/[id]/image/route.ts:187-201, src/app/api/admin/stories/[id]/image/route.ts:208-236
- **What's happening:** Admin image ingestion checks the original hostname string, then fetches the URL without redirect policy, post-redirect validation, DNS/IP validation, or allowlist.
- **Why it matters:** Redirects or DNS rebinding can bypass pre-fetch hostname checks and target internal/private services.
- **Recommendation:** Use an explicit host allowlist, disable or validate redirects, resolve hostnames immediately before fetch, and reject private/link-local/reserved IPs.
- **Expected impact:** Closes remaining SSRF path.
- **Effort estimate:** M

#### SE-M1 Production rate limiting silently falls back to per-instance memory when Upstash is absent
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/lib/rate-limit.ts:96-99, src/lib/rate-limit.ts:167-198, .env.example:90-94, src/app/api/chat/route.ts:33-38, src/app/api/suggestions/route.ts:91-94
- **What's happening:** Missing Redis env vars make `checkRateLimit()` use in-memory limits even in production.
- **Why it matters:** In-memory limits are per instance and reset on cold start, weakening abuse protection for cost-bearing public routes.
- **Recommendation:** Treat missing Upstash as production misconfiguration for cost-bearing routes and expose limiter backend state in health.
- **Expected impact:** Deterministic abuse controls across serverless instances.
- **Effort estimate:** S

#### SE-M2 MCP POST routes bypass the Zod validation used by their GET equivalents
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/lib/schemas.ts:267-286, src/app/api/mcp/places/route.ts:307-315, src/app/api/mcp/places/route.ts:364-391, src/app/api/mcp/weather/route.ts:151-160, src/app/api/mcp/weather/route.ts:215-235
- **What's happening:** GET handlers validate bounded schemas; POST handlers manually pull fields and pass them to external APIs without equivalent validation.
- **Why it matters:** Malformed tool calls or leaked MCP secrets can drive oversized/non-string inputs into paid APIs.
- **Recommendation:** Normalize POST bodies into the same schemas used by GET.
- **Expected impact:** Reduced malformed-input and cost-abuse risk.
- **Effort estimate:** S

#### SE-M3 Marketing credential encryption is policy-by-convention, not enforced
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/021_marketing_automation.sql:9-15, src/app/api/admin/marketing/accounts/route.ts:93-117, src/lib/credentials.ts:56-68, src/types/marketing.ts:273-277
- **What's happening:** API writes encrypted credential objects, but the database only declares `credentials jsonb`, and runtime helpers still accept legacy plaintext shapes.
- **Why it matters:** Plaintext OAuth tokens can remain accepted after manual inserts or migration mistakes.
- **Recommendation:** Detect/re-encrypt or remove plaintext rows, add a CHECK constraint requiring encrypted shape, and remove plaintext fallback after migration.
- **Expected impact:** Enforced credential encryption invariant.
- **Effort estimate:** M

#### SE-L1 License policy enforcement misses weak-copyleft dev dependencies and undocumented exceptions
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** docs/project/license-exceptions.md:1-12, docs/project/license-exceptions.md:44-67, .github/workflows/license-check.yml:29-30, package-lock.json:10651-10656, package-lock.json:10681-10690
- **What's happening:** The license workflow checks production dependencies and strong copyleft only; `package-lock.json` includes dev/optional MPL-2.0 `lightningcss` packages not listed in exceptions.
- **Why it matters:** The gate does not match the documented dependency policy.
- **Recommendation:** Document the exception or adjust policy, and add an all-dependency license report with allowlist-backed exceptions.
- **Expected impact:** License enforcement aligns with project policy.
- **Effort estimate:** S

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model

Paisaxe is a Next.js 16 App Router system with public immersive/story pages, API routes, a broad integration layer in `src/lib`, and operational scripts for data ingestion and seeding. The launch-critical chat flow crosses client UI, `/api/chat/stream`, Voyage, Supabase vector search/RPC, Voyage rerank, and Anthropic streaming. Admin flows route through Supabase auth/RBAC and many route-local DB operations. Typecheck passed; configured Knip scope returned clean; no real import cycles were reported.

### Findings

#### AR-H1 Story `source_type` contract is split across UI, API schema, tests, and database constraints
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/admin/create-story-dialog.tsx:168-182, src/types/admin.ts:76-90, src/lib/schemas.ts:75-89, src/app/api/admin/stories/route.ts:137-156, supabase/migrations/063_content_discovery_agent.sql:27-29, src/app/api/admin/stories/route.test.ts:470-477
- **What's happening:** UI/types send `user_submitted`, Zod accepts `curated | ai-generated | user-suggested`, route writes parsed value directly, and DB constraint accepts `curated | user_submitted | agent_discovered`.
- **Why it matters:** Suggestion-to-story conversion can fail while tests pass against a non-DB contract.
- **Recommendation:** Define one canonical `StorySourceType` and reuse it across TypeScript, Zod, tests, content discovery, and DB inserts.
- **Expected impact:** Restores type/runtime/DB agreement for story provenance.
- **Effort estimate:** M

#### AR-M1 Typecheck and dead-code gates exclude operational TypeScript scripts used by package commands
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** package.json:16, package.json:32-44, scripts/tsconfig.json:6-14, scripts/seed-database.ts:1-15, knip.json:1-23
- **What's happening:** `npm run typecheck` excludes several launch/data scripts; Knip is scoped to `src`.
- **Why it matters:** Data-pipeline and seeding code can drift outside main verification while still used for launch operations.
- **Recommendation:** Add dedicated script verification or bring excluded scripts into `scripts/tsconfig.json`; document any remaining exclusions.
- **Expected impact:** Launch data tooling fails fast in CI/local verification.
- **Effort estimate:** M

#### AR-M2 Chat behavior is duplicated across JSON and primary streaming endpoints
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/hooks/use-stream-chat.ts:96-104, src/app/api/chat/route.ts:54-169, src/app/api/chat/stream/route.ts:52-173, src/app/api/chat/route.ts:194-204, src/app/api/chat/stream/route.ts:200-209
- **What's happening:** `/api/chat` and `/api/chat/stream` independently own validation, safety, dynamic imports, embedding, search, feature flags, and Claude orchestration.
- **Why it matters:** Fixes can land in one endpoint and miss the one users hit.
- **Recommendation:** Extract shared request preparation, safety, retrieval, and metadata helpers.
- **Expected impact:** Less drift across chat transports.
- **Effort estimate:** M

#### AR-M3 Supabase access is not typed at the database boundary
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/lib/supabase.ts:1-7, src/lib/supabase.ts:30-60, src/lib/admin-auth.ts:7, src/lib/admin-auth.ts:158-204, src/lib/search.ts:16-42, src/app/api/admin/stories/route.ts:46-68, src/types/admin.ts:31-50
- **What's happening:** Supabase clients are unparameterized, route/query code uses string table names and manual row casts, and mappers maintain independent interface shapes.
- **Why it matters:** Schema drift is not caught by TypeScript; AR-H1 is a concrete example.
- **Recommendation:** Generate Supabase `Database` types and parameterize clients/select/insert/update paths.
- **Expected impact:** Schema-contract drift becomes compile-time visible.
- **Effort estimate:** L

#### AR-S1 Route handlers still act as the service layer
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** docs/decisions/0015-service-layer.md:20-40, src/app/api/webhooks/elevenlabs/route.ts:16-25, src/app/api/webhooks/elevenlabs/route.ts:328-455, src/app/api/admin/analytics/route.ts:82-100, src/app/api/admin/analytics/route.ts:343-486, src/app/api/admin/marketing/accounts/route.ts:19-147, src/app/api/admin/stories/route.ts:35-210
- **What's happening:** Large routes still own auth, validation, business logic, DB queries, and external calls.
- **Why it matters:** Launch fixes require editing HTTP adapters that also contain domain rules and persistence.
- **Recommendation:** Implement the service-layer ADR incrementally after launch.
- **Expected impact:** Smaller routes, clearer module boundaries, more isolated tests.
- **Effort estimate:** XL

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model

QA/Reliability covers automated gates and failure-mode coverage around public visitor flows, admin flows, payments, voice booking, webhooks, cron recovery, and operational scripts. Local signal is green: typecheck, lint, and unit tests passed; Vitest reported 349 files and 6421 tests. Verification surfaces include package scripts, Vitest config, Playwright E2E workflows, API route tests, browser journeys, and Supabase migration/RPC recovery logic.

### Findings

#### QA-H1 Booking SMS failures are marked retryable but have no autonomous retry runner
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/app/api/webhooks/elevenlabs/route.ts:528-584, src/app/api/webhooks/elevenlabs/route.test.ts:719-749, supabase/migrations/079_webhook_idempotency_rpcs.sql:237-259, vercel.json:4-24
- **What's happening:** Tests assert failed SMS jobs are marked failed, but no scheduled worker claims failed `booking_sms_jobs` after webhook acknowledgement.
- **Why it matters:** Booking outcome can be recorded while the visitor never receives the promised SMS.
- **Recommendation:** Add SMS outbox retry cron/route and tests for failure followed by autonomous retry success.
- **Expected impact:** Recoverable booking notifications after transient Twilio failures.
- **Effort estimate:** M

#### QA-H2 Successful booking calls can be orphaned if conversation-id persistence fails
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/make-booking/route.ts:437-470, src/app/api/webhooks/elevenlabs/route.ts:398-424, src/app/api/mcp/make-booking/route.test.ts:558-607, src/app/api/cron/fail-stale-bookings/route.ts:7-17
- **What's happening:** If updating `pending_bookings.conversation_id` fails after ElevenLabs accepts the outbound call, the route logs and still returns success. The webhook later looks up by `conversation_id` and ignores unknown conversations.
- **Why it matters:** A real restaurant call can happen, but its outcome cannot attach to the booking row.
- **Recommendation:** Treat post-call ID persistence as a critical partial failure, add durable recovery/reconciliation, and test update failure plus unmatched webhook arrival.
- **Expected impact:** Prevents "call placed, outcome lost" failures.
- **Effort estimate:** M

#### QA-M1 Lint/typecheck coverage excludes operational and edge code outside `src`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** package.json:15-19, tsconfig.json:34-47, scripts/tsconfig.json:6-13, vitest.config.ts:12-18, supabase/functions/keep-alive/index.ts:1-18, scripts/seed-images.ts:188-220
- **What's happening:** Lint only targets `src`; TypeScript configs exclude scripts, E2E, Supabase functions, and several high-impact data scripts.
- **Why it matters:** Launch-support code can drift outside green local gates.
- **Recommendation:** Add dedicated verification for non-`src` TypeScript and Supabase functions.
- **Expected impact:** Lower operational risk from adjacent launch tooling.
- **Effort estimate:** M

#### QA-M2 Live integration coverage is mostly skipped or accepts upstream failure
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** playwright.config.ts:92-100, e2e/mcp.spec.ts:76-88, e2e/mcp.spec.ts:396-414, e2e/stripe-real-checkout.spec.ts:90-95, .github/workflows/e2e-stripe-integration.yml:33-72
- **What's happening:** Default Playwright uses dummy credentials; MCP tests skip without secrets and accept 200 or 500 for upstream flows; real Stripe checkout skips when secrets are unavailable.
- **Why it matters:** Launch can be green without proving real Places, Weather, ElevenLabs, Supabase auth, or Stripe test-mode success.
- **Recommendation:** Define a pre-launch live integration gate with real test-mode credentials and fail on skipped critical happy paths.
- **Expected impact:** Distinguishes graceful degradation from true integration readiness.
- **Effort estimate:** M

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model

Paisaxe's UX surface includes a root provider stack and root `<main id="main-content">`, public entry into `/immersive`, and visitor flows across story viewing, chat/voice purchase, favorites, pricing/checkout, legal/about pages, and admin. Immersive UI lives under `src/components/immersive`, shared primitives under `src/components/ui`, design tokens in global CSS/Tailwind config, and i18n copy under `src/lib/i18n`.

### Findings

#### UX-H1 Nested `<main>` landmarks break page structure across public screens
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/layout.tsx:144-146, src/components/immersive/story-viewer.tsx:204-207, src/app/pricing/page.tsx:47, src/app/favorites/page.tsx:119, src/app/about/page.tsx:24, src/app/privacy/page.tsx:24, src/app/terms/page.tsx:24, src/components/admin/admin-shell.tsx:242
- **What's happening:** Root layout wraps route content in `<main id="main-content">`, while routes/components render inner `<main>` elements.
- **Why it matters:** Nested main landmarks make skip-link and screen-reader navigation ambiguous.
- **Recommendation:** Keep a single page-level main landmark; convert inner mains to div/section or delegate main ownership per route.
- **Expected impact:** Cleaner assistive-tech navigation.
- **Effort estimate:** M

#### UX-H2 Collapsed filter popover leaves hidden controls keyboard-reachable
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/category-filter-badge.tsx:116-125, src/components/immersive/category-filter-badge.tsx:140-151, src/components/immersive/category-filter-badge.tsx:211-225, src/components/immersive/category-filter-badge.tsx:245-263, src/components/immersive/language-switcher.tsx:153-159
- **What's happening:** The category filter hides its panel visually with opacity/scale/pointer-events, but child buttons remain tabbable.
- **Why it matters:** Keyboard users can tab into invisible controls and lose focus context.
- **Recommendation:** Remove collapsed panel from accessibility tree and tab order with conditional rendering, `hidden`, `inert`, or propagated tabIndex/aria-hidden.
- **Expected impact:** Predictable keyboard traversal.
- **Effort estimate:** S

#### UX-H3 Favorites cards hide core information and removal behind hover
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/favorites/page.tsx:219-226, src/app/favorites/page.tsx:247-265, src/app/favorites/page.tsx:267-278
- **What's happening:** Favorite card metadata and remove button are hidden until hover; the remove button is nested inside a surrounding link.
- **Why it matters:** Touch and keyboard users cannot reliably discover information or removal.
- **Recommendation:** Show essential text persistently or on focus-within, move remove out of the link, and add focus-visible reveal states.
- **Expected impact:** Favorites become usable on mobile and keyboard.
- **Effort estimate:** M

#### UX-H4 Paid voice funnel drops intent during sign-in
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/pricing/page.tsx:19-29, src/app/pricing/checkout/page.tsx:54-70, src/components/premium/voice-purchase-cta.tsx:26-36, src/app/auth/callback/route.ts:11-16
- **What's happening:** Anonymous purchase attempts send users to sign-in with inconsistent or missing `next` paths; callback defaults to `/immersive`.
- **Why it matters:** A user who decides to buy from a story/chat can return to the wrong step and must rediscover checkout.
- **Recommendation:** Preserve `returnTo` through sign-in and resume the exact checkout or story voice-ready route after auth.
- **Expected impact:** Lower checkout abandonment.
- **Effort estimate:** M

#### UX-M1 Design-system signals are fragmented across tokens, public pages, and admin
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** tailwind.config.ts:46-53, src/components/ui/button.tsx:6-31, src/components/ui/card.tsx:10-12, src/app/pricing/page.tsx:33-40, src/app/pricing/page.tsx:100-140, src/components/admin/admin-shell.tsx:132-159, src/components/admin/admin-shell.tsx:203-232
- **What's happening:** Brand tokens are TODO, primitives use generic tokens, pricing uses direct neutral/green utilities, and admin uses a separate beige/stone palette.
- **Why it matters:** Screen consistency depends on ad hoc classes.
- **Recommendation:** Establish active Paisaxe semantic tokens and migrate high-traffic screens/primitives first.
- **Expected impact:** More cohesive brand perception.
- **Effort estimate:** L

#### UX-M2 Focus indicators are missing on several non-immersive primary actions
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/pricing/page.tsx:37-43, src/app/pricing/page.tsx:137-149, src/app/pricing/checkout/page.tsx:62-67, src/app/error.tsx:29-39, src/app/not-found.tsx:18-23, src/app/about/page.tsx:14-20, src/app/privacy/page.tsx:14-20, src/app/terms/page.tsx:14-20
- **What's happening:** Back links, purchase/sign-in CTAs, retry actions, and legal/about navigation rely on hover/transition styling without explicit focus-visible treatment.
- **Why it matters:** Keyboard users can reach critical actions without clear visible focus.
- **Recommendation:** Apply shared focus ring patterns to public action styles.
- **Expected impact:** Better keyboard accessibility.
- **Effort estimate:** S

#### UX-M3 Interactive progress segments are modeled inside a progressbar
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-progress-bar.tsx:137-147, src/components/immersive/story-progress-bar.tsx:152-164, src/components/immersive/accessibility.test.tsx:387-404
- **What's happening:** The progress container uses `role="progressbar"` while child segments are interactive buttons.
- **Why it matters:** A progressbar is not expected to contain navigable controls, which can confuse assistive tech.
- **Recommendation:** Use a labeled navigation/list/tab pattern or make the progressbar non-interactive.
- **Expected impact:** More accurate story navigation semantics.
- **Effort estimate:** M

#### UX-M4 Spanish voice and public copy need a pre-launch editorial pass
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** CLAUDE.md:289-290, src/lib/i18n/es.ts:23-31, src/lib/i18n/es.ts:51-60, src/lib/i18n/es.ts:122-130, src/lib/i18n/es.ts:183-210, src/lib/i18n/es.ts:257-287, src/components/admin/admin-shell.tsx:31-34, src/components/admin/admin-shell.tsx:151-165
- **What's happening:** Guidance says Asturias user-facing content should be Spanish, but Spanish strings contain missing accents, mixed English tokens, and English visible states.
- **Why it matters:** Unedited copy weakens local credibility.
- **Recommendation:** Run a Spanish editorial pass over `es.ts` and visible auth/loading/admin strings.
- **Expected impact:** Higher perceived quality and stronger local trust.
- **Effort estimate:** M

#### UX-M5 Loading states sometimes expose motion-only or textless feedback
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/loading.tsx:1-5, src/app/pricing/checkout/return/page.tsx:26-31, src/app/pricing/page.tsx:137-148, src/components/immersive/skeleton-story-card.tsx:9-13, src/components/immersive/voice-chat.tsx:27-40
- **What's happening:** Some loading states show only animated spinners or icons without status text.
- **Why it matters:** Assistive-tech users and slow-network users get inconsistent feedback during route/payment transitions.
- **Recommendation:** Standardize loading primitives with `role="status"`, localized text, and reduced-motion-safe visuals.
- **Expected impact:** Clearer perceived loading and purchase/access transitions.
- **Effort estimate:** S

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| SE-B1 | Security | Default anon/authenticated SELECT grants expose operational tables with SMS PII | launch-blocker | Before launch | M | Prevents public PII exposure |
| DO-H1 | DevOps | Production error tracking can be silently disabled | high | Before launch | S | Prevents blind production launch |
| FE-H1 | Frontend | Admin stories pagination loses the active tab | high | Before launch | S | Stabilizes story curation workflow |
| UX-H2 | UX | Collapsed filter popover leaves hidden controls keyboard-reachable | high | Before launch | S | Fixes primary keyboard discovery bug |
| AR-H1 | Architecture | Story `source_type` contract is split | high | Before launch | M | Fixes admin story provenance workflow |
| BE-H1 | Backend | Session-scoped advisory locks are used through pooled RPC calls | high | Before launch | M | Prevents duplicate/stalled background work |
| BE-H2 | Backend | SMS outbox has no independent retry worker | high | Before launch | M | Makes booking notifications recoverable |
| DO-H2 | DevOps | Database migrations are not applied in CI | high | Before launch | M | Catches migration failures pre-release |
| PE-H1 | Performance | Public pages do global auth and flag startup work | high | Before launch | M | Improves public startup p95 |
| PE-H2 | Performance | Chat p99 is gated by unbounded third-party stages | high | Before launch | M | Bounds core chat latency |
| QA-H1 | QA | Booking SMS failures have no autonomous retry runner | high | Before launch | M | Verifies recoverable SMS delivery |
| QA-H2 | QA | Successful booking calls can be orphaned | high | Before launch | M | Prevents lost booking outcomes |
| SE-H1 | Security | Admin image URL ingestion has SSRF bypass paths | high | Before launch | M | Closes admin SSRF route |
| UX-H1 | UX | Nested main landmarks break page structure | high | Before launch | M | Improves assistive navigation |
| UX-H3 | UX | Favorites cards hide information/removal behind hover | high | Before launch | M | Makes favorites usable on touch/keyboard |
| UX-H4 | UX | Paid voice funnel drops intent during sign-in | high | Before launch | M | Reduces checkout abandonment |
| BE-M1 | Backend | Failed ElevenLabs initiation leaves idempotency stuck | medium | Before launch | S | Improves booking retry behavior |
| DO-M1 | DevOps | Health runbooks contradict implementation | medium | Before launch | S | Aligns incident response |
| DO-M2 | DevOps | Public DB diagnostics endpoint exposes error detail | medium | Before launch | S | Reduces information exposure |
| DO-M4 | DevOps | Branch protection docs conflict | medium | Before launch | S | Removes release ambiguity |
| SE-M1 | Security | Production rate limiting falls back to memory | medium | Before launch | S | Strengthens abuse controls |
| UX-M2 | UX | Missing focus indicators on public actions | medium | Before launch | S | Improves keyboard accessibility |
| UX-M5 | UX | Loading states expose motion-only/textless feedback | medium | Before launch | S | Improves route/payment feedback |
| AR-M1 | Architecture | Operational scripts excluded from gates | medium | Before launch | M | Covers launch data tooling |
| AR-M2 | Architecture | Chat behavior duplicated across endpoints | medium | Before launch | M | Reduces chat safety/retrieval drift |
| FE-M2 | Frontend | Global providers still perform deferred side effects | medium | Before launch | M | Reduces public startup work |
| FE-M3 | Frontend | Query-param reads sit in broad route shells | medium | Before launch | M | Smaller hydration boundaries |
| PE-M1 | Performance | Immersive hydrates full story catalog | medium | Before launch | M | Reduces payload/memory scaling |
| QA-M1 | QA | Non-src operational code outside gates | medium | Before launch | M | Reduces operational code drift |
| QA-M2 | QA | Live integration coverage skips critical happy paths | medium | Before launch | M | Proves real integration readiness |
| SE-M3 | Security | Marketing credential encryption is not enforced | medium | Before launch | M | Enforces token storage invariant |
| UX-M3 | UX | Interactive progress segments inside progressbar | medium | Before launch | M | Corrects assistive semantics |
| UX-M4 | UX | Spanish public copy needs editorial pass | medium | Before launch | M | Improves local trust |
| FE-M1 | Frontend | Chat analytics use wrong PostHog context | medium | Before launch | S | Reliable chat telemetry |
| FE-M4 | Frontend | Immersive deep-link handling ignores later URL changes | medium | Before launch | S | Reliable share/payment returns |
| BE-M2 | Backend | Request validation inconsistent | medium | After launch | M | Cleaner API contracts |
| BE-M3 | Backend | Stripe webhook audit insert mismatches table | medium | After launch | S | Accurate payment audit trail |
| BE-M4 | Backend | Story conversion from suggestion is not atomic | medium | After launch | M | Consistent curation metrics |
| DO-M3 | DevOps | Request IDs not bound into server log context | medium | After launch | M | Better incident correlation |
| FE-M5 | Frontend | Feature-flagged tools are statically imported | medium | After launch | M | Smaller initial immersive bundle |
| PE-M2 | Performance | Story metadata generation does full-row N+1 work | medium | After launch | S | Faster builds/share metadata |
| PE-M3 | Performance | MCP POST calls bypass GET cache strategy | medium | After launch | M | Lower latency/quota/cost |
| SE-M2 | Security | MCP POST routes bypass GET validation schemas | medium | After launch | S | Lower malformed-input risk |
| UX-M1 | UX | Design-system signals are fragmented | medium | After launch | L | More cohesive visual system |
| PE-L1 | Performance | UI unused export checks have blind spots | low | Later | S | Better dead-code guardrail |
| SE-L1 | Security | License policy misses dev weak-copyleft exceptions | low | Later | S | Aligns license controls |
| AR-M3 | Architecture | Supabase access is not typed at DB boundary | medium | After launch | L | Compile-time schema drift detection |
| AR-S1 | Architecture | Route handlers still act as service layer | strategic | Later | XL | Clearer module boundaries |

## 13. Top 10 Highest-ROI Improvements

1. `SE-B1` - Default grants expose operational tables. Highest ROI because it removes the sole launch-blocker and protects booking PII.
2. `DO-H1` - Sentry/health release gate. Small effort, high operational payoff before any public traffic surge.
3. `FE-H1` - Admin story pagination tab loss. Small fix with direct impact on pre-launch curation.
4. `UX-H2` - Hidden tabbable filter controls. Small fix to the primary discovery flow's keyboard behavior.
5. `BE-M1` - Mark failed booking initiation immediately. Small fix that improves retry clarity in a critical voice workflow.
6. `DO-M2` - Restrict public DB diagnostics. Small fix that reduces information exposure.
7. `SE-M1` - Fail closed or surface missing Upstash in production. Small fix that strengthens cost-abuse controls.
8. `BE-H2` / `QA-H1` - Add SMS retry worker. Medium effort but closes a clear durable-notification gap.
9. `AR-H1` - Unify story source type. Medium effort and removes an end-to-end admin contract split.
10. `UX-H4` - Preserve paid voice intent through sign-in. Medium effort with direct conversion impact.

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- `SE-B1`: Default anon/authenticated SELECT grants expose operational tables with booking SMS PII
- `AR-H1`: Story `source_type` contract is split across UI, API schema, tests, and database constraints
- `FE-H1`: Admin stories pagination loses the active tab and routes the user out of the stories panel
- `BE-H1`: Session-scoped advisory locks are still used through pooled RPC calls
- `BE-H2`: SMS outbox has no independent worker after webhook acknowledgement
- `PE-H1`: Public pages still do global auth and feature-flag startup work
- `PE-H2`: Chat streaming p99 is gated by unbounded third-party stages before first SSE byte
- `DO-H1`: Production error tracking can be silently disabled while health and release gates still pass
- `DO-H2`: Database migrations are not applied in CI; only filenames are checked
- `SE-H1`: Admin image URL ingestion still has SSRF bypass paths through redirects and DNS resolution
- `QA-H1`: Booking SMS failures are marked retryable but have no autonomous retry runner
- `QA-H2`: Successful booking calls can be orphaned if conversation-id persistence fails
- `UX-H1`: Nested `<main>` landmarks break page structure across public screens
- `UX-H2`: Collapsed filter popover leaves hidden controls keyboard-reachable
- `UX-H3`: Favorites cards hide core information and removal behind hover
- `UX-H4`: Paid voice funnel drops intent during sign-in
- `AR-M1`: Typecheck and dead-code gates exclude operational TypeScript scripts used by package commands
- `AR-M2`: Chat behavior is duplicated across JSON and primary streaming endpoints
- `FE-M1`: Chat analytics use a PostHog React context that is not actually wrapping the chat subtree
- `FE-M2`: Global providers still perform auth and flag side effects on routes that are intended to defer them
- `FE-M3`: Query-param reads sit in broad client route shells instead of narrow Suspense islands
- `FE-M4`: Immersive deep-link handling is guarded by a one-shot boolean and can ignore later URL changes
- `BE-M1`: Failed ElevenLabs call initiation leaves booking idempotency claims stuck
- `PE-M1`: Immersive hydrates and persists an unbounded full story catalog
- `DO-M1`: Health-check and monitoring runbooks contradict the implemented health contract
- `DO-M2`: Public database diagnostics endpoint exposes backend error detail
- `DO-M4`: Production branch protection documentation conflicts on approval requirements
- `SE-M1`: Production rate limiting silently falls back to per-instance memory when Upstash is absent
- `SE-M3`: Marketing credential encryption is policy-by-convention, not enforced
- `QA-M1`: Lint/typecheck coverage excludes operational and edge code outside `src`
- `QA-M2`: Live integration coverage is mostly skipped or accepts upstream failure
- `UX-M2`: Focus indicators are missing on several non-immersive primary actions
- `UX-M3`: Interactive progress segments are modeled inside a progressbar
- `UX-M4`: Spanish voice and public copy need a pre-launch editorial pass
- `UX-M5`: Loading states sometimes expose motion-only or textless feedback

### After launch (Wave 2)
- `AR-M3`: Supabase access is not typed at the database boundary
- `FE-M5`: Runtime feature flags gate immersive tools after their code is already statically imported
- `BE-M2`: Request validation is inconsistent for malformed JSON and dynamic IDs
- `BE-M3`: Stripe webhook audit insert does not match the deployed table shape
- `BE-M4`: Story conversion from user suggestion is not atomic
- `PE-M2`: Story metadata generation does full-row N+1 database work for redirect pages
- `PE-M3`: MCP POST tool calls bypass the cache strategy used by equivalent GET routes
- `DO-M3`: Request IDs are generated but not bound into server log context
- `SE-M2`: MCP POST routes bypass the Zod validation used by their GET equivalents
- `UX-M1`: Design-system signals are fragmented across tokens, public pages, and admin

### Later / strategic (Wave 3)
- `PE-L1`: Unused export checks have explicit blind spots in UI code
- `SE-L1`: License policy enforcement misses weak-copyleft dev dependencies and undocumented exceptions
- `AR-S1`: Route handlers still act as the service layer

## 15. Open Questions / Assumptions

- Assumed the repository's migrations represent the active Supabase privilege model; `SE-B1` should be confirmed against the live database ACL/RLS state before remediation, but the migration evidence is strong enough to block launch.
- Assumed the current branch is `develop`; local `git status` showed modified agent reports already present before this audit.
- Assumed the specialist-reported build and audit command outputs are valid; the main session directly verified typecheck, lint, and unit tests.
- The audit did not run full Playwright E2E or live third-party integration tests because `/pre-launch` designated the QA specialist for test verification and the current local unit gates were already green.
- Several findings overlap intentionally across domains, especially provider startup work and SMS retry durability; `/remediate` should merge duplicate implementation work while preserving each finding ID.

## 16. Final Verdict

- **Verdict:** NOT READY
- **What would most worry me about shipping today?** The combination of possible public PII exposure in Supabase privileges (`SE-B1`) and unreliable recovery in the voice booking/SMS path (`BE-H2`, `QA-H1`, `QA-H2`). Those are not polish defects; they are trust failures.
- **What gives confidence?** The codebase has strong local test coverage, clear operational intent, and the problematic areas are well-localized enough for focused remediation.
- **Next 5 actions:**
  1. Confirm and fix Supabase grants/RLS for operational tables (`SE-B1`).
  2. Add/verify migration-apply CI and DB privilege checks (`DO-H2`, `SE-B1`).
  3. Repair voice booking durability: pooled locks, SMS retry worker, conversation-id partial failure, failed initiation state (`BE-H1`, `BE-H2`, `QA-H1`, `QA-H2`, `BE-M1`).
  4. Add production readiness gates for Sentry and rate limiting (`DO-H1`, `SE-M1`).
  5. Fix the highest-friction launch UX issues: admin story pagination, sign-in intent preservation, hidden tabbable filter controls, nested landmarks, and favorites hover-only actions (`FE-H1`, `UX-H2`, `UX-H4`, `UX-H1`, `UX-H3`).
