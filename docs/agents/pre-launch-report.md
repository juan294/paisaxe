# Pre-Launch Codebase Audit
> Generated on 2026-04-26 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

---

## 1. Executive Summary

Paisaxe is a technically ambitious, well-structured Next.js 16 tourism app for Asturias with a mature CI/CD pipeline, strong backend idempotency guarantees, and an unusually thorough unit-test foundation for its stage of development. However, the audit uncovered **6 launch blockers** and **33 high-severity findings** across all eight domains that collectively prevent a confident public launch. The most acute risks are a Stripe partial-failure path that permanently locks paying users out of their day pass (BE-B2), a broken viral-loop share URL that serves 404s on mobile (UX-B1), and a completely dark error-reporting stack — Sentry is wired but the DSN is unset, so production exceptions are invisible (DO-H2). The codebase also carries a significant Spanish-language brand crisis on its own monetisation pages, with hardcoded English copy and two competing visual identities on the checkout flow (UX-B2, UX-B3). These issues are all fixable in days, not weeks.

**Top 3 strengths:**
1. **Robust idempotency infrastructure.** Stripe and ElevenLabs webhooks use SECURITY DEFINER RPCs with advisory locks, idempotency key tables, and durable job queues — an unusually mature pattern for a solo project.
2. **6,117 unit/integration tests, all green.** 53/53 API routes have paired `route.test.ts` files; TDD protocol is genuinely enforced.
3. **Structured 9-step proxy pipeline** (`src/proxy.ts`) cleanly handles CORS, CSRF, CSP, Supabase auth refresh, canonical redirects, and maintenance mode with documented runbooks.

**Top 5 risks ordered by blast radius:**
1. **Paid users permanently locked out** if Stripe webhook partially fails (BE-B2) — no recovery path exists.
2. **Zero production error visibility** — Sentry DSN unset; all `captureException` calls are no-ops (DO-H2).
3. **Silent cron-auth failure** brings down translation pipeline and advisory-lock cleanup with no alarm (BE-B1).
4. **Authentication path bypasses `.trim()`** — direct `process.env.SUPABASE_*!` reads on Google OAuth callback risk invisible login outage (DO-M1).
5. **Mobile share links are 404s** — overflow menu shares `/stories/${id}`; route is `/story/[slug]` — viral loop broken on the primary sharing device class (UX-B1).

**Verdict: NOT READY** — 6 launch blockers are present (BE-B1, BE-B2, UX-B1, UX-B2, UX-B3, UX-B4). All carry S–M effort. A focused 2–3 day sprint clears all blockers and the most critical highs, after which the codebase reaches CONDITIONAL status.

---

## 2. System Architecture Overview

Paisaxe is a Next.js 16 App Router application deployed on Vercel (Pro, region `fra1`) against Supabase (PostgreSQL + pgvector, Switzerland). The compositional layers are:

- **Proxy layer** (`src/proxy.ts` + `src/lib/proxy/*`): 9-step pipeline handling canonical-domain redirects, story URL rewrites, maintenance mode, root redirect, CORS preflight, CSRF + Origin validation, Supabase session refresh, static CSP header, and request-ID injection.
- **UI/routing layer** (`src/app/`): App Router with PPR (`cacheComponents: true`). Root `/` redirects to `/immersive` — a full-viewport stories carousel with streaming Suspense. Supporting routes: `/favorites`, `/pricing`, `/pricing/checkout`, `/about`, `/privacy`, `/terms`, `/story/[slug]` (redirect to immersive).
- **API surface** (`src/app/api/`): ~60 route handlers across `admin/`, `chat/`, `checkout/`, `cron/`, `favorites/`, `feature-flags/`, `health/`, `mcp/`, `suggestions/`, `voice-access/`, `webhooks/`.
- **Logic/IO library** (`src/lib/`): 56 top-level files (flat) plus sub-domains `admin-api/`, `costs/`, `i18n/`, `platforms/`, `proxy/`. Key hubs: `supabase.ts` (29 importers), `admin-auth.ts` (35 importers), `logger.ts` (25 importers).
- **Client hooks** (`src/hooks/`): 14 hooks with bespoke per-hook fetch-cache and state logic.
- **Agents layer** (`src/agents/`): 5 ElevenLabs voice agents tracked in git via `agents.json`/`agent_configs/`.

**Data flow for the hot path (chat):** `use-stream-chat` → `/api/chat/stream` → `lib/embeddings` (Voyage `voyage-3.5`, 512 dims) → `lib/search` (`match_chunks` RPC, ivfflat index) → `lib/rerank` (Voyage `rerank-2.5`, top 3 of 10) → `lib/claude` (Anthropic SDK, SSE stream) → client markdown render.

**Architecture concerns:** The flat `src/lib/` namespace (56 files) mixes IO clients, domain logic, security primitives, and formatters without enforced layering boundaries (AR-S1). Supabase clients are instantiated without a `Database` TypeScript generic, defeating type safety across all 91 `.from()` call sites (AR-H1). The `src/services/` directory is a `.gitkeep` ghost — dead architecture (AR-M2).

---

## 3. End-to-End Flow Analysis

**Key user flows:**

1. **Immersive browsing** (`/` → `/immersive`): PPR shell streams story data + feature flags from Supabase (60s revalidate). `StoryViewer` renders with Ken Burns CSS animation, 20-segment progress bar, and a top-right control cluster. Risk: control cluster tap targets are 36×36px on mobile (UX-H4); progress bar segments are 4px tall (UX-M10).

2. **Chat flow** (text, VoiceChat panel): User opens chat → CSRF fetch → POST `/api/chat/stream` → embedding → vector search → rerank → Claude SSE stream → markdown render. Risk: embedding and image-fetch serialized when they could overlap rerank (PE-H3); ivfflat index untuned (PE-H1); Anthropic SDK dynamically imported per request (PE-H4).

3. **Voice flow** (Pelayo, ElevenLabs): Feature-flag gated. Component mount immediately requests microphone permission before user gesture (UX-H1). Dialog lacks `aria-modal` (UX-B4).

4. **Monetisation flow** (`/pricing` → `/pricing/checkout` → Stripe Embedded → return): `checkout/embedded/route.ts` builds `return_url` from attacker-controllable `Origin` header without allowlist validation (SE-H2). Pricing page shows English copy "Voice Pass · 24h" on the Spanish site (UX-B2). Green and amber visual identities conflict across the funnel (UX-B3). Checkout route lacks `error.tsx`/`loading.tsx` (UX-M8).

5. **Social sharing** (mobile overflow menu): Builds `/stories/${story.id}` — route is `/story/[slug]` (singular, by slug) — a 404 for every mobile share (UX-B1).

**Integration and boundary risks:**
- ElevenLabs make-booking commits an `initiating` row then calls ElevenLabs with no `AbortSignal.timeout` — a hung request poisons the idempotency key forever (BE-H4).
- Cron auth fails silently: misconfigured `CRON_SECRET` returns 401 with no alarm, stalling translation pipeline (BE-B1).
- `getUserFromRequest` reads only the `Authorization: Bearer` header — browser-authenticated users are 401'd on `/api/favorites` and `/api/voice-access` (BE-H2).

---

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model

Next.js 16 App Router with PPR. A single client `Providers` boundary wraps PostHog → Language → conditionally Auth context. State management is React-native: 114 client components, 56 with local `useState`, no global state libraries. Cross-component state uses React Context. Data fetching is direct `fetch()` from custom hooks with bespoke per-hook caching. Heavy chunks lazy-loaded via `next/dynamic`. 285 `.tsx` component files.

### Findings

#### FE-H1 Static legal pages forced into the client bundle
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/about/page.tsx:1`, `src/app/privacy/page.tsx:1`, `src/app/terms/page.tsx:1`
- **What's happening:** `/about`, `/privacy`, `/terms` are `"use client"` purely to call `useTranslation()`, dragging the full provider tree into the client bundle for routes that should be SSG.
- **Why it matters:** Three near-zero-JS routes ship the full provider tree, hurting LCP.
- **Recommendation:** Server-render these pages; pass translated strings from server. `t()` is a simple key lookup against static `es`/`en` modules.
- **Expected impact:** Smaller bundle, faster LCP.
- **Effort estimate:** S

#### FE-H2 Chat message lists keyed by array index, breaking React reconciliation during streaming
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat.tsx:304-305`, `src/components/immersive/voice-chat-elevenlabs.tsx:337-339`
- **What's happening:** Both surfaces render `messages.map((msg, i) => <div key={i}>...)`. Index keys cause React to reuse DOM nodes on streaming updates, producing janky markdown rendering and potential `ChatUpsellCTA` state leaks.
- **Why it matters:** ReactMarkdown remounts on every token — CPU cost and visual jank.
- **Recommendation:** Add stable `id` per message at creation (`crypto.randomUUID()`); use as React key.
- **Expected impact:** Smooth streaming render, correct child state lifetime.
- **Effort estimate:** S

#### FE-H3 `useFeatureFlags` and `useStories` allow parallel singletons outside their provider
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-feature-flags.ts:211-217`, `src/hooks/use-stories.ts:307-311`
- **What's happening:** Both hooks fall through to per-call state if no Context is present, silently spawning parallel state and independent fetches.
- **Why it matters:** Consumers outside the provider get stale data; dual API obscures wiring correctness.
- **Recommendation:** Throw if called outside provider (matches `auth-provider.tsx:131-137` pattern).
- **Expected impact:** Eliminates hidden parallel-state bugs.
- **Effort estimate:** S

#### FE-H4 `StoryViewer` image prefetch leaks unmanaged Image objects; key remount causes flash
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-viewer.tsx:101-120,256-266`
- **What's happening:** Manual `new window.Image()` objects created for prefetch but never cleared (unbounded growth). `<Image>` key includes `isAmbient`/`autoPlay` flags, forcing a remount and flash on every toggle.
- **Why it matters:** Memory grows with session length; autoplay toggle causes visible flash.
- **Recommendation:** Drop flag-based key from `<Image>`; apply Ken Burns via CSS. Replace manual prefetch with `<link rel="preload">`.
- **Expected impact:** Eliminates flash on toggle; removes unbounded Image accumulation.
- **Effort estimate:** S

#### FE-H5 Admin shell `searchParams → setActiveTab` causes router/state ping-pong on every tab click
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/admin/admin-shell.tsx:139-169`
- **What's happening:** Click → `setActiveTab` → `router.push` → `searchParams` change → `useEffect` fires → `setActiveTab` again. Doubled render work per tab switch.
- **Recommendation:** Derive `activeTab` from `searchParams` at render time; remove `useState`.
- **Expected impact:** Halved admin tab-switch render cost.
- **Effort estimate:** S

#### FE-H6 `analytics-cache-context` schedules `setRevalidationTrigger` from a render-time microtask
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/admin/analytics-cache-context.tsx:140-147`
- **What's happening:** Staleness check fires during render and calls `queueMicrotask(() => setRevalidationTrigger(...))` — churn on every analytics panel render; brittle under React 19 strict mode.
- **Recommendation:** Move staleness check into a `useEffect` keyed on `[cacheKey, enabled]`.
- **Expected impact:** Removes per-render microtask; simpler control flow.
- **Effort estimate:** S

#### FE-M1 `voice-chat.tsx` is a 423-line monolith
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat.tsx:69-423`
- **What's happening:** Single component owns privacy notice, focus trap, voice access fetch, voice mode toggle, SSE streaming, markdown rendering, error retry, upsell CTA, expiry warning, ElevenLabs orchestration — 6 `useEffect`s.
- **Recommendation:** Extract `<ChatHeader>`, `<ChatMessageList>`, `<ChatComposer>`, `<ChatErrorBanner>`, `useChatMode()`.
- **Effort estimate:** M

#### FE-M2 `admin-shell.tsx` is 806 lines mixing auth, stories CRUD, and admin chrome
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/admin/admin-shell.tsx:127-807`
- **What's happening:** 11 `useState`s. Stories tab logic dominates a shell that should be a router.
- **Recommendation:** Extract `<StoriesTabPanel>`; move `StatCard` to `ui/stat-card.tsx`.
- **Effort estimate:** M

