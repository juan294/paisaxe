# Pre-Launch Codebase Audit
> Generated on 2026-04-23 | Branch: `develop` | 8 specialists
> Focus: comprehensive

## 1. Executive Summary
Paisaxe is not ready for a public launch in its current state. The branch is clean, local unit/static verification is strong, and recent `develop` CI is green, but the launch-critical path still has two hard blockers: the booking flow does not persist against the current database contract, and the end-to-end suite still fails broadly across public mobile, chat, suggestions, pricing, and QA-journey flows. The codebase shows good intent around health checks, observability, and rollout controls, but several of those controls do not actually fail or gate releases when the system is degraded.

- Top 3 strengths:
  - Local correctness at the unit/static layer is strong: `npm run test` passed `323` files / `6028` tests, `npm run typecheck` passed, `npm run lint` passed, and `npm run build` completed successfully on April 23, 2026.
  - The operational surface is documented and instrumented: `/api/health`, Upptime, Sentry, structured logging, segment error boundaries, and release/runbook material all exist and are wired into the repo.
  - The immersive route already uses sensible launch-era patterns such as server-fetched initial stories/flags, Suspense/PPR boundaries, and lazy loading for heavy voice-chat code.
- Top 5 risks:
  - `BE-B1` Booking creation is incompatible with the live schema, so successful outbound calls can complete without a durable booking record.
  - `QA-B1` Full E2E verification still fails in `44` cases, concentrated on public mobile, chat, pricing, favorites, suggestion, and QA-journey coverage.
  - `SE-H1` Visitor voice access policy is enforced from browser-visible feature-flag config, exposing allowlist logic and agent IDs client-side.
  - `DO-H1` Degraded health states still return `200`, so both monitoring and preview smoke can pass while core dependencies are unhealthy.
  - `DO-H2` Preview smoke is not an enforced required check on `main`, despite release docs treating it as a production-safety barrier.
- Verdict: NOT READY

The branch is closer to launchable than the E2E failures suggest, because the static checks and recent CI state are healthy. But the remaining failures are concentrated in real user paths, and the booking schema mismatch is a direct correctness bug on a live product capability. Those two issues alone are enough to block launch.

## 2. System Architecture Overview
Paisaxe is a Next.js 16 App Router application with a split between a visitor-facing immersive experience, a large client-side admin surface, and a broad set of API routes under `src/app/api/**`. `src/proxy.ts` is the control-plane edge layer for canonical redirects, maintenance mode, auth refresh, CSP, CSRF, CORS, and request IDs. Most shared logic flows through `src/lib/**`, with Supabase as the primary persistence boundary and Stripe, ElevenLabs, Twilio, Anthropic, Voyage, Sentry, and PostHog as external integrations.

Major modules and responsibilities:
- `src/app/immersive/**`: primary browse/chat experience, story loading, feature flags, filters, navigation.
- `src/app/pricing/**` and checkout APIs: paid voice access and Stripe flows.
- `src/app/api/**`: chat, favorites, suggestions, checkout, webhooks, cron, admin APIs, MCP tools.
- `src/components/admin/**`: admin control plane for stories, analytics, agents, costs, marketing.
- `src/lib/**`: shared env/config, auth, logging, rate limiting, search, story loading, AI integrations.
- `supabase/migrations/**`: schema, RPCs, webhook idempotency, translation and booking support.

How the pieces connect:
- Public traffic enters through proxy/middleware, then resolves into App Router pages or APIs.
- Visitor pages fetch stories and feature flags from Supabase-backed APIs or direct REST access.
- Paid flows authenticate with Supabase auth, then create Stripe sessions and post-purchase return flows.
- Booking and translation flows span route handlers, external APIs, and Supabase tables/RPCs.
- Observability spans `/api/health`, structured logs, Sentry, Upptime, and GitHub Actions.

Cross-specialist architecture concerns:
- Env/config ownership is not centralized in practice despite `src/lib/env.ts`.
- Feature flags and auth bootstrap are duplicated across client subtrees instead of flowing from one hydrated source.
- Several operationally important side effects still happen inline inside request lifetimes instead of durable jobs.
- Dependency/tooling state is not internally consistent enough for reliable audit/update workflows.

## 3. End-to-End Flow Analysis
Key flows reviewed:
- Immersive browsing, story navigation, language switching, suggestions, and chat entry.
- Pricing and checkout return flows.
- MCP booking initiation through ElevenLabs and webhook/SMS completion.
- Story approval to translation webhook fan-out.
- Health, monitoring, and preview/release validation.

Request/data/control flow observations:
- The immersive page is server-primed but still falls back to client-side hook bootstraps for flags, auth, and some secondary controls, which creates rollout and loading-state drift.
- Checkout has two parallel creation paths with different origin-validation behavior.
- Booking and translation both rely on external side effects during request handling rather than a durable queue/outbox model.
- Health and preview tooling exist, but the machine-read path does not currently fail when the system is degraded.

Integration and boundary risks:
- Supabase schema/code drift can silently break downstream webhook correlation.
- Mobile and anonymous experiences are the least stable verified paths despite being public-first surfaces.
- Release controls are partially documentary rather than enforced.

## 4. Frontend / UI Findings (Staff Frontend Engineer)
### Domain Model
The frontend is organized around a server root layout that wraps the app in client providers, with `/immersive` acting as the core product surface and `/favorites`, `/pricing`, and `/admin` as secondary client-heavy routes. The dominant frontend boundaries are story/flag bootstrap, auth/bootstrap providers, and the immersive toolbar/control layer.

