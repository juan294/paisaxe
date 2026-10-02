# Pre-Launch Codebase Audit
> Generated on 2026-08-18 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

## 1. Executive Summary

Paisaxe is an unusually well-engineered solo-operator product wrapped around several launch-critical gaps that would not survive contact with real traffic or a payment dispute. The engineering discipline is genuinely high — zero `any`/`ts-ignore`, a cycle-free module graph, 98.9% test-statement coverage, a rigorous tree-hash release protocol, and a durable Postgres-backed job queue with proper `SKIP LOCKED` semantics. But that discipline is concentrated in the parts of the system that are easiest to test, and it thins out sharply at the boundaries that matter most on launch day: authentication is silently disabled on the three routes that carry the entire revenue funnel, the payment/observability stack has never been proven to work end-to-end, and at least two backend paths (translation retries, outbound phone calls) have no cost ceiling at all. Several of these are the kind of finding that a comprehensive read-only audit exists to catch precisely because they produce a green CI and a working demo while being broken for the exact users the product is built for.

**Top 3 strengths (evidence-backed):**
1. **Static analysis and type safety are exceptional.** `npm run typecheck` passes clean across four TS projects, `npx knip` reports zero unused files/exports/dependencies, zero `@ts-ignore`/`any` in non-test source under `strict: true`, and the module dependency graph is fully acyclic with correct layering (`app/api → lib`, no reverse imports) — AR's Domain Model.
2. **The durable-queue design for async work (bookings, translations, webhooks) is architecturally sound.** `FOR UPDATE SKIP LOCKED` claim/lease semantics, idempotency keys, and dedicated webhook-event tables are correctly modeled in Postgres — BE's Domain Model, AR-M1 area.
3. **The release-safety machinery is genuinely rigorous where it runs.** Tree-hash candidate identity (not SHA, because of squash merges), a `required-probes.yaml` manifest that explicitly encodes "a skipped required probe is a vacuous pass," and documented fail-closed gates for Dependabot PRs — DO's Domain Model, DO-S1.

**Top 5 risks (ordered by blast radius):**
1. **Auth is silently disabled on `/immersive`, `/pricing`, and `/favorites`** — the only three routes where signed-in users exist — killing favorites, paid voice access, and the purchase-CTA for every real user (FE-B1).
2. **Two backend paths have no cost ceiling**: the translation queue retries forever with no attempt cap (BE-B1, echoing the exact Anthropic-credit-exhaustion incident that already took down prod chat once), and `/api/mcp/make-booking` places outbound phone calls with no rate limit and no premium-rate blocklist (BE-B2).
3. **Nothing proves the observability stack actually works.** The Sentry project exists and reports "configured," but a 90-day issue query returns zero results — including across the known 2026-07-20 outage window — and the Vercel log drain is still marked "NOT CONFIRMED" in its own runbook (DO-B1).
4. **The pricing page misdescribes what it sells.** All three tiers (day/week/month) display "24 horas" copy regardless of selection, on the screen immediately preceding a card charge (UX-B1).
5. **RLS and default-grant patterns leave the data layer under-defended relative to the API layer.** `feature_flags.config` (containing admin emails) and unapproved story content are anon-readable via direct PostgREST, and a blanket `ALTER DEFAULT PRIVILEGES ... GRANT SELECT TO anon` has already caused three follow-up migrations to retrofit RLS onto tables that shipped without it (SE-H1/H2/H3).

**Verdict: NOT READY.** Six launch-blocker findings were confirmed across four independent specialists (Frontend ×2, Backend ×2, DevOps ×1, UX ×1), each with concrete evidence and a clear before-launch remediation path. None requires an architectural rewrite — the fixes range from S to L effort — but shipping today would mean launching with the paid product's authenticated features non-functional, no verified way to detect an incident, and no ceiling on at least two forms of real-money spend.

---

## 2. System Architecture Overview

Paisaxe is a Next.js 16 App Router monolith (~55.6k LOC non-test source, 754 TS/TSX files) deployed as a single Vercel project (region `fra1`) against one Supabase Postgres project (Zurich) plus Upstash Redis, Stripe, Anthropic, Voyage AI, ElevenLabs, and Twilio.

**Entry points.** Every request passes through `src/proxy.ts`, a nine-step edge pipeline (canonical-domain redirect → story-slug rewrite → maintenance-mode gate → root redirect → CORS → CSRF double-submit + Origin check → Supabase auth-session refresh → request-id → CSP stamping). Beyond the proxy, there are 13 page routes and 59 API route handlers, clustering into: public product APIs (chat, favorites, feature-flags, checkout), MCP tool endpoints called by ElevenLabs voice agents (secret-header auth only), signature-verified webhooks (Stripe, ElevenLabs, translate, Supabase), six Vercel Cron jobs (`CRON_SECRET` on GET, webhook-secret-or-admin-cookie fallback on POST), 31 admin routes (three different auth-enforcement mechanisms), and health probes.

**Core product flow (RAG chat).** `use-stream-chat.ts` → `POST /api/chat/stream` → Upstash rate limit → Zod parse → injection detection → Voyage embedding (Redis-cached) → Supabase `match_chunks` HNSW RPC → Voyage `rerank-2.5` → Claude SSE stream, with per-stage `Promise.race` timeouts that do not actually cancel the underlying upstream call (BE-M4, AR-H2, PE-H5). Production uses the Anthropic SDK; every local, CI, and QA-agent run uses a parallel `curl`-subprocess implementation gated on `NODE_ENV`, so the branch that ships is the one least covered by tests (AR-M3, BE-L1, QA-H3).

**Data access.** Three coexisting Supabase client styles — a proxied anon singleton, per-call service-role clients (33 call sites, no pooling despite a documented-but-unused singleton helper), and raw PostgREST `fetch` — sit atop 100 forward-only migrations. RLS policies are generally present but in at least three documented cases (`feature_flags`, `stories`, a blanket `ALTER DEFAULT PRIVILEGES`) are broader than every application-layer read path, meaning the moderation and privacy logic exists only in TypeScript, not in the database (SE-H1/H2/H3, AR cross-domain note).

**Durable async work.** Bookings, SMS retries, and story translations are modeled as Postgres tables claimed via `SECURITY DEFINER` RPCs with `FOR UPDATE SKIP LOCKED`, `pg_cron`/`pg_net` triggers, and Vercel Cron as a second scheduler. The mechanics are sound; the policy layer on top (retry caps, dead-letter states, worker/enqueuer separation) is incomplete in exactly the two places that matter most for cost control (BE-B1, BE-S1).

**Frontend.** Effectively a single-surface app: `/` and `/story/:slug` both redirect to `/immersive`, which renders one story at a time from a PPR static shell with one dynamic hole. Provider composition (PostHog → Language → FeatureFlags → Auth) is applied per-route via a hand-maintained path allowlist/denylist, which is the direct architectural cause of FE-B1. Client-side data fetching is reimplemented five separate times with no shared library (FE-M4).

**Cross-cutting architecture concern (systemic).** The release-probe subsystem (`quality/required-probes.yaml`) encodes a rigorous principle — "a required probe that skips is a vacuous pass" — but that principle has not propagated outward: a `develop-smoke` CI job has never executed a single probe and always reports green (DO-H1), a `vercel-env-safety` job has never run because its token secret is unset (DO-M2), and a documented `--require-sentry` release flag does not exist in the workflow it's supposed to gate (DO-H4). This is the single most consequential architectural pattern in the report (DO-S1): one subsystem holds verification discipline, and nothing outside it inherits it.

---

## 3. End-to-End Flow Analysis

**Chat (Ask).** Reviewed by BE, PE, AR, QA. The pipeline is well-instrumented with per-stage timeouts but those timeouts race rather than cancel (BE-M4), retry budgets stack across two independent layers for up to 12 Anthropic calls per request (AR-H2), and no automated gate exercises the real embedding→search→rerank→generate path end-to-end — every browser test mocks the SSE response (QA-H2). The legacy non-streaming `/api/chat` route is dead to users but still live, carrying a security preamble that has already diverged from its streaming replacement (AR-H1, BE-H6).

**Purchase → Voice (paid funnel).** Reviewed by FE, UX, BE, SE. This is the most damaged flow in the audit. Auth is disabled by a path-allowlist bug on the exact three routes serving this funnel (FE-B1), the tier selector loses the user's chosen tier across a sign-in redirect (UX-H4), the pricing copy is wrong for two of three tiers (UX-B1), suggested-question chips are silently dropped once voice mode activates (UX-H1), and the Stripe webhook grants access without checking `payment_status`, which is latent today only because payment methods are hardcoded to `card` (BE-M5, SE-M2 — independently confirmed by two specialists). No E2E test can currently catch any of this because the auth-dependent test journeys are structurally vacuous (FE-B2, QA-H1).

**Booking (via voice agent → MCP tools).** Reviewed by BE, SE. `make-booking` has no rate limit and accepts phone numbers matching Spanish premium-rate ranges (BE-B2, independently corroborated by SE-H4). Timed-out calls are left in an unrecoverable state with no reconciliation path despite a code comment claiming one exists (BE-H2). Webhook payloads are Zod-parsed and then the raw unvalidated body is used anyway (BE-H3).

**Content moderation / RAG corpus.** Reviewed by SE, BE. Moderation state (`curation_status`) is enforced only in TypeScript; RLS grants full anon read on `stories`, `chunks`, and `images` (SE-H2). Combined with a blanket default-privilege grant from a prior incident fix (SE-H3), this is the most systemic security finding in the report.

**Incident response.** Reviewed by DO. Every documented recovery path has at least one defect: the maintenance-mode kill switch doesn't cover the main app and fails open on a Supabase outage (DO-H3), incident runbook commands reference removed health fields and the wrong HTTP verb (DO-H5), and the observability stack that would let anyone notice an incident has never been proven to deliver (DO-B1).

---

## 4. Frontend / UI Findings (Staff Frontend Engineer)