#### FE-M3 Bespoke fetch-cache patterns duplicated across 5+ hooks
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-stories.ts:36-41`, `src/hooks/use-feature-flags.ts:23-27`, `src/components/admin/analytics-cache-context.tsx:30-45`, `src/hooks/use-voice-access.ts:32-140`
- **What's happening:** Every domain reimplements module-level cache, in-flight dedup, stale-while-revalidate, mount-effect fetch, and focus revalidation with inconsistent TTLs.
- **Recommendation:** Adopt SWR or TanStack Query for client data fetching.
- **Effort estimate:** L

#### FE-M4 `Providers` remounts `AuthProvider` subtree on pathname transitions
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/providers.tsx:23-46`
- **What's happening:** `usePathname()`-based tree branching unmounts/remounts `AuthProvider` on `/immersive` ↔ `/about` transitions, triggering Supabase auth round-trips.
- **Recommendation:** Always mount `AuthProvider`; move `deferInitialAuth` logic inside the provider.
- **Effort estimate:** S

#### FE-M5 PostHog provider lazy-load reshapes the React tree on init, remounting all descendants
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/posthog-provider.tsx:58-121`
- **What's happening:** `PostHogProvider` inserted between `PostHogContext.Provider` and `children` when dynamic import resolves — full descendant remount.
- **Recommendation:** Always render `<PostHogContext.Provider>` with a stable subtree.
- **Effort estimate:** S

#### FE-M6 Unconditional idle prefetch of voice-chat for all visitors
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/immersive/immersive-page-content.tsx:103-109`
- **What's happening:** `requestIdleCallback(() => import("voice-chat"))` fires on every mount regardless of voice access.
- **Recommendation:** Gate prefetch on voice feature flag enabled or user hover intent.
- **Effort estimate:** S

#### FE-M7 Manual SSE buffer parsing duplicated without abstraction
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-stream-chat.ts:128-205`
- **Recommendation:** Extract `useSseStream<T>(url, options)` hook.
- **Effort estimate:** M

#### FE-L1 `console.error`/`console.warn` in 16+ client component production paths
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/components/auth/auth-provider.tsx:60,103,111`, `src/hooks/use-stories.ts:105,202,268`, `src/hooks/use-voice-access.ts:65`, `src/components/immersive/voice-chat-elevenlabs.tsx:144,223,233`
- **Recommendation:** Replace with `Sentry.captureException` or structured logger.
- **Effort estimate:** S

#### FE-L2 `(navigator as any).standalone` bypasses type safety
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/fullscreen-button.tsx:32-33`
- **Recommendation:** Add global ambient type augmentation for iOS `Navigator.standalone`.
- **Effort estimate:** S

#### FE-L3 Share logic duplicated with mismatched URLs (root cause of UX-B1)
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/share-button.tsx:27`, `src/components/immersive/story-viewer.tsx:447-457`
- **What's happening:** Story-viewer overflow menu builds `/stories/${id}` (404); `ShareButton` correctly uses `/story/${story.slug}`. The launch-blocker classification lives at UX-B1.
- **Recommendation:** Reuse `ShareButton` logic; standardize on `/story/${slug}`.
- **Effort estimate:** S

#### FE-S1 No state management library — strategic decision point
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `src/hooks/*.ts`, `src/components/admin/analytics-cache-context.tsx`
- **Recommendation:** Decide: SWR/TanStack Query for server state + Zustand for client-only, OR a shared `createCachedHook` factory. Document in ADR.
- **Effort estimate:** L

---

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model

~52 API routes. Validation via Zod `safeParse` in `src/lib/schemas.ts`. Two Supabase clients: anon/cookie-bound and service-role. Cross-cutting concerns in `src/proxy.ts`. Rate limiting via Upstash (fail-closed in production). Idempotency enforced for Stripe day-pass and ElevenLabs booking via SECURITY DEFINER RPCs. Background jobs use durable-queue pattern with `claim_*`/`fail_*`/`complete_*` RPCs guarded by Postgres advisory locks.

### Findings

#### BE-B1 Cron auth fails silently — misconfigured secret halts translation and booking recovery pipelines
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/cron-auth.ts:7-17`, `src/app/api/cron/content-discovery/route.ts:82-87`, `src/app/api/cron/fail-stale-translations/route.ts:58-63`, `src/app/api/cron/subscription-optimizer/route.ts:127-131`
- **What's happening:** `verifyVercelCron` returns `false` when secret is missing with no distinction. All cron routes return 401 silently. If `CRON_SECRET` is misconfigured, `fail-stale-translations` (every 15 min), `subscription-optimizer`, and `content-discovery` stop running with no alarm.
- **Why it matters:** Translation pipeline and booking recovery depend on these crons. Silent failure turns at-least-once delivery into at-most-once with no signal.
- **Recommendation:** Add `cron_auth_configured` probe to `/api/health`; emit `[CRON_AUTH_REJECTED]` log with `reason=missing_secret|header_missing|mismatch` per failed attempt.
- **Expected impact:** Cron-auth misconfiguration detected within minutes.
- **Effort estimate:** S

#### BE-B2 Stripe webhook partial failure permanently locks paying users out of their day pass
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/webhooks/stripe/route.ts:85-91`, `supabase/migrations/078_grant_day_pass_idempotent.sql:24-34`
- **What's happening:** `grant_day_pass_idempotent` inserts a dedup row first, then `voice_purchases`. If the second insert fails, the dedup row is NOT rolled back — user is paid-but-not-granted permanently. Every retry returns `'duplicate'`. No reconciliation cron exists.
- **Why it matters:** Real money. No recovery path.
- **Recommendation:** (a) Regression test asserting RPC rolls back dedup row on `voice_purchases` insert failure. (b) Add `amount_paid` to `voice_purchases`. (c) Add reconciliation cron scanning webhook events without matching grant rows.
- **Expected impact:** Paid users always get their grant; partial failures become recoverable.
- **Effort estimate:** M

#### BE-H1 Marketing agent chat accepts unvalidated body with unbounded conversation history
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/admin/marketing/agent/route.ts:127-173`
- **What's happening:** Body cast via `as AgentChatRequest` with no Zod validation; `conversationHistory` unchecked, going straight to Anthropic at uncapped cost.
- **Recommendation:** Add `agentChatRequestSchema` capping history length (≤20), message length (≤4000), validating role enum. Add rate limit (5 req/min/user).
- **Effort estimate:** S

#### BE-H2 `getUserFromRequest` reads only `Authorization: Bearer` — cookie-authenticated users get 401
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/supabase-auth.ts:38-57`, `src/app/api/favorites/route.ts:8,39,84`, `src/app/api/voice-access/route.ts:18`
- **What's happening:** Browser fetches without an explicit `Authorization` header are 401'd even with a valid session cookie.
- **Why it matters:** Authenticated users get spurious 401s on core features.
- **Recommendation:** Try cookie-bound client first in `getUserFromRequest`, then fall back to bearer header. Apply uniformly.
- **Effort estimate:** S

#### BE-H3 Marketing posts POST/PATCH bypasses Zod validation
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/admin/marketing/posts/route.ts:93-103,152-180`
- **What's happening:** Body cast via `as CreateDraftInput` with a manual two-field check. The only admin write route without `safeParse`.
- **Recommendation:** Add `marketingDraftSchema`/`marketingDraftPatchSchema` to `src/lib/schemas.ts`.
- **Effort estimate:** S

#### BE-H4 Make-booking: hung ElevenLabs request with no timeout poisons idempotency key forever
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/mcp/make-booking/route.ts:217-228,370-468`
- **What's happening:** Inserts `pending_bookings(status='initiating')` then calls ElevenLabs with no `AbortSignal.timeout`. Hung request (Vercel 60s timeout) leaves row in `initiating`; subsequent retries hit 409 forever.
- **Recommendation:** Add `AbortSignal.timeout(15_000)`; add cron to age out `initiating` rows > 5 minutes to `failed`.
- **Effort estimate:** M

#### BE-H5 Health endpoint always returns HTTP 200 regardless of degraded state
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/health/route.ts:110-131`
- **What's happening:** Hardcodes `status: 200` even when `overallStatus === "degraded"`. *(See also DO-H1 for the monitoring documentation mismatch.)*
- **Recommendation:** Return 503 on degraded; use `/api/health/live` as the always-200 liveness probe.
- **Effort estimate:** S

#### BE-H6 Translation queue serial processing exceeds Vercel 60s timeout on full batches
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `src/app/api/webhooks/translate/route.ts:249-411`, `supabase/migrations/079_webhook_idempotency_rpcs.sql:343-397`
- **What's happening:** Claims up to 10 jobs with 10-minute lease; processes serially at ~5–15s each. Batch of 10 exceeds Vercel 60s limit; killed jobs locked for 10 minutes.
- **Recommendation:** Reduce `TRANSLATE_JOB_BATCH_SIZE` to 1–3; reduce lease to 2–3 min; have worker self-kick when more work pending.
- **Effort estimate:** M

#### BE-M1 In-memory rate-limit map unsynchronized across Vercel instances with misleading dev fallback
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/rate-limit.ts:31,153-179`
- **Recommendation:** Add `[RATE_LIMIT_DEGRADED]` warn on every fallback request; surface in health probe.
- **Effort estimate:** S

#### BE-M2 Admin auth executes two round-trips per request with no caching
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/admin-auth.ts:40-71`
- **What's happening:** Every admin route calls `auth.getUser()` + SELECT `user_profiles`. Non-PGRST116 errors return 403, masking real DB errors.
- **Recommendation:** 30-second in-memory LRU by `user_id → role`; log non-PGRST116 as `[ADMIN_PROFILE_LOOKUP_FAILED]` → return 500.
- **Effort estimate:** S

#### BE-M3 Service-role client recreated per webhook/cron invocation
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/supabase.ts:52-61`
- **Recommendation:** Add memoized `getAdminClient()` returning a process-singleton.
- **Effort estimate:** S

#### BE-M4 Feature-flags API caches publicly with no `Vary` header despite environment-specific filtering
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `src/app/api/feature-flags/route.ts:30-66`
- **Recommendation:** Add `Vary: Host` or set `Cache-Control: private`.
- **Effort estimate:** S

#### BE-M5 Admin agent runner uses in-process Map — incompatible with serverless, protected only by a dev gate
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/admin/agents/run/route.ts:33-34,60-66`
- **Recommendation:** Add lint/test asserting `VERCEL_ENV` gate remains; document "local-only by design."
- **Effort estimate:** S

#### BE-M6 ElevenLabs webhook booking state update is non-atomic — `outcome_message` can be lost
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/webhooks/elevenlabs/route.ts:587-616`
- **What's happening:** `complete_booking_sms_job` succeeds in step (a); separate `UPDATE pending_bookings` can fail in step (b); idempotency key prevents re-attempt.
- **Recommendation:** Move `outcome_message` set into `complete_booking_sms_job` RPC as a single transaction.
- **Effort estimate:** S