#### FE-H1 Feature flags do not have a single hydrated source of truth inside the immersive experience
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/immersive/immersive-page-content.tsx:47-68`, `src/hooks/use-feature-flags.ts:57-66`, `src/hooks/use-feature-flags.ts:119-136`, `src/components/immersive/story-viewer.tsx:78`, `src/hooks/use-visitor-voice-access.ts:22-31`, `src/hooks/use-voice-access.ts:33-35`
- **What's happening:** The immersive route receives server-resolved `initialFlags`, but only the top-level `ImmersivePageContent` instance is seeded with them. Nested consumers call `useFeatureFlags()` again without shared hydrated state.
- **Why it matters:** The same screen can render against multiple flag states during hydration and early interaction. Story controls, voice entry points, and gated UI can disagree inside one session.
- **Recommendation:** Move flags behind a route-scoped provider or shared cache seeded once from the server payload, then consume that single hydrated state everywhere below.
- **Expected impact:** Removes intra-page flag drift, reduces duplicate bootstrap work, and makes rollout behavior predictable.
- **Effort estimate:** M

#### FE-M1 `useStories` performs cache bootstrap during render, which makes initial client state depend on `localStorage`
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-stories.ts:38-69`, `src/hooks/use-stories.ts:95-104`, `src/hooks/use-stories.ts:116-134`, `src/app/favorites/page.tsx:17-18`
- **What's happening:** `useStories` reads browser storage during render to decide its first client state. Routes without server `initialStories`, such as `/favorites`, can server-render one state and hydrate into another.
- **Why it matters:** This increases hydration instability and first-paint layout shifts on a public route.
- **Recommendation:** Keep the render path pure, initialize from explicit props only, and reconcile browser cache in an effect after hydration.
- **Expected impact:** More stable hydration boundaries and fewer first-paint jumps.
- **Effort estimate:** M

#### FE-M2 Global client providers pull auth and analytics bootstrap into every route, including low-interactivity content pages
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/layout.tsx:138-146`, `src/app/providers.tsx:18-25`, `src/components/auth/auth-provider.tsx:28-79`, `src/app/about/page.tsx:1-8`, `src/app/privacy/page.tsx:1-8`, `src/app/terms/page.tsx:1-8`
- **What's happening:** The root layout mounts a broad client provider boundary, and `AuthProvider` immediately bootstraps session/user state on mount. Static/legal routes inherit that client bootstrap whether they need it or not.
- **Why it matters:** Static or low-interactivity routes ship more client work and auth initialization than their product value justifies.
- **Recommendation:** Split provider scope by route group and keep auth/bootstrap providers inside the routes that truly need them.
- **Expected impact:** Smaller initial JS and less mount-time work on non-app routes.
- **Effort estimate:** M

#### FE-M3 Favorites state management is internally inconsistent about anonymous persistence
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-favorites.ts:23-24`, `src/hooks/use-favorites.ts:39-42`, `src/hooks/use-favorites.ts:63-86`, `src/app/favorites/page.tsx:117-138`
- **What's happening:** The hook clears favorites for anonymous users, but still retains merge logic for local-plus-cloud favorites and the page still renders anonymous-user copy that assumes local favorites can exist.
- **Why it matters:** The state machine models two different product rules at once, which creates dead or misleading behavior on a retention surface.
- **Recommendation:** Choose one persistence model and remove the conflicting branch and copy.
- **Expected impact:** Simpler state transitions and clearer favorites behavior.
- **Effort estimate:** S

## 5. Backend / API / Data Findings (Staff Backend Engineer)
### Domain Model
The backend is centered on App Router API routes with four main classes: public visitor APIs, admin APIs, webhook/cron endpoints, and MCP tool endpoints. Supabase is the primary persistence layer, with RPCs and idempotency tables used selectively, and several external integrations are invoked inline from request handlers.

#### BE-B1 Booking persistence is broken against the current database contract
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/mcp/make-booking/route.ts:344-370`, `src/app/api/mcp/make-booking/route.ts:376-417`, `supabase/migrations/053_pending_bookings.sql:5-20`
- **What's happening:** The booking flow inserts a `pending_bookings` row before it has a `conversation_id`, but the current table requires `conversation_id TEXT UNIQUE NOT NULL`. The insert failure is logged and ignored, then later updates fall back to `venue_phone`.
- **Why it matters:** A real outbound booking call can succeed without a durable booking row to correlate the webhook, so status updates and SMS notifications can fail or attach to the wrong record.
- **Recommendation:** Reconcile code and schema. Either create the row after obtaining `conversation_id`, or migrate the table to support a pre-call state with a nullable correlation field. Make persistence failure fatal in this path.
- **Expected impact:** Booking becomes traceable end-to-end and webhook/SMS completion becomes deterministic.
- **Effort estimate:** M

#### BE-H1 Booking initiation has no idempotency boundary before the real-world side effect
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `src/app/api/mcp/make-booking/route.ts:246-377`, `src/lib/mcp-auth.ts:9-30`, `supabase/migrations/053_pending_bookings.sql:5-20`
- **What's happening:** The endpoint authenticates and validates, then immediately calls ElevenLabs. There is no request idempotency key or claim record before the outbound call.
- **Why it matters:** Retries or duplicate tool invocations can place duplicate calls to the same venue for the same reservation.
- **Recommendation:** Require a caller-supplied idempotency key and claim it in Postgres before placing the outbound call.
- **Expected impact:** Duplicate booking calls become preventable.
- **Effort estimate:** M

#### BE-H2 SMS delivery is outside the durable idempotent workflow
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/webhooks/elevenlabs/route.ts:426-456`, `src/app/api/webhooks/elevenlabs/route.ts:473-518`, `src/lib/twilio-sms.ts:37-89`, `supabase/migrations/079_webhook_idempotency_rpcs.sql:15-49`
- **What's happening:** The webhook claims and updates booking state transactionally, but SMS sending happens afterward as a one-shot network call. Twilio failure is only logged.
- **Why it matters:** A transient SMS outage permanently drops the customer-facing confirmation or denial even when the booking status itself was recorded correctly.
- **Recommendation:** Move SMS into a retriable outbox/job table or persist delivery state and retry asynchronously outside the webhook request.
- **Expected impact:** Booking outcomes remain eventually deliverable instead of being lost on first failure.
- **Effort estimate:** M