#### FE-B1 Auth bootstrap is permanently disabled on `/immersive`, `/favorites`, and `/pricing` — every signed-in feature on the main route is dead
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/providers.tsx:18, src/app/providers.tsx:25, src/app/providers.tsx:34-36, src/components/auth/auth-provider.tsx:40-44, src/hooks/use-voice-access.ts:44-48, src/hooks/use-voice-access.ts:116-120, src/hooks/use-favorites.ts:141, src/components/immersive/site-info-menu.tsx:13
- **What's happening:** `Providers` computes `deferInitialAuth = STATIC_PATHS.has(pathname) || DEFERRED_AUTH_PATHS.has(pathname)`, and `DEFERRED_AUTH_PATHS` contains `/immersive`, `/pricing`, `/favorites`. `AuthProvider`'s bootstrap effect never calls `getSession()`/`getUser()` and never registers `onAuthStateChange` on those paths. There is no later re-init and no second `AuthProvider` anywhere in the tree. Downstream: `useFavorites` always returns `requiresAuth: true`; `useVoiceAccess` short-circuits so `hasPaidAccess=false`, `canUseVoice=false`, `needsPurchase=false`; the post-payment deep link opens chat in *text* mode for a user who just paid.
- **Why it matters:** The entire authenticated product — favorites, the paid ElevenLabs voice agent, and the in-chat upgrade CTA — is non-functional on the only route where users actually spend time. This is the revenue path. Comment history shows the paths were grouped in by a hydration-stability fix (#338) and never removed. No test asserts `deferInitialAuth === false` for `/immersive`, and E2E runs with dummy Supabase credentials that skip auth entirely, so nothing catches it.
- **Recommendation:** Reduce `deferInitialAuth` to genuinely anonymous routes only — keep `STATIC_PATHS`, delete `DEFERRED_AUTH_PATHS`. If the original concern was the hydration cost of the `getUser()` round-trip, seed `isLoading` from a server-read cookie-presence check rather than skipping the bootstrap. Add a regression test asserting auth is not deferred for `/immersive`, `/favorites`, `/pricing`.
- **Regression risk:** Re-enabling auth restores a Supabase `getUser()` call during hydration — the static shell must still render identically server/client on the first pass. Verify `StoryViewer` and `SiteInfoMenu` don't shift layout when `user` transitions null→resolved.
- **Expected impact:** Favorites, bookmarks, paid voice, and the purchase CTA start working for signed-in users; the paid-then-return flow lands in voice mode instead of text.
- **Effort estimate:** S

#### FE-B2 The E2E suite structurally cannot catch auth-dependent regressions
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/components/auth/auth-provider.tsx:50-57, src/lib/stories-data.ts:45-49, src/hooks/use-feature-flags.ts:23, src/hooks/use-feature-flags.ts:87-91
- **What's happening:** Three modules detect the E2E environment by sniffing dummy Supabase credentials and take a hard-coded branch: auth is skipped, stories fall back to fixtures, flags bypass the server seed. Every signed-in code path in the frontend is unexercised by the browser test suite.
- **Why it matters:** FE-B1 sat on `develop` behind a green CI. The product's paid funnel has no automated coverage at all.
- **Recommendation:** Add one Playwright project running against a seeded local Supabase Docker stack with a real test user, covering sign-in → bookmark → reload → persists, and purchase → return → voice mode.
- **Regression risk:** Adding a stateful E2E project increases CI cost and flakiness; gate it to release-candidate PRs to `main`, target the local Docker stack, never production Supabase/Stripe.
- **Expected impact:** The revenue funnel gains a real regression gate.
- **Effort estimate:** L

#### FE-H1 Server-only logging infrastructure ships in the visitor client bundle and triggers a CSP `unsafe-eval` violation on every page load
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/hooks/use-stories.ts:14, src/lib/stories-data.ts:4, src/lib/logger.ts:15-17, src/lib/request-context.ts:10-31, src/lib/proxy/csp.ts:39-47
- **What's happening:** The client hook `use-stories.ts` transitively imports `pino` and a `Function("return require")()("node:async_hooks")` call at module scope, which reaches the browser bundle (confirmed in built chunk output) and throws a CSP-blocked `EvalError` on every visit, swallowed but still logged as a CSP violation.
- **Why it matters:** Server-only logging config and an 8-story fallback dataset are downloaded by every visitor; the CSP violation drowns out real violations if reporting is ever added.
- **Recommendation:** Split `stories-data.ts` into server (Supabase + logger) and client-safe modules; route client story fetches through an API route.
- **Regression risk:** `getStoriesFromDB` deliberately reuses a browser-client singleton to avoid duplicate `GoTrueClient` instances — preserve that invariant across the split.
- **Expected impact:** Smaller first-paint bundle; clean CSP violation channel.
- **Effort estimate:** M

#### FE-H2 `/story/:slug` is 308-redirected before it renders, so per-story metadata, OG images, and indexability do not exist
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/lib/proxy/story-rewrite.ts:13-25, src/proxy.ts:27-31, src/app/story/[slug]/page.tsx:14-53, src/app/sitemap.ts:14-19
- **What's happening:** `handleStoryRewrite` 308-redirects every `/story/:slug` before the App Router route can render its `generateMetadata`/OG image, yet `generateStaticParams` still prerenders one page per story that can never be served. All 105 sitemap URLs canonicalize to one generic `/immersive` page.
- **Why it matters:** Sharing is the growth loop; every shared link renders an identical generic card and no story is indexable. `308` is cached indefinitely by clients.
- **Recommendation:** Make `/story/[slug]` a real rendered page with correct metadata, or downgrade to `307` and remove the unreachable prerendered route.
- **Regression risk:** The rewrite was introduced to dodge a hydration crash (#310) — verify that's actually gone before removing it.
- **Expected impact:** Correct per-story social cards; 100+ individually indexable URLs.
- **Effort estimate:** M

#### FE-H3 Focus is yanked out of the open chat panel on every parent re-render, guaranteed ~60s after page load
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/hooks/use-focus-trap.ts:17, src/hooks/use-focus-trap.ts:69-75, src/components/immersive/voice-chat.tsx:72-73, src/app/immersive/immersive-page-content.tsx:191-194, src/hooks/use-feature-flags.ts:149-160
- **What's happening:** A no-op `useMemo` fails to stabilize `onClose`, which is redeclared every render; the feature-flags background refetch at exactly 60s TTL produces a re-render that tears down and reinstalls the focus trap, moving focus out of the dialog.
- **Why it matters:** A user typing in chat has focus stolen mid-sentence one minute into the session, and on every subsequent flag refresh or story revalidation.
- **Recommendation:** Wrap handlers in `useCallback`; make `useFocusTrap` hold `onEscape` in a ref so install/teardown depends only on `[ref, active]`.
- **Regression risk:** The trap's restore-focus-on-close behavior must still fire on genuine close.
- **Expected impact:** Chat input keeps focus for the whole session.
- **Effort estimate:** S

#### FE-H4 The ElevenLabs voice agent never receives the user's access token or the prompt-chip question
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/voice-chat-elevenlabs.tsx:30, src/components/immersive/voice-chat-elevenlabs.tsx:296, src/components/immersive/voice-chat.tsx:236-240, src/components/immersive/voice-chat.tsx:129-136
- **What's happening:** `VoiceChatElevenLabs` accepts `userAccessToken` but `VoiceChat` never supplies it, so MCP tool calls can't authenticate. `initialMessage` from a prompt chip is only written into the text composer's state, which never renders in voice mode.
- **Why it matters:** The paid voice agent cannot complete authenticated tool calls (bookings, favorites), and tapping a suggested question in voice mode discards it silently.
- **Recommendation:** Pass `session?.access_token` down as `userAccessToken` (meaningful once FE-B1 is fixed); forward `initialMessage` as a dynamic variable to the agent.
- **Regression risk:** Sending an access token as an ElevenLabs dynamic variable puts a bearer credential in a third-party payload — coordinate with SE before shipping.
- **Expected impact:** Voice MCP tools can authenticate; prompt chips carry into voice sessions.
- **Effort estimate:** M

#### FE-M1 Streaming chat re-renders and re-parses the entire conversation on every token
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/hooks/use-stream-chat.ts:329, src/components/immersive/voice-chat.tsx:147-170, src/components/markdown/basic-markdown.tsx:258-266
- **What's happening:** `sendMessage`'s dep array includes the full `messages` array, changing on every token; `BasicMarkdown` re-parses the whole accumulated string on each render with no memoization and index-keyed blocks.
- **Why it matters:** This is the product's core mobile interaction; cost scales with response length.
- **Recommendation:** Hold `messages` in a ref; memoize `parseBlocks`; key blocks by content-derived stable key.
- **Regression risk:** The turn-cap check must still read the current array; verify no dropped keystrokes.
- **Expected impact:** One memoized row update per token instead of full-subtree render plus re-parse.
- **Effort estimate:** M

#### FE-M2 `StoryInfoPanel`'s memoization is defeated by two props recreated every render
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-viewer.tsx:232, story-viewer.tsx:243, src/components/immersive/story-info-panel.tsx:45
- **What's happening:** `localizedStory` and `questionPrompts` are freshly allocated every render, defeating a `memo` whose own comment claims stabilization.
- **Why it matters:** The code and comment assert a performance property that doesn't hold.
- **Recommendation:** `useMemo` `localizedStory`; hoist a module-level empty-array constant.
- **Regression risk:** `getLocalizedStory` must stay pure for the memo to be sound.
- **Expected impact:** Panel genuinely skips re-render on index-only changes.
- **Effort estimate:** S

#### FE-M3 Adjacent-image "preload" fetches a different URL than the one the browser actually requests
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-viewer.tsx:215-226, story-viewer.tsx:250-254, story-viewer.tsx:289-299, next.config.ts:76-99
- **What's happening:** `<link rel="preload">` uses the raw image URL while `next/image` requests the optimizer URL — the two never coincide, so nothing is warmed.
- **Why it matters:** Doubles bytes on the exact navigation it was meant to accelerate (~368KB waste per swipe, measured).
- **Recommendation:** Preload the optimizer URL with matching `imagesrcset`, or render adjacent images as hidden `next/image` with `priority`.
- **Regression risk:** `w`/`q` values must exactly match what `next/image` picks for the viewport.
- **Expected impact:** Adjacent-story navigation actually shows a warmed image.
- **Effort estimate:** S

#### FE-M4 Five bespoke client-side data/cache layers, several with disabled dependency linting
- **Severity:** medium | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/hooks/use-stories.ts:40-44, use-stories.ts:134-141, src/hooks/use-feature-flags.ts:25-29, src/components/admin/analytics-cache-context.tsx:100-180, src/hooks/use-voice-access.ts:37-84, src/hooks/use-favorites.ts:26-75
- **What's happening:** No data-fetching library exists; five independent stale-while-revalidate implementations each with module-level mutable singletons, one mutating cache during render.
- **Why it matters:** Every one is a distinct bug surface — FE-H3's focus steal is a direct consequence of one of these hand-rolled timers.
- **Recommendation:** Adopt one client cache library (TanStack Query) and migrate incrementally post-launch.
- **Regression risk:** Module-level singletons are load-bearing across component instances (shared caches between `/immersive` and `/favorites`); a migration must preserve cross-provider sharing and localStorage persistence.
- **Expected impact:** One cache implementation instead of five.
- **Effort estimate:** XL

#### FE-M5 Dead frontend surface accumulates because the dead-code gate never runs on the team's actual workflow
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/hooks/use-realtime-feature-flags.ts:18, src/lib/realtime.ts:67,97, src/app/pricing/success/page.tsx, src/app/story/[slug]/page.tsx, src/components/posthog-provider.tsx:65-68,127-131, .github/workflows/knip.yml:3-4
- **What's happening:** Unreferenced realtime-flag propagation code, a duplicate `/pricing/success` page, and a childless PostHog provider node shaped entirely by test assertions all survive because `knip.yml` triggers only `on: pull_request`, while the team commits directly to `develop`.
- **Why it matters:** The "no dead code" guardrail cannot fire for normal development; `useRealtimeFeatureFlags` reads as a shipped capability that doesn't exist.
- **Recommendation:** Add `push: branches: [develop]` to the knip trigger; delete the unreferenced exports and duplicate page.
- **Regression risk:** Enabling knip on develop pushes will likely fail on a backlog of unrelated unused exports first.
- **Expected impact:** The dead-code gate becomes real.
- **Effort estimate:** M

#### FE-M6 Media-query hooks read `matchMedia` in their state initializer, diverging from the SSR'd markup
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [inference]
- **Files:** src/hooks/use-reduced-motion.ts:13-16, src/hooks/use-media-query.ts:14-17, src/components/immersive/story-viewer.tsx:104,196-198,285
- **What's happening:** Server renders `false` for reduced-motion; client's first render already returns the real value, causing a hydration mismatch for reduced-motion visitors on the primary route.
- **Why it matters:** React discards server markup for that subtree — precisely the cost the PPR shell exists to avoid.
- **Recommendation:** Initialize to `false`, set the real value in the existing effect; add `motion-reduce:` variants where missing.
- **Regression risk:** One frame of animation before the effect corrects it, unless paired with a CSS variant.
- **Expected impact:** No hydration mismatch for reduced-motion users.
- **Effort estimate:** S

#### FE-M7 Code-splitting is applied inconsistently — the heaviest admin panel and the suggest-place dialog are eagerly bundled
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/admin/admin-shell.tsx:20,38-76,254, src/components/immersive/story-viewer.tsx:19,37-40,426-430,514-517
- **What's happening:** The largest admin tab panel is a static import while five smaller siblings are dynamic; a flag-gated dialog is statically mounted regardless of the flag.
- **Why it matters:** The stated intent of code-splitting isn't achieved in either case.
- **Recommendation:** Make both dynamic and conditionally rendered.
- **Regression risk:** Form state resets on conditional mount; verify no dependent DOM checks.
- **Expected impact:** Smaller entry chunks for both surfaces.
- **Effort estimate:** S

#### FE-L1 `ComponentErrorBoundary`'s retry button cannot recover
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/ui/component-error-boundary.tsx:38-40,42-62
- **What's happening:** Retry only flips `hasError` back to false without remounting; the same crash recurs immediately.
- **Why it matters:** A retry affordance that visibly does nothing is worse than no affordance — the user taps it, the screen flickers, and the error stays.
- **Recommendation:** Remount via a `resetKey` counter.
- **Regression risk:** Remounting discards subtree state (e.g., in-progress voice conversation).
- **Expected impact:** Retry either recovers or is removed.
- **Effort estimate:** S

#### FE-L2 Share URL construction is duplicated with divergent behaviour
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/share-button.tsx:25-61, src/components/immersive/story-viewer.tsx:455-474
- **What's happening:** Two independent share implementations disagree on localization, feedback, and share text.
- **Why it matters:** Sharing is the organic-growth surface of a tourism product, and the mobile path — the one that matters — is the weaker of the two.
- **Recommendation:** Extract a shared `useShareStory` hook.
- **Regression risk:** Desktop/mobile branches currently differ deliberately — preserve that split.
- **Expected impact:** One share implementation with consistent feedback.
- **Effort estimate:** S

#### FE-L3 `useStoryKeyboardNav` registers the same handler twice and re-registers on every navigation
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/hooks/use-story-keyboard-nav.ts:26-63
- **What's happening:** A `WeakSet` suppresses a double-dispatch that a capture-phase listener already prevents; callbacks aren't ref-held so listeners churn every navigation.
- **Why it matters:** Minor, but it is a maintenance trap: the `WeakSet` implies a real double-dispatch problem that no longer exists, so a future reader will be reluctant to touch it.
- **Recommendation:** Keep only the capture listener; hold callbacks in a ref.
- **Regression risk:** Check tests aren't relying on the `window`-level listener for a specific environment quirk.
- **Expected impact:** One listener registered once per session.
- **Effort estimate:** S

#### FE-S1 Auth and locale are resolved entirely client-side, which is the root cause behind several findings
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** src/app/layout.tsx:122-125, src/app/providers.tsx:30-40, src/lib/i18n/provider.tsx:56-68, src/components/auth/auth-provider.tsx:25-123
- **What's happening:** To preserve the PPR static shell, both locale and auth resolve after hydration via a per-path skip-list, which is the direct source of FE-B1 and the i18n first-paint flash.
- **Why it matters:** The skip-list pattern will keep accumulating; FE-B1 is what it looks like when it goes wrong on the revenue path.
- **Recommendation:** Move locale/auth-presence resolution to the proxy (which already runs auth refresh), setting hint headers/cookies read in a route-segment layout, not the root layout.
- **Regression risk:** Any `headers()` call must stay out of the root layout or the PPR shell is lost; a session hint cookie must never be treated as authorization.
- **Expected impact:** Correct first paint for non-Spanish and signed-in users; the whole class of bug behind FE-B1 goes away.
- **Effort estimate:** XL

### Cross-Domain Notes (Frontend)
- SE/BE: `/admin` has no server-side gate — authorization is decided entirely in the browser; the API routes validate independently but any anonymous visitor can download the full admin client bundle.
- SE: CSP `connect-src` has no Sentry ingest host — if a Sentry project is configured, client-side error reporting will be silently blocked.
- PE: bundle analyzer wiring exists but is unused; FE-H1 and FE-M7 identify concrete things to look for in its output.
- DO/QA: the dead-code gate never runs on develop pushes (FE-M5).
- UX: several findings have a11y consequences — `aria-hidden` on `<main>` while chat is open, FE-H3's focus steal, FE-M6's animation-flash trade.
- BE: `/api/checkout/day-pass` has no client caller — the live flow is `/api/checkout/embedded`.

---

## 5. Backend / API / Data Findings (Staff Backend Engineer)

#### BE-B1 Translation queue retries forever with no attempt cap, driving unbounded Anthropic spend
- **Severity:** launch-blocker | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** supabase/migrations/080_fail_stale_translations_support.sql:94-119, supabase/migrations/082_translation_lease_10min.sql:33-52, src/lib/translate-story.ts:184-232
- **What's happening:** `translate_webhook_events.attempts` is incremented but never read as a bound in any query. `fail_stale_story_translations` re-kicks up to 20 jobs every 15 minutes with a flat 5-minute retry, forever. A poison-pill story (Claude refusal, JSON parse failure, deleted story) re-invokes Claude for every locale on every cycle indefinitely.
- **Why it matters:** This is the exact failure mode that already took production down (Anthropic credit exhaustion, 2026-07-20) — a single stuck job silently burns credits until the balance hits zero and chat returns 500s.
- **Recommendation:** Add an attempts-cap predicate to the claim query and the re-kick query; introduce a terminal `dead` status with alerting; switch to exponential backoff.
- **Regression risk:** `attempts` increments on *claim*, not failure — capping on the current counter would kill jobs that were only ever victims of a lease-expiry reclaim (BE-H2's timeout scenario); the cap must be generous or the increment moved to the failure path.
- **Expected impact:** Bounded worst-case translation cost.
- **Effort estimate:** M

#### BE-B2 `/api/mcp/make-booking` places outbound phone calls with no rate limit, no quota, and no premium-rate blocklist
- **Severity:** launch-blocker | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/make-booking/route.ts:110-116, src/lib/services/booking-service.ts:71-86, src/lib/mcp-auth.ts:15-37
- **What's happening:** The only gate is a static shared secret configured inside a third-party ElevenLabs agent. `checkRateLimit` is never called on this route (unlike sibling MCP routes). `isValidSpanishPhone` accepts premium-rate ranges (803/806/807/905/907). Free-text SMS is also sent to a caller-supplied number.
- **Why it matters:** A leaked MCP secret (stored in a third-party SaaS config, not just Vercel env) becomes an unmetered dialer against premium-rate numbers with no ceiling.
- **Recommendation:** Add rate limiting keyed on `customer_phone` plus a global daily counter; add a premium/special-range deny-list; add a per-day SQL-enforced cap on booking inserts.
- **Regression risk:** IP-based keying doesn't work since all calls originate from ElevenLabs' fixed egress; the daily cap must fail open for reads, closed for calls.
- **Expected impact:** Telephony/SMS spend becomes bounded.
- **Effort estimate:** M

#### BE-H1 The database-storage health probe is permanently dead — the anon client cannot execute `get_database_size()`
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/health/route.ts:3,194-219,310-312, supabase/migrations/092_revoke_internal_function_access_fix.sql:58
- **What's happening:** `checkDatabaseSize()` uses the anon client, but migrations 091/092 revoked `EXECUTE` on that function from anon/authenticated. Every call returns a permission error swallowed into `usage_percent: null`, and the 80%-threshold alarm evaluates to `false` unconditionally.
- **Why it matters:** One of `/api/health`'s three probes has silently returned null since migration 092; storage exhaustion would arrive with no warning.
- **Recommendation:** Switch to the admin client; make the null case distinguishable from a passing probe.
- **Regression risk:** Using a service-role client on an unauthenticated route must not leak beyond the single rounded percentage already allow-listed.
- **Expected impact:** Storage exhaustion becomes detectable.
- **Effort estimate:** S

#### BE-H2 Timed-out booking calls are unrecoverable — the documented reconciliation path does not exist
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/make-booking/route.ts:270-274,301-321, supabase/migrations/100_reconcile_recorded_voice_durability.sql:121-142, src/app/api/webhooks/elevenlabs/route.ts:143-166
- **What's happening:** A comment claims "the stale-bookings cron or a late webhook can reconcile," but neither does — the cron unconditionally flips timed-out rows to `failed` with no lookup, and the webhook matches only by `conversation_id`, which timed-out rows never received.
- **Why it matters:** The timeout window is exactly the case where the call may have actually happened — the venue gets called, the customer is told "we'll retry," and the row is silently marked failed with no operator visibility.
- **Recommendation:** Persist a correlation key before the outbound call; add a distinct `orphaned` status that alerts instead of routing to `failed`.
- **Regression risk:** A fallback lookup key must not let one webhook event match two bookings, breaking the existing uniqueness guarantee.
- **Expected impact:** Calls that actually reached the venue stop being silently discarded.
- **Effort estimate:** L

#### BE-H3 Three webhooks build strict Zod schemas and then ignore the parse result — validation is decorative
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/elevenlabs/route.ts:110-173, src/app/api/webhooks/supabase/route.ts:75-87, src/app/api/webhooks/translate/route.ts:196-203
- **What's happening:** All three handlers `safeParse`, log a warning on failure, and then proceed to read the **raw** body regardless of parse outcome.
- **Why it matters:** Worse than no schema — it creates false confidence that downstream code is validated.
- **Recommendation:** Pick one posture per webhook (non-strict parse, enforce, consume `.data` exclusively); the translate handler already models this correctly.
- **Regression risk:** These webhooks are live and signature-verified — a hard 400 on a schema mismatch risks rejecting real provider events if the schema is too strict.
- **Expected impact:** Type annotations become guarantees.
- **Effort estimate:** M

#### BE-H4 Asymmetric phone validation — `customer_phone` is never format-checked but is unconditionally prefixed `+34`
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/schemas.ts:34,52, src/app/api/mcp/make-booking/route.ts:164-176,193-194
- **What's happening:** Only the venue phone is format-validated; the customer's phone is bounds-checked only and then unconditionally `+34`-prefixed if it doesn't already start with `34`.
- **Why it matters:** A malformed customer number silently becomes a valid-looking but wrong Spanish number — the booking confirmation SMS goes nowhere or to an unrelated subscriber, invisibly.
- **Recommendation:** Apply the same format validation to both fields at the schema layer; make normalization throw rather than guess.
- **Regression risk:** Voice-transcribed numbers may legitimately fail tighter validation — coordinate the Spanish-language failure copy with the agent config.
- **Expected impact:** Confirmation SMS reaches the actual visitor.
- **Effort estimate:** S

#### BE-H5 All six cron endpoints accept cookie-based admin auth on POST while being CSRF-exempt
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/csrf.ts:53-58, src/app/api/cron/*/route.ts (six files)
- **What's happening:** The CSRF exemption is justified by "cron uses webhook secret or admin auth," but the admin-auth fallback reads a cookie session — exactly the case CSRF protection exists for.
- **Why it matters:** A logged-in admin visiting a hostile page can be made to trigger any cron job cross-site, including cost-bearing operations (content generation, SMS retries).
- **Recommendation:** Remove the admin-auth fallback from cron handlers; route manual triggering through a non-exempt admin path.
- **Regression risk:** Confirm nothing currently relies on the cookie fallback before removing it.
- **Expected impact:** Cost-bearing jobs stop being reachable from an admin's browser via a hostile page.
- **Effort estimate:** S

#### BE-H6 The chat output safety filter runs only on the endpoint no client calls
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/chat/route.ts:121,222-245, src/app/api/chat/stream/route.ts:224-261, src/hooks/use-stream-chat.ts:120
- **What's happening:** `/api/chat` runs `detectPromptLeakage` and topic-relevance checks; the live `/api/chat/stream` route (the only one any client calls) does neither.
- **Why it matters:** The prompt-leakage defense protects nothing in production; the dead route remains live, billable attack surface.
- **Recommendation:** Delete `/api/chat` and port leak detection into the stream route as a rolling check, or extract a shared pre/post pipeline both routes call.
- **Regression risk:** Leak detection on a stream degrades from "suppress" to "truncate mid-delivery" — verify the client discards accumulated text on error.
- **Expected impact:** The safety filter protects real traffic.
- **Effort estimate:** M

#### BE-M1 MCP rate limits key on caller IP, but every caller is one third-party service
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [inference]
- **Files:** src/app/api/mcp/places/route.ts:294-295,352-353, src/app/api/mcp/weather/route.ts:137,196
- **What's happening:** Rate limiting is keyed on caller IP, but all calls originate from ElevenLabs' egress — the limit is effectively "20/min for the entire product," not per-visitor.
- **Why it matters:** A handful of concurrent voice conversations start 429-ing legitimate tool calls.
- **Recommendation:** Key on a per-conversation identifier with IP fallback; raise the global ceiling.
- **Regression risk:** A caller-supplied conversation ID is spoofable — the global bucket remains the real abuse ceiling.
- **Expected impact:** Concurrent voice sessions stop starving each other.
- **Effort estimate:** M

#### BE-M2 `notify_webhook` regressed to a mutable `search_path`, and the migration guard only checks three hardcoded function names
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** supabase/migrations/025_webhook_config_table.sql:44-48, supabase/migrations/015_security_advisor_fixes.sql:123-127, scripts/check-migrations.ts:43-47,213-239
- **What's happening:** Migration 015 fixed `notify_webhook` to `search_path = ''`; migration 025 later reverted it. The automated guard only checks 3 of 25 `SECURITY DEFINER` functions by name.
- **Why it matters:** The guard's own gap is why the regression slipped through; any future function outside the three names is unguarded.
- **Recommendation:** Replace the allowlist with a general parser over every `SECURITY DEFINER` header; restore `notify_webhook`'s empty path.
- **Regression risk:** A general check will legitimately flag `SECURITY INVOKER` functions needing schema resolution — scope strictly to `SECURITY DEFINER`.
- **Expected impact:** The documented rule becomes enforced.
- **Effort estimate:** S

#### BE-M3 No route declares `maxDuration`, yet queue batch sizes are tuned against an assumed 60s budget
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/translate/route.ts:10-16, src/lib/chat-stream-timeouts.ts:3-8, vercel.json
- **What's happening:** Batch size (3) and lease duration are justified by a comment assuming Vercel's 60s default — nothing declares or enforces that assumption.
- **Why it matters:** If the effective limit differs, batches are killed mid-job or the tuning is needlessly conservative.
- **Recommendation:** Declare `maxDuration` explicitly on every long-running handler.
- **Regression risk:** Confirm the actual plan limit with DO before choosing numbers.
- **Expected impact:** Queue tuning becomes verifiable.
- **Effort estimate:** S

#### BE-M4 Stage timeouts race but never cancel — the underlying upstream call keeps running and billing
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/chat-stream-timeouts.ts:28-65, src/lib/embeddings.ts:34-39, src/lib/claude.ts:324-341
- **What's happening:** `Promise.race` timeouts cannot cancel the already-started upstream fetch; the codebase already has the correct `AbortSignal` pattern in `/api/health` but didn't apply it to the request path.
- **Why it matters:** Timed-out embedding/generation calls continue running and billing after the client has moved on.
- **Recommendation:** Thread `AbortSignal` into Voyage/Anthropic/rerank calls.
- **Regression risk:** Aborting mid-stream must not be mistaken for a real error by the caller.
- **Expected impact:** Timeouts stop paying for work nobody receives.
- **Effort estimate:** M

#### BE-M5 Stripe webhook handles one event type — refunds, disputes, and failed async payments never revoke access
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:69-71, src/lib/stripe.ts:114-124
- **What's happening:** Only `checkout.session.completed` grants access; nothing handles refunds, disputes, or checks `payment_status` before granting (mitigated today only because payment methods are hardcoded to card).
- **Why it matters:** A refunded pass keeps its access; enabling any delayed-settlement payment method (SEPA, Bizum) would open a free-access path with no code change.
- **Recommendation:** Guard on `payment_status === "paid"`; handle refund/dispute events to expire the matching grant.
- **Regression risk:** Refund events carry a Charge, not a PaymentIntent — needs a lookup, and must stay idempotent.
- **Expected impact:** Refunds/chargebacks actually remove access.
- **Effort estimate:** M

#### BE-M6 Three data-access styles coexist, and the documented singleton optimization is dead code
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/supabase-admin.ts:46-55, src/lib/supabase.ts:52-58, src/lib/feature-flags-server.ts:27-38, src/lib/services/booking-service.ts:198,230,295,335
- **What's happening:** A documented "singleton admin client" optimization has zero call sites; 33 files construct a fresh client per call instead.
- **Why it matters:** A reviewer sees the optimization comment and assumes the fix landed — it didn't.
- **Recommendation:** Adopt the singleton across call sites, or delete it and drop the claim.
- **Regression risk:** Cookie-bound clients must never be singletonized — only the stateless service-role client qualifies.
- **Expected impact:** Fewer per-request allocations on the booking hot path.
- **Effort estimate:** M

#### BE-M7 Embedding cache key omits model and dimension
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/embedding-cache.ts:5,28-30, src/lib/embeddings.ts:10-12
- **What's happening:** The Redis key is derived from query text alone; model and dimension constants (already changed once via migration 017) don't participate in the key.
- **Why it matters:** The next model/dimension change silently serves stale-model vectors for 24h, or crashes `match_chunks` on a dimension mismatch intermittently.
- **Recommendation:** Include model and dimension in the key.
- **Regression risk:** Deploy off-peak — the key-format change orphans all existing entries at once.
- **Expected impact:** Model/dimension changes become safe.
- **Effort estimate:** S

#### BE-M8 MCP endpoints return raw internal error messages into the voice agent's context
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/places/route.ts:340,397, src/app/api/mcp/weather/route.ts:180,183,239,242, src/app/api/mcp/make-booking/route.ts:341-346
- **What's happening:** Six call sites return `err.message` verbatim, which an LLM then reads aloud to visitors.
- **Why it matters:** Internal error detail (hostnames, constraint names) becomes something Pelayo says out loud.
- **Recommendation:** Return a stable code plus Spanish guidance; gate detail behind `NODE_ENV === "development"` as other routes already do.
- **Regression risk:** ElevenLabs agent prompts may be written against the current message shape — coordinate the copy change.
- **Expected impact:** Internal detail stops reaching visitors.
- **Effort estimate:** S

#### BE-M9 Public feature-flags endpoint scrubs config by denylist
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/feature-flags/route.ts:15-28,49-52
- **What's happening:** Only one named flag has its sensitive keys stripped; any other flag's full config is published unmodified.
- **Why it matters:** The default is "publish" — the next admin adding a secret to any flag's config leaks it with no code change.
- **Recommendation:** Invert to an allowlist of publishable keys per flag.
- **Regression risk:** Enumerate current consumers before switching, since dropped keys fail silently.
- **Expected impact:** New flag configs are private by default.
- **Effort estimate:** S

#### BE-M10 The `pending_bookings` PII table is excluded from the migration security guard and has no retention policy
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** scripts/check-migrations.ts:36-41, supabase/migrations/053_pending_bookings.sql:5-41
- **What's happening:** The table holding customer names, phones, and special requests is the one PII table omitted from the automated posture guard, and no migration ever expires rows.
- **Why it matters:** Not currently exploitable (RLS-with-no-policies denies by default), but the highest-PII table is the one exempt from the check that would catch a future permissive policy.
- **Recommendation:** Add the table to the guard; add a retention job.
- **Regression risk:** Adding it to the guard requires the parity migration to land in the same change or CI breaks.
- **Expected impact:** The highest-PII table gets the same enforced posture as its siblings.
- **Effort estimate:** M

#### BE-M11 SMS retry exhaustion is a silent dead-letter
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** supabase/migrations/100_reconcile_recorded_voice_durability.sql:249-258, src/app/api/cron/retry-booking-sms/route.ts:8-10,109-124
- **What's happening:** Jobs at max attempts are never claimed again and never counted anywhere, so a broken Twilio config looks identical to an idle queue.
- **Why it matters:** A visitor who booked via voice never learns their confirmation SMS failed, permanently, with zero signal.
- **Recommendation:** Add a terminal `dead` status, counted and logged at ERROR.
- **Regression risk:** The webhook path's attempt semantics differ from the cron's — don't misclassify.
- **Expected impact:** Undelivered booking outcomes become visible.
- **Effort estimate:** M

#### BE-M12 Bearer-token clients cannot use the voice endpoints — auth context is dropped on the second client
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/lib/supabase-auth.ts:10-38,51-82, src/app/api/voice-session/route.ts:11-31, src/app/api/voice-access/route.ts:16-33
- **What's happening:** `getSupabaseClient()` is called with no `request` argument on two voice routes, so bearer auth succeeds at the user-lookup step but the follow-up RLS-scoped query runs unauthenticated.
- **Why it matters:** A bearer-authenticated caller gets a false "voice access required" denial that looks like a business decision.
- **Recommendation:** Pass `request` through consistently, as `/api/favorites` already does correctly.
- **Regression risk:** Verify RLS policy grants identical visibility under cookie and bearer auth.
- **Expected impact:** The documented API-client auth path actually works.
- **Effort estimate:** S

#### BE-L1 The production Anthropic code path is the least-tested one
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/claude.ts:50,308-315,324-341,342-383
- **What's happening:** `USE_CURL = process.env.NODE_ENV !== "production"` selects `callWithCurl` (a `child_process`+curl subprocess with its own retry loop) in dev/test and `callWithSDK` (17 lines, no timeout) in production. Vitest sets `NODE_ENV=test`, so the entire claude.test.ts suite exercises the curl branch that never ships.
- **Why it matters:** Test confidence is inverted relative to risk — the curl path has all the complexity and coverage; the SDK path carries all production traffic. Retry/backoff timing differs between the two, so local behavior doesn't predict production. The API key is also passed as a curl argv element, visible in `ps` on a shared machine.
- **Recommendation:** Re-run the documented Turbopack reproduction and, if resolved on current Next.js, remove the curl branches per the file's own header comment plan. Failing that, switch the gate to an explicit opt-in env var.
- **Regression risk:** The curl workaround exists because of a documented Turbopack/HTTPS regression — removing it without reproducing risks reintroducing a dev-server outage. Flipping tests to the SDK path requires reworking every mock intercepting `execFile`.
- **Expected impact:** Coverage aligns with risk; one subprocess dependency and one argv key-exposure removed.
- **Effort estimate:** M

#### BE-L2 `approve-all`'s `VERCEL_URL` fallback can never work
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/admin/stories/approve-all/route.ts:17-20,28-42
- **What's happening:** `NEXT_PUBLIC_APP_URL?.trim() || VERCEL_URL?.trim() || ""` is used directly as a fetch base URL, but Vercel sets `VERCEL_URL` to a bare hostname with no scheme, so `fetch` throws `TypeError: Failed to parse URL`, silently caught into a log line.
- **Why it matters:** The fallback reads as redundancy but provides none — if `NEXT_PUBLIC_APP_URL` is ever unset, every ping fails identically, just with more log noise. Translation still eventually happens via the 15-minute cron, so impact is latency, not loss, but the fallback creates a false sense of resilience.
- **Recommendation:** Use `https://${process.env.VERCEL_URL}` for the fallback; log once at the call site rather than per-loop-iteration.
- **Regression risk:** Making the fallback functional means `approve-all` on a preview deployment would POST to the preview's own webhook handler, which shares production Supabase — restrict the fallback to `VERCEL_ENV === "production"`.
- **Expected impact:** The fallback either works or is honestly absent.
- **Effort estimate:** S

#### BE-L3 Dead code contradicting documented architecture: `keywordSearch` and the "hybrid search" claim
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/search.ts:140-160,79-119
- **What's happening:** CLAUDE.md states the architecture is "hybrid search: vector similarity + keyword matching." `keywordSearch` is fully implemented (full-text `websearch` against the Spanish config) and exported, but has no non-test caller — `search()` is purely vector + rerank.
- **Why it matters:** Anyone reasoning about recall (or debugging "why didn't it find X") starts from a false model. The project's own "no dead code — Knip reports unused exports" guardrail is demonstrably not catching a clear violation, undermining confidence in the other guardrails.
- **Recommendation:** Decide whether hybrid retrieval is wanted. If yes, wire `keywordSearch` into `search()` and fuse result sets. If no, delete it and correct the CLAUDE.md line.
- **Regression risk:** Enabling hybrid search changes which chunks reach the reranker and therefore which sources are cited — a retrieval-quality change needing evaluation, not a wiring change. Deleting removes the only Spanish full-text query in the codebase; confirm no migration index exists solely to serve it.
- **Expected impact:** Documentation matches reality; the dead-code guardrail is verified to actually work.
- **Effort estimate:** S

#### BE-L4 `grant_day_pass_idempotent`'s atomicity "invariant" is a no-op sub-block
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** supabase/migrations/099_grant_day_pass_purchase_type.sql:105-125
- **What's happening:** The `voice_purchases` INSERT is wrapped in a redundant `BEGIN...EXCEPTION WHEN OTHERS THEN RAISE; END` block documented as providing an atomicity invariant. A PL/pgSQL function already executes in a single transaction — an unhandled exception rolls back the whole function identically without the block, which additionally forces a more expensive Postgres savepoint.
- **Why it matters:** The behavior is correct but for a reason unrelated to the code that claims to produce it — a future "simplification" or a copied idiom elsewhere could inherit a pattern that swallows exceptions it shouldn't.
- **Recommendation:** Remove the sub-block; reword the comment to state the real guarantee (the function body is one transaction).
- **Regression risk:** Genuinely none in behavior, but verify on the local Docker stack that the function isn't called from within another PL/pgSQL block establishing its own exception context.
- **Expected impact:** One savepoint removed per Stripe webhook call; the comment describes the actual mechanism.
- **Effort estimate:** S

#### BE-L5 IPv6 clients get effectively unlimited rate-limit buckets
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/lib/request-utils.ts:13-29, src/lib/rate-limit.ts:219-257, src/app/api/chat/stream/route.ts:58-61
- **What's happening:** `getClientIp` returns the address verbatim with no IPv6 normalization; a residential /64 allocation gives one subscriber 2^64 distinct source addresses, each producing its own Upstash bucket.
- **Why it matters:** The chat rate limit is the only thing standing between an anonymous visitor and unbounded Claude+Voyage spend; IPv6 adoption in Spanish residential ISPs is significant.
- **Recommendation:** Normalize IPv6 identifiers to their /64 prefix before using as the rate-limit key; leave IPv4 whole.
- **Regression risk:** A /64 can be a large shared population behind some mobile/CGNAT-equivalent v6 deployments — collapsing to /64 risks false 429s there; raise the cap alongside the change or make prefix length configurable.
- **Expected impact:** The primary cost control stops being trivially sidesteppable on IPv6.
- **Effort estimate:** S

#### BE-L6 `Cache-Control: public` on secret-authenticated MCP responses
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/places/route.ts:333-337,389-393
- **What's happening:** Both GET and POST handlers return `Cache-Control: public, max-age=3600` on responses only reachable with a valid `x-mcp-secret` header — `public` authorizes any shared cache to store and serve the response to any requester.
- **Why it matters:** The intent (avoid re-paying for Google Places) is sound, but `public` is the wrong directive for an authenticated response; exposure is limited today since POST isn't cached and the CDN sits behind the same auth boundary, but it's a correctness-of-intent issue.
- **Recommendation:** Use `private, max-age=3600`, or implement server-side Redis caching keyed on the normalized query.
- **Regression risk:** Switching to `private` forfeits whatever CDN hit-rate exists today — measure before assuming it's zero.
- **Expected impact:** Cache directives match the response's actual audience; a real cost saving becomes available via server-side caching.
- **Effort estimate:** S

#### BE-L7 `validateAdminAuth` swallows all errors and its role cache is unbounded
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/admin-auth.ts:14-16,139-147,117-136
- **What's happening:** The function's final catch block returns a generic 500 with no `logger.error` call, unlike a narrower failure case in the same function that does log. Separately, the module-level role cache has a 30s TTL but no size bound or eviction sweep — entries are only overwritten, never removed.
- **Why it matters:** A total auth failure — the case most worth diagnosing — is the one case producing zero telemetry; a Supabase auth outage would manifest as unexplained 500s across every admin route with nothing in the logs to explain why.
- **Recommendation:** Log the caught error before returning 500, mirroring the existing logged-failure shape; bound the role cache with an eviction sweep reusing the existing in-memory rate-limit store pattern.
- **Regression risk:** Logging in this catch must route through the existing sanitizer, since Supabase auth errors can carry token fragments.
- **Expected impact:** Auth outages become diagnosable; unbounded map growth removed.
- **Effort estimate:** S

#### BE-L8 Dev-only `child_process` routes ship in the production bundle behind runtime env checks
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/app/api/admin/agents/run/route.ts:3,103-109, src/app/api/admin/tunnel/route.ts:2,27-32
- **What's happening:** Two admin routes import `spawn`/`exec` and are present in the deployed bundle, gated only at runtime by two *different* env-var checks (`VERCEL_ENV !== undefined` vs `NODE_ENV === "production"`) for the same "local only" intent.
- **Why it matters:** The individual controls are careful (allowlists, secret scrubbing), but "not in production" expressed as a runtime string comparison rather than build-time absence means any environment where the expected variable is unset turns an authenticated admin session into arbitrary script execution. The two gates also disagree on which environments they protect.
- **Recommendation:** Exclude these routes from production builds entirely; at minimum, unify on the stricter gate.
- **Regression risk:** Build-time exclusion changes the route manifest between environments — the admin dashboard's fetches would 404 rather than 403 in production; confirm the UI handles that.
- **Expected impact:** A latent RCE surface is removed by construction rather than by configuration.
- **Effort estimate:** M

#### BE-S1 The translation queue's worker is the enqueuer, invoked synchronously over HTTP
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** src/app/api/webhooks/translate/route.ts:209-249,297-349, src/app/api/admin/stories/approve-all/route.ts:95-100
- **What's happening:** `/api/webhooks/translate` performs three roles in one request — enqueue, claim a batch of up to three jobs (including other stories' jobs), and synchronously run multiple Claude round-trips before responding. It's invoked from three directions that can each trigger the others. The durable-queue mechanics are well-built; what's missing is a worker that isn't also an HTTP request handler.
- **Why it matters:** BE-B1 (unbounded retry), BE-M3 (batch size tuned to a guessed timeout), and `approve-all` blocking on translation are all symptoms of this one structural choice — as the story corpus grows, the coupling gets tighter, not looser.
- **Recommendation:** Separate the roles — keep the webhook as pure enqueue-and-acknowledge (202 immediately), add a dedicated drain endpoint invoked on a schedule that claims and processes a bounded batch.
- **Regression risk:** Making the webhook async removes the synchronous feedback the admin UI gets from `approve-all` today — the UI must move to polling. Translation latency becomes bounded by the drain schedule rather than immediate.
- **Expected impact:** Queue correctness stops depending on an undeclared timeout; batch sizing becomes a throughput decision rather than a survival constraint.
- **Effort estimate:** L

#### BE-S2 Rate limiting is applied to 5 of ~20 public routes, chosen ad hoc
- **Severity:** strategic | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/rate-limit.ts:219, src/app/api/checkout/day-pass/route.ts:50, src/app/api/voice-session/route.ts:9, src/app/api/favorites/route.ts:38, src/app/api/mcp/make-booking/route.ts:110
- **What's happening:** A repo-wide grep for `checkRateLimit` returns exactly five routes. Unprotected and externally reachable: both checkout routes, voice-session (mints a signed ElevenLabs URL per call), favorites, voice-access, feature-flags, and make-booking (BE-B2).
- **Why it matters:** Which routes are protected reflects build order rather than where the cost is — for a product whose unit economics are "€1.99 for 24h of unlimited AI voice," the absence of any ceiling on the metered upstream is the single largest financial unknown at launch.
- **Recommendation:** Adopt rate limiting as a default rather than an opt-in via a shared route helper with an explicit exemption list; add a per-user voice-minutes ceiling tracked from the post-call webhook.
- **Regression risk:** A default-on limiter in the proxy can only key on IP, reintroducing BE-M1's shared-bucket problem for server-to-server callers, which must be exempted explicitly. Per-user voice caps change the advertised "unlimited" product copy.
- **Expected impact:** New endpoints are protected by default; the largest uncapped cost driver at launch gains a ceiling.
- **Effort estimate:** L

### Cross-Domain Notes (Backend)
- DO: BE-M3 needs the effective Vercel `maxDuration` confirmed; BE-H1's dead storage probe means the Supabase capacity alarm has never been able to fire.
- SE: BE-H5, BE-M9, BE-M10, BE-M2, BE-L8, BE-M8 all sit on the security boundary; BE-B2's premium-rate dialing is a financial-abuse vector worth independent review.
- PE: BE-M4 and BE-M6 are correctness/cost findings with latency implications.
- AR: BE-S1 and BE-M6 are architectural; BE-H6 is a service-boundary question.
- QA: BE-L1 — the entire Vitest suite exercises the dev-only curl path, overstating confidence in the shipped SDK code.

---

## 6. Performance and Scalability Findings (Performance Engineer)

#### PE-H1 Adjacent-story preloads fetch un-optimized origin images, discarding ~184KB each
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-viewer.tsx:215-226,252-254,289-296
- **What's happening:** The preload `<link>` requests the raw Supabase Storage URL while `next/image` requests the optimizer URL — measured 183,728 bytes wasted vs. 19,065–117,448 bytes actually used depending on viewport.
- **Why it matters:** ~19× bandwidth amplification per swipe on the app's core interaction; bypasses the image CDN and bills Storage egress directly.
- **Recommendation:** Build the preload href identically to what `next/image` will request, or drop the manual preload for offscreen `<Image priority>` elements.
- **Regression risk:** Must stay byte-identical to the optimizer URL or the double-download just moves.
- **Expected impact:** ~350KB less transfer per navigation on mobile.
- **Effort estimate:** S

#### PE-H2 Maintenance-flag DB lookup sits on the canonical entry path, adding 60–330ms before the root redirect
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/proxy.ts:33-45, src/lib/proxy/maintenance.ts:9-18,66-130,137-146
- **What's happening:** Every request to `/` pays a Supabase REST round-trip before the 308 redirect to `/immersive`, measured 333ms cold / 65–203ms warm vs. 1.3–2.2ms with the check short-circuited.
- **Why it matters:** Organic and paid traffic pays this on the very first hop, before a single byte of the app loads — and it protects nothing since `/immersive` is itself bypassed.
- **Recommendation:** Decide maintenance-mode semantics first, then either hoist the root redirect above the check or remove `/immersive` from the bypass list.
- **Regression risk:** Changes maintenance-mode behavior for root visitors — a deliberate product decision, not a free win.
- **Expected impact:** ~60–330ms off TTFB for every first-time visitor.
- **Effort estimate:** S

#### PE-H3 No enforced client bundle budget, and the only analyzer measures a build that is never shipped
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/bundle-size.yml:44-75, package.json:12-13, next.config.ts:5-8
- **What's happening:** The Turbopack production build has no route-level size table; the bundle-size CI check only runs `du -sh` with no threshold; `analyze` scripts force a webpack build that isn't what ships. Measured actuals: 233KB gzip shared baseline, 297KB gzip on `/immersive`.
- **Why it matters:** A stray top-level import could double the shared baseline and every gate would stay green.
- **Recommendation:** Add a script that sums gzip bytes per route from the actual Turbopack output and fails against a committed budget.
- **Regression risk:** Budgets must be set from current measured values, not aspirational ones.
- **Expected impact:** Bundle regressions become visible and blocking.
- **Effort estimate:** M

#### PE-H4 The Lighthouse performance gate measures an 8-story fallback page, not the real 71-story app
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/lighthouse.yml:38-41,50-54, src/lib/stories-server.ts:50-53, lighthouserc.json:6-9
- **What's happening:** The Lighthouse job builds with dummy Supabase credentials, which triggers an 8-story fallback dataset instead of the real 71 stories, and disables maintenance mode; the config also runs desktop-only.
- **Why it matters:** The gate that enforces stated performance budgets measures roughly one-ninth of the real payload on desktop for a mobile-first product.
- **Recommendation:** Expand the fallback fixture to a production-representative story count; add a mobile Lighthouse run.
- **Regression risk:** Growing the fixture also grows the client bundle, since it's statically imported into a client module chain — pair with PE-H3's budget gate.
- **Expected impact:** The performance budget starts reflecting what users experience.
- **Effort estimate:** M

#### PE-H5 No `maxDuration` anywhere; the chat stream's internal timeout budget can outlive the platform's
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [inference]
- **Files:** src/lib/chat-stream-timeouts.ts:3-8, src/app/api/chat/stream/route.ts:147-154,198-214
- **What's happening:** Zero routes declare `maxDuration`; the chat route's internal budget (with a resetting 30s idle window) can exceed the platform default, and when the platform kills the function mid-stream, cleanup code never runs.
- **Why it matters:** Stream truncations become silent — no error event, no done event, no server-side telemetry.
- **Recommendation:** Set an explicit `maxDuration` strictly greater than the worst-case internal budget; lower the internal budget so it's always the binding constraint.
- **Regression risk:** Raising `maxDuration` raises the cost ceiling on hung requests.
- **Expected impact:** Stream truncations become observable and bounded.
- **Effort estimate:** S

#### PE-M1 71 story pages are prerendered at build time but the proxy 308s past them before they can be served
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/proxy/story-rewrite.ts:13-25, src/app/story/[slug]/page.tsx:14-19,49-53
- **What's happening:** 71 prerendered pages (2.4MB) and their build-time OG metadata queries produce output that's provably unreachable, since the proxy 308s every request first. (See FE-H2 for the frontend/SEO angle on the same root cause.)
- **Why it matters:** Build time and deploy artifact size scale linearly with the catalogue for output that is provably unreachable, and the per-story OG metadata this route exists to provide never reaches a crawler.
- **Recommendation:** Either make it a real rewrite so the prerenders are served, or delete `generateStaticParams`/`generateMetadata`.
- **Regression risk:** The redirect exists to dodge a specific hydration crash — verify that's resolved before switching to rewrite.
- **Expected impact:** Either working per-story previews or a smaller, faster build.
- **Effort estimate:** M

#### PE-M2 Only the embedding is cached; retrieval, rerank, and image lookup re-run on every chat message
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/lib/search.ts:79-119, src/lib/embedding-cache.ts:27-69
- **What's happening:** A cache hit on the embedding still pays for the vector search RPC, the rerank call, and an image lookup — three more round-trips before the first token.
- **Why it matters:** Time-to-first-token is the entire perceived latency of chat, and tourism Q&A is highly repetitive — each repeat query still pays for three external hops it doesn't need to.
- **Recommendation:** Cache the full `SearchResult` keyed on a hash of the query plus a content-version marker.
- **Regression risk:** The cache key must include a content version or `npm run seed-db` reseeds leave users on stale content for a day.
- **Expected impact:** 2–3 fewer round-trips on repeat queries.
- **Effort estimate:** M

#### PE-M3 The Upstash rate-limit call has no timeout and precedes every stage timeout on the chat path
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/rate-limit.ts:134-159,219-245, src/app/api/chat/stream/route.ts:58-61
- **What's happening:** The rate-limit check is the first I/O in the handler and has no timeout, race guard, or stage instrumentation — a slow (not failing) Upstash adds unbounded latency invisibly.
- **Why it matters:** A degraded Upstash region adds unbounded latency to the front of every chat request, and the resulting latency is invisible in the stage-timing logs used to diagnose the pipeline.
- **Recommendation:** Add an explicit timeout/race with the same fail-closed semantics as the error path.
- **Regression risk:** A timed-out limiter must resolve to fail-closed, never fail-open, or the timeout becomes a rate-limit bypass.
- **Expected impact:** Bounded worst-case latency on the chat path's first I/O.
- **Effort estimate:** S

#### PE-M4 One React state update per SSE chunk, each re-parsing the full accumulated markdown
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/hooks/use-stream-chat.ts:170-180, src/components/markdown/basic-markdown.tsx:258-268
- **What's happening:** (Same root cause as FE-M1.) Markdown parsing is O(n²) over response length with no memoization on the actively-streaming row.
- **Why it matters:** This is the product's core mobile interaction, and the cost scales with response length — degrading exactly when the user is most engaged.
- **Recommendation:** Coalesce chunks into a rAF-batched flush; memoize `parseBlocks`.
- **Regression risk:** Changes streaming feel; flush must happen before the `done` handler reads final content.
- **Expected impact:** Substantially lower main-thread work during streaming.
- **Effort estimate:** M

#### PE-M5 The entire 71-story catalogue is serialized into the initial `/immersive` payload though one story renders
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/immersive/immersive-data-loader.tsx:13-28, src/lib/stories-server.ts:41-92
- **What's happening:** 50KB gzip of HTML with 71 story objects ships on the LCP-critical path though the viewer renders one at a time.
- **Why it matters:** This is the payload on the critical path to LCP for the primary landing page, and it grows linearly with the content catalogue, which is actively being expanded.
- **Recommendation:** Instrument payload size/growth first; don't restructure until a threshold is crossed.
- **Regression risk:** Windowing would break deterministic shuffle ordering and deep-link resolution — a genuinely invasive change if ever needed.
- **Expected impact:** Payload growth becomes visible before it's a problem.
- **Effort estimate:** S (instrumentation) / L (windowing)

#### PE-M6 `/about` and every future `/a*` route silently bypasses maintenance mode
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/proxy/maintenance.ts:9-18,37-42
- **What's happening:** A bare `"/a"` prefix match intended for a PostHog proxy path also matches `/about`, `/auth/callback`, `/agenda`, and any future route starting with "a".
- **Why it matters:** Maintenance mode does not actually cover the site, and the blast radius grows silently with every new route whose name starts with "a" — invisible until a real maintenance window.
- **Recommendation:** Narrow to an exact-segment match.
- **Regression risk:** Must land together with PE-H2's ordering fix, or previously-fast pages regress to the DB-lookup cost.
- **Expected impact:** Maintenance mode actually gates the routes it claims to.
- **Effort estimate:** S

#### PE-L1 Sequential per-user `getUserById` in the admin suggestions route
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/admin/suggestions/route.ts:53-59
- **What's happening:** After fetching suggestions, the route loops over unique user IDs and awaits `supabase.auth.admin.getUserById(userId)` one at a time — a classic serialized N+1 with no timeout.
- **Why it matters:** Admin-only, so no user impact today, but latency grows linearly with distinct submitters and the route has no timeout.
- **Recommendation:** `Promise.all` over the id list, bounded to a reasonable concurrency.
- **Regression risk:** Unbounded `Promise.all` fires N concurrent admin-API calls, which with a large backlog could trip Supabase auth-admin rate limits — bound concurrency rather than fanning out unbounded.
- **Expected impact:** Admin suggestions panel load time becomes flat rather than linear in submitter count.
- **Effort estimate:** S

#### PE-L2 Server-side external API fetches without timeouts in admin routes
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/admin/costs-analytics/route.ts:246,278, src/app/api/admin/elevenlabs-analytics/route.ts:49, src/app/api/admin/stories/approve-all/route.ts:28
- **What's happening:** Four server-side calls to the ElevenLabs API from Vercel functions have no `AbortSignal` timeout, unlike the strong timeout discipline the codebase shows on the visitor-facing path.
- **Why it matters:** Combined with PE-H5's missing `maxDuration`, a hung upstream can hold the function open until the platform default expires.
- **Recommendation:** Apply `AbortSignal.timeout(...)` uniformly, matching the idiom already used elsewhere in the codebase.
- **Regression risk:** The ElevenLabs conversations endpoint can legitimately be slow on large accounts — an over-tight timeout turns a slow analytics panel into an empty one; these calls already degrade to partial data, so add a distinct log event for the timeout case.
- **Expected impact:** Bounded admin route duration; no functions held open by a stalled third party.
- **Effort estimate:** S

#### PE-L3 `/api/feature-flags` is fetched on pages that consume no flags
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/providers.tsx:37-39, src/hooks/use-feature-flags.ts:105, src/app/api/feature-flags/route.ts:66-72
- **What's happening:** The root `FeatureFlagsProvider` is active — and fetches — on `/about`, `/terms`, `/privacy`, `/pricing`, `/favorites`, none of which read any flag. Measured 175-262ms origin latency, uncached beyond a 60s `max-age` header.
- **Why it matters:** A post-hydration round-trip on largely static content pages that never read the result; minor alone, but compounds with the existing shared JS baseline those same pages carry.
- **Recommendation:** Invert the gate — enable the provider on routes that actually consume flags rather than disabling it selectively.
- **Regression risk:** Flipping to an allowlist risks silently omitting a route that does read a flag; grep every consumer call site before changing.
- **Expected impact:** One fewer origin round-trip on static content pages.
- **Effort estimate:** S

#### PE-L4 Sentry client SDK ships on every page with no DSN to send to
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** sentry.client.config.ts:4-13, next.config.ts:120-140
- **What's happening:** The client SDK chunk (8.4KB gzip) is present in the shared baseline of every prerendered page. (Per DO-B1, a Sentry project and DSN now exist, but issue delivery is unverified — the null-DSN framing here may already be stale; confirm current state before acting.)
- **Why it matters:** 8.4KB gzip of code on every page load that may be doing nothing if delivery is broken; `/api/health` also flips to degraded when the DSN is genuinely absent.
- **Recommendation:** Resolve DO-B1 first (confirm whether the DSN is live and delivering); if error tracking is genuinely being abandoned, remove `withSentryConfig` from the client build instead.
- **Regression risk:** Removing `withSentryConfig` also removes server/edge instrumentation and the sourcemap upload pipeline — a much larger loss than 8.4KB of client JS.
- **Expected impact:** Either working error tracking, or 8.4KB gzip off every page.
- **Effort estimate:** S

#### PE-L5 Embedding cache key hashes un-normalized query text
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/embedding-cache.ts:28-30, src/lib/embeddings.ts:27-32
- **What's happening:** The cache key is `sha256(text)` over the raw string, so casing and whitespace variants of the same question produce distinct cache entries and separate billed Voyage embed calls.
- **Why it matters:** Directly reduces hit rate on a cache whose entire purpose is avoiding a billed external round-trip on the chat critical path — free to fix.
- **Recommendation:** Normalize before hashing (trim, collapse whitespace, consider lowercasing) and version the key prefix.
- **Regression risk:** Lowercasing risks subtly shifting retrieval for case-carrying queries (proper nouns, acronyms) since embeddings are case-sensitive — validate retrieval quality before enabling case folding; trim/whitespace-collapse alone is safe.
- **Expected impact:** Higher embedding cache hit rate; fewer billed Voyage calls on repeat queries.
- **Effort estimate:** S

#### PE-S1 233KB gzip of JavaScript on pages that are pure static content
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/app/layout.tsx:144-153, src/app/providers.tsx:30-53, src/app/about/page.tsx, src/app/terms/page.tsx, src/app/privacy/page.tsx
- **What's happening:** `/about`, `/terms`, `/privacy`, and `/` each load an identical 14-chunk, 233KB gzip baseline because the root layout wraps every route in a fully client-side provider stack (PostHog → Language → FeatureFlags → Auth), regardless of what the route renders.
- **Why it matters:** Not a launch risk — normal for an App Router site — but it's a ceiling: no per-route optimization can go below this baseline while the provider stack lives in the root layout.
- **Recommendation:** Leave alone for launch; revisit only if the PE-H3 budget gate shows the baseline growing, via a route group with a lighter layout rather than unpicking the provider chain in place.
- **Regression risk:** The provider nesting is load-bearing in documented, non-obvious ways — conditionally removing a provider causes a full remount and auth-state reset, and changing the tree shape after PostHog init remounts all descendants. Any change also risks reintroducing a `headers()` call that would break the PPR static shell.
- **Expected impact:** Deliberately none for now; documented so the ceiling is a known constraint rather than a surprise.
- **Effort estimate:** L

### Cross-Domain Notes (Performance)
- SE/BE: PE-M6's `"/a"` maintenance bypass is a correctness/access-control issue, not just performance.
- AR/UX: PE-M1's dead `/story/[slug]` prerenders are also FE-H2's SEO/social-sharing gap.
- QA: The Lighthouse gate's dummy-credential fallback (PE-H4) affects every data-layer function using the same short-circuit pattern, not just stories.
- DO: `NEXT_PUBLIC_SENTRY_DSN` health-degradation interplay with PE-L4; zero routes declare `maxDuration`/`runtime`/`preferredRegion` anywhere.
- FE: Row-level memoization is correct for completed chat messages; the remaining cost is concentrated in the actively-streaming row (PE-M4).

---

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

#### DO-B1 Error and log observability is declared but has no verified sink
- **Severity:** launch-blocker | **Time horizon:** Before launch | **Evidence type:** [evidence] for facts, [inference] for the combined conclusion
- **Files:** docs/operations/logging.md:90-103, docs/operations/alerting-runbook.md:86-89, sentry.server.config.ts:1-13
- **What's happening:** The Sentry project exists and `/api/health` reports it "configured," but a 90-day issue query returns zero results — spanning the known 2026-07-20 outage window. The log-drain runbook still carries a "NOT CONFIRMED — action required" banner from 2026-04-28, while the tracking issue for it is closed.
- **Why it matters:** With no verified drain and apparently no Sentry delivery, a real production failure occurred (the 2026-07-20 outage) and left no trace in either sink. Every log-keyed runbook procedure assumes an aggregator that may not exist.
- **Recommendation:** Fire a synthetic exception in production and confirm delivery to the Sentry project; configure and verify a Vercel log drain; reopen the tracking issue until a live-tail line has actually been observed.
- **Regression risk:** A synthetic error must not be reachable by unauthenticated users or flip `/api/health` to degraded; a log drain forwards raw Pino output, so the PII sanitizer must cover that path too, not just the Sentry path.
- **Expected impact:** Incidents become investigable after the fact.
- **Effort estimate:** M

#### DO-H1 The `Develop smoke check` job has never executed a single probe and always reports green
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:228-299, vercel.json:3
- **What's happening:** `vercel.json`'s `ignoreCommand` skips the build for every direct `develop` push (no PR id), so no preview deployment is ever created, and the smoke-check job's wait loop always exhausts its timeout and reports success anyway.
- **Why it matters:** This job exists specifically to catch runtime regressions dummy-key CI builds can't see, and it has never once probed anything while burning ~5.3 minutes of runner time per push.
- **Recommendation:** Either build a preview for direct `develop` pushes (accepting it shares production Supabase/Stripe) or delete the job and rely on the PR-to-`main` smoke gate; if kept, the timeout branch must fail, not pass.
- **Regression risk:** Building previews on every `develop` push means any accidentally-mutating probe becomes a production write.
- **Expected impact:** Either a working regression signal or ~5.3 minutes reclaimed per push.
- **Effort estimate:** S

#### DO-H2 `/api/health`'s `rate_limit` probe can never report degradation — the alert it feeds cannot fire
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/rate-limit.ts:164-204,225-238, src/app/api/health/route.ts:60-67,296-334
- **What's happening:** Degradation is tracked as module-level state set only inside the process that experienced the failure; on Vercel each route is a separate isolate, so `/api/health` can never observe a flag set by `/api/chat/stream`.
- **Why it matters:** Chat fails closed on an Upstash outage, denying every request, while `/api/health` continues reporting healthy and every gate that depends on it stays green.
- **Recommendation:** Make the health probe actively ping Redis rather than reading cross-process state.
- **Regression risk:** Must stay inside the existing timeout harness so a Redis hang can't make `/api/health` itself slow.
- **Expected impact:** An Upstash outage that currently takes chat down silently becomes visible within one monitoring cycle.
- **Effort estimate:** M

#### DO-H3 `maintenance_mode` — the documented last-resort mitigation — does not gate the primary surface and fails open
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/proxy/maintenance.ts:9-18,66-127
- **What's happening:** `/immersive` (the entire app) is on the maintenance bypass list, and the flag read fails open (returns `false`) on any Supabase connectivity failure — precisely the scenario the runbooks reserve this control for.
- **Why it matters:** Both scenarios the runbooks name for this control (operator unavailable, database restore in progress) are scenarios in which it does nothing.
- **Recommendation:** Remove `/immersive` from the bypass list; serve the last-known cached value past its TTL on a read failure rather than defaulting to `false`.
- **Regression risk:** Failing closed instead would be worse — a transient Supabase blip would take the whole site down; the stale-cache approach is the safer trade.
- **Expected impact:** Maintenance mode becomes a control that actually holds the site.
- **Effort estimate:** M

#### DO-H4 The documented `--require-sentry` release gate does not exist, and a test pins the divergence in place
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/preview-smoke.yml:113, scripts/verification-config.test.ts:93-100
- **What's happening:** Three operational documents state the release gate requires Sentry configuration; the workflow doesn't pass the flag, and a unit test explicitly asserts the flag's absence with no rationale.
- **Why it matters:** This is the gate that would have caught DO-B1; the operator's belief that no release ships without proving observability is wired is false.
- **Recommendation:** Make all four artefacts (three docs + the test) agree — either add the flag and invert the test, or correct the docs and add a rationale comment.
- **Regression risk:** Turning the flag on makes Sentry configuration a hard release blocker; confirm the Preview environment carries the DSN first.
- **Expected impact:** The release checklist's observability claim becomes true.
- **Effort estimate:** S

#### DO-H5 Incident-response runbooks contain commands that fail when executed
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** docs/operations/alerting-runbook.md:96-100,119-123, docs/operations/migration-policy.md:176-183,192-195, docs/operations/database-backup.md:115
- **What's happening:** Cron-recovery `curl` examples use the wrong HTTP verb (401s); `jq` expressions reference health-response fields that were removed months ago (always return null); a migration filename in the backup runbook is wrong.
- **Why it matters:** These are the executable steps taken under pressure — a tired operator following them gets misdirected toward diagnosing the tooling instead of the incident.
- **Recommendation:** Correct all four commands; add a docs-vs-code assertion test so a field removal fails CI when a runbook still names it.
- **Regression risk:** The migration-verification step needs a real schema query, not a re-pointed health-field check that verifies nothing.
- **Expected impact:** Incident commands work the first time they're run.
- **Effort estimate:** M

#### DO-H6 A byte-length/char-length mismatch lets an unauthenticated request crash `/api/health`
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/health/route.ts:86-99,296-301, src/lib/cron-auth.ts:71-78,108-114, src/lib/mcp-auth.ts:31-36
- **What's happening:** Six sites guard `timingSafeEqual` with a JS string `.length` check (UTF-16 code units) instead of byte length; any multibyte-character input of the right code-unit count throws an unhandled `RangeError`, which on `/api/health` happens before the `try` block opens, producing an unauthenticated HTTP 500.
- **Why it matters:** `/api/health`'s entire contract is "always 200," relied on by monitoring and the release gate — an anonymous ~100-request sweep can break both at will.
- **Recommendation:** Compare Buffer lengths, not string lengths, before calling `timingSafeEqual`; move the health identity check inside the `try` block as defense in depth.
- **Regression risk:** Must stay constant-time for equal-length inputs.
- **Expected impact:** `/api/health` can no longer be knocked off its always-200 contract by an anonymous request.
- **Effort estimate:** S

#### DO-M1 The compensation-migration command in the rollback runbook hangs `npm run check-migrations`
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** docs/operations/rollback.md:137-140, scripts/check-migrations.ts:18,84-101
- **What's happening:** The rollback runbook instructs `touch supabase/migrations/$(date +%Y%m%d%H%M%S)_revert_<description>.sql` — a 14-digit timestamp prefix — while every existing migration uses a sequential 3-digit prefix, which the migration-policy doc documents explicitly. The timestamped filename still parses as a migration number (~20 trillion), and the gap-check loop iterates from 1 to that value.
- **Why it matters:** `check-migrations` is a CI gate and an explicit pre-deployment release-checklist step. Following the rollback runbook literally during an incident produces a job that spins until the runner times out or OOMs, on the path that ships the fix.
- **Recommendation:** Fix the runbook to use the sequential convention; separately, harden the gap scanner against pathological input so a malformed filename fails fast instead of hanging.
- **Regression risk:** Tightening the pattern must not reject the legitimate historical set (numbers 1-100 with documented gaps), which existing tests cover — prefer a pairwise-gap rewrite over a hard ceiling if a future move to timestamp-prefixed migrations is plausible.
- **Expected impact:** The documented recovery command produces a valid migration; a malformed one fails in seconds with a readable error.
- **Effort estimate:** S

#### DO-M2 The `Vercel env safety` guardrail has never run and reports success every time
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/security.yml:63-95, docs/operations/operations.md:354
- **What's happening:** The job requires `VERCEL_TOKEN` (a secret), which is unset; the two required repo-variable IDs are populated. The `if:` guard on the assertion step means it's always skipped, and the job reports success on every push and scheduled run.
- **Why it matters:** It's the only automated check on deployed Vercel environment state anywhere in the repo, and it has never executed a single assertion — a "requiredness without evidence" pattern the project has explicitly rejected elsewhere for Dependabot.
- **Recommendation:** Add `VERCEL_TOKEN` as a repository secret so the check runs; change the skip path to fail rather than pass on `push`/`schedule` (keep skip only for fork PRs).
- **Regression risk:** A Vercel project-scoped token is a high-value credential that can read all environment variable values — treat it as sensitive in the rotation inventory this report calls for elsewhere (DO-M3).
- **Expected impact:** One security control moves from nominal to operational.
- **Effort estimate:** S

#### DO-M3 No secret inventory, rotation cadence, or revocation procedure exists
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** .env.example:1-157, docs/operations/alerting-runbook.md:118, docs/operations/operations.md:374
- **What's happening:** The system holds long-lived credentials for at least twelve services. A repo-wide search for rotation guidance returns only two incidental mentions in a Gitleaks-remediation context — no document lists which secrets exist, which systems hold each copy, or the ordered steps to rotate one without an outage.
- **Why it matters:** Several secrets are multi-homed and cannot be rotated atomically (e.g. one lives in both Vercel and a Supabase config table; another is used by Vercel Cron, a health-check, and a local release-verification script) — rotating either without a written ordering silently breaks something, and given DO-B1, the breakage may not be observable.
- **Recommendation:** Write a secret-rotation inventory document — one row per secret, consuming code path, every system holding a copy, rotation procedure in dependency order, cadence.
- **Regression risk:** The inventory itself becomes a map of the credential surface — must name locations only, never values, and should be reviewed against the Gitleaks ruleset before committing.
- **Expected impact:** A credential compromise becomes a documented procedure rather than an improvisation.
- **Effort estimate:** M

#### DO-M4 No boot-time environment validation and no deployed-config drift detection
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** scripts/check-env.ts:1-46, src/lib/env.ts:33-51, src/app/api/health/route.ts:293-334
- **What's happening:** The existing env checker verifies only that every referenced var is documented — nothing verifies the reverse, that a deployment actually has the vars it needs present with sane values. `/api/health` covers only three of the ~15 service credentials the app depends on.
- **Why it matters:** A missing Stripe or ElevenLabs credential is discovered only when a user reaches that code path and gets a runtime 500 — and per DO-B1, that error may reach no observability sink at all.
- **Recommendation:** Add a startup manifest checked once per cold start in `instrumentation.ts`, logging a structured event listing missing keys rather than throwing.
- **Regression risk:** Throwing at startup on a missing var would convert a partial outage into a total one; must warn, not fail, and must be environment-aware since Preview/local legitimately lack many production vars.
- **Expected impact:** A missing production credential becomes visible at deploy time instead of at first customer contact.
- **Effort estimate:** M

#### DO-M5 Env vars on the payments path use `??`, which does not fall back on empty strings
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/checkout/day-pass/route.ts:28,74, src/app/api/checkout/embedded/route.ts:28,81
- **What's happening:** The consequential checkout `success_url`/`cancel_url` construction uses `process.env.NEXT_PUBLIC_SITE_URL ?? "https://paisaxe.es"`. `??` is nullish-only — a whitespace-contaminated value (which the project's own CLAUDE.md already warns Vercel's CLI can introduce) passes through untouched instead of triggering the fallback.
- **Why it matters:** This is revenue-path code; a contaminated site URL produces a relative redirect URL that Stripe rejects at session creation, while `/api/health` stays green since it doesn't probe Stripe.
- **Recommendation:** Route these sites through the project's existing trim-aware `getEnv()` choke-point.
- **Regression risk:** Some of the affected sites render client-side, where the dynamic `process.env[key]` form inside `getEnv` is not inlined by the bundler — those need a literal-access trimmed getter, not the generic form; mixing this up silently breaks canonical URLs.
- **Expected impact:** Checkout stops being one invisible whitespace character away from failing.
- **Effort estimate:** S

#### DO-M6 No function duration budget is declared anywhere
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** vercel.json:1-66, src/app/api/cron/content-discovery/route.ts, src/app/api/chat/stream/route.ts
- **What's happening:** A repo-wide grep for `maxDuration` and `export const runtime` across all API routes returns nothing, and `vercel.json` has no `functions` block. Several routes are structurally long-running (content generation, an SSE chat stream).
- **Why it matters:** Function duration depends on plan tier and compute mode and can change without a code change on this side — the same shape of implicit-platform-behavior dependency that has already caused a documented incident for this project.
- **Recommendation:** Declare `maxDuration` explicitly, starting with the longest-running routes.
- **Regression risk:** Raising `maxDuration` raises the ceiling on billed compute for a hung invocation; pair any increase with a bound on the work each invocation attempts, and verify affected jobs are idempotent before extending them.
- **Expected impact:** Long-running routes stop depending on an undeclared platform default.
- **Effort estimate:** S

#### DO-M7 CI runs the full suite, E2E, and Lighthouse on documentation-only commits
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:22-26, .github/workflows/e2e.yml:3-7, .github/workflows/lighthouse.yml:3-7
- **What's happening:** No workflow uses `paths`/`paths-ignore` except one. A recent docs-only commit triggered four full workflows totaling roughly 24 minutes of runner wall-clock.
- **Why it matters:** The project's own deployment-safety rule states every CI run costs money and must be justified — a Markdown edit triggering the full E2E and Lighthouse suites fails that test, and this recurs on every documentation-agent commit.
- **Recommendation:** Add `paths-ignore` for docs/prose paths to the E2E and Lighthouse workflows.
- **Regression risk:** `paths-ignore` on a workflow that's also a required branch-protection status check can deadlock a documentation-only release PR waiting for a context that never arrives — filter only the `push` trigger, not `pull_request` on `main`, for any required check.
- **Expected impact:** Roughly 13 minutes of runner time reclaimed per documentation commit.
- **Effort estimate:** S

#### DO-M8 The release checklist's "what would ship" step reports 290 commits spanning three months
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** docs/runbooks/release-checklist.md:44, docs/operations/operations.md:99
- **What's happening:** Step 2 runs `git log main..develop --oneline`, but because the repo squash-merges, `develop`'s commits never become ancestors of `main`, so the range never prunes — it currently returns 290 commits for an 8-day-old, 26-file actual delta.
- **Why it matters:** This step is the human review gate before authorizing a production release; three months of noise buries the 26 files a reviewer actually needs to see, and the count grows monotonically with every release.
- **Recommendation:** Replace with `git diff --stat main develop` for shape, plus `git log` bounded to the last release tag rather than `main`.
- **Regression risk:** A tag-bounded range depends on the tag existing — tagging happens last in the release process, so an in-flight or aborted release leaves the range undefined; the replacement must fall back explicitly rather than producing nothing.
- **Expected impact:** The pre-release review step shows the ~26 files actually shipping instead of 290 commits of history.
- **Effort estimate:** S

#### DO-L1 Operational documents carry stale facts about jobs, files and monitors
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** docs/operations/operations.md:146,198, docs/operations/pending-setup.md:39-50, docs/operations/database-backup.md:115
- **What's happening:** Three factual staleness items — a pg_cron job listed as active that was actually unscheduled months ago; a stated rationale for removing an Edge Function keep-alive that references a health-check behavior the code doesn't actually have; a migration filename that doesn't match the real file (also DO-H5).
- **Why it matters:** Individually minor, but they compound the DO-H5 pattern — the operator cannot fully trust the operations documents, raising the cost of every incident.
- **Recommendation:** Correct the three statements; add the existing pg_cron verification query as a periodic drift check owned by the documentation agent.
- **Regression risk:** The correction must be to the documents, not the system — nobody should re-schedule the deliberately-removed job to make the doc true.
- **Expected impact:** The operations guide stops asserting three things that aren't the case.
- **Effort estimate:** S

#### DO-L2 Presence checks and value reads disagree on trimming for the same variable
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/places/route.ts:164,324,380, src/app/api/mcp/weather/route.ts:85,162,221, src/app/api/mcp/make-booking/route.ts:180-181,356-358
- **What's happening:** Several routes guard on an env var untrimmed and then read its value trimmed elsewhere in the same file — a whitespace-only value passes the presence check and fails downstream at the point of use instead.
- **Why it matters:** Converts a clear "not configured" path into an opaque downstream provider error, on non-revenue MCP routes (the same root pattern as DO-M5, lower stakes).
- **Recommendation:** Route both the guard and the read through the project's trim-aware `getEnv()`, folded into the DO-M5 change as one sweep.
- **Regression risk:** A whitespace-only value would now correctly return "not configured" instead of attempting the call — confirm no guard is load-bearing for an intentional blank-value semantic.
- **Expected impact:** Misconfiguration surfaces as "not configured" at the guard instead of an opaque provider error.
- **Effort estimate:** S

#### DO-S1 The audit-remediation loop closes findings on artefacts delivered, not on controls verified operational
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference], grounded in four independently-verified instances
- **Files:** docs/operations/logging.md:90-103, .github/workflows/ci.yml:228-299, .github/workflows/security.yml:76-80, .github/workflows/preview-smoke.yml:113
- **What's happening:** Four controls in this report share one shape — the remediation was completed as designed, the tracking issue was closed, and the control does not function (DO-B1's log drain, DO-H1's smoke job, DO-M2's env-safety job, DO-H4's require-sentry gate). In each case the artefact was accepted as the completion criterion without verifying the control produced signal in its target environment.
- **Why it matters:** The release-probe subsystem elsewhere in this codebase correctly encodes "a skipped required probe is a vacuous pass" — but that principle hasn't propagated to CI jobs, operational docs, or third-party integrations, producing a documented safety posture materially stronger than the actual one.
- **Recommendation:** Extend the required-probes discipline outward — an operational finding closes only on observed evidence (a log line seen, a workflow run whose logs show the assertion executing), recorded in the closing comment.
- **Regression risk:** Making inert checks fail loudly turns four currently-green signals red at once — sequence this (fix the control, then tighten its failure mode), not as a batch, or a solo operator facing a wall of red will rationally start ignoring CI.
- **Expected impact:** The gap between documented and actual operational posture closes, and stops silently reopening.
- **Effort estimate:** L

#### DO-S2 The backup and restore path has never been rehearsed
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** docs/operations/database-backup.md:1-156,87-135
- **What's happening:** The backup runbook documents PITR and daily snapshots, a full restore procedure, and a 13-item post-restore verification checklist, but nothing indicates it has ever been exercised — no rehearsal record exists, and two of its own steps are already known-broken (DO-H5, DO-L1).
- **Why it matters:** The stated recovery time is 10-20 minutes with no secondary operator; the two errors already visible in the checklist are exactly the kind that only surface during execution, meaning they'd surface during a real incident.
- **Recommendation:** Rehearse once against a Supabase branch or throwaway project, walk the checklist verbatim, fix every step that doesn't work as written, and record the date/outcome.
- **Regression risk:** The rehearsal itself is the risk and must not touch the production project, since Preview already shares production Supabase — the rehearsal environment must be created explicitly and confirmed distinct.
- **Expected impact:** The documented 10-20 minute recovery becomes a measured figure rather than an estimate.
- **Effort estimate:** M

#### DO-S3 The single-operator risk acceptance has no instrumented re-evaluation trigger
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** docs/operations/alerting-runbook.md:6-12,14-30
- **What's happening:** The documented risk acceptance names explicit re-evaluation triggers (traffic growth, sensitive data handling, a second operator, recurring off-hours incidents) but nothing measures whether any has been crossed — no scheduled review date, no push-based alert channel.
- **Why it matters:** A risk acceptance without a review mechanism silently becomes permanent; the "recurring off-hours incidents" trigger specifically can never fire today because, per DO-B1, incidents aren't being recorded at all.
- **Recommendation:** Give the acceptance a review date; once DO-B1 is resolved, wire a simple monthly off-hours error count into an existing scheduled report rather than creating a new artefact nobody reads.
- **Regression risk:** The instrumentation itself must not become a fifth inert control — prefer surfacing it in a report already reviewed over creating something new.
- **Expected impact:** The risk acceptance acquires an expiry, revisited by design rather than by an incident forcing the issue.
- **Effort estimate:** S

### Cross-Domain Notes (DevOps)
- SE: DO-H6's byte-length bug spans six `timingSafeEqual` call sites — confirm the constant-time property still holds in whatever fix lands.
- BE: Rate limiting fails closed on Upstash failure while maintenance mode fails open on Supabase failure — the two most important degradation paths in the system fail in opposite directions, likely not deliberately.
- QA: `verification-config.test.ts` is a good pattern (asserting CI wiring matches intent) that would have caught DO-H1/DO-M2 had it also asserted jobs execute their probes, not just that the workflow text contains them.
- PE: DO-M7 and DO-H1 are CI cost items; DO-M6 touches `/api/chat/stream`'s latency budget directly.
- AR: DO-S1 looks like an architectural boundary problem — one subsystem (release probes) holds verification discipline and nothing outside it inherits it.

**Note on a stale project assumption:** prior memory recorded "no Sentry project exists for Paisaxe" — this is now out of date. The project exists and reports as configured; the live problem is *delivery* (zero issues in 90 days), not absence.

---

## 8. Security / Privacy Findings (Security Reviewer)

#### SE-H1 `feature_flags.config` is anon-readable, defeating the API-layer scrub of admin emails and agent IDs
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** supabase/migrations/008_feature_flags.sql:8,30-33, supabase/migrations/069_fix_anon_table_grants.sql:29, src/app/api/feature-flags/route.ts:11-16
- **What's happening:** The RLS policy and grant allow anon to read `feature_flags` directly via PostgREST; the Next.js API route scrubs admin emails and an agent ID from the same data, but the scrub only applies to one of two access paths.
- **Why it matters:** Any client can query PostgREST directly and get admin email addresses (GDPR-relevant for an EU-hosted, Spain-facing product) plus an ElevenLabs agent identifier, bypassing the app-layer denylist entirely.
- **Recommendation:** Split the sensitive payload into a service-role-only table, or replace the blanket policy with a restricted view exposing only safe columns to anon.
- **Regression risk:** `src/lib/proxy/maintenance.ts:92` reads this table over PostgREST with the anon key on the hot path — revoking anon SELECT without exempting that path silently disables the maintenance gate.
- **Expected impact:** Admin emails and agent IDs become unreachable regardless of access path.
- **Effort estimate:** M

#### SE-H2 RLS policies are broader than every application read path — unmoderated content is publicly retrievable via PostgREST
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** supabase/migrations/003_stories_table.sql:17,35-37, src/lib/stories-server.ts:63
- **What's happening:** Every application code path filters on `is_active AND curation_status = 'approved'`; the RLS policy checks only `is_active`. A client using the anon key can read unapproved, AI-generated, human-unreviewed story content directly.
- **Why it matters:** The moderation gate exists only in TypeScript — a standing content-integrity and reputational exposure invisible to the app's own tests.
- **Recommendation:** Tighten the RLS policy to match the application predicate exactly.
- **Regression risk:** Admin reads must keep using a service-role client that bypasses RLS or the curation queue will render empty.
- **Expected impact:** Unapproved content becomes unreachable through every access path.
- **Effort estimate:** S

#### SE-H3 Default privileges grant `anon` SELECT on every future public table, making RLS a manual opt-in
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** supabase/migrations/070_default_anon_privileges.sql:20-24, supabase/migrations/077_stripe_webhook_events.sql:1-5, supabase/migrations/087_restrict_operational_table_access.sql:6-8
- **What's happening:** A blanket `ALTER DEFAULT PRIVILEGES ... GRANT SELECT TO anon` means any new table is anon-readable unless RLS is also explicitly enabled — a trap that has already fired: four operational tables (including one holding customer phone numbers) shipped without RLS and were only locked down by later remediation migrations.
- **Why it matters:** This converts a forgotten line into public data exposure rather than a permission error, and it's invisible until the Supabase advisor happens to flag it — reactively, after the table is live.
- **Recommendation:** Revoke the blanket grant; replace with explicit per-table grants on the genuinely public tables; add a CI check that fails when any public table lacks RLS enabled.
- **Regression risk:** Only affects tables created after the change — an audit of current grants is still needed separately.
- **Expected impact:** New tables fail closed by default.
- **Effort estimate:** M

#### SE-H4 Rate limiting is applied to cheap endpoints and omitted from the expensive ones
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/make-booking/route.ts:106-113, src/app/api/voice-session/route.ts:10-51, src/app/api/checkout/day-pass/route.ts:50-100
- **What's happening:** (Independently corroborates BE-B2 and BE-S2.) Rate limiting protects read-only endpoints while `make-booking` (outbound calls), `voice-session` (ElevenLabs session minting), and checkout are unprotected.
- **Why it matters:** The protection gradient runs backwards relative to cost and blast radius — a leaked MCP secret becomes an unmetered telephony generator.
- **Recommendation:** Apply rate limiting to all four, keyed appropriately per endpoint.
- **Regression risk:** The limiter fails closed in production — adding it to checkout means an Upstash outage becomes a checkout outage too; weigh that trade explicitly.
- **Expected impact:** A leaked secret becomes a bounded incident.
- **Effort estimate:** S

#### SE-M1 `/api/cron/*` is CSRF-exempt but accepts admin cookie auth, relying on an implicit framework default
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/csrf.ts:50-60, src/app/api/cron/subscription-optimizer/route.ts:153-155, src/app/api/cron/fail-stale-bookings/route.ts:67-69
- **What's happening:** (Independently confirms BE-H5.) The CSRF exemption for `/api/cron/` is justified by "cron uses webhook secret or admin auth," but every cron route's fallback path is a pure cookie-session check — precisely the mode CSRF protection exists for. No Origin check runs either since CSRF validation returns early before it.
- **Why it matters:** A logged-in admin visiting a hostile page could have their browser trigger content-discovery, subscription-optimizer, or booking-failure sweeps. The exploit is blocked today only by an unstated, unpinned `SameSite=Lax` cookie default from an upstream library.
- **Recommendation:** Narrow the exemption to cover only the machine-to-machine path (valid webhook secret present); require CSRF+Origin validation when falling through to admin-cookie auth.
- **Regression risk:** pg_cron and Vercel Cron send neither Origin nor a CSRF cookie — the check must be ordered strictly after the webhook-secret path succeeds, not before, or scheduled jobs break.
- **Expected impact:** The admin-triggered cron path stops depending on an unstated library default.
- **Effort estimate:** S

#### SE-M2 Stripe webhook grants access without checking `payment_status`
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:69-108, src/lib/stripe.ts:113,152
- **What's happening:** (Independently confirms BE-M5.) On `checkout.session.completed`, the handler grants access without ever inspecting `session.payment_status`. Latent today only because payment methods are pinned to `["card"]`, which settles synchronously.
- **Why it matters:** Enabling any delayed-settlement payment method (SEPA, Klarna, Bancontact — natural for the Spanish/EU market) would silently open an unpaid-access path with no code change in the webhook itself.
- **Recommendation:** Gate the grant on `session.payment_status === "paid"`, return a 200 no-op otherwise, and handle `checkout.session.async_payment_succeeded` as an additional grant trigger.
- **Regression risk:** The idempotency RPC keys on `event.id` — if async-succeeded is routed to the same RPC it carries a different event ID for the same purchase, risking a duplicate grant unless the idempotency key moves to the payment-intent or session ID.
- **Expected impact:** Access grants become tied to actual settlement, so payment-method changes can't create a free-access path.
- **Effort estimate:** S

#### SE-M3 License policy is enforced by an exact-match denylist; a source-available production dependency passes silently
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/license-check.yml:30,41, docs/project/license-exceptions.md:1-3
- **What's happening:** The stated policy is permissive-only (MIT/Apache-2.0/BSD/ISC) with documented exceptions; enforcement is a denylist of specific SPDX identifiers. `@sentry/cli` (reached via `@sentry/nextjs` in the production tree) declares `FSL-1.1-MIT` — a source-available license with a competing-use restriction, neither in the allowlist nor the exceptions doc nor the denylist, so CI passes it without comment.
- **Why it matters:** A denylist cannot enforce a stated allowlist policy — it only catches licenses someone anticipated. Practical legal risk is low (build tooling, no competing use), but the gate that was supposed to surface the decision never did.
- **Recommendation:** Invert to `--onlyAllow` seeded with the licenses currently present; record `@sentry/cli` as a documented exception with the competing-use analysis.
- **Regression risk:** `--onlyAllow` will immediately fail on several permissive-equivalent licenses already in the tree that are outside the four named families (e.g. `Unlicense`, `BlueOak-1.0.0`, compound SPDX expressions) — all must be enumerated in the allow string first, or the next unrelated PR fails CI.
- **Expected impact:** Unreviewed licenses become build failures instead of silent passes.
- **Effort estimate:** S

#### SE-M4 Admin role cache has a 30-second TTL and no invalidation path
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/admin-auth.ts:15-16,66-79,115-136
- **What's happening:** `validateAdminAuth` caches the admin role for 30 seconds per user ID in a module-level map, with no eviction hook when a role changes — waiting out the TTL or an instance recycle are the only ways it clears.
- **Why it matters:** Revoking an admin is not immediate — for up to 30 seconds per warm instance, a demoted or compromised account continues to pass admin checks on every route, including mutation routes, during exactly the scenario (an active incident) where revocation matters most.
- **Recommendation:** Add an `invalidateRoleCache(userId)` escape hatch called wherever roles change, plus a short-circuit that skips the cache for mutating HTTP methods.
- **Regression risk:** The cache is per-instance, so any invalidation call only clears the instance that handles it — it cannot be relied on as a global revocation mechanism, and documentation must not overstate what it achieves.
- **Expected impact:** Admin revocation gains a deliberate, documented latency bound instead of an accidental one.
- **Effort estimate:** S

#### SE-L1 SSRF guard on remote image import is resolve-then-fetch (DNS rebinding window)
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** src/app/api/admin/stories/[id]/image/route.ts:105-129,325-335
- **What's happening:** The SSRF guard (a genuinely thorough IPv4/IPv6 private-range check plus DNS resolution verification) validates a hostname, but the subsequent `fetch()` performs its own separate DNS resolution — a hostname whose record flips between the two resolutions is fetched without re-validation.
- **Why it matters:** Residual risk is small — admin-only, redirects rejected, response validated as an image, size-capped — recorded because the surrounding guard is otherwise complete enough that this is the only remaining gap.
- **Recommendation:** Resolve once and connect to the validated IP with the original Host header preserved, or use a `lookup` hook that re-checks each resolved address at connect time.
- **Regression risk:** Pinning to a resolved IP breaks TLS SNI/certificate validation unless Host/servername is carried through explicitly, and breaks CDN-hosted images relying on geo-DNS.
- **Expected impact:** Closes the last gap in an otherwise complete SSRF guard.
- **Effort estimate:** M

#### SE-L2 `/api/health` publicly discloses secret-configuration state
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/health/route.ts:255-258,265-290
- **What's happening:** The unauthenticated health response includes `cron_auth`, `sentry`, and `rate_limit` backend state — build identity is correctly gated behind an auth check, but these three fields got no such treatment.
- **Why it matters:** Low impact since both disclosed subsystems fail closed (missing cron secret rejects everything; degraded rate limiter denies), but it's reconnaissance surface and inconsistent with how the build field is already handled.
- **Recommendation:** Move `cron_auth`, `sentry`, and `rate_limit` behind the same auth gate that already protects the build field.
- **Regression risk:** `/api/health` is polled continuously by Upptime, and a preview-smoke workflow gates deploys on body content — removing fields will break both unless updated in the same change; verify what the external monitor actually matches on first.
- **Expected impact:** Configuration state stops being readable by unauthenticated callers.
- **Effort estimate:** S

#### SE-L3 `PLAYWRIGHT_TEST_ORIGIN` is appended to the CORS allowlist with no environment guard
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/proxy/cors.ts:19-24
- **What's happening:** The allowed-origins list unconditionally pushes this env var when set, guarded only by a code comment asserting it's "never set in production" — a convention, not a constraint. The same array also backs the CSRF Origin check.
- **Why it matters:** No current exposure (only set in the Playwright config), but it's a latent misconfiguration where a single accidentally-scoped Vercel env var would silently grant an arbitrary origin both CORS and CSRF acceptance.
- **Recommendation:** Guard the push on a real non-production condition rather than convention alone, matching a pattern already used elsewhere in the codebase.
- **Regression risk:** Playwright sometimes runs against a production build locally, where a naive `NODE_ENV` check alone would break the E2E suite's CORS-dependent tests — the deploy-environment half of the condition is the load-bearing one.
- **Expected impact:** Test-only origin injection becomes structurally impossible in deployed environments.
- **Effort estimate:** S

#### SE-L4 Sentry scrubbing omits request URL, query string, and IP
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/sentry-before-send.ts:30-46
- **What's happening:** The event sanitizer deletes cookies and request data, redacts sensitive headers, and hashes the user's email — but doesn't touch `request.url`, `request.query_string`, or `user.ip_address`.
- **Why it matters:** Modest today given DO-B1's delivery-verification gap, but query strings carry user-scoped values on some routes, and IP address is personal data under GDPR for an EU-facing product — the scrubber is otherwise careful, making these look like oversights.
- **Recommendation:** Strip or allowlist query strings, normalize URL to its path, null out IP unless deliberately retained for abuse investigation.
- **Regression risk:** Query strings and IP are genuine debugging signal — prefer an allowlist of known-safe params over blanket deletion; rewriting URL affects Sentry's issue grouping and may split or merge historical clusters.
- **Expected impact:** Error telemetry stops carrying user-scoped identifiers by default.
- **Effort estimate:** S

#### SE-L5 Security checklist Gate 1 duplicates an existing automated CI check
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** docs/operations/pre-launch-security-checklist.md:9-11,15-35, .github/workflows/security.yml:20-33
- **What's happening:** The checklist's Gate 1 asks a human to manually run a Gitleaks secret scan because "CI only scans the working tree" — but the CI workflow already checks out full git history and runs a blocking Gitleaks scan on every push, PR, and daily schedule.
- **Why it matters:** Not itself a vulnerability, but a checklist step the reader can verify is redundant trains reviewers to treat the other five gates — several of which genuinely cannot be automated — as equally skippable.
- **Recommendation:** Rewrite Gate 1 to record the CI run's status rather than asking for a manual re-run; correct the header claim.
- **Regression risk:** The manual command uses a redaction flag CI's invocation lacks — verify CI logs don't surface a matched secret in plaintext before pointing reviewers at CI output as authoritative.
- **Expected impact:** The release checklist stays credible; reviewer attention goes to the five gates that actually require a human.
- **Effort estimate:** S

#### SE-S1 Data-layer authorization has no automated regression coverage
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** supabase/migrations/087_restrict_operational_table_access.sql:1-10, supabase/migrations/089_enable_rls_admin_audit_log.sql:1-9, supabase/migrations/090_fix_rls_operational_tables.sql:1-11
- **What's happening:** SE-H1, SE-H2, and SE-H3 are three instances of one root cause — RLS policies and grants are written and reviewed by hand, verified only when the Supabase advisor happens to flag them. The migration history makes the pattern legible: later migrations repeatedly fix tables an earlier migration left open. Meanwhile every application-layer control has extensive test coverage, and zero data-layer controls do.
- **Why it matters:** The craftsmanship at the application layer is genuinely high, which makes the data layer the weakest link by a clear margin — and the gap is structural, not incidental.
- **Recommendation:** Add an RLS test suite connecting with the anon key and asserting negative access for each sensitive table, run against the local Docker Supabase stack the release process already provisions.
- **Regression risk:** These tests are only meaningful if the local stack's policies match production — the migration history shows recorded migrations and actual database state can diverge, so pair with a production `pg_policies` comparison check. Negative-access tests are also easy to pass for the wrong reason (a typo'd table name looks identical to a blocked query) — pair each with a positive control.
- **Expected impact:** The data layer gains the same regression safety net the application layer already has.
- **Effort estimate:** L

**Scope caveat (from the Security Reviewer):** this was a static, read-only review — no live requests were sent to production and no exploit was executed. SE-H1 and SE-H2 should be confirmed against the live database before remediation is scoped. A dedicated penetration test remains necessary before further launch milestones.

**Scope caveat (from the Security Reviewer):** this was a static, read-only review — no live requests were sent to production and no exploit was executed. SE-H1 and SE-H2 should be confirmed against the live database before remediation is scoped. A dedicated penetration test remains necessary before further launch milestones.

### Cross-Domain Notes (Security)
- BE/DO: `voice-access` and `voice-session` build their Supabase client without the request, so a bearer-token client gets a false-denied response rather than a security hole (same root cause as BE-M12).
- DO: Migration 090 documents that migration 087's statements did not apply despite being recorded as applied — a migration-tooling reliability issue with security consequences.
- BE/PE: `maintenance.ts`'s anon-key PostgREST read on the hot path is the coupling that makes SE-H1's fix non-trivial.
- QA: No test exercises the anon PostgREST surface at all — structurally invisible to the existing test suite.
- AR: Authorization is expressed twice, in two languages (TypeScript predicate vs. RLS policy), with no mechanism keeping them in agreement.

---

## 9. Code Quality / Maintainability Findings (Principal Architect)

**Baseline health note (stated plainly by the Architect):** `npm run typecheck` passes clean across all four TS projects; `npx knip` reports zero unused files/exports/dependencies; zero `@ts-ignore`/real `any` in non-test source under `strict: true`; `npm outdated` shows only minor drift; the module graph is fully acyclic with correctly-directed layering. The findings below are specific structural risks in an otherwise disciplined system, not a general quality problem.

#### AR-H1 Superseded `/api/chat` route still ships, duplicating the security preamble it has already diverged from
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/api/chat/route.ts:1-287, src/app/api/chat/stream/route.ts:49-107
- **What's happening:** (Same underlying route as BE-H6.) No application code calls `/api/chat` — only an E2E test does — yet it duplicates the entire security preamble of the live streaming route, and the two copies have already diverged.
- **Why it matters:** Security-critical logic maintained in two hand-synced copies is the classic source of "fixed in one place" incidents; Knip cannot flag this because route files are entry points by definition.
- **Recommendation:** Delete the route (after confirming no external caller) and retarget the E2E test at the streaming endpoint, or extract a single shared preamble helper.
- **Regression risk:** Verify against Vercel access logs for external callers before removing.
- **Expected impact:** One security preamble instead of two divergent copies.
- **Effort estimate:** S

#### AR-H2 Layered retries plus non-cancelling timeouts let one chat request bill up to 12 Anthropic calls
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/claude.ts:87,98-129,295-296,327,365-426,513-519
- **What's happening:** Retry budgets are nested at two independent levels (an outer manual loop around an SDK client that also has its own `maxRetries: 3`), compounding to up to 12 HTTP calls per message, and the stage timeout doesn't cancel the underlying call (same root cause as BE-M4/PE-H5).
- **Why it matters:** Under a partial Anthropic degradation — precisely when retries all fail — a modest request rate multiplies into up to 12× spend with zero successful responses, mapping directly onto the project's own recorded credit-exhaustion incident.
- **Recommendation:** Collapse to a single retry authority; thread an `AbortSignal` through so a stage timeout actually cancels the call.
- **Regression risk:** The two retry layers cover different failure modes (SDK-level 429/5xx vs. first-token stream failure) — verify which before removing either.
- **Expected impact:** Worst-case spend drops from 12 calls to the intended 3–4.
- **Effort estimate:** M

#### AR-H3 The circular-dependency CI gate resolves none of the codebase's 1,077 alias imports
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** package.json:18, .github/workflows/ci.yml:69
- **What's happening:** The `madge --circular` check omits `--ts-config`, so it can't resolve the `@/*` path alias used by essentially the entire import graph (1,077 imports) — it currently passes for the wrong reason.
- **Why it matters:** A required status check that passes without actually analyzing the graph converts an unmonitored risk into one the team believes is monitored.
- **Recommendation:** Add `--ts-config tsconfig.json` to the madge invocation.
- **Regression risk:** Low — re-verified the repo is still cycle-free with resolution enabled.
- **Expected impact:** The gate begins covering ~100% of the import graph instead of a small relative-import remainder.
- **Effort estimate:** S

#### AR-M1 595 prior-audit finding IDs are embedded as code comments across 170 files, and they now collide
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/proxy.ts:69, src/app/api/chat/route.ts:43,74, src/app/api/health/route.ts:73-77, src/app/api/feature-flags/route.ts:9-48
- **What's happening:** Comments carrying prior-audit finding IDs appear 595 times across 170 files spanning 95 distinct IDs. The ID namespace is reused across audit cycles — `AR-M1`, `AR-M2`, `AR-H2` and others already existed in the code from a previous architecture audit before this current run started, meaning this report's own IDs now collide with pre-existing ones.
- **Why it matters:** These IDs are meaningless to any reader who wasn't present for the audit that generated them, and there's no in-repo index resolving them — worse, because the namespace recycles, a reader who does look one up now finds the wrong finding.
- **Recommendation:** Strip bare ID tokens and keep the substantive prose where a comment explains a real constraint; delete comments that are only an ID restating adjacent code; reference the GitHub issue number instead where durable traceability is wanted.
- **Regression risk:** Comment-only change, but touches 170 files — must be an isolated commit with no source edits mixed in. Do not blanket-regex the IDs away; some comments become ungrammatical without rewriting, and some appear inside test assertions/describe-block names.
- **Expected impact:** Comments carry reasons a new engineer can act on rather than tokens they must ignore; the ID-collision trap for future audits disappears.
- **Effort estimate:** M

#### AR-M2 Three competing admin-auth abstractions; the RLS-scoped one is used by 1 of 31 routes
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/admin-auth.ts:159-172,174-215, src/app/api/admin/marketing/agent-logs/route.ts, src/app/api/admin/suggestions/route.ts
- **What's happening:** All 31 admin routes are authenticated, but via three different mechanisms (manual check, an unbypassable wrapper, and an RLS-scoped read-only wrapper). The RLS-scoped wrapper's own docstring states the design intent — read-only operations should get a cookie-scoped client limiting blast radius — but it's followed in exactly one route. Four read-only routes instead run with full service-role reach, contradicting the documented design.
- **Why it matters:** A documented defense-in-depth decision was applied to 3% of its intended call sites. The manual-check pattern also depends on every author remembering to check the result, with no compiler or lint rule catching a forgotten early-return.
- **Recommendation:** Migrate the four read-only service-role routes to the RLS-scoped wrapper first (highest value, lowest risk); convert remaining manual-check routes to the wrapper pattern so enforcement is structural.
- **Regression risk:** Not mechanical — the RLS-scoped client returns fewer rows than service-role for any query the admin's own RLS policy doesn't grant, which is a silent data-disappearance bug, not a loud failure. Confirm RLS policies actually admit the admin role for every table each route touches, tested against the local Docker stack.
- **Expected impact:** Auth becomes unbypassable by construction across the admin surface.
- **Effort estimate:** M

#### AR-M3 The production Claude transport is a different implementation from the one dev and CI exercise
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/claude.ts:3-15,48-50,63-67,135-169, src/lib/claude.test.ts:1451-1467
- **What's happening:** (Echoed independently by BE-L1 and QA-H3.) A `NODE_ENV`-based flag selects a `curl` subprocess transport in dev/test and the Anthropic SDK in production. Every local run, e2e run, and CI run exercises the curl path; the SDK path runs only in production. The header comment honestly documents this as a known parity gap left open because SDK streaming couldn't be verified headlessly.
- **Why it matters:** The single most important code path in the product has no pre-production integration signal — a regression in SDK streaming from an SDK bump, Next.js bump, or runtime change is undetectable by any gate and surfaces first to real users.
- **Recommendation:** Add one integration probe that exercises the SDK path against the real API before release, wired into the release-gate probe manifest rather than per-push CI to control cost.
- **Regression risk:** A real-API probe spends Anthropic credit on every release and can fail for reasons unrelated to the code (the project has already had a credit-exhaustion incident) — it must report distinguishably from a code failure or the team will learn to ignore a red gate.
- **Expected impact:** The production transport gains pre-release verification.
- **Effort estimate:** M

#### AR-M4 An admin-panel decomposition refactor was started and abandoned, leaving inconsistent siblings
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/admin/costs-analytics-panel/ (11 files), src/components/admin/stripe-analytics-panel.tsx:1-716, src/components/admin/visitors-analytics-panel.tsx:1-811
- **What's happening:** Four admin features were decomposed into small colocated modules with a clear convention; eleven sibling components doing the same job were left as single 420-811-line files — direct siblings in the same directory structured in opposite ways.
- **Why it matters:** A half-applied convention is worse than either applied consistently, because there's no signal telling a new contributor which pattern is current, and each new panel becomes an arbitrary choice.
- **Recommendation:** Standardize on the decomposed structure and apply it to the two largest untouched offenders first.
- **Regression risk:** These are admin-only surfaces with limited e2e coverage, so a decomposition regression would likely be caught only by colocated unit tests — confirm those tests exercise the public component boundary rather than internals before relying on them, and this is a 5+ file refactor that should go through the project's dedicated refactoring workflow.
- **Expected impact:** One structural convention across the admin surface.
- **Effort estimate:** L

#### AR-M5 The `server-only` guard is applied to 6 of 14 secret-reading modules
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/claude.ts:156, src/lib/twilio-sms.ts:41, src/lib/mcp-auth.ts:16, src/lib/rate-limit.ts:107
- **What's happening:** The project uses `import "server-only"` as a build-time guard against a secret-reading module landing in a client bundle. Six sensitive modules carry it; eight equally sensitive ones (including the Anthropic key reader and the rate-limit module) don't. A transitive-import-closure check from every client component confirms this is currently latent, not an active leak — the boundary holds by discipline, not enforcement.
- **Why it matters:** The whole value of the guard is converting a silent runtime leak into a loud build failure; applied to 43% of modules that need it, it protects only the cases someone remembered.
- **Recommendation:** Add `import "server-only"` to the eight unguarded modules.
- **Regression risk:** This fix is most likely to surface a real problem rather than cause one — if any of the eight is transitively reachable from a client bundle through a path static analysis missed, the build will correctly fail; land it as its own isolated commit so that failure is unambiguous.
- **Expected impact:** The server/client boundary is enforced by the build for all 14 secret-reading modules instead of 6.
- **Effort estimate:** S

#### AR-L1 `lint:src` has no warning ceiling while `lint:scripts` does
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** package.json:15-17, eslint.config.mjs:19,44
- **What's happening:** Application source (`eslint src/`) has no `--max-warnings` flag while build scripts do — the inverse of the intended risk ordering. Two rules are configured as warnings, and a fresh lint run currently reports zero warnings, so there's no backlog.
- **Why it matters:** The gate is clean today purely by chance of timing; warning backlogs are self-reinforcing once a few accumulate.
- **Recommendation:** Add `--max-warnings=0` to `lint:src`.
- **Regression risk:** Minimal given the current zero count, but re-run the lint immediately before applying in case a warning was introduced in between.
- **Expected impact:** The zero-warning state becomes enforced rather than incidental.
- **Effort estimate:** S

#### AR-L2 `knip.json` silences license identifiers as if they were binaries
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** knip.json:22-35
- **What's happening:** `ignoreBinaries` contains eleven SPDX license identifiers alongside genuine binaries — almost certainly deny-list arguments passed to the license checker in a CI workflow that Knip misparsed as binary invocations and were then silenced rather than fixed.
- **Why it matters:** A suppression that hides the real issue rather than resolving it, in the configuration of the dead-code gate itself — the one place where over-broad suppression directly reduces the gate's coverage.
- **Recommendation:** Remove the eleven license identifiers from `ignoreBinaries` and re-run Knip.
- **Regression risk:** Removing entries can only make Knip report more, never less — no risk of masking a problem, but may surface an unresolved-binary error to address separately.
- **Expected impact:** Knip output becomes signal-only.
- **Effort estimate:** S

#### AR-L3 Two environment variables for the Supabase service key, resolved by silent fallback
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/env.ts:79,82, src/lib/supabase-admin.ts:33, .env.example:7-8
- **What's happening:** Two accessors read two differently-named env vars for the same service-role key, resolved via `??` and documented as "either works" — a deliberate compatibility shim.
- **Why it matters:** Two spellings resolved by `??` means setting the wrong one still "works," hiding a misconfiguration — and if both are set to different values (e.g. one rotated, one stale), the fallback silently picks the first, which is exactly the rotation scenario where a loud failure is wanted, on the highest-privilege credential in the system.
- **Recommendation:** Pick one canonical name, confirm it's what's set in Vercel, then delete the other accessor and the fallback.
- **Regression risk:** Must verify via the Vercel CLI which variable production actually has populated before removing either accessor — if production runs on the legacy name and the fallback is deleted, every service-role operation fails at once (a total admin/webhook outage). Per project rules, changing production env vars requires user authorization.
- **Expected impact:** One spelling for the most privileged credential; misconfiguration fails loudly instead of silently falling back.
- **Effort estimate:** S

#### AR-S1 The test suite is 2.4× the size of the source it covers, concentrated in a few very large files
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** src/proxy.test.ts:1-1765, src/proxy.ts:1-96, src/app/api/mcp/make-booking/route.test.ts:1-2694
- **What's happening:** Non-test source totals ~55,572 lines; test code totals ~130,750 — a 2.35:1 ratio, heavily skewed (one 18:1 file testing a thin composition-layer file whose steps already have their own colocated unit tests).
- **Why it matters:** Flagged as something to watch, not a defect — where composition-layer tests re-cover what handler-level unit tests already assert, test volume becomes a change-amplifier that biases the team against future refactors like AR-M4.
- **Recommendation:** Do not undertake broad test reduction. Sample the outlier file against its constituent unit tests, measure actual overlap, and only then decide whether the pattern generalizes.
- **Regression risk:** Test deletion is the one refactor with no safety net — any reduction must be justified by demonstrated duplication, not file size, and must not drop the coverage thresholds enforced in CI. Ordering/short-circuit assertions that no unit test can cover must survive regardless.
- **Expected impact:** Understanding of whether test volume is buying coverage or imposing drag.
- **Effort estimate:** M (investigation)

#### AR-S2 `noUncheckedIndexedAccess` is off, so array and record indexing is unsoundly typed
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** tsconfig.json:1-40
- **What's happening:** The config enables `strict: true` and a genuinely strong baseline the codebase fully satisfies with zero escape hatches, but `noUncheckedIndexedAccess` is absent — `arr[i]` types as `T` rather than `T | undefined`, so out-of-bounds or missing-key access type-checks cleanly and fails at runtime. This matters more than usual given several external-data parsing boundaries (SSE frame splitting, cookie parsing, search-result arrays).
- **Why it matters:** The largest remaining soundness gap in an otherwise rigorously typed codebase, and precisely the class of bug well-formed test fixtures don't catch — the failure needs malformed upstream data or an empty result set.
- **Recommendation:** Do not enable now. After launch, turn it on locally, count errors, and fix incrementally starting with the external-data boundaries.
- **Regression risk:** Enabling repo-wide will produce a large error count across 754 files — the danger is the fix pattern, since under deadline pressure errors get silenced with non-null assertions, which preserves the unsoundness while undoing the codebase's current zero-escape-hatch discipline.
- **Expected impact:** A latent runtime-error class becomes a compile-time error at the boundaries where external data enters.
- **Effort estimate:** XL

### Cross-Domain Notes (Architecture)
- QA: The LLM-quality suite (`test:qa`) is outside every release gate and runs on a single operator's Mac via launchd — no CI workflow references it.
- QA/DO: `e2e/` is typechecked but never linted — 44 tracked files with no lint coverage.
- SE: `streamWithCurl` passes the Anthropic API key as a `spawn` argv element, visible in local process listings (dev/test only).
- SE/BE: The four read-only admin routes running with service-role clients (AR-M2) are a blast-radius question shared with SE.
- DO: `develop-smoke` is `continue-on-error: true` by design — echoes DO-H1's finding that it's advisory-only regardless.
- PE: AR-H2's retry amplification and the non-cancelling timeout have direct latency and cost implications beyond the architectural concern.

---

## 10. Testing / QA Findings (QA / Reliability Lead)

**Raw gate results (all green):**

| Gate | Command | Result |
|---|---|---|
| Unit/integration | `npm run test -- --maxWorkers=4` | **PASS** — 393 files, 7421 tests, 0 failed, 70.68s |
| Types | `npm run typecheck` | **PASS** — 0 errors |
| Lint | `npm run lint` | **PASS** — 0 errors, 0 warnings |
| Coverage | `npx vitest run --coverage` | **PASS** — 98.9% statements / 97.42% branches / 99.06% functions / 99.29% lines |

Playwright was not run locally (would require a multi-minute cold build); CI's own `Playwright E2E` run is the authority on that gate. No flakes observed at capped workers on either local run.

#### QA-H1 The "Authenticated User Journeys" E2E suite is vacuous — it is never authenticated and its assertions cannot fail
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** e2e/qa-journey.spec.ts:486-633,538-563,566-605
- **What's happening:** The E2E build bakes in a dummy Supabase anon key, so `AuthProvider` short-circuits to `user = null` regardless of cookies the test fixture injected server-side. One "favorite via API" test writes directly to localStorage and then asserts localStorage contains what it just wrote — a tautology. The real `/api/favorites` → Postgres → RLS path is never exercised.
- **Why it matters:** Four tests in a required CI check report green coverage of the authenticated path while verifying nothing — they would pass even if auth, favorites, and RLS were completely broken. This is directly connected to FE-B1/FE-B2 shipping unnoticed.
- **Recommendation:** Build a dedicated authenticated E2E project against a real (non-dummy) key and a local Supabase Docker stack, asserting on server-observable state; delete the localStorage-only assertions.
- **Regression risk:** A real authenticated project signs into the production Supabase project (Preview shares production) — cleanup and test-user scoping must remain unconditional.
- **Expected impact:** The authenticated path gains genuine per-merge coverage or stops being falsely claimed.
- **Effort estimate:** M

#### QA-H2 No automated gate exercises the real chat/RAG pipeline — the product's core feature
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** e2e/chat.spec.ts:16-31,93-100, quality/required-probes.yaml:28-140
- **What's happening:** Every browser-level chat test intercepts the SSE endpoint with a canned response. None of the 9 required release probes touches chat. Unit tests cover the route at 100% statements with every external dependency mocked.
- **Why it matters:** A Voyage dimension change, a `match_chunks` signature drift, an SDK breaking change, or an expired key — the exact incident class this project has already lived through — produces green CI and a broken product.
- **Recommendation:** Add a `chat-smoke` release probe asserting on SSE shape (200, event-stream content-type, a non-empty text event, a terminal done event with ≥1 source) — never on answer content.
- **Regression risk:** Must send a Vercel-forwarded IP header or it 429s itself against the untrusted-caller rate limit.
- **Expected impact:** Retrieval-and-generation contract drift becomes a release blocker instead of a production incident.
- **Effort estimate:** M

#### QA-H3 The only real-LLM regression suite exercises a non-production Anthropic code path, on a different endpoint, off-CI
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/lib/claude.ts:50,63-67,80-90, src/tests/qa/llm-quality.test.ts:69, scripts/qa-agent.sh:177-181
- **What's happening:** (Same divergence as AR-M3/BE-L1.) The weekly QA agent runs `npm run dev`, forcing the curl code path with different prompt structure and retry semantics than production, and it hits the non-streaming `/api/chat` endpoint no user ever calls. The suite's only trigger is a launchd job on one Mac.
- **Why it matters:** The one gate that talks to a live model validates a transport, prompt shape, and endpoint no production user touches.
- **Recommendation:** Point the QA suite at `/api/chat/stream`; have the QA agent run a production build (`next build && next start`) instead of dev.
- **Regression risk:** Adds minutes to a weekly job; the health-wait loop needs adjusting for a longer cold start.
- **Expected impact:** The live-model gate starts measuring the code that actually ships.
- **Effort estimate:** S

#### QA-H4 Every idempotency, concurrency and RLS guarantee lives in Postgres functions that no automated test executes
- **Severity:** high | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:96-108, supabase/migrations/
- **What's happening:** 21 `.rpc()` call sites invoke 10 named functions plus 25 `SECURITY DEFINER` functions and a full RLS policy set — every unit test mocks the Supabase client and asserts on the value it supplied. Nothing executes real SQL.
- **Why it matters:** The highest-consequence logic in the system ("did a paying customer get their grant, exactly once") has the highest mock-coverage and the lowest real coverage.
- **Recommendation:** Add a local-Docker integration tier for the RPCs whose contract is a guarantee, starting with the payment-grant and SMS-claim functions.
- **Regression risk:** Must be structurally unable to reach production; start as non-required until flake rate is known.
- **Expected impact:** The idempotency contract becomes falsifiable.
- **Effort estimate:** L

#### QA-M1 The E2E storage-state fixture is dead code, and the mobile nav hint overlays every mobile test for ~3.5s
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** e2e/storage-state.json:1-11, playwright.config.ts:71, src/components/immersive/navigation-hint.tsx:8-12,24,35,46-53
- **What's happening:** The Playwright storage-state seed writes a localStorage key, but the nav hint it's meant to suppress reads `sessionStorage` — a deliberate change recorded in the component's own comment — so the seed has been inert since that change. On the mobile project, the hint renders as a full-viewport click-intercepting overlay for ~3.5s on every test, masked by `retries: 2`.
- **Why it matters:** A silent, structural flake source in the required Playwright E2E check; also a real 3.5-second pointer-event block for actual mobile visitors on every session, not just in tests.
- **Recommendation:** Replace the file-based seed with an `addInitScript` writing to `sessionStorage`, which is origin-agnostic and fixes a secondary hard-coded-port bug in the same fixture.
- **Regression risk:** Suppressing the hint everywhere in tests means it loses its only browser-level coverage — add one opt-in mobile test asserting it appears and auto-dismisses.
- **Expected impact:** Removes ~3.5s of retry churn per mobile test.
- **Effort estimate:** S

#### QA-M2 The zero-test guard protects only the Stripe path; `npm run prelaunch` can pass having skipped its authenticated journeys
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** scripts/lib/playwright-report.ts:24-48, scripts/run-stripe-e2e.ts:159, scripts/run-prelaunch-gate.ts:45-48, e2e/qa-journey.spec.ts:486-492
- **What's happening:** The codebase already has a well-built guard (`assertTestsExecuted`, refuses a run with zero executed tests) wired to exactly one call site — the Stripe E2E script. The `prelaunch` gate's browser-E2E step has no such guard, and without QA test-user credentials locally, the authenticated journeys silently skip while the gate prints "passed."
- **Why it matters:** `npm run prelaunch` is a documented pre-deployment release-checklist gate; a gate that prints "passed" while a whole test class silently didn't execute is precisely the failure mode the existing guard was built to eliminate — it just isn't applied here.
- **Recommendation:** Route the prelaunch browser-E2E step through the existing guard; additionally make the auth-journey skip fail closed under CI or an explicit flag rather than silently skip.
- **Regression risk:** The guard alone doesn't detect a *partial* skip (auth journeys skipping while dozens of anonymous tests run still yields a non-zero count) — the fail-closed skip is the load-bearing half, and must be gated on an explicit flag so a legitimate credential-less local run stays usable.
- **Expected impact:** The local release gate stops being able to report success on a run that verified less than it claims.
- **Effort estimate:** S

#### QA-M3 `npm run prelaunch` omits the unit suite, typecheck and lint
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** scripts/run-prelaunch-gate.ts:28-49, package.json:40
- **What's happening:** The prelaunch step list is exactly five entries (verification-coverage, env, migrations, build, e2e) — it does not run the unit test suite, typecheck, or lint, despite the release checklist listing the full suite as a separate documented step.
- **Why it matters:** The gap between what a command's name implies and what it checks is where release mistakes live — an operator who runs `prelaunch` and sees it pass hasn't run the 7,000+ unit tests.
- **Recommendation:** Prepend typecheck, lint, and the unit suite to the step list — they're the cheapest steps and would surface failures before the ~4-minute build.
- **Regression risk:** If the checklist intentionally separates "full suite" from "prelaunch" to run at different cadences, adding them here duplicates work — confirm intent against the release checklist first.
- **Expected impact:** One command becomes a true gate.
- **Effort estimate:** S

#### QA-M4 No meta-test enforces the admin-guard or RPC-name invariants, though the pattern for one already exists
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/lib/logger-migration.test.ts:16-33,45-62, src/app/api/admin/ (31 route files)
- **What's happening:** All 31 admin routes are currently guarded, and all 10 named RPCs invoked from application code match a migration definition — both hold by convention only. The codebase already has the right tool: an existing meta-test walks the API tree and fails on any bare console call.
- **Why it matters:** An unguarded admin route or a drifted RPC name would be a real data-exposure or production-500 bug that no route-level unit test would catch, since each route's own test mocks whatever it imports.
- **Recommendation:** Add two meta-tests in the existing style — walk admin routes asserting a guard reference exists per exported method; extract every `.rpc()` string literal and assert a matching migration definition.
- **Regression risk:** Both are static text checks and will false-positive on legitimate refactors (a new wrapper name, an RPC invoked via a variable) — keep the guard allowlist in one named constant.
- **Expected impact:** Two invariants move from convention to enforcement at near-zero runtime cost.
- **Effort estimate:** S

#### QA-M5 `check-migrations` enforces `SET search_path` on 3 named functions out of 25 SECURITY DEFINER functions
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** scripts/check-migrations.ts:43-47,213-239,274-279
- **What's happening:** (Same root-cause gap as BE-M2.) The migration-security checker validates `search_path` against a hard-coded three-name allowlist; parsing every migration finds 25 distinct `SECURITY DEFINER` functions. All 25 currently comply, so this is a latent gate gap, not an active violation.
- **Why it matters:** The gate creates the impression the project's own database-security guardrail is enforced when it covers 12% of the functions it claims to protect.
- **Recommendation:** Invert the check to parse every `SECURITY DEFINER` function header and require the clause on all of them, taking the last definition per signature.
- **Regression risk:** The header parser must respect migration ordering (judge a function on its latest definition, not every historical one) and must not fire on DROP/REVOKE statements.
- **Expected impact:** The stated database-security guardrail becomes machine-enforced across all 25 functions instead of 3.
- **Effort estimate:** M

#### QA-M6 The rate-limit call sits outside the chat route's timeout discipline and fails closed, making Upstash a single point of total chat failure
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/lib/rate-limit.ts:134-159,219-257, src/app/api/chat/stream/route.ts:58-61,147-154
- **What's happening:** (Echoes PE-M3/SE-H4.) Every stage of the chat pipeline has an explicit timeout except the very first I/O — the rate-limit check — which has no timeout and no stage telemetry.
- **Why it matters:** The route is otherwise exemplary about bounded latency; the one unbounded call is the one that runs first on every request, and there's no hedge distinguishing "Upstash errored once" from "Upstash has been down for ten minutes."
- **Recommendation:** Add a rate-limit stage to the existing timeout wrapper so a slow limiter degrades on a known deadline with the same telemetry as every other stage.
- **Regression risk:** A timed-out limiter must fail closed, exactly like the error path — falling through to allowed would turn the timeout into a rate-limit bypass.
- **Expected impact:** Bounded worst-case latency on the chat path's first I/O.
- **Effort estimate:** S

#### QA-M7 The visitor voice flow — the monetized feature — has no browser-level coverage, and the file named for it tests something else
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** e2e/voice-agents.spec.ts:39-283, src/app/api/voice-session/route.ts, src/app/api/voice-access/route.ts
- **What's happening:** The spec file named for voice agents contains only unauthenticated-admin-denial assertions. Grepping for voice-session, Pelayo, or ElevenLabs across `e2e/` yields one unrelated hit. Coverage confirms this is also the weakest unit-tested API route in the codebase.
- **Why it matters:** Voice is what the day-pass purchase buys — the purchase side has a real end-to-end test, the delivery side has none, so a user can pay successfully and find the feature broken with no gate noticing.
- **Recommendation:** Rename the misleading spec file; add a visitor-voice spec covering the paywall gate (access denied → CTA renders; access granted → Talk control renders and requests a session), mocked rather than depending on a live ElevenLabs connection.
- **Regression risk:** A mocked test verifies the client gate, not that the server issues a valid signed URL — don't let it create the impression real issuance is covered.
- **Expected impact:** The paywall gate for the paid feature gains real coverage.
- **Effort estimate:** M

#### QA-M8 Eighteen E2E assertions carry per-wait timeouts equal to the entire CI per-test budget, with `retries: 2` masking the result
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** playwright.config.ts:53,56, e2e/immersive.spec.ts:20,26,39,59,80, e2e/interactive-controls.spec.ts:107,380,402
- **What's happening:** The CI per-test timeout is set *lower* than the local one, on runners slower than a developer machine. Eighteen individual assertion waits in the desktop/mobile projects request that entire budget for a single wait, leaving zero headroom for what follows, and a two-attempt retry can mask a genuinely slow render as a transient flake.
- **Why it matters:** A manufactured flake floor — under CI contention a legitimately-slow render fails attempt 1, passes attempt 2, and shows up only as a "flaky" count nothing reads.
- **Recommendation:** Raise the CI per-test timeout above the local one (CI is the slower environment), or reduce per-assertion waits to a fraction of the budget.
- **Regression risk:** Raising the CI timeout lengthens the worst-case E2E job and weakens the timeout's value as a performance-regression signal.
- **Expected impact:** Removes a systemic flake floor.
- **Effort estimate:** S

#### QA-L1 Coverage thresholds sit 4-7 points below actual, leaving large silent-regression headroom
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** vitest.config.ts:45-50
- **What's happening:** Configured thresholds are 95/90/95/95; measured actuals are 98.9/97.42/99.06/99.29 — roughly 450 uncovered statements and 590 uncovered branches of slack before the gate fires.
- **Why it matters:** A ratchet that trails reality by several points isn't really a ratchet — the team maintains coverage voluntarily, and the gate provides little protection if attention lapses.
- **Recommendation:** Raise thresholds to just under current measured values with a small deliberate buffer.
- **Regression risk:** A tighter ratchet fails PRs adding a legitimately hard-to-cover module — establish a documented exclusion convention before tightening.
- **Expected impact:** The coverage gate starts protecting the level the team actually maintains.
- **Effort estimate:** S

#### QA-L2 `lint:src` lacks `--max-warnings=0` while `lint:scripts` has it
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** package.json:15-17
- **What's happening:** (Same finding as AR-L1, confirmed independently by QA.) The larger, more important application tree has a looser lint gate than the smaller scripts tree; a fresh run shows zero current warnings.
- **Why it matters:** Warnings in the application surface would accumulate invisibly, and the first one sets the precedent.
- **Recommendation:** Add `--max-warnings=0` to `lint:src`.
- **Regression risk:** A future lint-plugin upgrade introducing a new warn-level rule becomes an immediate CI failure — that's the intent, but it makes dependency bumps slightly more likely to need an accompanying code change.
- **Expected impact:** Warning drift in the application tree becomes impossible.
- **Effort estimate:** S

#### QA-L3 The health endpoint probes three tables; the paid-access table is not among them
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/health/route.ts:150-192, src/app/api/health/db/route.ts:44
- **What's happening:** The health endpoint probes two content tables and one config table; `voice_purchases` — the table that decides whether a paying customer gets the feature they bought — isn't among them.
- **Why it matters:** `/api/health` is the primary 24/7 signal that production is working, and the project's own stated principle is that health checks must verify every public table the app actually reads.
- **Recommendation:** Add a `voice_purchases` probe following the existing pattern (a minimal `select id limit 1` exercises grants and RLS without reading customer data).
- **Regression risk:** Each added probe is another round-trip on an endpoint hit constantly by monitoring, and a new hard-failing probe widens what blocks a release — decide deliberately whether a failure here should be `unhealthy` or merely `degraded`.
- **Expected impact:** A broken paid-access read path becomes visible to monitoring instead of silent.
- **Effort estimate:** S

#### QA-L4 Stripe unrecoverable-event and RPC-timeout markers have no alert consumer
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:20-29,113-122
- **What's happening:** When a checkout-completed event is malformed, the handler correctly logs an ERROR-level marker and returns 200 so Stripe stops retrying — but nothing in the alerting runbook consumes that log marker, and grepping the repo finds it referenced only in the route, its test, and a planning doc.
- **Why it matters:** The 200 response is deliberate and correct, but it means Stripe's own retry/failure surface will never surface the problem — the log line is the only signal, and money-taken-with-no-grant is the highest-severity silent failure class in the system.
- **Recommendation:** Wire the markers into the alerting path and add a documented manual-grant remediation procedure to the runbook.
- **Regression risk:** Do not change the 200 response to force Stripe retries — retrying a malformed event is an infinite loop, and the current behavior is correct; any reconciliation job added instead must be strictly read-only.
- **Expected impact:** Payment-without-grant becomes a paged incident rather than an archaeology exercise.
- **Effort estimate:** M

#### QA-L5 Isolated low-coverage islands in visitor-facing responsive and animation code
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/hooks/use-media-query.ts, src/components/immersive/author-typewriter.tsx, src/test/setup.ts:101-114
- **What's happening:** Against a 98.9% overall statement rate, a small cluster of visitor-facing files sit at 50-62% branch coverage — traced to a global test-environment `matchMedia` mock that hard-codes `matches: false` and gives listener registration an empty body, steering coverage away from responsive/reduced-motion branches by default.
- **Why it matters:** Individually minor, but these are exactly the branches that break for a subset of real users and never for the developer running the default mock.
- **Recommendation:** Cover the missing branches; make the shared mock support driving change events opt-in so listener paths are reachable without each test rebuilding the mock.
- **Regression risk:** Changing the shared mock's default touches all test files that rely on it implicitly — make the new behavior opt-in rather than changing the default return value.
- **Expected impact:** Responsive and reduced-motion branches become exercised.
- **Effort estimate:** M

#### QA-S1 The verification strategy has depth everywhere except at the boundaries that actually fail
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** vitest.config.ts:29-31, quality/required-probes.yaml:28-140, scripts/release/analyze-release-run.ts:143-166
- **What's happening:** Extensive unit-test coverage fakes every external boundary (Postgres, Anthropic, Voyage, ElevenLabs, Stripe, Upstash); the Playwright tier fakes the same boundaries at the network layer; the release-probe tier is real but deliberately thin. QA-H1 through QA-H4 are four instances of the same structural gap — there's no tier between "everything mocked" and "the release gate."
- **Why it matters:** Confidence is highest exactly where the code is most deterministic and near-zero where it depends on another system's contract — vacuous authenticated journeys, no real chat probe, a quality gate on a non-production code path, and untested RPCs all exist because of this one missing middle tier, and it will regenerate at the next boundary added if patched piecemeal.
- **Recommendation:** Establish a contract/integration tier running per-merge against a Supabase Docker stack, using the existing `local-docker` tier structure in the release-probe manifest as its home rather than inventing a parallel one.
- **Regression risk:** Adds a required check with a genuinely new container-dependency flake mode and real CI minutes — start non-required and promote only once flake rate is measured; recorded upstream fixtures for third-party contract shapes need a periodic refresh job or they become their own false-confidence source.
- **Expected impact:** The class of failure behind QA-H1 through QA-H4 stops regenerating.
- **Effort estimate:** XL

**Open questions (QA):** Playwright was not run locally (full build required); CI's own run is the authority. `test:qa` requires a live server and credentials and was not run.

**Open questions (QA):** Playwright was not run locally (full build required); CI's own run is the authority. `test:qa` requires a live server and credentials and was not run.

### Cross-Domain Notes (QA)
- SE: The Anthropic API key is passed as a `spawn` argv element in the dev-only curl path, visible in local process listings.
- BE: The fail-closed rate limiter's availability cost is unhedged; a Stripe webhook `setTimeout` is never cleared on the success path.
- DO: The QA agent is the sole trigger for the only live-LLM signal, dependent on one Mac being awake, and it also probes production from a personal machine.
- FE: The nav-hint overlay blocks pointer events for 3.5s on every real mobile session, not just in tests.
- AR: `claude.ts`'s dual transport has divergent prompt caching and retry semantics between the tested and shipped paths.

---

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

#### UX-B1 Pricing page sells three tiers but every surrounding copy string says "24 hours"
- **Severity:** launch-blocker | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/pricing/page.tsx:124-158,166,225, src/lib/pricing.ts:26-45, src/lib/i18n/es.ts:264,269,292
- **What's happening:** The section label, feature bullet, and FAQ answer are all hardcoded to "24 horas" regardless of which tier (day/week/month) is selected. The locale keys needed to make duration tier-dependent don't exist in any of the six locale files, so a fallback silently renders Spanish duration text to every non-Spanish visitor too.
- **Why it matters:** A user selecting the €9.99 monthly pass reads, in three places, that they're buying 24 hours of access — immediately before a card charge. This is a material misdescription on a payment surface in an EU consumer market.
- **Recommendation:** Derive the section label, feature bullet, and FAQ answer from the selected tier; add the missing duration keys to all six locale files; add a parity test.
- **Regression risk:** The `t(key) === key` fallback exists to survive missing keys — remove it together with adding the keys, not before.
- **Expected impact:** The tier selector describes what it actually sells.
- **Effort estimate:** S

#### UX-H1 Suggested-question chips are silently discarded for paying (voice) users
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/voice-chat.tsx:104-108,126-136,235-243
- **What's happening:** (Same root cause as FE-H4.) Tapping a chip prefills `inputValue`, but if voice mode is already active the composer that would display it never mounts.
- **Why it matters:** For the exact cohort that paid, choosing a suggested question produces a voice orb and no trace of their question.
- **Recommendation:** Route the initial message through the mode branch — auto-submit in text mode, pass as an ElevenLabs dynamic variable in voice mode.
- **Regression risk:** Passing user text into ElevenLabs dynamic variables widens agent-prompt injection surface — coordinate with Security.
- **Expected impact:** A chip tap produces an answer instead of a dead end on both paths.
- **Effort estimate:** M

#### UX-H2 `<main>` is `aria-hidden` while chat is open but stays focusable, and the focus trap is escapable
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-viewer.tsx:246-249, src/hooks/use-focus-trap.ts:67
- **What's happening:** `aria-hidden` is set without `inert`, so everything behind the modal stays keyboard-focusable inside a subtree announced as non-existent; the trap's keydown listener is scoped to the container, not `document`, so once focus escapes (e.g., via backdrop click) it's never recaptured.
- **Why it matters:** A keyboard/screen-reader user can tab into and operate controls behind an open modal with no feedback — a systemic containment failure across every hand-rolled modal (see UX-M2), not one component.
- **Recommendation:** Add `inert` alongside `aria-hidden`; move the trap's listener to `document`.
- **Regression risk:** `inert` disables pointer events on the layer too — verify backdrop click-to-close still works.
- **Expected impact:** Keyboard and AT users are actually confined to the dialog.
- **Effort estimate:** S

#### UX-H3 `/about`, `/privacy` and `/terms` hardcode Spanish while `<html lang>` claims the user's language
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/about/page.tsx:3-6, src/app/privacy/page.tsx:3-6, src/app/terms/page.tsx:3-6, src/components/a11y/lang-sync.tsx:9-11
- **What's happening:** These three pages hardcode Spanish text while the global `lang` attribute is set to the user's actual locale — a WCAG 3.1.1 violation and a suppressor of browser translation tooling.
- **Why it matters:** Privacy and Terms are the two pages where comprehension is legally load-bearing, and they're the one place in an otherwise six-locale app where localization was skipped.
- **Recommendation:** Convert to client components using the existing translation hook (translations already exist in all six locale files).
- **Regression risk:** Converting to client components forfeits the static shell for these low-traffic routes — check with Performance whether that matters.
- **Expected impact:** Non-Spanish visitors read legal content in their language; `lang` stops lying to assistive tech.
- **Effort estimate:** M

#### UX-H4 Selected pricing tier is dropped when checkout bounces the user through sign-in
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/app/pricing/checkout/page.tsx:39-47,82-87, src/lib/pricing.ts:60-68
- **What's happening:** The sign-in return path is hand-built and drops the `tier` query param that a dedicated helper (`buildCheckoutUrl`) exists specifically to preserve; an unauthenticated arrival silently defaults to the day pass.
- **Why it matters:** A user who chose the €9.99 monthly pass is quietly moved to the €1.99 day pass — an unannounced downgrade at the payment step.
- **Recommendation:** Use the existing `buildCheckoutUrl` helper for the sign-in redirect instead of hand-rolling the URL.
- **Regression risk:** The day-pass default is the correct server-side safety net and must stay — this fix removes the cause, not the guard.
- **Expected impact:** The tier a user picks is the tier they're charged for, across every auth interruption.
- **Effort estimate:** S

#### UX-H5 `asturianu_touches` renders a raw English key as a button label and overrides the user's chosen locale
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-info-panel.tsx:101-108,144,158, src/lib/asturianu.ts:6-26
- **What's happening:** A lookup miss returns the raw key (`"bookmarks"`, no such entry exists) instead of a fallback, and the flag-driven mechanism overrides title/subtitle regardless of the visitor's actual language choice.
- **Why it matters:** Currently latent (flag defaults off), but one admin toggle away from shipping a literal English word onto the most prominent panel on the site.
- **Recommendation:** Fix the missing key; gate the mechanism on the Asturian locale being selected, not on the flag alone.
- **Regression risk:** The flag's server-side consumer (steering Claude's response language) is independent of the UI mechanism — decouple before changing either.
- **Expected impact:** No raw key strings in the UI; Asturian follows the user's actual choice.
- **Effort estimate:** S

#### UX-H6 Story text is localized on some surfaces and not others
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/share-button.tsx:28-33, src/app/favorites/page.tsx:257,261,280, src/components/immersive/story-viewer.tsx:207-210,243
- **What's happening:** `getLocalizedStory` is bypassed in the share button, the entire favorites gallery, and progress-bar screen-reader labels; question prompts have no translated field in the type system at all.
- **Why it matters:** The chrome is translated into six languages, but the content a visitor actually reads, saves, and shares reverts to Spanish at the moments they leave the app or build their saved collection.
- **Recommendation:** Route every story-title/subtitle read through `getLocalizedStory`; extend the translation type to cover question prompts.
- **Regression risk:** The favorites page uses a separate provider that doesn't currently trim to one locale — coordinate with Performance before adding localization there.
- **Expected impact:** A visitor's chosen language holds across reading, saving, sharing, and suggested questions.
- **Effort estimate:** M

#### UX-H7 The paid voice UI announces nothing to assistive tech and dead-ends on a denied mic
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/voice-chat-elevenlabs.tsx:237-245,330-335,364-421
- **What's happening:** The voice-state text has no `aria-live`; a denied microphone permanently disables the retry button with no recovery instruction; the mute/stop buttons have no focus-visible styling.
- **Why it matters:** This is the €1.99–9.99 paid experience — its entire feedback loop is visual and unannounced, and its most common failure mode has no in-UI recovery.
- **Recommendation:** Wrap the status line in `role="status" aria-live="polite"`; reset permission state to allow retry; add standard focus-visible rings.
- **Regression risk:** `aria-live` on status may interleave with an existing live-region transcript — consider demoting one.
- **Expected impact:** Voice state is perceivable non-visually; a denied mic is recoverable.
- **Effort estimate:** M

#### UX-M1 The design-token layer is defined but effectively unused; three parallel color systems, and the app body is white
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/globals.css:5-58, tailwind.config.ts:12-55, src/app/layout.tsx:33
- **What's happening:** A full semantic-token palette and brand tokens are defined; repo-wide, the semantic tokens see ~41 total usages and the brand tokens see zero, despite a config comment explicitly instructing their use. The admin surface separately carries ~1,969 raw hex literals. The concrete symptom: `body` resolves to pure white under an otherwise all-dark visitor app, visible on iOS overscroll.
- **Why it matters:** Three color systems sharing no source of truth means a brand color change is a thousands-of-sites-edit project; the white body is a visible defect on the platform most likely used by a tourist standing in front of a landscape.
- **Recommendation:** Fix the white body immediately with an explicit dark background on `body`; separately, pick one system (adopt semantic tokens across the visitor app and codemod admin, or delete the unused token layer).
- **Regression risk:** Flipping the root palette would invert the ~41 existing token consumers including admin components expecting the current `.dark` semantics — the safer first move is an explicit background, not a palette swap. The admin's theme provider doesn't clear its `dark` class on unmount, which any broader change must account for.
- **Expected impact:** No white flash on overscroll; a single place to change brand color.
- **Effort estimate:** L

#### UX-M2 Two dialog systems coexist, with four different modal accessibility contracts
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/suggest-place-dialog.tsx:5-11, src/components/immersive/voice-chat.tsx:184-190, src/components/immersive/mood-overlay.tsx:27, src/components/auth/sign-in-prompt.tsx:28-32
- **What's happening:** One dialog uses the shadcn/Radix primitive (focus trap, escape, scroll lock, labeling for free); four other visitor-facing modals hand-roll their own, each implementing a different subset — the sign-in prompt has none of focus trap, escape handler, initial focus, or focus restoration.
- **Why it matters:** Four contracts means four places to fix every modal bug (UX-H2 is one instance of exactly this), and the auth gate is the weakest of the four.
- **Recommendation:** Migrate the hand-rolled modals onto the shadcn Dialog, starting with the sign-in prompt (least custom, worst a11y).
- **Regression risk:** The voice-chat modal is the hardest migration and should be last — it deliberately renders null when closed rather than unmounting through the primitive's presence machinery, and a naive port risks double-restoring focus or breaking its lazy chunk boundary. The mood overlay intentionally has no backdrop-click dismissal, which Radix would need explicitly disabled.
- **Expected impact:** One modal contract; a11y fixes land once instead of four times.
- **Effort estimate:** L

#### UX-M3 Three dropdowns in the same toolbar use three different ARIA patterns and focus behaviours
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/toolbar-overflow-menu.tsx:97-130, src/components/immersive/language-switcher.tsx:144-224, src/components/immersive/site-info-menu.tsx:33-62
- **What's happening:** Three toolbar dropdowns sitting side by side use three different roles and focus-management strategies; the language switcher keeps its closed panel mounted and visually hidden with no `aria-hidden`/`inert`, so its options stay in the accessibility tree while invisible; the site-info menu (holding sign-in, sign-out, and every legal link) has no menu role, no `aria-expanded`, and no focus management at all.
- **Why it matters:** A keyboard user gets three different interaction models within one 200px-wide strip, and the weakest is the one holding auth and legal navigation.
- **Recommendation:** Standardize on one pattern (the most complete existing implementation, or Radix's `DropdownMenu`, already a transitive dependency); add `aria-expanded`/focus management to the site-info menu and `inert` to the closed language-switcher panel.
- **Regression risk:** The language switcher's mounted-but-hidden approach exists to animate the open/close transition — `inert` preserves that; conditional rendering would drop it. The overflow menu is mobile-only (`md:hidden`) and must not be unified in a way that carries that constraint into always-visible controls.
- **Expected impact:** One predictable dropdown behaviour; the auth/legal menu stops being the least accessible control on the page.
- **Effort estimate:** M

#### UX-M4 The four error boundaries have drifted into four different treatments
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/error.tsx:23-46, src/app/immersive/error.tsx:22-44, src/app/favorites/error.tsx:22-45, src/app/not-found.tsx:10-29
- **What's happening:** The same "something broke, retry or go home" screen is implemented four times with divergent button treatments and inconsistent focus rings — two of the four have none on their only controls; none carries `role="alert"`.
- **Why it matters:** Error screens are where trust is kept or lost and are the least likely to be reviewed; two of four leave keyboard users with no visible focus indication.
- **Recommendation:** Extract a single presentational error-screen component taking title/description/actions and a variant for the dark full-bleed contexts; add `role="alert"`.
- **Regression risk:** The immersive/favorites boundaries deliberately use a glass/translucent treatment for their dark backdrop context — unifying on the root layout's solid treatment would be a visual regression there.
- **Expected impact:** One error identity; keyboard users can see what they're about to activate on every error screen.
- **Effort estimate:** S

#### UX-M5 Two payment confirmation pages exist; the reachable one is the newer, the orphaned one is stale
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/pricing/success/page.tsx:29-90, src/app/pricing/checkout/return/page.tsx:37-108
- **What's happening:** Two near-duplicate ~100-line post-payment pages exist; the newer, reachable one has accumulated fixes (a11y live-region on loading, reduced-motion-safe spinner, URL-encoded deep link, focus-visible ring) the orphaned one never received. The orphaned page has no client-side caller in the codebase. Both unconditionally show a large green success check even when the webhook hasn't landed and voice access isn't actually usable yet.
- **Why it matters:** A duplicated post-payment screen is where fixes silently fail to propagate — exactly what happened here — and declaring success while access isn't actually granted is the worst moment to be optimistic.
- **Recommendation:** Delete the orphaned page and its unreferenced backing route together (after confirming no external caller like a Stripe Payment Link), or unify into one shared component; make the confirmation state-driven rather than unconditionally optimistic.
- **Regression risk:** Confirm the orphaned checkout route truly has no external caller before deleting — a Stripe Payment Link configured outside the repo wouldn't appear in a source grep. A pending state must not imply failure, since webhooks routinely land seconds after redirect — poll or offer refresh rather than showing an error.
- **Expected impact:** One confirmation page that stays fixed; users learn immediately whether their purchase is actually usable.
- **Effort estimate:** M

#### UX-M6 Touch targets on the primary mobile toolbar are well under the minimum
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/components/immersive/language-switcher.tsx:161-162, src/components/immersive/toolbar-overflow-menu.tsx:148, src/components/immersive/question-prompts.tsx:31
- **What's happening:** Computed from utility classes, several toolbar/chat controls are ~24-28px — below WCAG 2.5.8's 24×24 AA floor and well below the 44×44 platform convention other controls in the same toolbar already use.
- **Why it matters:** This is a tourism product used one-handed, outdoors, on a phone; the language switcher — the control non-Spanish visitors need first — is the smallest thing in the toolbar.
- **Recommendation:** Set a 44×44 floor for interactive elements in the toolbar/chat using padding or a transparent hit-area expansion.
- **Regression risk:** Enlarging hit areas risks colliding with adjacent full-screen tap zones used for swipe navigation — verify a larger language-switcher hit area doesn't start swallowing swipe gestures; these sizes are derived from the utility scale, not measured on a device, so confirm before shipping.
- **Expected impact:** One-handed outdoor use stops requiring precision.
- **Effort estimate:** M

#### UX-M7 Secondary text sits below AA contrast in several visitor-facing places
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** src/app/favorites/page.tsx:164, src/components/immersive/voice-chat/chat-message-list.tsx:125, src/components/premium/voice-purchase-cta.tsx:115
- **What's happening:** Several low-opacity text treatments compute to roughly 2.8:1 against their backgrounds, well below the 4.5:1 AA floor — disproportionately the strings that carry reassurance and state, including "secure payment" copy directly under the purchase button.
- **Why it matters:** The affected strings are exactly the ones meant to reduce purchase anxiety and communicate state, undermining their own purpose if illegible in daylight.
- **Recommendation:** Raise the opacity/contrast floor for body-weight text on dark and glass backgrounds; leave decorative-only low-alpha separators alone.
- **Regression risk:** These low alphas are doing deliberate visual-hierarchy work — raising every instance flattens that hierarchy, so raise the floor for text specifically rather than uniformly.
- **Expected impact:** Reassurance and state copy is readable in daylight on a phone.
- **Effort estimate:** M

#### UX-M8 The global reduced-motion reset freezes every loading spinner
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/globals.css:126-137, src/app/pricing/success/page.tsx:32, src/app/favorites/page.tsx:81
- **What's happening:** The `prefers-reduced-motion` CSS reset applies a near-zero animation duration to every element, correctly killing decorative animations but also killing loading spinners — several loading indicators lack an explicit reduced-motion-safe variant that others in the codebase already have, so they render as static icons for these users.
- **Why it matters:** Reduced motion should suppress vestibular triggers, not suppress status — a frozen spinner on the pricing CTA at the moment of purchase reads as a hung page.
- **Recommendation:** Scope the global reset to exclude designated status indicators, giving reduced-motion users a non-animated but distinct status affordance (e.g. a text label).
- **Regression risk:** The blunt `*` reset is genuinely protective — narrowing it means any future animation added without an explicit reduced-motion variant is no longer caught by default; pair the narrowing with a lint rule.
- **Expected impact:** Reduced-motion users can tell "loading" from "broken."
- **Effort estimate:** S

#### UX-M9 The first-visit navigation hint blocks all interaction for three seconds on mobile
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/navigation-hint.tsx:13,45-54
- **What's happening:** (Same component as QA-M1.) The hint intercepts every tap for its first three seconds, above the info panel and toolbar layers, and — since a recent change from localStorage to sessionStorage aimed at improving discoverability — now recurs every new tab or session rather than once per user.
- **Why it matters:** The first three seconds of a mobile session are the highest-intent moment on the site, and they're currently non-interactive.
- **Recommendation:** Make the hint non-blocking (`pointer-events-none`, dismiss on first touch anywhere via a passive listener) rather than swallowing the touch that would otherwise navigate.
- **Regression risk:** The existing component test asserts dismissal via the current blocking click handler and needs rewriting against the new mechanism, not just a drop-in change.
- **Expected impact:** The first tap of a mobile session does what the user intended.
- **Effort estimate:** S

#### UX-M10 A stale hardcoded constant hides a fully-translated Asturian locale from the switcher
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/language-switcher.tsx:34-47,58-66, src/lib/i18n/ast.ts, src/lib/i18n/detect-language.ts:3
- **What's happening:** A hand-maintained coverage-percentage constant for the Asturian locale is set below the switcher's visibility threshold, requiring manual updates whenever the locale file changes — that sync has drifted. Measuring the actual file directly shows it has all keys and is genuinely 81% translated, comfortably above the threshold, yet it's filtered out of the switcher.
- **Why it matters:** Asturian is the regional language of the product's subject region and is treated as a headline differentiator elsewhere (a dedicated feature flag, per-story metadata, a complete locale file) — all of it ships and none of it is selectable, because of one stale integer.
- **Recommendation:** Compute coverage from the actual locale file at build/test time rather than hand-maintaining a constant.
- **Regression risk:** Exposing the locale interacts directly with UX-H5's separate Asturian mechanism — resolve that first, since the two could disagree on content for the same story. Confirm the voice-agent language mapping has an Asturian entry before exposing it, or the paid voice agent could receive an unsupported language override.
- **Expected impact:** A built, translated, bundled locale becomes reachable.
- **Effort estimate:** M

#### UX-M11 Date and time formatting ignores the app's selected locale
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/pricing/page.tsx:105, src/app/pricing/success/page.tsx:62, src/app/pricing/checkout/return/page.tsx:80, src/components/immersive/voice-chat.tsx:222, src/lib/utils.ts:8-13
- **What's happening:** Every visitor-facing date (all pass-expiry timestamps) renders with the browser's locale rather than the app's selected one; a hardcoded-locale formatting helper exists in the codebase but has zero call sites — the one attempt at centralizing this points the wrong way and is unused.
- **Why it matters:** Every one of these is an expiry timestamp on a paid pass — the single most consequential piece of formatted data the product shows — and a visitor who switched the app language reads a mixed-language sentence on the purchase confirmation.
- **Recommendation:** Pass the active locale into the formatter at each site; fix or delete the unused helper.
- **Regression risk:** Not every app locale value is a valid BCP-47 tag with reliable `Intl` support (Asturian in particular) — map locale to an Intl tag explicitly rather than passing the raw value; timezone must stay local-time regardless.
- **Expected impact:** Expiry dates read in the language the rest of the sentence is written in.
- **Effort estimate:** S

#### UX-M12 The pricing tier selector declares a radiogroup but doesn't behave like one
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/pricing/page.tsx:127-158
- **What's happening:** The three tiers carry correct `role="radio"`/`role="radiogroup"`/`aria-checked` markup but no roving tabindex and no arrow-key handler — all three are independent tab stops and arrow keys do nothing, while the correct pattern is implemented properly twice elsewhere in the same codebase.
- **Why it matters:** A screen-reader user is told "radio group, 1 of 3" and then finds arrow keys inert — the specific failure that makes an ARIA role worse than no role at all, on the one decision the pricing page exists to capture.
- **Recommendation:** Apply the existing roving-tabindex handler pattern already implemented elsewhere in the codebase, or drop the radio roles in favor of plain toggle buttons that honestly describe the implemented behavior.
- **Regression risk:** Roving tabindex changes the tab order through the pricing card — verify the purchase CTA is still reached in one further Tab after the change.
- **Expected impact:** Keyboard and AT users can select a tier the way the announced role promises.
- **Effort estimate:** S

#### UX-L1 The author widget's social links are keyboard-focusable but never visible
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/author-typewriter.tsx:118-119,128-171,177-180
- **What's happening:** A popover with four social links is revealed only by hover, with no focus-within counterpart — unlike the favorites gallery which correctly pairs both — so the four links remain in the tab order while invisible, with no visible focus indicator.
- **Why it matters:** Small in isolation, but it's four invisible focus stops on the site's main screen, and the fix pattern already exists two files away.
- **Recommendation:** Add a focus-within reveal alongside the existing hover reveal.
- **Regression risk:** This widget is desktop/pointer-only and hidden below the mobile breakpoint, so a mobile-specific fix isn't needed.
- **Expected impact:** No invisible focus stops on the main route.
- **Effort estimate:** S

#### UX-L2 Favorites: silent destructive delete, an unreachable loading state, and a sign-in message with no sign-in button
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/app/favorites/page.tsx:288-298,37-43,157-162,123-137
- **What's happening:** Three issues on one page — the delete button removes a saved place immediately with no confirmation, undo, or announcement; a "loading more" state is set and cleared synchronously in the same handler so it can never actually render; and the signed-out empty state explains that signing in is needed but offers no sign-in control, only a link back to the main app.
- **Why it matters:** The delete is the only destructive action in the visitor app and has the least protection; the sign-in dead end is a conversion leak on the exact screen where a signed-out user has demonstrated intent to save something.
- **Recommendation:** Add an undo affordance plus an announcement for removal; remove the unreachable loading branch and its translation key; add a sign-in button to the signed-out empty state.
- **Regression risk:** An undo mechanism conflicts with the current immediate-write pattern — either delay the write or implement undo as a re-add, which changes ordering if the backend sorts by creation time.
- **Expected impact:** Accidental deletions are recoverable and announced; signed-out users can act on the message they're shown.
- **Effort estimate:** M

#### UX-L3 Two share implementations with divergent behaviour, and neither is fully correct
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** src/components/immersive/share-button.tsx:25-61, src/components/immersive/story-viewer.tsx:455-474
- **What's happening:** (Same underlying duplication as FE-L2.) Desktop and mobile share paths disagree on share text, localization (one uses raw untranslated story text, the other localized), and feedback — the mobile path has no clipboard-failure feedback and an unhandled share-cancellation rejection.
- **Why it matters:** Sharing is the organic-growth surface of a tourism product, and the mobile path is the weaker of the two.
- **Recommendation:** Delete the inline mobile implementation and reuse the desktop share component inside the mobile overflow menu, fixing localization at the same time.
- **Regression risk:** The desktop component's toast is positioned relative to its own trigger button — reusing it inside a constrained overflow-menu popover may need a portal to avoid clipping.
- **Expected impact:** One share behaviour, with feedback, in the user's language, on the platform that actually shares.
- **Effort estimate:** S

#### UX-L4 Component reuse is thin: raw `<button>` outnumbers `<Button>` 42:15, and `SiteFooter` and `ui/card` are dead
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** src/components/ui/button.tsx:6-38, src/components/site-footer.tsx:6, src/components/ui/card.tsx
- **What's happening:** Across the visitor-facing tree, raw `<button>` elements outnumber the shared `Button` component nearly 3:1 — visible in the focus-ring audit above, since every screen bypassing `Button` is a screen missing its built-in focus indication. A site-footer component holding the only legal links outside the toolbar menu has zero usages, so `/pricing`, checkout, and `/favorites` expose no legal links at all.
- **Why it matters:** Every quality property the shared component encodes has to be re-remembered by hand at each of the 42 sites, and the audit shows it demonstrably wasn't; absent legal links on checkout is separately worth a compliance look.
- **Recommendation:** Migrate the buttons currently missing focus rings (identified in UX-M4/UX-H7) rather than a mass migration; mount the footer on non-immersive routes or add legal links to the checkout header directly; delete the unused card component.
- **Regression risk:** The footer is `fixed bottom-0`, which on the immersive route would collide with the story info panel and phone nav tap zones — scope it to non-immersive routes only.
- **Expected impact:** Focus indication becomes uniform; legal links become reachable from payment screens.
- **Effort estimate:** M

#### UX-S1 The multilingual promise is architecturally half-built
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** src/lib/i18n/provider.tsx:55-68, src/app/layout.tsx:122-127, src/types/immersive.ts:59-63
- **What's happening:** UX-H3, UX-H5, UX-H6, UX-M10, and UX-M11 are one problem seen five times — the product supports six languages for UI chrome and three fields of story content, and nothing else. There are three parallel translation mechanisms, one of which ignores locale entirely, no server-side locale resolution (deliberately, to preserve the PPR static shell), three static pages that opted out of i18n entirely, and no translated representation for question prompts at all.
- **Why it matters:** The target user is a foreign tourist in Asturias — language isn't a nice-to-have for that user, it's the product. The current state delivers a translated shell around Spanish content, arguably a worse impression than a confidently monolingual site.
- **Recommendation:** Decide the target explicitly — either commit to full content localization (extend the translation type, retire the parallel Asturian mechanism, localize the static pages and dates, revisit the PPR trade) or scope the switcher to what's genuinely translated and say so.
- **Regression risk:** Server-side locale resolution requires a `headers()` call in the root layout, which forfeits the PPR static shell — this was already tried once and reverted for that reason, so any revisit needs Performance's explicit sign-off on the LCP cost.
- **Expected impact:** One coherent localization story instead of three mechanisms and five exceptions.
- **Effort estimate:** XL

### Cross-Domain Notes (UX)
- FE/AR: Several dead components surfaced independently of Architecture's dead-code findings (a footer, a card component, an unused date formatter, unused brand color tokens) — worth checking why Knip isn't flagging these.
- FE/PE: An unused prop passed specifically for a memoization optimization partially defeats that same optimization.
- PE: `/story/[slug]`'s `generateStaticParams` may be defeated by a forced-dynamic `connection()` call in the same page body — worth confirming prerendering actually happens (ties to PE-M1/FE-H2).
- BE/DO: The checkout route gates only on one Stripe price ID but the UI offers three tiers unconditionally — a missing env var for the other two surfaces as a generic 500 after tier selection.
- QA: Several UX findings are covered by tests that encode the *current defective* behavior (chip-prefill, nav-hint dismissal, locale-coverage constants) and will need deliberate rewriting, not incidental fixing.

---

## 12. Prioritized Action Plan

Sorted by severity (blocker → high → medium → low → strategic), then time horizon (Before < After < Later), then effort (S < M < L < XL).

| ID | Domain | Title | Severity | Time Horizon | Effort |
|---|---|---|---|---|---|
| FE-B1 | FE | Auth bootstrap disabled on /immersive, /favorites, /pricing | blocker | Before | S |
| BE-B1 | BE | Translation queue retries forever, no attempt cap | blocker | Before | M |
| BE-B2 | BE | make-booking has no rate limit / premium-rate blocklist | blocker | Before | M |
| DO-B1 | DO | No verified observability sink (Sentry/log drain) | blocker | Before | M |
| UX-B1 | UX | Pricing tiers all show "24 hours" copy | blocker | Before | S |
| FE-B2 | FE | E2E suite structurally cannot catch auth regressions | blocker | Before | L |
| AR-H1 | AR | Superseded /api/chat route still ships, duplicated preamble | high | Before | S |
| AR-H3 | AR | madge circular-dep gate resolves none of 1,077 alias imports | high | Before | S |
| BE-H1 | BE | Database-storage health probe is permanently dead | high | Before | S |
| BE-H4 | BE | Asymmetric phone validation, unconditional +34 prefix | high | Before | S |
| BE-H5 | BE | Cron endpoints CSRF-exempt but accept cookie admin auth | high | Before | S |
| DO-H1 | DO | Develop smoke check never executes a probe, always green | high | Before | S |
| DO-H4 | DO | Documented --require-sentry release gate does not exist | high | Before | S |
| DO-H6 | DO | Byte/char length mismatch crashes /api/health unauthenticated | high | Before | S |
| FE-H3 | FE | Focus yanked from chat panel on every parent re-render | high | Before | S |
| SE-H2 | SE | RLS broader than app read path — unmoderated content public | high | Before | S |
| SE-H4 | SE | Rate limiting on cheap endpoints, omitted from expensive ones | high | Before | S |
| UX-H2 | UX | `<main>` aria-hidden without inert; escapable focus trap | high | Before | S |
| UX-H4 | UX | Selected pricing tier dropped across sign-in redirect | high | Before | S |
| UX-H5 | UX | Asturian mechanism renders raw key, overrides locale choice | high | Before | S |
| AR-H2 | AR | Layered retries + non-cancelling timeouts, up to 12 Claude calls | high | Before | M |
| BE-H3 | BE | Webhooks parse then ignore the parse result | high | Before | M |
| BE-H6 | BE | Output safety filter runs only on the dead endpoint | high | Before | M |
| DO-H2 | DO | rate_limit health probe can never report degradation | high | Before | M |
| DO-H3 | DO | maintenance_mode doesn't gate /immersive, fails open | high | Before | M |
| DO-H5 | DO | Incident runbook commands fail when executed | high | Before | M |
| FE-H1 | FE | server-only logging ships in client bundle, CSP violation | high | Before | M |
| FE-H2 | FE | /story/:slug redirected before render — no OG/indexability | high | Before | M |
| FE-H4 | FE | Voice agent never gets access token or prompt-chip question | high | Before | M |
| SE-H1 | SE | feature_flags.config anon-readable, leaks admin emails | high | Before | M |
| SE-H3 | SE | Default privileges grant anon SELECT on future tables | high | Before | M |
| UX-H1 | UX | Suggested-question chips discarded for paying voice users | high | Before | M |
| UX-H3 | UX | Static legal pages hardcode Spanish, lang attribute lies | high | Before | M |
| UX-H6 | UX | Story text localized on some surfaces, not others | high | Before | M |
| UX-H7 | UX | Paid voice UI unannounced to AT, dead-ends on denied mic | high | Before | M |
| BE-H2 | BE | Timed-out booking calls unrecoverable, no reconciliation | high | Before | L |
| PE-H1 | PE | Adjacent-image preload fetches wrong URL, ~350KB waste | high | Before | S |
| PE-H2 | PE | Maintenance DB lookup adds 60-330ms before root redirect | high | Before | S |
| PE-H5 | PE | No maxDuration anywhere, stream can outlive platform timeout | high | Before | S |
| PE-H3 | PE | No enforced bundle budget; analyzer measures wrong build | high | Before | M |
| PE-H4 | PE | Lighthouse gate measures 8-story fallback, not real 71 | high | Before | M |
| QA-H1 | QA | Authenticated E2E journeys are vacuous | high | Before | M |
| QA-H2 | QA | No gate exercises the real chat/RAG pipeline | high | Before | M |
| QA-H3 | QA | Only real-LLM suite exercises non-production code path | high | Before | S |
| QA-H4 | QA | Idempotency/RLS guarantees never executed by any test | high | After | L |
| AR-M1 | AR | 595 stale audit-ID comments across 170 files, IDs collide | medium | After | M |
| AR-M2 | AR | 3 admin-auth abstractions, RLS-scoped one used 1 of 31 | medium | After | M |
| AR-M3 | AR | Production Claude transport untested outside prod | medium | After | M |
| AR-M4 | AR | Admin-panel decomposition refactor abandoned mid-way | medium | After | L |
| AR-M5 | AR | server-only guard on 6 of 14 secret-reading modules | medium | After | S |
| BE-M1 | BE | MCP rate limits key on IP but caller is one third party | medium | Before | M |
| BE-M2 | BE | notify_webhook search_path regression; guard checks 3 of 25 | medium | Before | S |
| BE-M3 | BE | No maxDuration; queue batch size tuned to guessed timeout | medium | Before | S |
| BE-M5 | BE | Stripe webhook: refunds/disputes never revoke access | medium | Before | M |
| BE-M7 | BE | Embedding cache key omits model and dimension | medium | Before | S |
| BE-M8 | BE | MCP endpoints return raw errors into voice agent context | medium | Before | S |
| BE-M9 | BE | Public feature-flags endpoint scrubs config by denylist | medium | Before | S |
| BE-M10 | BE | pending_bookings PII table excluded from security guard | medium | Before | M |
| BE-M4 | BE | Stage timeouts race but never cancel upstream billing | medium | After | M |
| BE-M6 | BE | 3 data-access styles; documented singleton is dead code | medium | After | M |
| BE-M11 | BE | SMS retry exhaustion is a silent dead-letter | medium | After | M |
| BE-M12 | BE | Bearer clients dropped auth context on voice endpoints | medium | After | S |
| DO-M1 | DO | Rollback runbook migration command hangs check-migrations | medium | Before | S |
| DO-M2 | DO | vercel-env-safety job never runs, secret token unset | medium | Before | S |
| DO-M3 | DO | No secret inventory, rotation cadence, or revocation | medium | After | M |
| DO-M4 | DO | No boot-time env validation or config drift detection | medium | After | M |
| DO-M5 | DO | Payments-path env vars use ?? instead of trim-aware getEnv | medium | After | S |
| DO-M6 | DO | No function duration budget declared anywhere | medium | After | S |
| DO-M7 | DO | CI runs full suite/E2E/Lighthouse on docs-only commits | medium | After | S |
| DO-M8 | DO | Release "what would ship" step reports 290 stale commits | medium | After | S |
| FE-M1 | FE | Streaming chat re-renders/re-parses entire text on every token | medium | Before | M |
| FE-M3 | FE | Adjacent-image preload mismatch (frontend half of PE-H1) | medium | Before | S |
| FE-M5 | FE | Dead-code gate never runs on develop-push workflow | medium | Before | M |
| FE-M6 | FE | matchMedia hooks diverge from SSR markup, hydration mismatch | medium | Before | S |
| FE-M2 | FE | StoryInfoPanel memoization defeated by unstable props | medium | After | S |
| FE-M7 | FE | Code-splitting inconsistent on largest admin panel/dialog | medium | After | S |
| PE-M3 | PE | Rate-limit call has no timeout, precedes stage-timeout budget | medium | Before | S |
| PE-M6 | PE | /about and future /a* routes bypass maintenance mode | medium | Before | S |
| PE-M1 | PE | 71 prerendered story pages unreachable behind 308 redirect | medium | After | M |
| PE-M2 | PE | Only embedding cached; retrieval/rerank/images re-run always | medium | After | M |
| PE-M4 | PE | SSE chunk re-render re-parses full markdown (backend half) | medium | After | M |
| PE-M5 | PE | Full 71-story catalogue serialized though 1 story renders | medium | After | S/L |
| QA-M1 | QA | E2E storage-state nav-hint fixture is dead, causes flake | medium | Before | S |
| QA-M2 | QA | Zero-test guard protects only Stripe path, not prelaunch | medium | Before | S |
| QA-M3 | QA | prelaunch omits unit suite, typecheck, and lint | medium | Before | S |
| QA-M5 | QA | search_path enforcement covers 3 of 25 functions | medium | After | M |
| QA-M4 | QA | No meta-test for admin-guard or RPC-name invariants | medium | After | S |
| QA-M6 | QA | Rate-limit call outside stage-timeout discipline | medium | After | S |
| QA-M7 | QA | Paid voice flow has zero browser-level coverage | medium | After | M |
| QA-M8 | QA | 18 E2E assertions consume entire CI test budget | medium | After | S |
| SE-M1 | SE | Cron CSRF-exempt but accepts cookie admin auth (=BE-H5) | medium | Before | S |
| SE-M2 | SE | Stripe webhook grants without payment_status check (=BE-M5) | medium | Before | S |
| SE-M3 | SE | License-check gate is a denylist, misses source-available dep | medium | After | S |
| SE-M4 | SE | Admin role cache 30s TTL, no invalidation hook | medium | After | S |
| UX-M3 | UX | Three toolbar dropdowns, three different ARIA patterns | medium | After | M |
| UX-M5 | UX | Two payment-confirmation pages, orphan lacks a11y fixes | medium | After | M |
| UX-M6 | UX | Touch targets under WCAG floor on primary mobile toolbar | medium | After | M |
| UX-M7 | UX | Secondary/reassurance text below AA contrast | medium | After | M |
| UX-M10 | UX | Stale coverage constant hides complete Asturian locale | medium | After | M |
| UX-M1 | UX | Design tokens unused; visitor body resolves to white | medium | After | L |
| UX-M2 | UX | Two dialog systems, four accessibility contracts | medium | After | L |
| UX-M4 | UX | Four error boundaries drifted into four treatments | medium | After | S |
| UX-M8 | UX | Reduced-motion reset freezes loading spinners | medium | After | S |
| UX-M9 | UX | Nav hint blocks all interaction 3s on every mobile session | medium | After | S |
| UX-M11 | UX | Pass-expiry dates ignore selected locale | medium | After | S |
| UX-M12 | UX | Pricing radiogroup lacks roving-tabindex/arrow keys | medium | After | S |
| AR-L1 | AR | lint:src has no warning ceiling unlike lint:scripts | low | After | S |
| AR-L2 | AR | knip.json silences license IDs as if binaries | low | After | S |
| AR-L3 | AR | Two env vars resolve to same service-role key via ?? | low | After | S |
| BE-L2 | BE | approve-all VERCEL_URL fallback can never work | low | After | S |
| BE-L3 | BE | keywordSearch dead code contradicts "hybrid search" claim | low | After | S |
| BE-L5 | BE | IPv6 clients get effectively unlimited rate-limit buckets | low | After | S |
| BE-L6 | BE | Cache-Control: public on secret-authenticated MCP responses | low | After | S |
| BE-L7 | BE | validateAdminAuth swallows errors; unbounded role cache | low | After | S |
| BE-L1 | BE | Production Anthropic path is the least-tested one | low | After | M |
| DO-L1 | DO | Operational docs carry stale pg_cron/monitor facts | low | After | S |
| PE-L1 | PE | Sequential per-user getUserById, unbounded N+1 | low | After | S |
| PE-L2 | PE | Server-side admin fetches have no timeout | low | After | S |
| PE-L3 | PE | /api/feature-flags fetched on pages with no flag consumers | low | After | S |
| PE-L4 | PE | Sentry client SDK ships with no verified DSN delivery | low | After | S |
| PE-L5 | PE | Embedding cache key hashes un-normalized query text | low | After | S |
| QA-L1 | QA | Coverage thresholds sit 4-7 points below actual | low | After | S |
| QA-L2 | QA | lint:src lacks --max-warnings=0 (=AR-L1) | low | After | S |
| QA-L3 | QA | Health endpoint doesn't probe voice_purchases table | low | After | S |
| QA-L4 | QA | Stripe unrecoverable-event markers have no alert consumer | low | After | M |
| SE-L2 | SE | /api/health discloses secret-config state to anonymous callers | low | After | S |
| SE-L3 | SE | Playwright test-origin env var widens CORS/CSRF with no guard | low | After | S |
| SE-L4 | SE | Sentry scrubbing omits URL, query string, and IP | low | After | S |
| SE-L5 | SE | Security checklist Gate 1 duplicates an automated CI check | low | After | S |
| UX-L1 | UX | Author widget social links focusable but never visible | low | After | S |
| UX-L3 | UX | Two share implementations diverge; mobile path weaker | low | After | S |
| UX-L2 | UX | Favorites: silent delete, unreachable loading state, no sign-in CTA | low | After | M |
| BE-L8 | BE | Dev-only child_process routes ship in production bundle | low | Later | M |
| DO-L2 | DO | Presence/value env checks disagree on trimming | low | Later | S |
| BE-L4 | BE | Idempotency exception sub-block is a no-op | low | Later | S |
| SE-L1 | SE | SSRF guard is resolve-then-fetch, narrow DNS-rebind window | low | Later | M |
| UX-L4 | UX | Thin component reuse; footer/card dead, no legal links on payment | low | Later | M |
| AR-S1 | AR | Test suite 2.4x source size, possible composition-layer overlap | strategic | Later | M |
| BE-S1 | BE | Translation webhook is enqueuer+claimer+worker in one request | strategic | Later | L |
| DO-S2 | DO | Backup/restore path has never been rehearsed | strategic | Later | M |
| DO-S3 | DO | Risk-acceptance re-evaluation triggers have no measurement | strategic | Later | S |
| SE-S1 | SE | Data-layer authorization has no automated regression coverage | strategic | Later | L |
| DO-S1 | DO | Remediation loop closes findings on artefacts, not verified controls | strategic | Later | L |
| PE-S1 | PE | 233KB gzip JS ships on pure static content pages | strategic | Later | L |
| BE-S2 | BE | Rate limiting covers 5 of ~20 public routes, chosen ad hoc | strategic | After | L |
| FE-S1 | FE | Auth/locale resolved entirely client-side (root cause of FE-B1) | strategic | Later | XL |
| QA-S1 | QA | Verification strategy has no tier between mocked and release-gate | strategic | Later | XL |
| UX-S1 | UX | Multilingual promise is architecturally half-built | strategic | Later | XL |
| AR-S2 | AR | noUncheckedIndexedAccess off — largest remaining soundness gap | strategic | Later | XL |

---

## 13. Top 10 Highest-ROI Improvements

1. **FE-B1** — One boolean-set change reactivates favorites, paid voice, and the purchase CTA for every authenticated user. Smallest effort (S) against the single largest functional gap in the report.
2. **UX-B1** — A pricing-copy fix that removes a material payment-page misdescription for two of three revenue tiers, at S effort.
3. **BE-B2** — Adding rate limiting and a premium-rate blocklist to one endpoint closes an open-ended telephony-billing exposure.
4. **BE-B1** — An attempts-cap predicate on two existing queries closes the exact failure mode that already caused a production outage once.
5. **DO-H6** — A one-line comparison-order fix removes an anonymous, zero-skill DoS against the endpoint every other release gate depends on.
6. **AR-H3** — A single CLI flag (`--ts-config`) turns a decorative circular-dependency gate into one that actually analyzes 1,077 imports.
7. **DO-H1** — Fixing or deleting one CI job recovers ~5.3 minutes of runner time per `develop` push while turning a permanently-green false signal into either a real one or an honest absence.
8. **SE-H3** — Revoking one blanket default-privilege grant (plus a CI check) prevents the exact "table shipped without RLS" incident class that has already required three follow-up migrations to fix.
9. **UX-H4** — Swapping a hand-rolled URL for an existing, already-correct helper function (`buildCheckoutUrl`) stops silently downgrading paying customers' chosen tier.
10. **DO-B1** — Firing one synthetic exception and verifying delivery either confirms or disproves whether the entire observability stack works — the highest-leverage single verification step in the report, since it is the prerequisite for trusting every other alert-based finding.

---

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- FE-B1: Auth bootstrap disabled on /immersive, /favorites, /pricing
- FE-B2: E2E suite structurally cannot catch auth regressions
- BE-B1: Translation queue retries forever, no attempt cap
- BE-B2: make-booking has no rate limit / premium-rate blocklist
- DO-B1: No verified observability sink
- UX-B1: Pricing tiers all show "24 hours" copy
- AR-H1: Superseded /api/chat route still ships
- AR-H2: Layered retries + non-cancelling timeouts, up to 12 Claude calls
- AR-H3: madge circular-dep gate resolves none of 1,077 alias imports
- BE-H1: Database-storage health probe is permanently dead
- BE-H2: Timed-out booking calls unrecoverable
- BE-H3: Webhooks parse then ignore the parse result
- BE-H4: Asymmetric phone validation, unconditional +34 prefix
- BE-H5: Cron endpoints CSRF-exempt but accept cookie admin auth
- BE-H6: Output safety filter runs only on the dead endpoint
- BE-M1, BE-M2, BE-M3, BE-M5, BE-M7, BE-M8, BE-M9, BE-M10: backend medium findings scoped before launch
- DO-H1: Develop smoke check never executes a probe
- DO-H2: rate_limit health probe can never report degradation
- DO-H3: maintenance_mode doesn't gate /immersive, fails open
- DO-H4: Documented --require-sentry release gate does not exist
- DO-H5: Incident runbook commands fail when executed
- DO-H6: Byte/char length mismatch crashes /api/health unauthenticated
- DO-M1, DO-M2: migration-guard hang, vercel-env-safety never runs
- FE-H1: server-only logging ships in client bundle
- FE-H2: /story/:slug redirected before render
- FE-H3: Focus yanked from chat panel on every parent re-render
- FE-H4: Voice agent never gets access token or prompt-chip question
- FE-M1, FE-M3, FE-M5, FE-M6: frontend medium findings scoped before launch
- PE-H1, PE-H2, PE-H3, PE-H4, PE-H5: all performance highs
- PE-M3, PE-M6: performance mediums scoped before launch
- QA-H1, QA-H2, QA-H3: QA highs scoped before launch
- QA-M1, QA-M2, QA-M3: QA mediums scoped before launch
- SE-H1, SE-H2, SE-H3, SE-H4: all security highs
- SE-M1, SE-M2: security mediums scoped before launch
- UX-H1 through UX-H7: all UX highs

### After launch (Wave 2)
- QA-H4: Idempotency/RLS guarantees never executed by any test
- AR-M1, AR-M2, AR-M3, AR-M4, AR-M5: architecture mediums
- BE-M4, BE-M6, BE-M11, BE-M12: backend mediums
- DO-M3 through DO-M8: DevOps mediums
- FE-M2, FE-M7: frontend mediums
- PE-M1, PE-M2, PE-M4, PE-M5: performance mediums
- QA-M4 through QA-M8: QA mediums
- SE-M3, SE-M4: security mediums
- UX-M1 through UX-M12 (except UX-M10 grouped here too): UX mediums
- All low-severity findings not explicitly listed under Later
- BE-S2: Rate limiting covers 5 of ~20 public routes, chosen ad hoc

### Later / strategic (Wave 3)
- AR-S1: Test suite 2.4x source size, possible composition-layer overlap
- AR-S2: noUncheckedIndexedAccess off
- BE-S1: Translation webhook is enqueuer+claimer+worker in one request
- BE-L4, BE-L8: idempotency no-op block, dev-only routes in prod bundle
- DO-S1: Remediation loop closes findings on artefacts, not verified controls
- DO-S2: Backup/restore path has never been rehearsed
- DO-S3: Risk-acceptance re-evaluation triggers have no measurement
- DO-L2: Presence/value env checks disagree on trimming
- FE-S1: Auth/locale resolved entirely client-side
- PE-S1: 233KB gzip JS ships on pure static content pages
- QA-L5, QA-S1: responsive-code coverage islands; no contract-test tier
- SE-L1, SE-S1: SSRF resolve-then-fetch window; no data-layer regression coverage
- UX-L4, UX-S1: thin component reuse; multilingual promise half-built

---

## 15. Open Questions / Assumptions

- **Sentry delivery is unverified, not merely undocumented.** DO-B1 found the Sentry project exists and reports "configured," but no issues appear in a 90-day window. This should be confirmed with a synthetic test before assuming either "it works" or "it's broken" — prior project memory that "no Sentry project exists" is now stale and should be corrected.
- **Whether `/api/chat` (the non-streaming route) has any external caller** outside this repo — three independent specialists (AR, BE, QA) flagged it as dead code reachable only by an E2E test, but none could rule out an ElevenLabs tool config or other out-of-repo consumer without checking Vercel access logs.
- **The effective Vercel `maxDuration` for the current plan** is assumed by comment (60s) in the translation-queue batch sizing but is not declared or verified anywhere in code (BE-M3, DO-M6, PE-H5) — DevOps should confirm the actual platform default before any timeout-related fix lands.
- **Whether `/api/checkout/day-pass` (the orphaned hosted-checkout route) has any external caller** — a Stripe Payment Link or QR code configured outside the repo would not appear in a source grep (UX-M5, BE cross-domain note).
- **Whether hybrid (vector + keyword) search is actually wanted** — the architecture is documented as hybrid but only vector search runs; `keywordSearch` exists, fully implemented, with zero callers (BE-L3). This is a product decision, not an engineering one.
- **Whether the Asturian locale should be exposed** in the language switcher — it is complete and translated but hidden by a stale hardcoded coverage number (UX-M10); exposing it interacts directly with the separate `asturianu_touches` mechanism (UX-H5) and both should be resolved together, deliberately.
- **This audit is read-only and static.** The Security Reviewer explicitly notes SE-H1 and SE-H2 (RLS/grant findings) should be confirmed against the live database before remediation is scoped, and that a dedicated penetration test remains necessary before further launch milestones — this audit catches structural and code-level issues only.
- **Playwright/E2E and the live-LLM QA suite were not run locally** by the QA specialist (a local run requires a multi-minute cold build); CI's own most recent run is the authority on flake rate and pass/fail for those gates.

---

## 16. Final Verdict

**Verdict: NOT READY.**

Six independently-confirmed launch-blocker findings — spanning four specialist domains (Frontend, Backend ×2, DevOps, UX) — mean the product as it stands today would ship with its authenticated feature set non-functional, at least two open-ended real-money cost exposures, a payment page that misdescribes what it sells, and no verified way to detect an incident after the fact. None of the six requires a redesign; all have concrete, scoped fixes at S–L effort.

**What would most worry me about shipping today:** FE-B1 and DO-B1 combined. FE-B1 means the paid product doesn't actually work for the users who pay for it — favorites, voice access, and the upgrade CTA are all silently dead on the one route real users spend their time on, and it has been dead since a hydration fix in April with a fully green CI the entire time. DO-B1 means that if this had caused a customer-facing incident (and BE-B1's twin — the translation-queue cost bomb — already has, once), there is no verified way anyone would find out until a customer complained. Shipping with both of these unresolved means launching blind to exactly the failure modes most likely to occur.

**What gives me confidence:** The engineering discipline underneath these gaps is real and specific, not diffuse. Zero `any`/`ts-ignore` under strict TypeScript, a fully acyclic module graph, a durable Postgres job queue with correct `SKIP LOCKED` semantics, 98.9% test coverage, and a release process built around tree-hash identity rather than fragile SHA-range diffing are all genuinely above-average for a project at this stage. Every blocker found has a narrow, well-understood fix — this is a gap in verification and wiring, not a gap in capability. A team that already built `required-probes.yaml`'s "a skipped probe is a vacuous pass" principle clearly has the judgment to close these; it just hasn't propagated that principle past its original subsystem yet (DO-S1).

**Next 5 actions (ordered):**
1. Fix FE-B1 (remove `/immersive`, `/pricing`, `/favorites` from the auth-deferral allowlist) and verify manually that favorites, voice access, and the purchase CTA work for a real signed-in user — this is the highest-leverage single change in the report.
2. Fix BE-B1 and BE-B2 together (both are cost-ceiling gaps on backend queues/endpoints) — add the attempts cap to the translation queue and rate-limiting plus a premium-rate blocklist to `make-booking`.
3. Fire a synthetic Sentry event in production and confirm it's received; if it isn't, treat that as its own incident and fix delivery before relying on any alert-based finding elsewhere in this report (DO-B1).
4. Fix UX-B1 (pricing copy) and UX-H4 (tier-loss on sign-in redirect) together, since both sit on the same payment page and are both S/S effort.
5. Run `/remediate` to drive the rest of Wave 1 (Before Launch) through parallel TDD fix agents, then re-run this audit's Verdict Thresholds against the updated findings before authorizing a release.