#### BE-M7 Suggestion POST: IP-only rate limit, no spam mitigation on public-write endpoint
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/suggestions/route.ts:79-88`
- **Recommendation:** Add hCaptcha/Turnstile token requirement + honeypot field for anonymous submissions.
- **Effort estimate:** M

#### BE-L1 ~58 `console.*` calls in API routes instead of structured logger
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/chat/route.ts:209`, `src/app/api/feature-flags/route.ts:52`, `src/app/api/checkout/day-pass/route.ts:45,80`, `src/app/api/favorites/route.ts:26,72,113` (and ~50 more in `eslint.config.mjs:46-79` ignore-list)
- **Recommendation:** Replace with `logger.*` and `[ROUTE_EVENT]` codes.
- **Effort estimate:** S

#### BE-L2 Stripe unrecoverable webhook events have no admin-visible audit trail
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/webhooks/stripe/route.ts:9-18,64-73`
- **Recommendation:** Insert row into `stripe_unrecoverable_events` table for manual reconciliation.
- **Effort estimate:** S

#### BE-L3 Duplicate validation in `validateChatRequest` + Zod schema on chat routes
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/app/api/chat/route.ts:54-69`, `src/app/api/chat/stream/route.ts:53-71`
- **Recommendation:** Extend Zod schema with `.transform()` for sanitization; remove `validateChatRequest`.
- **Effort estimate:** M

#### BE-S1 Background queue drained by HTTP handlers under Vercel timeouts — no dedicated worker
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `src/app/api/webhooks/translate/route.ts`, `supabase/migrations/079`, `supabase/migrations/082`, `supabase/migrations/083`
- **Recommendation:** Document design in ADR; set volume thresholds for migration to Inngest/Supabase Queues.
- **Effort estimate:** L

---

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model

Hot path: `/immersive` PPR shell streams story data + feature flags (60s revalidate). Chat: embedding (Voyage, in-process LRU 100 entries/5 min) → vector search (ivfflat) → rerank (Voyage) → Claude SDK (SSE). Heavy chunks lazy-loaded. Chat routes use per-request dynamic `import()` as a Turbopack workaround. Build uses Turbopack. Deployment on Vercel (single region `fra1`).

### Findings

#### PE-H1 `ivfflat` vector index undersized — recall and latency degrade as corpus grows
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `supabase/migrations/017_reduce_embedding_dimensions.sql:23-25`, `src/lib/search.ts:13-17`
- **What's happening:** `chunks_embedding_idx` uses `ivfflat WITH (lists=100)` without `SET LOCAL ivfflat.probes`. Default probes=1 gives poor recall on 100 lists; latency rises sharply past ~100k rows.
- **Why it matters:** Chat is the core feature. Low recall feeds the reranker irrelevant candidates.
- **Recommendation:** Switch to HNSW: `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)` with `SET LOCAL hnsw.ef_search = 40` inside `match_chunks`; or keep ivfflat with `lists ≈ sqrt(rows)` and `probes = 10`.
- **Expected impact:** Higher recall, stable p95 chat latency as corpus grows.
- **Effort estimate:** M

#### PE-H2 Embedding cache is in-process and tiny (100 entries) — cold lambdas always pay Voyage RTT
- **Severity:** high
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/embedding-cache.ts:8-9`, `src/lib/embeddings.ts:14,26-55`
- **What's happening:** Per-process Map with TTL 5 min. On Vercel each lambda has its own Map; hit rate stays near zero.
- **Recommendation:** Promote to Upstash Redis (already a dependency) with 24h TTL.
- **Expected impact:** 100–250ms p50 savings on cache hits; Voyage cost reduction.
- **Effort estimate:** M

#### PE-H3 Search pipeline serializes rerank and image fetch unnecessarily
- **Severity:** high
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/search.ts:75-94`
- **What's happening:** `getRelatedImages` waits for `rerankChunks` (~150–300ms) to complete even though image refs are available after `searchChunks`.
- **Recommendation:** Kick off `getRelatedImages(allRefs)` in parallel with `rerankChunks`; filter to top-k after rerank completes.
- **Expected impact:** 50–150ms reduction in first-token latency.
- **Effort estimate:** S

#### PE-H4 Anthropic SDK + Voyage + Supabase dynamically imported on every chat request
- **Severity:** high
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/chat/stream/route.ts:118-128`, `src/lib/claude.ts:53,256`
- **What's happening:** Both chat routes `await import("@/lib/claude")` per request (Turbopack workaround). `streamWithSDK`/`callWithSDK` also `await import("@anthropic-ai/sdk")` per call.
- **Recommendation:** Re-verify on latest Next.js patch; hoist imports when Turbopack regression is gone. Independently, hoist the second-level `await import("@anthropic-ai/sdk")` in `claude.ts`.
- **Expected impact:** 50–300ms warm/cold savings per chat request.
- **Effort estimate:** S

#### PE-M1 Streaming SSE endpoint on Node lambda — higher cold-start cost than necessary
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `src/app/api/chat/stream/route.ts:1-33`
- **Recommendation:** Evaluate Edge runtime — Anthropic SDK, Upstash Redis, Supabase JS all support it.
- **Effort estimate:** M

#### PE-M2 Curl-spawn streaming path in development masks SDK regressions
- **Severity:** medium
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/lib/claude.ts:16,90-224`
- **Recommendation:** Re-test SDK in dev with latest Next.js patch; remove curl branch if fixed. Replace `setTimeout(resolve, 100)` polling with event-driven promise.
- **Effort estimate:** S

#### PE-M3 `next.config.ts` global `no-store` overrides per-route SWR caching headers
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `next.config.ts:74-79`, `src/app/api/feature-flags/route.ts:37`, `src/app/api/mcp/places/route.ts:328`, `src/app/api/mcp/weather/route.ts:173`
- **What's happening:** Global `Cache-Control: no-store` for `/api/:path*` may override intentional `public, max-age=60/3600/300` on feature-flags, places, weather.
- **Recommendation:** Remove blanket `no-store` from `next.config.ts`; set `no-store` only on routes that need it. Verify with `curl -I` on deployed preview.
- **Expected impact:** Real CDN caching for feature flags and MCP endpoints.
- **Effort estimate:** S

#### PE-M4 Marketing dashboard aggregates 100 posts in JavaScript instead of SQL
- **Severity:** medium
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/app/api/admin/marketing/dashboard/route.ts:36-47,128-192`
- **Recommendation:** Move `calculateStats` into a Postgres view or RPC.
- **Effort estimate:** M

#### PE-M5 Admin shell loads all stories into memory with no pagination
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/admin/admin-shell.tsx:171-185,212-231`
- **Recommendation:** Server-side filter + paginate; `loadStories()` should accept filter params.
- **Effort estimate:** M

#### PE-M6 Two raw `<img>` tags in the immersive viewport bypass `next/image`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/auth/auth-button.tsx:41-46`, `src/components/immersive/site-info-menu.tsx:46-51,86-91`
- **Recommendation:** Add `lh3.googleusercontent.com` to `images.remotePatterns` and use `next/image`; or add explicit `width`/`height` + `loading="eager"`.
- **Effort estimate:** S

#### PE-M7 Sentry sourcemap upload runs on every build including previews
- **Severity:** medium
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `next.config.ts:103-106`
- **Recommendation:** Set `widenClientFileUpload: false`, `hideSourceMaps: true`; gate upload to `main`/`develop` only.
- **Effort estimate:** S

#### PE-L1 1-second `setInterval` for elapsed timer keeps tab from idling
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/components/admin/agents-dashboard/terminal-display.tsx:40-47`
- **Recommendation:** Pause interval when `document.hidden`; reduce to 5s cadence.
- **Effort estimate:** S

#### PE-L2 `/story/[slug]` prerenders 70+ pages only to server-redirect to `/immersive`
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/app/story/[slug]/page.tsx:45-48`
- **Recommendation:** Use `next.config.ts` `redirects()` (308) for CDN-handled redirect; skip `generateStaticParams`.
- **Effort estimate:** S

#### PE-L3 `console.*` on the chat hot path instead of structured logger
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/lib/embeddings.ts:48,86,90`, `src/lib/rerank.ts:36-39`, `src/lib/claude.ts:81,331-373`
- **Recommendation:** Route through `logger`; demote Voyage token logs to `debug` level.
- **Effort estimate:** S

#### PE-L4 `EmbeddingCache` hashes every key with SHA-256 unnecessarily
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/lib/embedding-cache.ts:21-23,25-26`
- **Recommendation:** Use raw text as Map key directly.
- **Effort estimate:** S

#### PE-S1 Single-region deployment — global p95 dominated by network RTT for non-EU users
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `src/lib/feature-flags-server.ts:23-33`
- **Recommendation:** Add cache-MISS counter in `getStoriesServer`; document cache hit rate monitoring in operations.
- **Effort estimate:** S

---

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model

CI: 9 GitHub Actions workflows. Branch protection on `main` requires 5 status checks + 1 approval. Build/E2E/Lighthouse use dummy env vars; `preview-smoke.yml` exercises real runtime against a Vercel preview, only on PRs to `main`. Health surface: `/api/health/live` (always-200), `/api/health` (degraded-aware, always-HTTP-200), `/api/health/db`. Sentry wired but DSN commented out. Logging via `pino` with `instrumentation.ts` console patch (Node only). Runbooks at `docs/operations/`.

### Findings

#### DO-H1 Health endpoint always returns HTTP 200 — contradicts all monitoring documentation
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/health/route.ts:113-130`, `docs/operations/operations.md:7,117`, `docs/operations/migration-policy.md:96-101`, `docs/operations/alerting-runbook.md:20`
- **What's happening:** Code hardcodes `status: 200` on degraded. `operations.md:117` promises "HTTP 503 on degraded state." Documentation and code contradictory.
- **Why it matters:** Monitors configured per the docs never alert on a database outage.
- **Recommendation:** (a) Return 503 on degraded — use `/api/health/live` as the always-200 liveness probe, OR (b) update all documentation to remove 503 references. Option (a) is correct.
- **Expected impact:** Monitors and runbooks agree on contract.
- **Effort estimate:** S

#### DO-H2 Sentry SDK initialized everywhere but DSN is unset — production errors are invisible
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `sentry.server.config.ts:4-13`, `sentry.client.config.ts:4-13`, `.env.example:116-118`, `src/app/error.tsx:5,17`, `src/app/global-error.tsx:5,27`
- **What's happening:** `NEXT_PUBLIC_SENTRY_DSN` commented out in `.env.example`. Sentry init gated `if (dsn)`. Every `captureException` is a no-op. Route-level error boundaries, webhook failures, auth errors — all dark.
- **Why it matters:** The site is live. The entire error-reporting layer is silent.
- **Recommendation:** Verify DSN is set in Vercel Production + Preview (`vercel env ls`). Add as uncommented placeholder in `.env.example`. Configure Sentry project before launch if missing.
- **Expected impact:** Real-time exception visibility; deminified stack traces.
- **Effort estimate:** S

#### DO-H3 Console lint guard undermined by 25-file ignore-list in ESLint config
- **Severity:** high
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `eslint.config.mjs:44-90`, `docs/operations/logging.md:16-22`
- **What's happening:** `logging.md` advertises ESLint blocks `console.*` in all API routes. 25 files are explicitly exempted (chat, admin analytics, all cron routes). Edge-runtime routes bypass the console patch entirely.
- **Recommendation:** Migrate exempted files to `logger.*` (phase-3.md already tracks this); remove ignore-list.
- **Effort estimate:** M

#### DO-M1 `.trim()` choke-point bypassed by direct `process.env.SUPABASE_*!` reads on auth paths
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/admin-auth.ts:20-21`, `src/lib/supabase-auth.ts:13-14`, `src/lib/supabase-browser.ts:9-10`, `src/app/auth/callback/route.ts:21-22`
- **What's happening:** `env.ts` was created to centralize `.trim()` hygiene. Four critical auth files read env vars directly. A stray Vercel newline on the Supabase URL breaks Google OAuth callback silently.
- **Recommendation:** Replace bare reads with `getSupabaseUrl()`/`getSupabaseAnonKey()` from `@/lib/env`; add ESLint no-restricted-syntax rule on direct `process.env` reads.
- **Effort estimate:** S