#### BE-H3 Translation jobs can be stranded because the “queue” is just an HTTP trigger plus a permanent claim row
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `supabase/migrations/050_fix_translation_trigger.sql:56-64`, `src/app/api/webhooks/translate/route.ts:96-127`, `src/app/api/webhooks/translate/route.ts:129-179`, `supabase/migrations/079_webhook_idempotency_rpcs.sql:8-13`, `supabase/migrations/079_webhook_idempotency_rpcs.sql:58-79`, `supabase/migrations/080_fail_stale_translations_support.sql:1-64`, `src/app/api/admin/stories/approve-all/route.ts:15-20`, `src/app/api/admin/stories/bulk-status/route.ts:35-39`
- **What's happening:** Story approval fans out HTTP webhook calls, and the translate webhook permanently claims an event before performing the full translation inline. Claim rows have no lease/expiry.
- **Why it matters:** A timeout or process kill can leave a story permanently duplicate-blocked, and bulk approvals can create unbounded concurrency.
- **Recommendation:** Replace the webhook-as-queue pattern with a durable jobs table that tracks status, `claimed_at`, expiry, and retries.
- **Expected impact:** Translation automation becomes recoverable and safer under bulk publishing.
- **Effort estimate:** L

#### BE-M1 Write-path validation is only centralized for a minority of routes
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/schemas.ts:39-112`, `src/app/api/admin/stories/[id]/route.ts:36-103`, `src/app/api/admin/stories/bulk-delete/route.ts:13-30`, `src/app/api/admin/stories/bulk-status/route.ts:14-38`, `src/app/api/admin/feature-flags/[key]/route.ts:19-56`, `src/app/api/admin/marketing/accounts/route.ts:67-103`, `src/app/api/admin/marketing/schedule/route.ts:85-139`, `src/app/api/admin/marketing/schedule/route.ts:196-233`
- **What's happening:** Public routes often use shared Zod schemas, but many admin mutations still rely on route-local manual checks and type assertions.
- **Why it matters:** Malformed requests can turn into `500`s instead of clear `4xx` contract errors, and loosely-shaped data can be persisted into operational tables.
- **Recommendation:** Add schema-based validation to every write route and normalize validation error handling.
- **Expected impact:** Safer admin mutations and more predictable API contracts.
- **Effort estimate:** M

#### BE-M2 Public rate limiting is not reliably global and trusts client-supplied IP headers
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `src/lib/request-utils.ts:9-16`, `src/lib/rate-limit.ts:30-31`, `src/lib/rate-limit.ts:95-97`, `src/lib/rate-limit.ts:148-177`, `src/app/api/chat/route.ts:34-35`, `src/app/api/chat/stream/route.ts:35-36`, `src/app/api/suggestions/route.ts:79-81`
- **What's happening:** Public throttling keys off forwarded headers directly, and when the distributed store is absent or unavailable the limiter falls back to an in-process `Map`.
- **Why it matters:** On multi-instance/serverless deployments the limits stop being global, and spoofed headers can fragment or evade quotas.
- **Recommendation:** Treat distributed limiting as mandatory for launch traffic, key off trusted proxy identity, and alert when the app falls back from the shared store.
- **Expected impact:** Abuse controls behave consistently across replicas and are harder to bypass.
- **Effort estimate:** M

## 6. Performance and Scalability Findings (Performance Engineer)
### Domain Model
The app’s performance profile is dominated by the immersive route, the globally mounted client shell, and the chat entry path. The launch risk is not one isolated slow component; it is several shared bootstrap layers stacking together across the most important user journeys.

#### PE-H1 The global client shell is still heavier and broader than the route mix justifies
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/layout.tsx:138-146`, `src/app/providers.tsx:1-23`, `src/components/auth/auth-provider.tsx:28-79`
- **What's happening:** Every route mounts the same client provider stack, including auth bootstrap and analytics initialization, even for low-interactivity or anonymous-first pages.
- **Why it matters:** Shared startup work is being paid on too much of the route tree, which drags down first render on pages that do not need full app-shell behavior.
- **Recommendation:** Split provider scope by route group and keep auth/analytics/client-only concerns off routes that do not depend on them.
- **Expected impact:** Lower initial JS and less mount-time work on public, static, and anonymous-first paths.
- **Effort estimate:** M

#### PE-H2 The immersive route duplicates story and feature-flag hydration across mismatched caches
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/immersive/immersive-page-content.tsx:44-67`, `src/hooks/use-feature-flags.ts:47-117`, `src/hooks/use-stories.ts:98-184`
- **What's happening:** The route is server-primed, but client hooks still maintain their own rehydration and caching rules for flags and stories. Initial server values, in-memory caches, and `localStorage`-backed state are not unified under one route-scoped source of truth.
- **Why it matters:** The main product surface spends extra work reconciling state it already had on the server, while increasing the chance of hydration drift and route-local inconsistency.
- **Recommendation:** Seed one route-scoped data model for immersive stories and flags, then consume that shared hydrated state everywhere below the page boundary.
- **Expected impact:** Faster immersive boot, less duplicate fetch/cache work, and more predictable route behavior.
- **Effort estimate:** M

#### PE-H3 Chat first-token latency still chains several sequential remote steps before streaming begins
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/chat/stream/route.ts:93-137`, `src/app/api/chat/stream/route.ts:145-167`, `src/lib/claude.ts:21-223`
- **What's happening:** After validation passes, the chat stream path still waits for deferred imports, embedding generation, vector search, and feature-flag lookup before the first streamed token can leave the server.
- **Why it matters:** Even when the stream itself is healthy, the user still pays a serialized pre-stream latency tax on the highest-visibility interactive feature.
- **Recommendation:** Collapse or parallelize the pre-stream steps where possible, and keep the retrieval/gating path narrowly scoped so the model stream can start sooner.
- **Expected impact:** Lower first-token latency and a more responsive chat experience.
- **Effort estimate:** M