#### DO-M2 Cron jobs lack per-job recovery procedures and success/failure telemetry
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `vercel.json:4-21`, `docs/operations/alerting-runbook.md:44-60`
- **Recommendation:** Add `[CRON_SUCCESS]`/`[CRON_FAILURE]` log events; configure absence-of-success alert at 2× schedule interval.
- **Effort estimate:** M

#### DO-M3 Single-region deployment with no documented regional failover plan
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `vercel.json:3`, `docs/operations/operations.md:127-133`
- **Recommendation:** Add "Regional Outage" section to `rollback.md` with status pages to monitor and manual recovery path.
- **Effort estimate:** S

#### DO-M4 Stale `ADMIN_SECRET_KEY` env var with zero code references
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `.env.local` (ADMIN_SECRET_KEY line)
- **Recommendation:** Remove from `.env.local`, `.env.example`, and Vercel environments; rotate if it was ever a live credential.
- **Effort estimate:** S

#### DO-M5 CI uses placeholder env vars — runtime regressions only caught on PRs to `main`
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/ci.yml:80-91`, `.github/workflows/preview-smoke.yml`
- **What's happening:** `preview-smoke.yml` only runs on PRs to `main`. Direct `develop` pushes (the default workflow) never trigger runtime validation. Reproduces 2026-03-24 Dependabot incident pattern.
- **Recommendation:** Run lightweight smoke check on `develop` pushes against Vercel `develop` preview URL.
- **Effort estimate:** M

#### DO-M6 No documented database backup / restore procedure
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `docs/operations/migration-policy.md:74-83`, `docs/operations/rollback.md:148`
- **What's happening:** PITR available on Supabase Pro but config and tested restore steps are not documented.
- **Recommendation:** Add `docs/operations/database-backup.md` covering backup schedule, PITR window, and a tested restore procedure.
- **Effort estimate:** M

#### DO-M7 No log drain confirmed — Vercel log retention may be as low as 1 hour
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `docs/operations/logging.md:80-149`, `docs/operations/pending-setup.md`
- **Recommendation:** Confirm log drain is active in Vercel dashboard; configure BetterStack Starter or Axiom if not.
- **Effort estimate:** S

#### DO-L1 `npm audit` only at `--audit-level=high` in security workflow
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/security.yml:42-47`
- **Recommendation:** Drop to `--audit-level=moderate` for production deps.
- **Effort estimate:** S

#### DO-L2 `withTimeout` in health probe leaks the underlying Supabase request after timeout fires
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/app/api/health/route.ts:96-108`
- **Recommendation:** Wire `AbortController` through `withTimeout`; pass `{ signal }` to Supabase queries.
- **Effort estimate:** S

#### DO-S1 Solo-developer escalation is a single point of failure on a live payment site
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `docs/operations/alerting-runbook.md:14`
- **Recommendation:** Rephrase runbook to state SLO explicitly as accepted risk; or configure BetterStack email-to-PagerDuty for critical alerts.
- **Effort estimate:** S

---

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model

Auth via Supabase (Google OAuth) + cookie sessions + RBAC (`user_profiles.role = 'admin'`). Webhooks verify HMAC signatures. MCP routes use `MCP_API_SECRET` with constant-time comparison. CSRF uses double-submit cookie + SameSite=Strict + Origin/Referer allowlist. CSP: `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com` (PPR-compatible). Marketing OAuth credentials AES-256-GCM encrypted at rest. Security headers set globally in `next.config.ts`.

### Findings

#### SE-H1 8 moderate npm audit vulnerabilities — postcss XSS and uuid bounds-check
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `package.json`, `package-lock.json` (transitive: `postcss < 8.5.10` via Next; `uuid < 14` via svix → resend)
- **What's happening:** postcss has CSS-stringify XSS (GHSA-qx2v-qp2m-jg93); uuid has buffer bounds-check issue (GHSA-w5hq-g745-h8pq).
- **Why it matters:** Live payment-processing site should have zero unfixed CVEs at launch.
- **Recommendation:** Use npm `overrides` to pin `postcss` to `^8.5.10`; upgrade Resend/svix. Run `npm audit` until clean.
- **Expected impact:** Clean dependency audit surface in CI.
- **Effort estimate:** S

#### SE-H2 Embedded checkout `return_url` echoes attacker-controllable `Origin` header (open redirect)
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/checkout/embedded/route.ts:44-61`
- **What's happening:** Builds Stripe `return_url` from `request.headers.get("origin")` without allowlist check. Contrast with `day-pass/route.ts:49-53` which validates against `ALLOWED_ORIGINS`.
- **Why it matters:** Attacker supplies `Origin: https://evil.example`; Stripe redirects the paying customer to a phishing page.
- **Recommendation:** Mirror the day-pass route: validate against `ALLOWED_ORIGINS`; fall back to `NEXT_PUBLIC_SITE_URL`. Add regression test.
- **Expected impact:** Closes open-redirect-via-checkout vector.
- **Effort estimate:** S

#### SE-M1 Admin "image by URL" path is an authenticated SSRF
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/api/admin/stories/[id]/image/route.ts:128-178`
- **What's happening:** `fetch(imageUrl)` after only `new URL(imageUrl)` validation — no scheme check, no private-IP block, no timeout.
- **Recommendation:** Restrict to `https:` scheme; reject private/loopback/link-local hostnames; add `AbortSignal.timeout(8_000)`; cap response size.
- **Effort estimate:** S

#### SE-M2 CSRF Origin check allows requests with neither `Origin` nor `Referer`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/csrf.ts:77-97`
- **What's happening:** `validateOrigin` returns `true` when both headers are absent — weakens defense-in-depth.
- **Recommendation:** Require `Origin` on state-changing requests (403 on absent), or make CSRF cookie `httpOnly: true`.
- **Effort estimate:** M

#### SE-M3 Service-role client used for read-only admin operations, bypassing RLS
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `src/app/api/admin/stories/route.ts:35-75`, `src/lib/admin-auth.ts:97-105`
- **Recommendation:** Split into `withAdminRead` (cookie-scoped) and `withAdminWrite` (service-role); migrate read handlers to `withAdminRead`.
- **Effort estimate:** M

#### SE-M4 CSP `'unsafe-inline'` in `script-src`, no SRI for Stripe SDK
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/proxy/csp.ts:26-51`
- **What's happening:** Intentional for PPR/static-shell compatibility. CSP canary test provides detection.
- **Recommendation:** Verify CSP canary test runs on every PR; track Next.js roadmap for PPR-compatible nonces.
- **Effort estimate:** L

#### SE-M5 CSRF cookie `secure` gate uses `NODE_ENV` — inconsistent with rest of codebase using `VERCEL_ENV`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `src/lib/proxy/csrf-proxy.ts:62-65`, `src/lib/csrf.ts:18-25`
- **Recommendation:** Centralize into `isSecureRuntime()` returning true for `NODE_ENV=production` OR `VERCEL_ENV=preview|production`.
- **Effort estimate:** S

#### SE-L1 Admin agents runner passes full `process.env` to child processes
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/app/api/admin/agents/run/route.ts:88-148`
- **Recommendation:** Pass explicit env allowlist to child; pipe stdout/stderr through `sanitizeLogMessage`.
- **Effort estimate:** S

#### SE-L2 Bearer token precedence over session cookie is implicit and untested
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/supabase-auth.ts:38-57`
- **Recommendation:** Add test locking in the session-over-bearer precedence rule.
- **Effort estimate:** S

#### SE-L3 Stripe API version not pinned at client construction
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/stripe.ts:21-30`
- **Recommendation:** Pin `apiVersion` to current SDK expected version string.
- **Effort estimate:** S

#### SE-S1 Single admin role — no fine-grained permissions for future collaborators
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `src/lib/admin-auth.ts:62`, `src/app/api/admin/**`
- **Recommendation:** Plan `role_scopes` table for `requireCapability()` when collaborators are added.
- **Effort estimate:** L

---

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model

Next.js 16 App Router, strict-mode TypeScript. 9-step proxy pipeline. ~60 API routes. `src/lib/` flat namespace of 56 files with 4 organized sub-domains. Typecheck passes; zero circular deps (verified with `madge`); one dead export (knip). Build via `next build` with `cacheComponents: true`, Sentry wrapping, `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]`.

### Findings

#### AR-H1 Supabase clients untyped — 91 `.from()` queries operate on `any`-shaped rows
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/supabase.ts:1,30`, `src/lib/supabase-browser.ts`, `src/app/api/health/db/route.ts:2` (91 call-sites via grep)
- **What's happening:** No generated `Database` TypeScript type. All `SupabaseClient` instantiations omit the generic; query-builder return types collapse to `any`-equivalent. Column renames cannot be caught at compile time.
- **Why it matters:** Site is live with Stripe payments. Schema migrations can silently break runtime queries; users learn about it via Sentry (which is dark — DO-H2).
- **Recommendation:** `supabase gen types typescript --project-id <id> > src/types/database.types.ts`; parameterize all client factories with `<Database>`; add CI step that fails when local schema drifts.
- **Expected impact:** Schema-shape errors caught at build time; safe column renames.
- **Effort estimate:** M

#### AR-H2 Logger migration incomplete — 73 source files still use `console.*`; 25 API routes on ESLint ignore-list
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `eslint.config.mjs:46-79` (ignore-list), `src/app/api/chat/route.ts`, `src/app/api/admin/analytics/route.ts`, `src/app/api/checkout/day-pass/route.ts`, `src/app/api/cron/content-discovery/route.ts` (and 69 more)
- **What's happening:** Structured `pino` logger exists at `src/lib/logger.ts`; migration paused mid-flight. `instrumentation.ts:43-60` patches `console` globally but loses per-call `context`/`requestId` fields.
- **Why it matters:** Sentry/PostHog dashboards lose structured fields on the most critical paths.
- **Recommendation:** Migrate all 25 whitelisted files to `logger.*`; remove ignore-list entries (phase-3.md tracks this).
- **Expected impact:** Uniform structured logs in Sentry; removes recurring tech debt.
- **Effort estimate:** M

#### AR-M1 `preserveSymlinks: true` in `tsconfig.json` — undocumented, potential React hook duplication risk
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `tsconfig.json:11`
- **What's happening:** Can cause module duplication with worktree-based dev setups if any dep resolves through a symlink — "Invalid hook call" runtime error.
- **Recommendation:** Delete `preserveSymlinks: true` (default is `false`, Next.js expects it), or add a comment explaining why it is necessary.
- **Effort estimate:** S

#### AR-M2 Empty `src/services/` directory is dead architecture
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/services/.gitkeep`
- **What's happening:** Only a `.gitkeep`; no code references it. Confuses contributors about where to place business logic.
- **Recommendation:** Delete the directory, or add a one-line README defining the boundary (e.g., "services orchestrate multiple lib/ helpers").
- **Effort estimate:** S

#### AR-M3 Dead export `agentConfigUpdateSchema` — knip confirmed
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/schemas.ts:195-198`
- **What's happening:** `agentConfigUpdateSchema` is a `z.union([...])`. Route handler imports the two underlying schemas separately; the union is never used.
- **Recommendation:** Delete the export; verify knip CI reports zero unused exports.
- **Effort estimate:** S

#### AR-M4 `proxy.ts` re-exports internal symbols solely to satisfy two test files
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/proxy.ts:13-18`, `src/proxy.test.ts:24`, `src/lib/security-headers.test.ts:4`
- **Recommendation:** Update test files to import from `@/lib/proxy/*` directly; delete re-exports from `src/proxy.ts`.
- **Effort estimate:** S