#### PE-M1 The Edge hot path is broader than necessary and still intersects with Node-only logging code
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/proxy.ts:74-85`, `src/lib/logger.ts:180-214`, `src/instrumentation.ts:48-59`
- **What's happening:** The proxy matcher still covers nearly the whole app, and shared infra code continues to expose a dev logger implementation that calls `process.stdout.write`, which already surfaced as an Edge-runtime warning during build.
- **Why it matters:** Broad Edge exposure amplifies the blast radius of runtime-incompatible shared code and makes the hot path harder to reason about.
- **Recommendation:** Narrow the Edge hot path where practical and isolate Node-only logging implementations so Edge-linked code never imports them.
- **Expected impact:** Cleaner deploy output and less risk on the request path that every user traverses.
- **Effort estimate:** M

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)
### Domain Model
The reliability surface spans Vercel deploy/runtime behavior, GitHub Actions CI, manual release docs, `/api/health`, Upptime, Sentry, structured logs, and Supabase-backed cron/webhook flows. The immediate issue is not branch dirtiness or red CI; it is that several operational controls do not actually fail when the system is unhealthy.

#### DO-H1 Degraded health states do not fail monitoring or preview validation
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/health/route.ts:352`, `src/app/api/health/route.ts:373`, `src/app/api/health/route.ts:406`, `.github/workflows/preview-smoke.yml:46`, `.github/workflows/preview-smoke.yml:54`, `.github/upptime/.upptimerc.yml:18`, `docs/operations/operations.md:7`, `docs/operations/operations.md:117`
- **What's happening:** `/api/health` computes degraded state but still returns `200`; preview smoke only asserts `200`, and Upptime is also configured around `200`.
- **Why it matters:** Supabase loss, zero approved stories, or DB-capacity warnings can pass both release smoke and uptime monitoring.
- **Recommendation:** Add a machine health gate that fails on degraded state, either with a separate `/api/healthz` or by having preview/monitoring parse the JSON `status`.
- **Expected impact:** Real degradation becomes visible to CI and monitoring instead of being treated as healthy.
- **Effort estimate:** M

#### DO-H2 Real-runtime preview validation is not actually enforced on `main`
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/ci.yml:7`, `.github/workflows/preview-smoke.yml:3`, `CLAUDE.md:72`, `docs/operations/branch-protection.md:5`
- **What's happening:** Docs describe preview smoke as a required runtime check, but the documented branch protection only requires lint/typecheck, test, build, and Playwright E2E.
- **Why it matters:** Code can still merge to `main` without a required real-environment preview verdict.
- **Recommendation:** Add preview smoke as a required status check on `main` and align the docs with the enforced policy.
- **Expected impact:** Production releases regain a meaningful last-mile runtime barrier.
- **Effort estimate:** S

#### DO-M1 Env and secret validation only covers part of the real operational surface
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `.env.example:45`, `.env.example:96`, `scripts/check-env.ts:5`, `scripts/check-env.ts:59`, `scripts/check-env.ts:75`, `scripts/run-stripe-e2e.ts:4`, `scripts/run-stripe-e2e.ts:83`, `.github/workflows/e2e-stripe-integration.yml:28`, `.github/workflows/e2e-stripe-integration.yml:58`, `.github/workflows/e2e-stripe-integration.yml:65`
- **What's happening:** The env-doc gate only scans `src/` for direct env usage, while scripts and workflow dependencies outside `src/` are invisible to it. Critical workflows can skip silently when secrets are missing.
- **Why it matters:** Checkout and QA coverage can disappear without failing the documented env check.
- **Recommendation:** Replace the partial scan with a single maintained env manifest covering app, scripts, and workflows, and make skipped critical workflows fail loudly.
- **Expected impact:** Secret drift becomes detectable before it disables important operational checks.
- **Effort estimate:** M

#### DO-M2 Migration safety is policy-driven, not pipeline-enforced
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `docs/operations/migration-policy.md:65`, `docs/operations/migration-policy.md:84`, `docs/operations/migration-policy.md:87`, `docs/operations/rollback.md:114`, `docs/operations/rollback.md:153`, `.github/workflows/ci.yml:23`, `.github/workflows/e2e.yml:12`
- **What's happening:** The migration policy requires local replay and verification, but checked-in CI workflows do not boot Supabase or replay the full migration chain.
- **Why it matters:** Schema, grant, and RPC regressions can remain latent until release time.
- **Recommendation:** Add a migration-validation job that boots local Supabase, replays all migrations, and smoke-checks critical RPCs/routes.
- **Expected impact:** Database rollout risk shifts left into CI.
- **Effort estimate:** L

#### DO-M3 Core ops runbooks are drifting on production controls
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `CLAUDE.md:72`, `CLAUDE.md:75`, `docs/operations/branch-protection.md:5`, `docs/operations/branch-protection.md:17`, `docs/operations/operations.md:72`, `docs/operations/operations.md:82`, `docs/operations/pending-setup.md:20`, `docs/operations/pending-setup.md:98`
- **What's happening:** The canonical docs disagree on approval counts and required checks, `operations.md` describes release sync conditions loosely, and pending-setup docs still describe live controls as incomplete.
- **Why it matters:** Release and incident handling become harder exactly when operators need one trustworthy runbook.
- **Recommendation:** Pick one canonical production-controls document, lint or derive the rest from it, and archive stale setup docs.
- **Expected impact:** Release and rollback procedures become more trustworthy under pressure.
- **Effort estimate:** M

#### DO-S1 Alerting and incident response are only partially operationalized
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `docs/operations/operations.md:113`, `docs/operations/operations.md:118`, `docs/operations/logging.md:109`, `docs/operations/logging.md:112`, `docs/operations/logging.md:126`, `docs/operations/rollback.md:168`, `.github/upptime/.upptimerc.yml:18`
- **What's happening:** The documented alert path is mostly passive: Upptime opens GitHub issues, logging alerts are only recommended, and runbooks do not name an owner or escalation path.
- **Why it matters:** Discoverable incidents are not the same as actionable incidents, especially off-hours.
- **Recommendation:** Define one explicit alert channel, owner, and escalation path and wire health/log alerts to it.
- **Expected impact:** Incidents move from discoverable to actionable.
- **Effort estimate:** M

## 8. Security / Privacy Findings (Security Reviewer)
### Domain Model
The security boundary spans public APIs, client-visible rollout config, admin write paths, structured logging, and dependency/tooling hygiene. The most material launch concern is not one missing header; it is that some access-control and operational trust boundaries are still enforced in places that are too exposed or too weakly audited.

#### SE-H1 Visitor voice access control is exposed in browser-side feature-flag config
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-visitor-voice-access.ts:22-54`, `src/hooks/use-voice-access.ts:83-100`, `src/types/feature-flags.ts:20-23`
- **What's happening:** The browser receives the `visitor_voice_agent` config, including whitelisted emails and `agent_id`, and the client hook decides whether a signed-in user is allowed to use the voice feature.
- **Why it matters:** The allowlist policy and agent-selection data are exposed to the browser, which is the wrong trust boundary for launch-sensitive access control and internal agent identifiers.
- **Recommendation:** Move visitor voice authorization and agent selection behind a server-verified API boundary and return only the minimal client-facing capability state.
- **Expected impact:** Shrinks the exposed attack surface and removes a high-sensitivity access decision from the browser.
- **Effort estimate:** M