#### AR-M5 Client hook imports type from API route file — layering violation
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/hooks/use-voice-access.ts:7`
- **What's happening:** `import type { VoiceAccessResponse } from "@/app/api/voice-access/route"`. TypeScript `import type` strips runtime, but a future refactor dropping `type` silently ships server code to the browser.
- **Recommendation:** Move `VoiceAccessResponse` to `src/types/voice-access.ts`; have both route and hook import from `@/types`.
- **Effort estimate:** S

#### AR-L1 Three outdated minor-version dependencies on core services
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `package.json:76` (`lucide-react@1.8.0`, latest 1.11.0), `package.json:57` (`@elevenlabs/react@1.1.1`, latest 1.2.1), `package.json:89` (`voyageai@0.1.0`, latest 0.2.1)
- **Recommendation:** Bump in a single post-launch PR.
- **Effort estimate:** S

#### AR-L2 Two moderate `npm audit` findings behind major-version walls
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `package.json` (postcss via Next 16; uuid via resend → svix)
- **What's happening:** Fix paths require `--force` (CLI artifact shows Next 9.3.3 but means latest patch). *(Overlap with SE-H1 which recommends npm overrides as a safe fix.)*
- **Recommendation:** Use npm `overrides` for postcss; monitor Resend/svix for uuid patch.
- **Effort estimate:** S

#### AR-S1 Flat `src/lib/` of 56 files mixes IO clients, domain logic, security utilities, and formatters
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `src/lib/` (56 top-level files)
- **Recommendation:** Adopt the same sub-domain pattern as existing `admin-api/`, `costs/`, `i18n/`, `proxy/`: introduce `lib/clients/`, `lib/security/`, `lib/chat/` sub-domains.
- **Effort estimate:** M

#### AR-S2 No optional strict TypeScript flags enabled (`noUncheckedIndexedAccess` highest-leverage gap)
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `tsconfig.json:1-49`
- **Recommendation:** Enable in order: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, then `noUncheckedIndexedAccess`. Document in an ADR.
- **Effort estimate:** M

---

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model

335 Vitest files / 6,117 unit + integration tests, all green. 16 Playwright e2e specs. 53/53 API routes have paired `route.test.ts`. Vitest config declares aspirational coverage thresholds (95/90/95/95) but `npm run test` never invokes `--coverage`. `e2e.yml` does not inject `QA_TEST_USER_EMAIL/PASSWORD`; authenticated e2e tests silently skip on every PR. `e2e-stripe-integration.yml` runs only nightly. Visual regression uses `continue-on-error: true`, cannot block merges.

### Findings

#### QA-H1 Coverage thresholds defined but never enforced in CI
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `vitest.config.ts:23-28`, `package.json:23`
- **What's happening:** `thresholds: { statements: 95, branches: 90, ... }` declared but `npm run test` is `vitest run` with no `--coverage`. Coverage gates never execute.
- **Why it matters:** False sense of enforcement. New code can land well below 95% without any signal.
- **Recommendation:** Add coverage job to CI (`vitest run --coverage`); either fail on threshold breach or downgrade to honest values.
- **Expected impact:** Real coverage gating; visible gaps.
- **Effort estimate:** S

#### QA-H2 Authenticated e2e tests silently skip on every PR
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `e2e/fixtures/auth.ts:138-153`, `e2e/qa-journey.spec.ts:471-589`, `.github/workflows/e2e.yml:46-56`
- **What's happening:** `auth.ts` calls `test.skip(true, "...")` whenever `QA_TEST_USER_EMAIL`/`PASSWORD` are missing. Main `e2e.yml` does not inject those secrets. All 16 `authenticatedPage` references in `qa-journey.spec.ts` (favorites, voice access, paid immersive flow) silently skip on every PR.
- **Why it matters:** The authenticated user journey — the highest-revenue flow — has zero PR-time coverage.
- **Recommendation:** Add `QA_TEST_USER_EMAIL`/`PASSWORD` to `e2e.yml` workflow secrets; remove the conditional skip.
- **Expected impact:** PRs catch regressions to authenticated flows before merge.
- **Effort estimate:** S

#### QA-H3 Visual regression failures cannot block merges
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/e2e.yml:58-69`
- **What's happening:** `continue-on-error: true` on visual regression step. Screenshot diffs uploaded as artifacts but never fail the workflow.
- **Why it matters:** Real visual regressions (layout shift on `/immersive`, missing content, CSP breakage) pass CI silently.
- **Recommendation:** Remove `continue-on-error: true`; run visual regression in a dedicated blocking job. Raise `maxDiffPixelRatio` if flake is the concern.
- **Expected impact:** Visual regressions block merges.
- **Effort estimate:** S

#### QA-M1 `logger-sanitize` and proxy helpers have no direct tests
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/lib/logger-sanitize.ts:1-132`, `src/lib/proxy/auth-refresh.ts:79-164`, `src/lib/proxy/canonical-domain.ts`, `src/lib/proxy/csrf-proxy.ts`, `src/lib/proxy/root-redirect.ts`, `src/lib/proxy/story-rewrite.ts`
- **What's happening:** Security-sensitive helpers (PII redaction, auth-refresh timeout, CSRF origin gating, canonical redirects) have no `*.test.ts` sibling; exercised only transitively.
- **Recommendation:** Add direct unit tests for `sanitizeValue` (circular refs, Bearer/Stripe/phone patterns), `refreshAuthSession` (timeout path), and each proxy helper.
- **Effort estimate:** M

#### QA-M2 Stripe e2e workflow runs nightly only — not triggered by Stripe-touching PRs
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/e2e-stripe-integration.yml:3-6`
- **What's happening:** `workflow_dispatch` + cron-only. PRs modifying `src/app/api/checkout/**`, `src/app/api/webhooks/stripe/**`, `src/lib/stripe.ts` do not automatically run the real-Stripe suite.
- **Recommendation:** Add `pull_request` trigger with `paths` filter on Stripe-relevant paths.
- **Effort estimate:** S

#### QA-M3 Data-pipeline scripts (process-pdfs, seed-database, etc.) have no tests
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `scripts/process-pdfs.ts`, `scripts/seed-database.ts`, `scripts/extract-images.ts`, `scripts/seed-translations.ts`, `scripts/sync-translation-status.ts`
- **What's happening:** Of 22 scripts, only 2 have unit tests. Scripts that can mutate Supabase production data rely on manual execution only.
- **Recommendation:** Add thin integration tests per script exercising parsing/transformation logic against fixtures; prioritize `process-pdfs` and `seed-database`.
- **Effort estimate:** M

#### QA-L1 No ESLint rule preventing new `test.skip` calls
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `src/**/*.test.{ts,tsx}`, `e2e/**/*.spec.ts`
- **What's happening:** No unit/integration skips exist today, but the fixture-based skip pattern in e2e shows the project will silently skip rather than fail when prerequisites are missing.
- **Recommendation:** Add `vitest/no-disabled-tests` and `playwright/no-skipped-test` ESLint rules requiring code-owner exception comments.
- **Effort estimate:** S

---

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model

Root `/` redirects to `/immersive` — full-viewport stories carousel (`StoryViewer`). Modal-like `VoiceChat` panel handles text + voice. Other routes: `/favorites`, `/pricing`, `/pricing/checkout`, static `/about`/`/privacy`/`/terms`, `/story/[slug]` (redirect). Component library is shadcn/ui + ~30 immersive components + 25 admin components. Tailwind config defines brand tokens `paisaxe-blue/green/sand` but they are never used. Loading/error boundaries exist for `/`, `/immersive`, `/favorites`, `/admin` only. Six locales: es, ast, en, fr, de, pt.

### Findings

#### UX-B1 Mobile overflow share button generates a 404 URL — viral loop broken on mobile
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-viewer.tsx:447-456`, `src/components/immersive/share-button.tsx:27`, `src/app/story/[slug]/page.tsx:1`
- **What's happening:** Mobile overflow share builds `${origin}/stories/${story.id}` (plural, by id). Actual route is `/story/[slug]` (singular, by slug). `ShareButton` correctly uses `/story/${story.slug || story.id}`.
- **Why it matters:** Sharing is the primary viral loop. Every link shared from mobile overflow leads to a dead page.
- **Recommendation:** Reuse `ShareButton` logic (or extract `buildStoryShareUrl(story)` helper) in `story-viewer.tsx:447-456`.
- **Expected impact:** Shared mobile links resolve; share-driven funnel works.
- **Effort estimate:** S

#### UX-B2 Hardcoded English copy on the primary Spanish-language monetisation page
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/pricing/page.tsx:82,106` ("Premium Access", "Voice Pass · 24h"), `src/app/pricing/checkout/page.tsx:49` ("Unknown error"), `src/components/immersive/voice-chat-elevenlabs.tsx:176` ("Voice agent not configured"), `src/components/immersive/chat-actions.tsx:57` ("You" / "Paisaxe"), `src/components/auth/auth-button.tsx:43` ("User avatar")
- **What's happening:** Multiple user-visible strings are not localized. Pricing card prominently shows English copy on the main monetisation page.
- **Why it matters:** Project mandates Spanish user-facing content. English copy on the monetisation surface erodes trust and conversion.
- **Recommendation:** Move every visible literal through `t(...)`; add keys (e.g., `premium.voice_pass_label`, `errors.unknown`, `voice.error_not_configured`).
- **Expected impact:** Coherent Spanish UX on monetisation and chat.
- **Effort estimate:** S

#### UX-B3 Pricing/CTA visual identity is inconsistent — green vs amber gradients on the same product
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/pricing/page.tsx:51,61,93,140` (green), `src/components/premium/voice-purchase-cta.tsx:48,65,69,108` (amber/yellow), `src/components/immersive/chat-upsell-cta.tsx:60-86` (amber/yellow), `src/components/immersive/voice-chat.tsx:238` (green border)
- **What's happening:** Same product (Voice Pass €1.99) promoted with two different brand palettes. User sees green "Activar voz", clicks, sees amber gradient on locked-voice screen.
- **Why it matters:** Visual continuity is the primary predictor of checkout trust. Palette mismatch signals "wrong flow."
- **Recommendation:** Pick one palette (green aligns with "active" metaphor); apply across `voice-purchase-cta.tsx`, `chat-upsell-cta.tsx`, and chat-header CTA. Move into a Tailwind token (`--accent-voice`).
- **Expected impact:** Higher pricing-page conversion; fewer abandonment questions about product identity.
- **Effort estimate:** S

#### UX-B4 Voice-chat dialog missing `aria-modal="true"` — screen readers navigate behind the modal
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat.tsx:193-198`, `src/components/auth/sign-in-prompt.tsx:29`, `src/components/immersive/mood-overlay.tsx:42`
- **What's happening:** Chat panel has `role="dialog"` but no `aria-modal="true"`. Screen readers (VoiceOver/JAWS) don't restrict navigation to the dialog — the carousel behind remains addressable.
- **Why it matters:** Primary interaction surface. AT users get a confusing experience when dialog opens.
- **Recommendation:** Add `aria-modal="true"` on `voice-chat.tsx:193`; add `inert` or `aria-hidden` on the background carousel while dialog is open.
- **Expected impact:** Predictable AT behaviour for the most-used feature.
- **Effort estimate:** S