#### SE-M1 Public health endpoints leak recon and configuration state
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/health/route.ts:79-92`, `src/app/api/health/route.ts:220-316`, `src/app/api/health/route.ts:342-406`
- **What's happening:** `/api/health` is public and returns app version, uptime, story inventory fallback state, database size usage, and whether external-service keys are configured, while still replying with `200`.
- **Why it matters:** Anonymous callers can collect useful operational recon data without authentication, and the same endpoint is already overloaded as both status page and machine gate.
- **Recommendation:** Split public liveness from privileged diagnostics, minimize unauthenticated payload detail, and require auth or internal-only access for richer probe output.
- **Expected impact:** Reduces operational information leakage while preserving health checks.
- **Effort estimate:** S

#### SE-M2 Dependency audit posture is split across inconsistent toolchains, and the mailer chain is already flagged
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `package.json:81`
- **What's happening:** `npm audit --json` on April 23, 2026 reported `3` moderate vulnerabilities in the `resend -> svix -> uuid` chain, while the repo simultaneously declares `pnpm` without a committed `pnpm-lock.yaml`, leaving audit/update workflows split across incompatible tool paths.
- **Why it matters:** Known advisory debt already exists, and the repo’s dependency-review process is weaker than it appears because there is no single canonical install/audit path.
- **Recommendation:** Pick one package-manager truth, commit its lockfile, then clear the `resend` advisory chain on that canonical path.
- **Expected impact:** More reliable supply-chain review and removal of known dependency exposure.
- **Effort estimate:** S

#### SE-M3 Sensitive and operationally important flows still bypass the redacted logger
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/logger.ts:1-214`, `src/app/api/voice-access/route.ts:35-43`, `src/app/api/admin/stories/[id]/route.ts:63-144`, `src/app/api/admin/stories/bulk-status/route.ts:30-54`
- **What's happening:** The repo has a structured redacting logger, but multiple server paths still log raw errors through `console.error` instead of the shared logger.
- **Why it matters:** Sensitive or operationally important error data is more likely to bypass consistent redaction, structure, and correlation behavior exactly where server failures matter most.
- **Recommendation:** Standardize on the shared logger for all server and API error paths, especially around auth, admin, and payment-related flows.
- **Expected impact:** Safer logs and more uniform incident forensics.
- **Effort estimate:** M

#### SE-M4 Admin mutations rely on service-role access without a visible audit trail
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/admin-auth.ts:75-92`, `src/app/api/admin/stories/[id]/route.ts:52-113`, `src/app/api/admin/stories/bulk-status/route.ts:28-46`
- **What's happening:** Admin routes validate user role, then execute writes through `createAdminClient()` with service-role privileges, but the write paths do not persist who performed the mutation or emit a durable audit record.
- **Why it matters:** High-privilege content changes are harder to investigate, attribute, or roll back cleanly once multiple operators are involved.
- **Recommendation:** Add durable admin audit events for every mutation path and record actor identity alongside the write.
- **Expected impact:** Better accountability and safer operation of privileged admin workflows.
- **Effort estimate:** M

## 9. Code Quality / Maintainability Findings (Principal Architect)
### Domain Model
The codebase flows from App Router pages/components into `src/lib`, `src/config`, and `src/types`, with shared hotspots around env/config, auth, story types, and admin helpers. Typecheck is healthy, but dependency/tooling discipline and shared-layer API boundaries are weaker than they should be at launch.

#### AR-H1 The shared env/config boundary is not actually the source of truth
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/env.ts:2-8`, `src/lib/env.ts:37-40`, `src/lib/supabase.ts:3-18`, `src/lib/stories-server.ts:23-30`, `src/lib/stripe.ts:16-21`, `src/lib/stripe.ts:45-49`, `src/lib/stripe.ts:121-136`, `src/app/layout.tsx:24`, `src/app/layout.tsx:124-127`
- **What's happening:** The repo documents `src/lib/env.ts` as the env-variable choke point, but core modules still read `process.env` directly and handle missing config inconsistently.
- **Why it matters:** The same deployment drift can hard-fail some code paths, quietly degrade others, and bypass the one module intended for validation.
- **Recommendation:** Make `src/lib/env.ts` the only public env access layer and move required-var checks out of module scope.
- **Expected impact:** Predictable startup behavior and easier deployment audits.
- **Effort estimate:** M

#### AR-H2 Dependency management has no single operational source of truth
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `package.json:15`, `package.json:110`, `package.json:135`, `src/lib/sentry-before-send.ts:1`
- **What's happening:** The repo declares `pnpm` as the package manager, but there is no `pnpm-lock.yaml`, so `pnpm outdated` fails immediately. A directly imported package also appears only transitively.
- **Why it matters:** Dependency updates, supply-chain review, and CI installs are less reproducible than the manifest suggests.
- **Recommendation:** Pick one package manager, commit its lockfile, remove the conflicting path, and declare every directly imported dependency explicitly.
- **Expected impact:** Deterministic installs and usable dependency-audit workflows.
- **Effort estimate:** M

#### AR-M1 The shared barrel/type layer is accumulating real cycles and stale exports
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/types/index.ts:42-43`, `src/types/sse.ts:1-23`, `src/lib/proxy/index.ts:1-26`, `src/lib/schemas.ts:21-58`
- **What's happening:** The shared type layer contains a real cycle and several stale exports surfaced by dependency analysis.
- **Why it matters:** This increases refactor risk and makes the shared layer harder to reason about.
- **Recommendation:** Break the SSE/type cycle and keep dead-code checks in regular CI.
- **Expected impact:** Cleaner module boundaries and less shared-layer drift.
- **Effort estimate:** S

#### AR-S1 Cross-domain orchestration is concentrated in a few oversized modules
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/app/admin/page.tsx:6-17`, `src/components/admin/admin-shell.tsx:60-122`, `src/components/admin/admin-shell.tsx:126-166`, `src/components/admin/admin-shell.tsx:342-689`, `src/app/api/chat/stream/route.ts:103-170`, `src/lib/claude.ts:21-223`, `src/lib/claude.ts:233-531`
- **What's happening:** The admin surface and chat stack are organized around orchestration-heavy files rather than narrower feature boundaries.
- **Why it matters:** Ordinary changes are more likely to collide in the same files and resist targeted testing.
- **Recommendation:** Split orchestration layers into smaller controllers/services with clearer ownership.
- **Expected impact:** Smaller review surfaces and safer iteration.
- **Effort estimate:** L

## 10. Testing / QA Findings (QA / Reliability Lead)
### Domain Model
Verification is strong at the unit/static layer and weak at the product-journey layer. Public-route correctness currently depends on integration between auth bootstrap, feature flags, story loading, and mobile controls, and that is exactly where the current Playwright failures concentrate.

#### QA-B1 Public end-to-end verification is still failing broadly across launch-critical flows
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `e2e/suggestions.spec.ts:28-202`, `e2e/checkout.spec.ts:16-157`, `e2e/favorites.spec.ts:4-26`, `e2e/chat.spec.ts:33-106`, `e2e/pre-launch.spec.ts:87-415`, `e2e/qa-journey.spec.ts:51-400`
- **What's happening:** On April 23, 2026, local verification produced a split result: `npm run test` passed `323` files / `6028` tests, `npm run typecheck` passed, `npm run lint` passed, `npm run build` passed, but `npm run test:e2e` finished with `100 passed`, `44 failed`, `32 skipped`.
- **Why it matters:** The remaining failures are concentrated in real launch-facing behavior: suggestions, chat open/send flows, pricing/favorites pages, mobile interaction, and QA-journey journeys. The suite is not close enough to green to treat those paths as launch-safe.
- **Recommendation:** Make the E2E failures a release gate and triage them into real regressions vs. stale assertions, starting with public mobile, anonymous pricing/favorites, and suggestion/chat entry.
- **Expected impact:** Restores trust in the only verification layer that exercises the full public product.
- **Effort estimate:** L

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)
### Domain Model
The public UX is dominated by the immersive viewer, its toolbar/overflow controls, and a small number of secondary routes such as pricing and favorites. The riskiest issues are not visual polish gaps but broken or misleading affordances on public mobile and anonymous-entry flows.

#### UX-H1 The mobile “Suggest Place” affordance is wired to a trigger that does not exist in mobile layouts
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-viewer.tsx:392-460`, `src/components/immersive/suggest-place-button.tsx:14-21`
- **What's happening:** The real `SuggestPlaceButton` is rendered only inside `hidden md:block`, but the mobile overflow menu still exposes a “suggest” action that tries to click `[data-suggest-place-trigger]`.
- **Why it matters:** On mobile, the menu advertises a feature path that is not reliably present in the DOM, which is consistent with the failed suggestion journeys in E2E.
- **Recommendation:** Give mobile its own first-class suggestion trigger instead of delegating through a hidden desktop control.
- **Expected impact:** The suggestion flow becomes coherent and usable on public mobile.
- **Effort estimate:** S

#### UX-H2 Anonymous pricing and favorites routes can stay trapped behind loading states instead of rendering an immediate usable fallback
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/auth/auth-provider.tsx:28-61`, `src/hooks/use-voice-access.ts:83-88`, `src/app/pricing/page.tsx:72-100`, `src/app/favorites/page.tsx:79-86`
- **What's happening:** Anonymous public pages depend on auth/bootstrap loading state before deciding whether to show pricing or favorites UI, and local E2E screenshots captured spinner/skeleton-only states on those routes.
- **Why it matters:** These are public, intent-heavy routes. A launch funnel that can sit behind loading chrome instead of immediately rendering a usable anonymous path is a direct UX and conversion risk.
- **Recommendation:** Treat anonymous as a first-class resolved state and render the public path immediately, then layer auth-dependent enhancements afterward.
- **Expected impact:** Faster, clearer public routes and less user confusion on mobile/anonymous entry.
- **Effort estimate:** M