#### UX-H1 Microphone permission requested on component mount, before any user gesture
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat-elevenlabs.tsx:166-172`
- **What's happening:** `navigator.mediaDevices.getUserMedia({ audio: true })` fires on mount. iOS Safari can block outright (no user-gesture transient activation); desktop surfaces a browser prompt before the user signals intent.
- **Why it matters:** Surprises paying users with an OS-level permission dialog the moment chat opens. Denial disables the feature they paid €1.99 for.
- **Recommendation:** Defer to the `startConversation` click. Keep `hasPermission === null` until then.
- **Expected impact:** Cleaner first impression; fewer surprise denials; iOS reliability.
- **Effort estimate:** S

#### UX-H2 Smooth scroll ignores `prefers-reduced-motion`
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat.tsx:144`, `src/components/immersive/voice-chat-elevenlabs.tsx:163`, `src/components/admin/voice-agent-chat.tsx:112`
- **What's happening:** `scrollIntoView({ behavior: "smooth" })` hard-coded. Global CSS reduced-motion sledgehammer only overrides CSS animations/transitions, not JS scroll smoothing.
- **Why it matters:** Vestibular-disorder users can experience nausea from animated scrolling; project already advertises reduced-motion support.
- **Recommendation:** Use `useReducedMotion()` (exists at `src/hooks/use-reduced-motion`) — pick `behavior: prefersReducedMotion ? "auto" : "smooth"`.
- **Expected impact:** Reduced-motion contract honoured end-to-end.
- **Effort estimate:** S

#### UX-H3 Route-level error boundaries don't capture exceptions to Sentry
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/immersive/error.tsx:14-16`, `src/app/favorites/error.tsx:14-16`, `src/app/admin/error.tsx:14-16`
- **What's happening:** These route boundaries only `console.error` — never call `Sentry.captureException`. Root boundary never sees these errors (nearest-match). Sentry silent on the top user surfaces. (Exacerbated by DO-H2.)
- **Recommendation:** Add `Sentry.captureException(error)` in each route-level `error.tsx`, or factor a shared `RouteError` component.
- **Expected impact:** Real visibility into crashes on the most critical surfaces.
- **Effort estimate:** S

#### UX-H4 Top-right control cluster fails 44px tap target guideline on phones
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/bookmark-button.tsx:70`, `src/components/immersive/share-button.tsx:60`, `src/components/immersive/surprise-me-button.tsx:47`, `src/components/immersive/suggest-place-button.tsx:69`, `src/components/immersive/toolbar-overflow-menu.tsx:107`, `src/components/immersive/fullscreen-button.tsx:75`
- **What's happening:** Every nav-cluster button uses `p-2` + `h-5 w-5` icon = ~36×36px. Apple HIG / WCAG 2.2 AA Target Size requires ≥44×44 for primary controls.
- **Why it matters:** This cluster controls bookmarks (auth gating), share (viral loop), profile/sign-out, fullscreen. Mis-taps directly damage retention and conversion.
- **Recommendation:** Bump to `p-3` (44×44) or use `pointer:coarse` media query to increase padding on mobile.
- **Expected impact:** Fewer mis-taps on the most-used cluster.
- **Effort estimate:** S

#### UX-H5 `RelatedStories` chevron direction inverted versus expand/collapse convention
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/related-stories.tsx:48-52`
- **What's happening:** `isExpanded=true` shows `ChevronDown`; collapsed shows `ChevronUp`. Web convention (and rest of codebase, e.g., `category-filter-badge.tsx:107-111`) is the opposite.
- **Recommendation:** Swap chevrons or rotate-on-state as in the filter badge.
- **Effort estimate:** S

#### UX-H6 Live regions missing `role="alert"` on voice errors and mic permission denials
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat-elevenlabs.tsx:252-265,333-354`
- **What's happening:** Mic-permission warning and error display are static `<div>` blocks with no `aria-live` or `role="alert"`. Transcript region has no `aria-live`.
- **Why it matters:** AT users get no announcement of errors or agent speech.
- **Recommendation:** Add `role="alert"` to both banners; add `role="log" aria-live="polite"` to transcript wrapper.
- **Effort estimate:** S

#### UX-H7 Decorative `<main onClick>` is a non-accessible interactive toggle
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-viewer.tsx:229-237`
- **What's happening:** Root `<main>` landmark has `onClick` to toggle `showInfo` — no keyboard equivalent, no ARIA role signaling interactivity.
- **Recommendation:** Move click handler off `<main>` onto a dedicated transparent `<button>`, or remove it and rely on the `i` keyboard shortcut with a visible hint.
- **Effort estimate:** S

#### UX-M1 Two distinct dark backgrounds used inconsistently — visible flash on route transitions
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/error.tsx:23`, `src/app/loading.tsx:3`, `src/app/not-found.tsx:10` (`bg-black`), `src/app/pricing/page.tsx:33`, `src/app/favorites/page.tsx:91`, `src/app/about/page.tsx:11` (`bg-neutral-950`)
- **What's happening:** 26 files use `bg-black` (#000), 13 files use `bg-neutral-950` (#0a0a0a). `themeColor` in `layout.tsx:33` is a third value (#0a0f1a).
- **Recommendation:** Pick one; define `--bg-surface` and `--bg-immersive` tokens; update `themeColor` to match.
- **Effort estimate:** S

#### UX-M2 Brand color tokens (`paisaxe-blue/green/sand`) defined in Tailwind but never used
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `tailwind.config.ts:46-51` (definition; zero references in `src/**/*.tsx`)
- **Recommendation:** Either retire the tokens or apply them, replacing ad-hoc `green-500`/`amber-500` accents with brand tokens.
- **Effort estimate:** M

#### UX-M3 Four dead components in design system — unused alternative implementations
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-filters.tsx`, `src/components/auth/auth-button.tsx`, `src/components/immersive/favorite-button.tsx`, `src/components/immersive/skeleton-story-detail.tsx`
- **What's happening:** None are imported anywhere. Represent abandoned or superseded designs.
- **Recommendation:** Delete all four; unify on the "bookmark" metaphor in all remaining i18n keys.
- **Effort estimate:** S

#### UX-M4 `h-4.5 w-4.5` is not a valid Tailwind utility — silently ignored
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/chat-upsell-cta.tsx:61`
- **What's happening:** Default Tailwind doesn't include `4.5`; icon falls back to its intrinsic SVG size inside the `h-9 w-9` container expecting a specific size.
- **Recommendation:** Use `h-4 w-4` or extend Tailwind's spacing scale.
- **Effort estimate:** S

#### UX-M5 Stripe error messages surface raw API strings (English, technical) to users mid-checkout
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/pricing/checkout/page.tsx:42-50`, `src/components/immersive/suggest-place-dialog.tsx:67,82-83`
- **What's happening:** `setError(... err.message ...)` stores raw English API error strings shown to Spanish-speaking buyers.
- **Recommendation:** Always show a localized message; keep raw error in Sentry only. Map known Stripe error codes to user-friendly Spanish copy.
- **Effort estimate:** S

#### UX-M6 `voice-chat` and `story-progress-bar` use `key={i}` (index-as-key)
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/voice-chat.tsx:305`, `src/components/immersive/voice-chat-elevenlabs.tsx:339`, `src/components/immersive/story-progress-bar.tsx:153`
- **What's happening:** When messages mutate (retry replaces, error clears), React reuses DOM nodes incorrectly. *(Same root cause as FE-H2.)*
- **Recommendation:** Generate stable id at message creation (`crypto.randomUUID()`).
- **Effort estimate:** S

#### UX-M7 Author "typewriter" pill cycles English developer jokes on a Spanish tourism site
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/author-typewriter.tsx:19-31`
- **What's happening:** Cycles `"</> JG"`, `"npm run explore"`, `"works on my machine"`, `"bug free"` alongside translated phrases.
- **Why it matters:** Off-brand for a paying tourist audience; violates project's confident Spanish voice mandate.
- **Recommendation:** Drop the English/code-flavoured strings; keep the sidra/buen-camino set.
- **Effort estimate:** S

#### UX-M8 Pricing and checkout routes lack `error.tsx` and `loading.tsx`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `src/app/pricing/checkout/page.tsx` (no sibling `error.tsx`/`loading.tsx`), `src/app/about/page.tsx`, `src/app/story/[slug]/page.tsx`
- **What's happening:** Checkout failures bubble to the root `bg-black` boundary instead of staying within the checkout shell.
- **Recommendation:** Add `error.tsx` + `loading.tsx` to `/pricing/checkout` and `/pricing/checkout/return` reusing the `bg-neutral-950` layout.
- **Effort estimate:** S

#### UX-M9 Recurring "glassmorphism icon button" pattern copied verbatim in 10+ components instead of a Button variant
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-viewer.tsx:344-376`, `src/components/immersive/story-info-panel.tsx:115-139` (and 8+ more)
- **What's happening:** `p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:...` duplicated 10+ times. Zero `<Button>` components used in the immersive folder.
- **Recommendation:** Add `glass`/`glassIcon` variants to `src/components/ui/button.tsx`.
- **Effort estimate:** M

#### UX-M10 Progress bar segments 4px tall — poor touch affordance
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `src/components/immersive/story-progress-bar.tsx:160-163`
- **What's happening:** `flex-1 h-1` (4px) bars. On a 360px viewport with 20 segments, each is ~17×4px visible.
- **Recommendation:** Bump to `h-1.5`; enlarge to `h-2` on hover/focus. Increase inactive contrast from `bg-white/30` to `bg-white/40` on touch.
- **Effort estimate:** S

#### UX-L1 `role="region"` redundant on `<section aria-label>`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/related-stories.tsx:30-33`
- **Recommendation:** Remove `role="region"`.
- **Effort estimate:** S

#### UX-L2 `<img alt={story.title}>` repeats visible heading — screen readers announce twice
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/story-viewer.tsx:258`, `src/components/immersive/related-stories.tsx:76`, `src/app/favorites/page.tsx:236`
- **Recommendation:** Use `alt=""` on decorative hero images where the heading already conveys the content.
- **Effort estimate:** S

#### UX-L3 Clipboard fallback fails silently — no user feedback on copy failure
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/chat-actions.tsx:65-69`, `src/components/immersive/share-button.tsx:48-51`
- **Recommendation:** Show `t("chat.copy_failed")` toast/inline message on `catch`.
- **Effort estimate:** S

#### UX-S1 Two metaphors for "saved" content — bookmark vs heart vs favourite — pollutes the mental model
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `src/components/immersive/bookmark-button.tsx`, `src/components/immersive/favorite-button.tsx`, `src/app/favorites/page.tsx`, `src/lib/i18n/*.ts` (keys mix `favorites.save`, `favorites.saved_toast`, `favorites.bookmarks`, `favorites.remove_saved`)
- **Recommendation:** Pick one term in Spanish ("Guardados" with bookmark icon). Rename URL `/favorites` → `/guardados` or update copy to align. Remove `favorite-button.tsx`.
- **Effort estimate:** M