## 12. Prioritized Action Plan
| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| BE-B1 | BE | Booking persistence is broken against the current database contract | launch-blocker | Before launch | M | Restores durable booking records and webhook/SMS correlation |
| QA-B1 | QA | Public end-to-end verification is still failing broadly across launch-critical flows | launch-blocker | Before launch | L | Restores confidence in real user paths |
| SE-H1 | SE | Visitor voice access control is exposed in browser-side feature-flag config | high | Before launch | M | Removes a high-sensitivity access-control decision from the browser |
| DO-H2 | DO | Real-runtime preview validation is not actually enforced on `main` | high | Before launch | S | Reinstates a meaningful production release gate |
| DO-H1 | DO | Degraded health states do not fail monitoring or preview validation | high | Before launch | M | Makes degraded dependencies visible to CI and monitoring |
| FE-H1 | FE | Feature flags do not have a single hydrated source of truth inside the immersive experience | high | Before launch | M | Prevents rollout-state drift within the main product surface |
| UX-H1 | UX | The mobile “Suggest Place” affordance is wired to a trigger that does not exist in mobile layouts | high | Before launch | S | Fixes a broken public mobile affordance |
| UX-H2 | UX | Anonymous pricing and favorites routes can stay trapped behind loading states | high | Before launch | M | Improves public funnel usability and conversion readiness |
| PE-H1 | PE | The global client shell is still heavier and broader than the route mix justifies | high | Before launch | M | Reduces shared startup cost across public routes |
| PE-H2 | PE | The immersive route duplicates story and feature-flag hydration across mismatched caches | high | Before launch | M | Reduces duplicate boot work on the core product surface |
| AR-H1 | AR | The shared env/config boundary is not actually the source of truth | high | Before launch | M | Makes config behavior predictable across deployments |
| AR-H2 | AR | Dependency management has no single operational source of truth | high | Before launch | M | Restores deterministic dependency/update workflows |
| BE-H1 | BE | Booking initiation has no idempotency boundary before the real-world side effect | high | Before launch | M | Prevents duplicate outbound booking calls |
| BE-H2 | BE | SMS delivery is outside the durable idempotent workflow | high | Before launch | M | Prevents silent customer-facing delivery loss |
| BE-H3 | BE | Translation jobs can be stranded because the queue is just an HTTP trigger plus a permanent claim row | high | Before launch | L | Makes translation automation recoverable |
| PE-H3 | PE | Chat first-token latency still chains several sequential remote steps before streaming begins | high | Before launch | M | Makes chat feel materially faster on first response |
| SE-M1 | SE | Public health endpoints leak recon and configuration state | medium | Before launch | S | Reduces anonymous operational information leakage |
| AR-M1 | AR | The shared barrel/type layer is accumulating real cycles and stale exports | medium | After launch | S | Cleans the shared layer and reduces refactor risk |
| FE-M3 | FE | Favorites state management is internally inconsistent about anonymous persistence | medium | After launch | S | Clarifies favorites behavior and removes dead branches |
| PE-M1 | PE | The Edge hot path is broader than necessary and still intersects with Node-only logging code | medium | After launch | M | Lowers Edge/runtime risk across the request path |
| DO-M1 | DO | Env and secret validation only covers part of the real operational surface | medium | After launch | M | Prevents silent workflow drift |
| FE-M1 | FE | `useStories` performs cache bootstrap during render | medium | After launch | M | Stabilizes hydration on story-backed routes |
| BE-M1 | BE | Write-path validation is only centralized for a minority of routes | medium | After launch | M | Hardens admin and write APIs |
| BE-M2 | BE | Public rate limiting is not reliably global and trusts client-supplied IP headers | medium | After launch | M | Makes abuse controls consistent across replicas |
| DO-M3 | DO | Core ops runbooks are drifting on production controls | medium | After launch | M | Improves release/rollback trust under pressure |
| SE-M2 | SE | Dependency audit posture is split across inconsistent toolchains, and the mailer chain is already flagged | medium | After launch | S | Improves supply-chain review and removes known advisory debt |
| SE-M3 | SE | Sensitive and operationally important flows still bypass the redacted logger | medium | After launch | M | Makes logging safer and more consistent |
| SE-M4 | SE | Admin mutations rely on service-role access without a visible audit trail | medium | After launch | M | Improves accountability for privileged changes |
| FE-M2 | FE | Global client providers pull auth and analytics bootstrap into every route | medium | After launch | M | Reduces unnecessary client work on low-interactivity pages |
| DO-M2 | DO | Migration safety is policy-driven, not pipeline-enforced | medium | After launch | L | Shifts database risk left into CI |
| DO-S1 | DO | Alerting and incident response are only partially operationalized | strategic | Later | M | Turns detection into actionable incident response |
| AR-S1 | AR | Cross-domain orchestration is concentrated in a few oversized modules | strategic | Later | L | Lowers blast radius for future changes |