---

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|----|--------|--------|----------|--------------|--------|--------|
| BE-B1 | BE | Cron auth fails silently | launch-blocker | Before launch | S | Prevents silent pipeline halt |
| BE-B2 | BE | Stripe partial failure locks paid user out | launch-blocker | Before launch | M | Protects revenue and user trust |
| UX-B1 | UX | Mobile share URL is 404 | launch-blocker | Before launch | S | Restores viral loop |
| UX-B2 | UX | Hardcoded English on Spanish monetisation page | launch-blocker | Before launch | S | Conversion and trust |
| UX-B3 | UX | Pricing/CTA visual identity inconsistent | launch-blocker | Before launch | S | Checkout conversion |
| UX-B4 | UX | Voice-chat dialog missing aria-modal | launch-blocker | Before launch | S | AT accessibility contract |
| DO-H2 | DO | Sentry DSN unset — errors invisible | high | Before launch | S | Error visibility |
| SE-H2 | SE | Embedded checkout open redirect via Origin | high | Before launch | S | Payment security |
| BE-H2 | BE | Cookie-authenticated users get 401 | high | Before launch | S | Auth reliability |
| BE-H3 | BE | Marketing posts bypass Zod validation | high | Before launch | S | API integrity |
| BE-H1 | BE | Marketing agent unvalidated body | high | Before launch | S | Cost protection |
| SE-H1 | SE | 8 moderate npm audit vulnerabilities | high | Before launch | S | Dependency security |
| QA-H2 | QA | Authenticated e2e tests silently skip | high | Before launch | S | Revenue flow coverage |
| QA-H3 | QA | Visual regression cannot block merges | high | Before launch | S | Regression detection |
| QA-H1 | QA | Coverage thresholds never enforced | high | Before launch | S | Quality gate |
| DO-H1 | DO | Health endpoint 200-always contradicts docs | high | Before launch | S | Monitoring contract |
| FE-H1 | FE | Legal pages in client bundle | high | Before launch | S | LCP |
| FE-H2 | FE | Chat messages keyed by index | high | Before launch | S | Streaming quality |
| FE-H3 | FE | useFeatureFlags/useStories parallel singletons | high | Before launch | S | State correctness |
| FE-H4 | FE | StoryViewer Image prefetch leak + key flash | high | Before launch | S | Memory / UX |
| FE-H5 | FE | Admin shell searchParams ping-pong | high | Before launch | S | Admin render cost |
| FE-H6 | FE | analytics-cache render-time microtask | high | Before launch | S | Render correctness |
| AR-H1 | AR | Supabase clients untyped | high | Before launch | M | Schema safety |
| AR-H2 | AR | Logger migration incomplete | high | Before launch | M | Observability |
| BE-H4 | BE | Make-booking hung request poisons idempotency | high | Before launch | M | Booking reliability |
| BE-H5 | BE | Health always 200 | high | Before launch | S | Monitoring |
| BE-H6 | BE | Translation queue serial processing timeout | high | Before launch | M | Translation throughput |
| UX-H1 | UX | Mic permission on mount | high | Before launch | S | iOS reliability |
| UX-H2 | UX | Smooth scroll ignores reduced-motion | high | Before launch | S | Accessibility |
| UX-H3 | UX | Error boundaries don't capture to Sentry | high | Before launch | S | Error visibility |
| UX-H4 | UX | Control cluster tap targets too small | high | Before launch | S | Mobile usability |
| UX-H5 | UX | RelatedStories chevron direction inverted | high | Before launch | S | Interaction convention |
| UX-H6 | UX | Voice errors missing aria live regions | high | Before launch | S | AT accessibility |
| UX-H7 | UX | Non-accessible main onClick toggle | high | Before launch | S | Keyboard accessibility |
| DO-M1 | DO | .trim() bypass on auth paths | medium | Before launch | S | Auth resilience |
| BE-M1 | BE | Rate limit misleading in dev | medium | Before launch | S | Observability |
| BE-M5 | BE | Admin agent runner dev-gate only protection | medium | Before launch | S | Defense in depth |
| BE-M6 | BE | ElevenLabs booking non-atomic state | medium | Before launch | S | Data consistency |
| DO-M4 | DO | Stale ADMIN_SECRET_KEY env var | medium | Before launch | S | Secret hygiene |
| DO-M6 | DO | No database backup/restore procedure | medium | Before launch | M | Disaster recovery |
| PE-H1 | PE | ivfflat index untuned | high | Before launch | M | Chat recall/latency |
| PE-M3 | PE | next.config.ts no-store overrides route caching | medium | Before launch | S | CDN caching |
| PE-M6 | PE | Raw img tags in immersive viewport | medium | Before launch | S | CLS/LCP |
| QA-M1 | QA | logger-sanitize has no direct tests | medium | Before launch | M | PII safety |
| QA-M2 | QA | Stripe e2e only nightly | medium | Before launch | S | Revenue path coverage |
| SE-M1 | SE | Admin image SSRF | medium | Before launch | S | Security |
| SE-M2 | SE | CSRF allows no-header requests | medium | Before launch | M | CSRF defense |
| SE-M5 | SE | CSRF cookie secure gate inconsistent | medium | Before launch | S | Cookie security |
| UX-M1 | UX | Two dark background values | medium | Before launch | S | Route transition UX |
| UX-M2 | UX | Brand tokens defined but never used | medium | Before launch | M | Brand identity |
| UX-M3 | UX | Four dead components in design system | medium | Before launch | S | Design system hygiene |
| UX-M4 | UX | h-4.5 invalid Tailwind utility | medium | Before launch | S | Visual correctness |
| UX-M5 | UX | Stripe errors surface raw English to users | medium | Before launch | S | Checkout trust |
| UX-M6 | UX | voice-chat progress bar index keys | medium | Before launch | S | React correctness |
| UX-M7 | UX | Author typewriter English dev jokes | medium | Before launch | S | Brand voice |
| UX-M8 | UX | Pricing/checkout missing error.tsx | medium | Before launch | S | Error containment |
| DO-H3 | DO | Console lint ignore-list undermines logging | high | After launch | M | Structured logging |
| BE-M2 | BE | Admin auth double round-trips | medium | After launch | S | Admin latency |
| BE-M3 | BE | Service-role client recreated per call | medium | After launch | S | Webhook latency |
| BE-M4 | BE | Feature flags cache no Vary header | medium | After launch | S | Cache correctness |
| BE-M7 | BE | Suggestion POST no spam mitigation | medium | After launch | M | Spam prevention |
| PE-H2 | PE | Embedding cache in-process | high | After launch | M | Chat p50 latency |
| PE-H3 | PE | Search pipeline unnecessarily serialized | high | After launch | S | First-token latency |
| PE-H4 | PE | Anthropic SDK dynamic import per request | high | After launch | S | Chat cold-start |
| PE-M1 | PE | Streaming SSE on Node lambda | medium | After launch | M | Cold-start |
| PE-M5 | PE | Admin loads all stories no pagination | medium | After launch | M | Admin LCP |
| DO-M2 | DO | Cron jobs no telemetry | medium | After launch | M | Operational visibility |
| DO-M3 | DO | No regional failover plan | medium | After launch | S | Incident runbook |
| DO-M5 | DO | CI runtime gap on develop | medium | After launch | M | Regression detection |
| DO-M7 | DO | No log drain confirmed | medium | After launch | S | Log retention |
| FE-M1 | FE | voice-chat.tsx monolith | medium | After launch | M | Maintainability |
| FE-M2 | FE | admin-shell.tsx monolith | medium | After launch | M | Maintainability |
| FE-M3 | FE | Bespoke fetch-cache patterns duplicated | medium | After launch | L | Tech debt |
| FE-M4 | FE | Providers remounts AuthProvider on nav | medium | After launch | S | Auth flicker |
| FE-M5 | FE | PostHog provider reshapes tree on init | medium | After launch | S | State stability |
| FE-M6 | FE | Unconditional idle voice-chat prefetch | medium | After launch | S | Bandwidth |
| FE-M7 | FE | Manual SSE buffer parsing not abstracted | medium | After launch | M | Maintainability |
| AR-M4 | AR | proxy.ts re-exports for tests only | medium | After launch | S | Architecture |
| AR-M5 | AR | Hook imports type from route file | medium | After launch | S | Layering |
| SE-M3 | SE | Service-role bypasses RLS for reads | medium | After launch | M | Security hygiene |
| SE-M4 | SE | CSP unsafe-inline no SRI | medium | After launch | L | CSP hardening |
| SE-L2 | SE | Bearer precedence implicit | low | After launch | S | Auth contract |
| SE-L3 | SE | Stripe API version unpinned | low | After launch | S | Stability |
| QA-M3 | QA | Data pipeline scripts untested | medium | After launch | M | Pipeline safety |
| QA-L1 | QA | No test.skip lint rule | low | After launch | S | Test hygiene |
| BE-L1 | BE | console.* in API routes | low | After launch | S | Observability |
| BE-L2 | BE | Stripe unrecoverable events no audit trail | low | After launch | S | Payment audit |
| AR-L1 | AR | Three outdated minor deps | low | After launch | S | Vendor parity |
| AR-L2 | AR | Two moderate audit findings | low | After launch | S | Dep security |
| DO-L1 | DO | npm audit only at high level | low | After launch | S | Security |
| UX-M9 | UX | Glassmorphism button pattern not abstracted | medium | After launch | M | Design system |
| UX-M10 | UX | Progress bar too small | medium | After launch | S | Touch usability |
| UX-L1 | UX | role=region redundant | low | After launch | S | ARIA hygiene |
| UX-L2 | UX | alt text repeats visible heading | low | After launch | S | AT duplication |
| UX-L3 | UX | Clipboard failure silent | low | After launch | S | Micro-interaction |
| BE-L3 | BE | Duplicate validation in chat routes | low | Later | M | Tech debt |
| BE-S1 | BE | No dedicated background worker | strategic | Later | L | Architecture |
| AR-M1 | AR | preserveSymlinks: true undocumented | medium | Later | S | Dev stability |
| AR-M2 | AR | Empty src/services/ directory | medium | Later | S | Architecture |
| AR-M3 | AR | Dead agentConfigUpdateSchema export | medium | Later | S | Dead code |
| AR-S1 | AR | Flat src/lib/ lacks layering | strategic | Later | M | Architecture |
| AR-S2 | AR | Optional TS strict flags not enabled | strategic | Later | M | Type safety |
| DO-L2 | DO | withTimeout leaks promise | low | Later | S | Reliability |
| DO-S1 | DO | Solo escalation single point of failure | strategic | Later | S | Operational risk |
| FE-L1 | FE | console.* in client components | low | Later | S | Observability |
| FE-L2 | FE | navigator.standalone any cast | low | Later | S | Type safety |
| FE-L3 | FE | Share URL duplication | low | Later | S | Consolidation |
| FE-S1 | FE | No state management library | strategic | Later | L | Architecture |
| PE-M2 | PE | Curl-spawn dev/prod parity gap | medium | Later | S | Maintainability |
| PE-M4 | PE | Marketing dashboard JS aggregation | medium | Later | M | Admin performance |
| PE-M7 | PE | Sentry sourcemap on every build | medium | Later | S | Build cost |
| PE-L1 | PE | setInterval 1s for elapsed timer | low | Later | S | Battery |
| PE-L2 | PE | story/[slug] prerender for redirect | low | Later | S | Build cost |
| PE-L3 | PE | console.* on chat hot path | low | Later | S | Observability |
| PE-L4 | PE | EmbeddingCache SHA-256 overhead | low | Later | S | Micro-latency |
| PE-S1 | PE | Single-region p95 RTT | strategic | Later | S | Observability |
| QA-M3 | QA | Pipeline scripts untested | medium | After launch | M | Data safety |
| SE-L1 | SE | Child process full env exposure | low | Later | S | Secret hygiene |
| SE-S1 | SE | Single admin role | strategic | Later | L | RBAC |
| UX-S1 | UX | Bookmark vs favourite metaphor conflict | strategic | Later | M | Brand voice |

---

## 13. Top 10 Highest-ROI Improvements

**1. BE-B2 — Fix Stripe partial-failure path (Blocker, M effort)**
Reconciliation cron + RPC atomicity test protects the only revenue stream. A paying user permanently locked out is a chargeback waiting to happen. Every €1.99 at risk until fixed.

**2. UX-B1 + FE-L3 — Fix mobile share URL (Blocker, S effort)**
The primary viral loop is completely broken on mobile. Share from overflow → 404. A one-line fix (`/stories/${id}` → `/story/${slug}`) restores the most cost-effective acquisition channel. Bundle with BE-H5/DO-H1 (health endpoint 200/503 fix) for a single session.

**3. DO-H2 — Enable Sentry DSN (Blocker-adjacent High, S effort)**
The entire error-reporting stack is dark. Every exception on a live, paying-user site goes unreported. Turn this on immediately — it costs nothing and unlocks all other observability investments.