## 13. Top 10 Highest-ROI Improvements
1. `BE-B1` Reconcile booking schema and code. This removes a direct correctness failure in a live transactional flow. Expected impact: durable end-to-end booking state.
2. `QA-B1` Triage and fix the E2E failure clusters. This is the fastest way to regain confidence in public launch behavior. Expected impact: reliable launch verification.
3. `SE-H1` Move visitor voice authorization and agent selection behind a server boundary. This removes an avoidable browser-side trust decision on a paid/gated feature. Expected impact: tighter access control and less sensitive client exposure.
4. `DO-H2` Make preview smoke a required check on `main`. This is a small change with outsized release-safety value. Expected impact: real-runtime release gating.
5. `DO-H1` Add a machine-readable degraded health failure path. This turns existing observability into an actual control. Expected impact: degraded systems stop looking healthy.
6. `FE-H1` Seed immersive feature flags once and consume them everywhere. This fixes both rollout correctness and duplicate client bootstrap. Expected impact: consistent main-surface behavior.
7. `UX-H2` Render anonymous pricing/favorites states immediately. This is a direct conversion and usability fix. Expected impact: better public-funnel responsiveness.
8. `UX-H1` Replace the hidden-trigger mobile suggestion path with a first-class mobile control. Small implementation, clear product benefit. Expected impact: working mobile submission flow.
9. `PE-H2` Collapse immersive story/flag hydration into one route-scoped data model. This cuts duplicate boot work on the core experience. Expected impact: faster and more stable immersive startup.
10. `PE-H3` Shorten the serialized pre-stream chat path. This directly improves perceived responsiveness on a flagship interaction. Expected impact: lower first-token latency.

## 14. Before Launch / After Launch / Later Strategic
### Before launch (Wave 1)
- `BE-B1`: Booking persistence is broken against the current database contract
- `QA-B1`: Public end-to-end verification is still failing broadly across launch-critical flows
- `SE-H1`: Visitor voice access control is exposed in browser-side feature-flag config
- `DO-H2`: Real-runtime preview validation is not actually enforced on `main`
- `DO-H1`: Degraded health states do not fail monitoring or preview validation
- `FE-H1`: Feature flags do not have a single hydrated source of truth inside the immersive experience
- `UX-H1`: The mobile “Suggest Place” affordance is wired to a trigger that does not exist in mobile layouts
- `UX-H2`: Anonymous pricing and favorites routes can stay trapped behind loading states instead of rendering an immediate usable fallback
- `PE-H1`: The global client shell is still heavier and broader than the route mix justifies
- `PE-H2`: The immersive route duplicates story and feature-flag hydration across mismatched caches
- `AR-H1`: The shared env/config boundary is not actually the source of truth
- `AR-H2`: Dependency management has no single operational source of truth
- `BE-H1`: Booking initiation has no idempotency boundary before the real-world side effect
- `BE-H2`: SMS delivery is outside the durable idempotent workflow
- `BE-H3`: Translation jobs can be stranded because the queue is just an HTTP trigger plus a permanent claim row
- `PE-H3`: Chat first-token latency still chains several sequential remote steps before streaming begins
- `SE-M1`: Public health endpoints leak recon and configuration state

### After launch (Wave 2)
- `AR-M1`: The shared barrel/type layer is accumulating real cycles and stale exports
- `FE-M1`: `useStories` performs cache bootstrap during render
- `FE-M2`: Global client providers pull auth and analytics bootstrap into every route
- `FE-M3`: Favorites state management is internally inconsistent about anonymous persistence
- `BE-M1`: Write-path validation is only centralized for a minority of routes
- `BE-M2`: Public rate limiting is not reliably global and trusts client-supplied IP headers
- `PE-M1`: The Edge hot path is broader than necessary and still intersects with Node-only logging code
- `DO-M1`: Env and secret validation only covers part of the real operational surface
- `DO-M2`: Migration safety is policy-driven, not pipeline-enforced
- `DO-M3`: Core ops runbooks are drifting on production controls
- `SE-M2`: Dependency audit posture is split across inconsistent toolchains, and the mailer chain is already flagged
- `SE-M3`: Sensitive and operationally important flows still bypass the redacted logger
- `SE-M4`: Admin mutations rely on service-role access without a visible audit trail

### Later / strategic (Wave 3)
- `AR-S1`: Cross-domain orchestration is concentrated in a few oversized modules
- `DO-S1`: Alerting and incident response are only partially operationalized

## 15. Open Questions / Assumptions
- This audit used 8 specialist tracks, but the Codex harness only allowed 6 concurrent spawned agents; the remaining tracks were completed locally during the same audit pass.
- `npm run build` passed locally after Playwright shut down its preview server, so the Edge logger issue is currently a warning-level compatibility problem, not a hard build failure.
- The E2E failures almost certainly contain a mix of real regressions and stale assertions. This report treats the current suite state itself as blocking because the failing clusters are concentrated on launch-facing journeys.
- `npm audit --json` succeeded through the current `npm` lockfile path, while `pnpm audit`/`pnpm outdated` failed because the repo declares `pnpm` without a `pnpm-lock.yaml`. I treated that as a tooling-discipline issue, not just a command mismatch.
- I did not perform any live production probing, release PR creation, deployment, or external config changes.

## 16. Final Verdict
- Verdict (repeat from §1 for parser): NOT READY
- What would most worry you about shipping today?
  Booking requests that appear to succeed but fail to persist, plus a launch where the public mobile/chat/pricing/favorites paths are still not green in end-to-end verification.
- What gives you confidence?
  The branch is clean, the local static/unit/build stack is healthy, recent `develop` CI is green, and the codebase already has solid observability and release-process scaffolding.
- Next 5 actions (ordered)
  1. Fix `BE-B1` by reconciling `pending_bookings` schema/code and making persistence failure fatal.
  2. Triage `QA-B1` into real regressions vs stale tests, starting with mobile suggestions, chat entry, pricing, and favorites.
  3. Move visitor voice allowlist enforcement and agent selection behind a server-verified boundary to close `SE-H1`.
  4. Add a real degraded-state machine gate for preview/monitoring and make preview smoke required on `main`.
  5. Collapse immersive bootstrapping under one hydrated flags/stories model, then rerun build and E2E on the launch-critical public flows.