**4. UX-B2 + UX-B3 — Localise copy + unify CTA palette (Blockers, S effort)**
Two 30-minute fixes on the checkout funnel. English "Voice Pass · 24h" and a colour-identity split directly depress conversion. High ROI because they're S effort on the highest-revenue page.

**5. BE-H2 — Fix `getUserFromRequest` to use cookies (High, S effort)**
Cookie-authenticated users 401ing on `/api/favorites` and `/api/voice-access` is a logged-in UX breakage. One-liner fix; large user-visible impact.

**6. SE-H2 — Fix embedded checkout open redirect (High, S effort)**
Mirror two lines from `day-pass/route.ts`. Closes an open redirect on the Stripe post-payment flow. Payment security finding on a live revenue path.

**7. QA-H2 — Add auth credentials to `e2e.yml` (High, S effort)**
16 authenticated e2e tests silently skip on every PR — the entire monetised user journey has zero PR-time coverage. Add two GitHub secrets and remove one conditional.

**8. PE-H1 — Tune vector index to HNSW (High, M effort)**
Chat recall and p95 latency improve as the corpus grows. This is the single biggest architectural risk to the core product experience as content scales. M effort but only a single migration file.

**9. AR-H1 — Generate Supabase TypeScript types (High, M effort)**
91 `.from()` queries are typed as `any`. The project invests heavily in TypeScript strictness — this closes the biggest single gap in one `supabase gen types` command + parameterizing the client factories.

**10. DO-M1 — Fix direct `process.env.SUPABASE_*!` reads on auth paths (Medium, S effort)**
A stray Vercel newline on the Supabase URL breaks Google OAuth callback invisibly. The `.trim()` utility exists for exactly this reason. Replace 4 bare reads with the existing `getSupabaseUrl()`/`getSupabaseAnonKey()` helpers.

---

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- BE-B1: Cron auth fails silently — halts translation pipeline
- BE-B2: Stripe partial failure permanently locks paid user out
- UX-B1: Mobile share URL is 404
- UX-B2: Hardcoded English on Spanish monetisation page
- UX-B3: Pricing/CTA visual identity inconsistent
- UX-B4: Voice-chat dialog missing aria-modal
- DO-H2: Sentry DSN unset — production errors invisible
- DO-H1: Health endpoint 200-always contradicts docs
- DO-M1: .trim() bypassed on auth paths
- DO-M4: Stale ADMIN_SECRET_KEY env var
- DO-M6: No documented database backup/restore
- SE-H1: 8 moderate npm audit vulnerabilities
- SE-H2: Embedded checkout open redirect
- SE-M1: Admin image SSRF
- SE-M2: CSRF allows no-header requests
- SE-M5: CSRF cookie secure gate inconsistent
- QA-H1: Coverage thresholds never enforced
- QA-H2: Authenticated e2e tests silently skip
- QA-H3: Visual regression cannot block merges
- QA-M1: logger-sanitize has no direct tests
- QA-M2: Stripe e2e only nightly
- FE-H1: Legal pages forced into client bundle
- FE-H2: Chat messages keyed by array index
- FE-H3: useFeatureFlags/useStories parallel singletons
- FE-H4: StoryViewer Image prefetch leak + key flash
- FE-H5: Admin shell searchParams ping-pong
- FE-H6: analytics-cache render-time microtask
- AR-H1: Supabase clients untyped
- AR-H2: Logger migration incomplete
- AR-M1: preserveSymlinks: true undocumented
- AR-M2: Empty src/services/ directory
- AR-M3: Dead agentConfigUpdateSchema export
- BE-H1: Marketing agent unvalidated body
- BE-H2: Cookie-auth users get 401
- BE-H3: Marketing posts bypass Zod
- BE-H4: Make-booking hung request
- BE-H5: Health always 200
- BE-H6: Translation queue serial timeout
- BE-M1: Rate limit misleading dev fallback
- BE-M5: Admin agent runner dev-gate only
- BE-M6: ElevenLabs booking non-atomic
- PE-H1: ivfflat index untuned
- PE-M3: next.config.ts no-store overrides caching
- PE-M6: Raw img tags in immersive viewport
- UX-H1: Mic permission on mount
- UX-H2: Smooth scroll ignores reduced-motion
- UX-H3: Error boundaries don't capture to Sentry
- UX-H4: Control cluster tap targets too small
- UX-H5: RelatedStories chevron inverted
- UX-H6: Voice errors missing aria live regions
- UX-H7: Non-accessible main onClick toggle
- UX-M1: Two dark background values
- UX-M2: Brand tokens never used
- UX-M3: Four dead components
- UX-M4: h-4.5 invalid Tailwind utility
- UX-M5: Stripe errors surface raw English
- UX-M6: index-as-key in voice-chat
- UX-M7: Author typewriter English dev jokes
- UX-M8: Pricing/checkout missing error.tsx

### After launch (Wave 2)
- DO-H3: Console lint ignore-list undermines logging
- DO-M2: Cron jobs lack telemetry
- DO-M3: No regional failover documentation
- DO-M5: CI runtime gap on develop
- DO-M7: No log drain confirmed
- DO-L1: npm audit only at high level
- BE-M2: Admin auth double round-trips
- BE-M3: Service-role client recreated per call
- BE-M4: Feature flags cache no Vary header
- BE-M7: Suggestion POST no spam mitigation
- BE-L1: console.* in API routes
- BE-L2: Stripe unrecoverable events no audit trail
- PE-H2: Embedding cache in-process
- PE-H3: Search pipeline unnecessarily serialized
- PE-H4: Anthropic SDK dynamic import per request
- PE-M1: Streaming SSE on Node lambda
- PE-M5: Admin loads all stories no pagination
- FE-M1: voice-chat.tsx monolith
- FE-M2: admin-shell.tsx monolith
- FE-M3: Bespoke fetch-cache patterns duplicated
- FE-M4: Providers remounts AuthProvider on nav
- FE-M5: PostHog provider reshapes tree on init
- FE-M6: Unconditional idle voice-chat prefetch
- FE-M7: Manual SSE buffer parsing not abstracted
- AR-M4: proxy.ts re-exports for tests only
- AR-M5: Hook imports type from route file
- AR-L1: Three outdated minor deps
- AR-L2: Two moderate audit findings
- SE-M3: Service-role bypasses RLS for reads
- SE-M4: CSP unsafe-inline no SRI
- SE-L2: Bearer precedence implicit
- SE-L3: Stripe API version unpinned
- QA-M3: Data pipeline scripts untested
- QA-L1: No test.skip lint rule
- UX-M9: Glassmorphism button not abstracted
- UX-M10: Progress bar too small
- UX-L1: role=region redundant
- UX-L2: alt text repeats visible heading
- UX-L3: Clipboard failure silent

### Later / strategic (Wave 3)
- BE-L3: Duplicate validation in chat routes
- BE-S1: No dedicated background worker
- AR-S1: Flat src/lib/ lacks layering
- AR-S2: Optional TS strict flags not enabled
- DO-L2: withTimeout leaks promise
- DO-S1: Solo escalation single point of failure
- FE-L1: console.* in client components
- FE-L2: navigator.standalone any cast
- FE-L3: Share URL duplication (root cause fixed by UX-B1)
- FE-S1: No state management library decision
- PE-M2: Curl-spawn dev/prod parity gap
- PE-M4: Marketing dashboard JS aggregation
- PE-M7: Sentry sourcemap on every build
- PE-L1: setInterval 1s for elapsed timer
- PE-L2: story/[slug] prerender for redirect
- PE-L3: console.* on chat hot path
- PE-L4: EmbeddingCache SHA-256 overhead
- PE-S1: Single-region p95 RTT observability
- SE-L1: Child process full env exposure
- SE-S1: Single admin role, no fine-grained RBAC
- UX-S1: Bookmark vs favourite metaphor conflict

---

## 15. Open Questions / Assumptions

**Assumptions made during the audit:**
- Sentry DSN is not set in Vercel production env vars (inferred from `.env.example`). If it is, DO-H2 severity downgrades. User should verify via `vercel env ls`.
- `ADMIN_SECRET_KEY` was never an active credential. If it was, it needs immediate rotation before removal.
- The Supabase project is on Pro tier with PITR enabled (assumed from memory notes). If on Free tier, DO-M6 timeline becomes critical.
- `grant_day_pass_idempotent` is assumed to NOT automatically roll back the dedup row on `voice_purchases` insert failure. A code review of the RPC body would confirm or downgrade BE-B2.
- ivfflat index `lists=100` was set before the dimension reduction migration — the corpus size at that time is unknown. If current corpus is < 10k rows, recall is acceptable; if > 100k, it's degraded now.
- Log drain is not active (inferred from `pending-setup.md` and `logging.md` wording). User should confirm in Vercel dashboard.
- The `e2e-stripe-integration.yml` cron does inject Stripe secrets — assumed from the workflow structure, not verified.

**Missing context that limited stronger conclusions:**
- Actual production error rate and Sentry event volume (can't be verified without DSN access).
- Supabase project tier and current database size (affects DO-M6 urgency and PE-H1 impact).
- Whether PostHog funnels are configured for the pricing flow (affects conversion risk assessment for UX-B3).
- Whether `CRON_SECRET` is set in Vercel production (affects BE-B1 urgency — could be urgent or already working).

**Questions for the human before remediation starts:**
1. Is Sentry configured in Vercel? (`vercel env ls | grep SENTRY`)
2. Is `CRON_SECRET` set in Vercel? Have the crons been running successfully?
3. Was `ADMIN_SECRET_KEY` ever used as a live credential? If so, rotate before deleting.
4. Is the Supabase database on Pro tier with PITR enabled?
5. Is a log drain currently active in Vercel → Settings → Log Drains?
6. What is the current chunk count in the `chunks` table? (Determines ivfflat urgency.)
7. Has the embedded checkout ever been used in production? (Determines SE-H2 exposure window.)

---

## 16. Final Verdict

**Verdict: NOT READY**

**What would most worry me about shipping today?**
A paying user hits the Stripe webhook partial-failure path (BE-B2) — they pay, don't receive their day pass, and every retry silently returns "duplicate" with no recovery. Combined with Sentry being dark (DO-H2), this failure is invisible until the user contacts support. The second equally concerning risk is the mobile share URL returning 404 (UX-B1) — every piece of organic social content shared from a phone is dead on arrival.

**What gives me confidence?**
The test foundation is genuinely strong: 6,117 passing tests, 53/53 API routes covered, and a real TDD culture that prevents regressions. The idempotency infrastructure (advisory locks, SECURITY DEFINER RPCs, durable job queues) is production-grade. The proxy pipeline, CSRF/CORS handling, and runbook documentation show operational maturity. None of the blockers are architectural rewrites — they're targeted fixes.

**Next 5 actions (ordered):**
1. **Fix BE-B2** (add regression test for `grant_day_pass_idempotent` rollback + reconciliation cron) — protects revenue.
2. **Fix UX-B1 + DO-H2 + SE-H2 in one session** (share URL, Sentry DSN, checkout open redirect) — all S effort, max blast radius reduction.
3. **Fix UX-B2 + UX-B3 + UX-B4 + UX-H1–H7** (brand/language/accessibility blockers and highs) — all S effort, clears UX blocker class.
4. **Fix BE-B1 + BE-H2 + QA-H2** (cron auth observability, getUserFromRequest cookie fallback, auth e2e secrets) — closes the observability and auth gap.
5. **Run `/remediate` Wave 1** — once blockers are clear and the full list of Before Launch findings is resolved, run the remediation skill to drive Wave 1 to completion and move the verdict to CONDITIONAL.
