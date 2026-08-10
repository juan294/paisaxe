# Pre-Launch Codebase Audit
> Generated on 2026-06-20 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

## 1. Executive Summary

Paisaxe is a notably mature pre-launch codebase: the full test suite is green (371 files / 6788 tests), TypeScript strict typecheck passes across all four tsconfig projects, ESLint is clean at `--max-warnings=0`, `npm audit` reports zero vulnerabilities, Madge reports zero circular dependencies across 737 files, and Knip reports a single unused export. The architecture is cleanly layered (proxy → route → lib → data) with disciplined code splitting, idempotent webhooks, signature verification, and timeout discipline on every external fetch. However, this audit is in critic mode and assumes public launch under load — and it found **one launch-blocker**: paid weekly/monthly passes are silently under-delivered as 24-hour day passes (BE-B1), a paid-product-not-delivered bug that fires on the first non-day-pass purchase. Several high-severity items round out the must-fix list around abandoned billable voice sessions, silent failure UX, rate-limit bypass, false-failed bookings, missing server-side error capture, and brand/pricing inconsistency on the conversion funnel.

**Top 3 strengths (evidence-backed):**
1. **Test & type discipline** — 6788 passing tests, 95%/90% coverage gates, 4-project strict typecheck, zero `.skip`/`.only`/`.todo` (QA Domain Model).
2. **Clean architecture & boundaries** — zero circular deps, zero unused files, layered modules, three deliberately-separated Supabase clients, secret choke-point in `env.ts` (AR Domain Model).
3. **Security posture** — 0 npm vulns, all 49 privileged routes guarded, constant-time secret checks, RLS on 25 tables, SECURITY DEFINER functions with explicit `search_path`, strict CORS + CSRF (SE summary).

**Top 5 risks (by blast radius):**
1. **BE-B1** — Paid weekly/monthly passes delivered as 24h day passes (revenue/refund/chargeback + trust).
2. **FE-H1** — Voice sessions + mic never torn down on dialog close (runaway billing + privacy red flag).
3. **DO-H1** — Server-side route/RSC errors never reach Sentry (blind to launch-load failures).
4. **BE-H1** — Rate-limit `"unknown"` bucket enables self-DoS / billing amplification on the expensive chat path.
5. **UX-H2** — Upsell CTAs hardcode €1.99 and bypass tier selection (direct conversion/revenue leak).

**Verdict: NOT READY** — One launch-blocker (BE-B1) plus seven Before-launch high-severity findings must be resolved. The foundation is strong; the blockers are specific and fixable.

## 2. System Architecture Overview

Next.js 16 App-Router monolith in clean horizontal layers: a request-interception layer (`src/proxy.ts` delegating to nine focused handlers in `src/lib/proxy/` — canonical-domain, CSP, CORS, CSRF, auth-refresh, maintenance, request-id, story-rewrite, root-redirect); 57 API route handlers under `src/app/api/` acting as thin orchestrators over a 109-module domain library in `src/lib/`; a shared-types layer (`src/types/`); a presentation layer (108 components, 18 hooks); and an AI-agents layer (`src/agents/`, `src/lib/services/`, `src/lib/platforms/`). Data access is split across three Supabase clients — browser singleton, SSR auth, service-role admin — with secrets centralized behind `env.ts`. Flow is unidirectional (proxy → route → lib → supabase/external-API) with no cross-domain back-references and zero circular dependencies.

## 3. End-to-End Flow Analysis

- **Chat/RAG (public):** query → Voyage embedding (24h Redis cache) → Supabase `match_chunks` HNSW vector search → `rerank-2.5` (2.5s timeout) → Claude streaming, gated by per-stage timeouts + IP rate-limiting (Upstash, in-memory fallback, fail-closed in prod). AI stack is dynamically imported only after validation passes.
- **Payments:** `/api/checkout/*` → Stripe Checkout (tier in `session.metadata.purchase_type`) → `/api/webhooks/stripe` → `grant_day_pass_idempotent` RPC → time-boxed `voice_purchases`. **Break:** webhook ignores the tier metadata (BE-B1).
- **Voice booking:** ElevenLabs MCP tools (`/api/mcp/*`, secret-gated) claim a `pending_bookings` row → outbound Twilio call → reconcile via `/api/webhooks/elevenlabs` → idempotent RPCs + `booking_sms_jobs` outbox. **Risk:** 15s timeout can mark a placed call as failed (BE-H2).
- **Integration/boundary risks:** server-only guard missing on the two highest-value secret modules (AR-M1); server-side errors not captured by Sentry (DO-H1); upsell CTAs deep-link to checkout without a tier (UX-H2).

## 4. Frontend / UI Findings (Staff Frontend Engineer)

#### FE-H1 Voice (ElevenLabs) session and mic stream are not torn down on unmount
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/voice-chat-elevenlabs.tsx:174-254 (only effect is scroll; `endSession` only via button onClick at 349); src/app/immersive/immersive-page-content.tsx:251-263 (chat conditionally rendered on `chatOpen`, so closing unmounts the subtree)
- **What's happening:** No `useEffect` cleanup calls `endSession()`/stops the `getUserMedia` tracks on unmount. Closing the chat dialog leaves the WebSocket session and mic stream alive.
- **Why it matters:** Lingering billable ElevenLabs sessions that scale with traffic, a stuck browser mic indicator (privacy/trust), and possible audio after close.
- **Recommendation:** Add an unmount cleanup effect calling `endSession()` and `mediaStream.getTracks().forEach(t => t.stop())`. Verify the SDK releases the mic on `endSession`; retain the `MediaStream` from line 192 if not.
- **Expected impact:** Eliminates abandoned billable sessions and stuck mic indicators.
- **Effort estimate:** S

#### FE-H2 No user-visible feedback on chat stream timeout / connection loss
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/hooks/use-stream-chat.ts:80 (60s AbortController timeout), :196-197/:221 (AbortError silently swallowed); src/components/immersive/voice-chat-elevenlabs.tsx:130-157 (no reconnect path)
- **What's happening:** On timeout/abort the spinner simply stops with no error banner; voice has no explicit disconnect/reconnect feedback.
- **Why it matters:** On flaky mobile networks the core interaction silently dead-ends, reading as "broken."
- **Recommendation:** Surface a distinct actionable state via the existing `ChatErrorBanner` ("Se perdió la conexión. Reintentar"); differentiate 401/5xx/timeout; add `onError`/`onDisconnect` for voice.
- **Expected impact:** Recoverable, comprehensible failure states on the most-used surface.
- **Effort estimate:** M

#### FE-M1 Context provider values constructed without useMemo
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/components/auth/auth-provider.tsx:178-184; src/hooks/use-feature-flags.ts:187-195,209-211; src/hooks/use-stories.ts:289-295,303-305 (contrast src/lib/i18n/provider.tsx:96-99 which memoizes)
- **What's happening:** Three providers build their context `value` as a fresh object literal each render, re-rendering all consumers including the heavy `StoryViewer`.
- **Why it matters:** Latent re-render debt on a heavy consumer tree.
- **Recommendation:** Wrap each provider `value` in `useMemo` keyed on real deps.
- **Expected impact:** Removes unnecessary re-renders; consistency.
- **Effort estimate:** S

#### FE-M2 SSE reader lock not released on the abort/error path
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/hooks/use-sse-stream.ts:36-81 (`getReader()` with no `releaseLock`/`cancel` in `finally`)
- **What's happening:** On abort/decode-error the reader lock is left held and the body stream not cancelled.
- **Why it matters:** Repeated aborts can leave dangling readers/streams under load.
- **Recommendation:** Add `finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }`.
- **Expected impact:** Deterministic resource release on every exit path.
- **Effort estimate:** S

#### FE-M3 Chat message list re-renders/re-scrolls in full on every token; 20-turn cap not enforced client-side
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/voice-chat/chat-message-list.tsx:36-40,55-56; src/hooks/use-stream-chat.ts:39; src/lib/chat-safety.ts:10
- **What's happening:** Each streamed token re-renders the whole list and calls `scrollIntoView`; the 20-turn guideline isn't enforced in the client send path.
- **Why it matters:** Jank on low-end mobile during streaming of the core output.
- **Recommendation:** `React.memo` message rows; guard `scrollIntoView` to near-bottom; enforce the 20-turn cap with a graceful prompt.
- **Expected impact:** Smoother streaming; aligns client with safety guideline.
- **Effort estimate:** M

#### FE-M4 i18n locale resolves post-hydration → flash of Spanish for non-Spanish users
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/lib/i18n/provider.tsx:56-68 (SSR + first client render hardcode `'es'`, then `resolveLocale()` in effect), :71-80 (lazy translation load)
- **What's happening:** Non-Spanish visitors see Spanish on first paint, then a full re-translate.
- **Why it matters:** Wrong-language first paint + visible flip for the international audience.
- **Recommendation:** Resolve locale server-side from `Accept-Language`/cookie and pass `initialLocale` (provider already supports it).
- **Expected impact:** Correct-language first paint; removes flash.
- **Effort estimate:** M

#### FE-L1 Very low use of component memoization across 99 client components
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** repo-wide (only 2 of ~99 use `React.memo`); src/components/immersive/story-viewer.tsx:308-353 (inline arrow props)
- **What's happening:** Most presentational children aren't memoized and receive fresh closures, re-rendering on each story swipe.
- **Why it matters:** Can erode 60fps swipe on low-end devices.
- **Recommendation:** Profile the swipe; memoize the heaviest children and stabilize their callbacks. Don't blanket-memo.
- **Expected impact:** Marginal swipe smoothness.
- **Effort estimate:** M

#### FE-L2 `Math.random()` evaluated in `useRef` initializer on every render
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/app/immersive/immersive-page-content.tsx:74
- **What's happening:** `useRef(Math.random())` runs the expression each render though only the first value is kept.
- **Why it matters:** Trivial wasted work in the hot render path; confusing pattern.
- **Recommendation:** Use lazy init (`useRef<number>(null)` + set once) or `useMemo`.
- **Expected impact:** Negligible perf; clarity.
- **Effort estimate:** S

## 5. Backend / API / Data Findings (Staff Backend Engineer)

#### BE-B1 Stripe webhook hardcodes `day_pass`, under-delivering every paid weekly/monthly pass
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:73; src/lib/stripe.ts:114-124,148-163; supabase/migrations/095_stripe_webhook_audit_shape.sql:43-101 (and 084_fix_grant_day_pass_atomicity.sql:79)
- **What's happening:** Checkout records the chosen tier in `session.metadata.purchase_type` and charges correctly, but the webhook calls `calculateExpiryDate("day_pass")` with a hardcoded literal and the grant RPC inserts `purchase_type` hardcoded to `'day_pass'`. A €9.99 30-day purchase yields 24h of access and a wrong ledger entry.
- **Why it matters:** Paid product not delivered — revenue/refund/chargeback liability and trust problem on a live site; fires on the first weekly/monthly purchase (tiers actively sold per #137/#441).
- **Recommendation:** Read+validate `session.metadata.purchase_type`, pass it to `calculateExpiryDate`, add a `p_purchase_type` parameter to `grant_day_pass_idempotent`. Add a regression test asserting `weekly_pass` → 7-day expiry and correct `purchase_type`.
- **Expected impact:** Correct fulfillment for all three tiers; accurate ledger.
- **Effort estimate:** S

#### BE-H1 `getClientIp` collapses all un-headered clients into one shared `"unknown"` rate-limit bucket
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/lib/request-utils.ts:29; src/app/api/chat/stream/route.ts:49-50; src/app/api/chat/route.ts:47-48
- **What's happening:** Missing forwarded-for headers → constant `"unknown"` key shared by all such requests on the expensive, auth-less chat path.
- **Why it matters:** Shared-bucket self-DoS, or unlimited Claude/Voyage calls by omitting the header (billing amplification).
- **Recommendation:** Treat a missing `x-vercel-forwarded-for` (the only non-spoofable source on Vercel) as untrusted — fail closed (429) or use a stricter shared limiter; log/metric the path.
- **Expected impact:** Removes self-DoS and header-omission bypass.
- **Effort estimate:** S

#### BE-H2 Voice-booking timeout marks booking `failed` while the call may have actually been placed
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/lib/services/elevenlabs-call-service.ts:70-83; src/app/api/mcp/make-booking/route.ts:236-317; src/app/api/webhooks/elevenlabs/route.ts:143-166; src/app/api/cron/fail-stale-bookings/route.ts:19-28
- **What's happening:** On a 15s timeout the row is marked `failed` before `conversation_id` is persisted, so the later genuine webhook can't match it (returns 200/ignored); the stale-booking cron only rescues `initiating` rows.
- **Why it matters:** A real Twilio call happened but the system records failure and drops the outcome — wrong customer-facing results under upstream latency.
- **Recommendation:** On timeout/abort specifically, leave the row `initiating` (or a `degraded` state the cron understands), or persist a deterministic correlation id before the call.
- **Expected impact:** Eliminates false-failed bookings; closes the dropped-webhook gap.
- **Effort estimate:** M

#### BE-M1 Cron POST handlers fall back to admin-cookie auth without logging the fallback
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/cron/fail-stale-bookings/route.ts:67-73 (pattern across cron POST handlers)
- **What's happening:** Webhook-secret failure silently falls through to admin auth with no log.
- **Why it matters:** A misconfigured/rotated `WEBHOOK_SECRET` stays invisible until it breaks.
- **Recommendation:** `logger.warn("[CRON_AUTH_FALLBACK]", ...)` when webhook-secret fails but admin succeeds.
- **Expected impact:** Misconfigured cron auth becomes observable.
- **Effort estimate:** S

#### BE-M2 SMS-completion RPC failures after a successful send are logged but never retried
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/elevenlabs/route.ts:332-347
- **What's happening:** If `complete_booking_sms_job` errors after `sendSMS` succeeds, the job stays `processing` and may be re-claimed → duplicate SMS.
- **Why it matters:** Silent data divergence + duplicate-SMS risk.
- **Recommendation:** Retry the completion RPC with bounded backoff, or persist `provider_sid`/`outcome_message` in the same transaction; surface the failure to alerting.
- **Expected impact:** Removes orphaned-`processing` window and duplicate-SMS risk.
- **Effort estimate:** M

#### BE-M3 GitHub-traffic retention deletes filter on `fetched_at` with no confirmed index
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/app/api/cron/github-traffic-sync/route.ts (retention delete on `github_traffic_referrers`/`github_traffic_paths` by `fetched_at`); no matching index in supabase/migrations
- **What's happening:** Unindexed `.lte("fetched_at", cutoff)` delete → sequential scan + table lock as data grows.
- **Why it matters:** Silent degradation/contention over months.
- **Recommendation:** `CREATE INDEX IF NOT EXISTS ... (fetched_at)` for both tables; verify with EXPLAIN.
- **Expected impact:** Index-driven deletes that don't contend with reads.
- **Effort estimate:** S

#### BE-M4 `subscription-optimizer` shared-context file is read-modify-written with no locking
- **Severity:** medium
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/app/api/cron/subscription-optimizer/route.ts (read → prepend → write)
- **What's happening:** No advisory lock / atomic rename; concurrent runs can clobber; Vercel FS is ephemeral anyway.
- **Why it matters:** Lost-update on the agent context file.
- **Recommendation:** Gate behind the cron lease only, use atomic write (temp + rename), or move state to Postgres.
- **Expected impact:** No lost updates.
- **Effort estimate:** S

#### BE-L1 `favoritesPostSchema` accepts an unbounded array of UUIDs
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/lib/schemas.ts:117-121; src/app/api/favorites/route.ts:67-74
- **What's happening:** `storyIds` is `.min(1)` with no `.max()`, upserted in one statement.
- **Why it matters:** A single request can produce a very large upsert.
- **Recommendation:** Add `.max(200)` (or similar).
- **Expected impact:** Bounds per-request write size.
- **Effort estimate:** S

#### BE-L2 Stripe webhook RPC call has no client-side timeout
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/app/api/webhooks/stripe/route.ts:76-83
- **What's happening:** `supabase.rpc("grant_day_pass_idempotent", …)` awaited with no timeout.
- **Why it matters:** A hung DB connection blocks the handler to the platform limit (correctness preserved via Stripe retry + idempotency).
- **Recommendation:** Wrap in a ~10s `Promise.race` timeout, return 500 on timeout.
- **Expected impact:** Faster failure, no held connections.
- **Effort estimate:** S

## 6. Performance and Scalability Findings (Performance Engineer)

#### PE-M1 Full multi-locale translation payload for all stories ships to every immersive landing
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/types/immersive.ts:193 (`PUBLIC_STORY_SELECT` includes `metadata`), :82-83 (translations in metadata), src/lib/localize-story.ts:25, src/lib/stories-server.ts:62, src/app/immersive/immersive-page-content.tsx:38-49
- **What's happening:** The public query selects the whole `metadata` JSON (5 non-Spanish locales × ~73 stories) and hydrates it all into the client though one locale is viewed.
- **Why it matters:** ~6× redundant payload on the most-trafficked, LCP-sensitive route.
- **Recommendation:** Resolve only the active locale server-side (drop `translations` from `PUBLIC_STORY_SELECT`), or lazy-fetch per-locale on switch.
- **Expected impact:** Smaller RSC/HTML + client heap; faster mobile hydration.
- **Effort estimate:** M

#### PE-M2 Proxy matcher runs auth/CSP/CSRF on all API routes including high-frequency SSE
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/proxy.ts:77-85 (matcher), :60-72 (refresh+CSP+CSRF per match), src/lib/proxy/auth-refresh.ts:90-160
- **What's happening:** Middleware runs for every `/api/*` including `/api/chat/stream` and `/api/feature-flags`; CSP/CSRF cookie work is irrelevant to SSE.
- **Why it matters:** Per-request overhead on the hottest API paths at scale.
- **Recommendation:** Narrow the matcher or add an early `/api/` fast-path that skips CSP/CSRF-cookie steps. Verify against CSRF tests.
- **Expected impact:** Lower p50/p95 on the two highest-frequency routes.
- **Effort estimate:** M

#### PE-M3 PostHog + Sentry client bundle (~70KB gz) loads on the public landing page
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/layout.tsx:15 (`PostHogPageView` + `Providers` in root layout); build chunk `407cnfme6y1ex.js` (228.8KB/69.8KB gz); next.config.ts:18
- **What's happening:** Analytics+error-tracking chunk loads eagerly on first paint of the landing for every visitor.
- **Why it matters:** ~70KB gz of non-critical JS competes with hydration in the LCP window.
- **Recommendation:** Defer PostHog init to post-interaction/`requestIdleCallback`; confirm Sentry client lazy-loads. `PostHogPageView` capture can be deferred.
- **Expected impact:** Faster interactive/hydration on landing.
- **Effort estimate:** M

#### PE-L1 ElevenLabs/LiveKit deferred chunk is a single 591KB (147KB gz) monolith
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** chunk `37qcb34taif-j.js` (605KB/147KB gz); src/components/immersive/voice-chat.tsx:46-54 (correct `dynamic(ssr:false)`)
- **What's happening:** Correctly lazy-loaded for entitled users, but one large chunk must download before the voice UI appears.
- **Why it matters:** Noticeable first-open stall on mobile for paying users; not a general-traffic concern.
- **Recommendation:** Optional/post-launch only — investigate further tree-shaking/splitting of livekit-client.
- **Expected impact:** Faster first voice-mode open.
- **Effort estimate:** L

#### PE-L2 Public feature-flags route uses `select("*")` and refetches per environment
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/app/api/feature-flags/route.ts:50 (`.select("*")`), :63-70 (cache headers)
- **What's happening:** Selects all columns (including `config` later scrubbed) rather than `flag_key, enabled`. Bounded by 60s + SWR cache.
- **Why it matters:** Minor over-fetch on a route polled by every client.
- **Recommendation:** Narrow the select to columns returned after `scrubSensitiveConfig`.
- **Expected impact:** Smaller cache-miss payload, slightly less CPU.
- **Effort estimate:** S

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

#### DO-H1 Sentry misses server-side route handler / RSC errors — no `onRequestError` hook
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/instrumentation.ts:43-66 (no `onRequestError`); sentry.server.config.ts:1-13; repo-wide grep for `onRequestError`/`captureRequestError` = 0 hits
- **What's happening:** Next.js 15+/16 requires `export const onRequestError` for Sentry to capture unhandled Server Component / route handler / server action errors. It doesn't exist; server exceptions reach Pino/Vercel logs but not Sentry.
- **Why it matters:** Launch-load failures in chat/webhooks/voice/cron are invisible in Sentry, defeating the documented alerting flow; the `--require-sentry` smoke gate only checks DSN presence.
- **Recommendation:** Add `export const onRequestError = Sentry.captureRequestError;` to instrumentation; add a regression assertion in instrumentation.test.ts.
- **Expected impact:** Server-side errors become alertable.
- **Effort estimate:** S

#### DO-M3 `global-error.tsx`/`error.tsx` Sentry capture not verified
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/app/global-error.tsx; src/app/error.tsx; sentry.client.config.ts:1-13
- **What's happening:** `global-error.tsx` must explicitly call `Sentry.captureException(error)` in an effect — not automatic. Combined with DO-H1, client render crashes may never reach Sentry.
- **Why it matters:** Hydration/render failures would be user-visible but unobserved.
- **Recommendation:** Read both boundary files; ensure each calls `Sentry.captureException` in an effect; add a test.
- **Expected impact:** Client crash visibility; pairs with DO-H1.
- **Effort estimate:** S

#### DO-M1 Migrations applied manually and decoupled from code deploys — no deploy-time gate
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** docs/operations/rollback.md:152-162; docs/operations/migration-policy.md:9-17; `.github/workflows/` grep for `supabase db` = 0 hits; vercel.json (no migration step)
- **What's happening:** Migrations are CI-validated but applied by a human via `supabase db push`, decoupled from the git deploy. Nothing enforces ordering.
- **Why it matters:** Classic single-operator outage: ship code expecting schema N, forget the migration → every new-path request 500s with no off-hours paging.
- **Recommendation:** Hard ordering rule in the release checklist (migrate + verify before dependent code merges); add a schema-drift check to the smoke/pre-release gate. Longer term: gated GH Action running `supabase db push`.
- **Expected impact:** Removes a high-blast-radius human-error class.
- **Effort estimate:** M

#### DO-M2 `develop-smoke` runtime check is non-blocking and silent on failure
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:157-165 (`continue-on-error: true`), :206-219 (Vercel fail + timeout both `exit 0`); docs/operations/alerting-runbook.md:188-202
- **What's happening:** The only real-runtime check on `develop` swallows deploy failures/timeouts (empty URL → probe steps skipped), producing a green-ish run with no smoke signal.
- **Why it matters:** A runtime break on develop can sit undetected then surface only at the `main` PR gate.
- **Recommendation:** Emit `::warning::` + job-summary on failed/timed-out deploy; fail (non-blocking) when deploy succeeded but probes failed.
- **Expected impact:** Restores early-warning value.
- **Effort estimate:** S

#### DO-L1 Health probe storage limit hardcoded
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/app/api/health/route.ts:66 (`STORAGE_LIMIT_MB = 8192`)
- **What's happening:** DB-size degradation threshold uses a hardcoded 8GB; diverges silently if the plan changes.
- **Why it matters:** Capacity incident could read healthy, or false-degrade.
- **Recommendation:** Source from env var (documented in `.env.example`, picked up by `check-env.ts`).
- **Effort estimate:** S

#### DO-L2 No alert on health-endpoint `cron_auth: misconfigured`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** src/app/api/health/route.ts:171-177 (informational only); vercel.json:1-40 (6 crons)
- **What's happening:** `CRON_SECRET` misconfig is surfaced in the body but excluded from `overallStatus`, so no gate/alert trips.
- **Why it matters:** Booking/translation crons could be auth-rejected and stop silently — affecting the paid voice-booking flow.
- **Recommendation:** Fold into degraded status (prod only) or add a log-drain alert on `[CRON_AUTH_REJECTED]`.
- **Effort estimate:** S

## 8. Security / Privacy Findings (Security Reviewer)

#### SE-S1 Dedicated pre-launch security review still required
- **Severity:** strategic
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** whole-repo (audit scope)
- **What's happening:** Static read-only audit only; git history not scanned for leaked secrets (relies on Gitleaks CI), no dynamic auth-bypass testing.
- **Why it matters:** Static audit can't catch auth-flow logic flaws, history-leaked secrets, or runtime RLS gaps.
- **Recommendation:** Confirm Gitleaks history scan is green; run authenticated dynamic tests (admin routes as non-admin; cron/MCP without secrets) to verify fail-closed behavior.
- **Expected impact:** Converts inferred guarantees into verified ones.
- **Effort estimate:** M

#### SE-L1 MCP Places endpoint forwards attacker-influenceable query to Google (no SSRF today)
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/api/mcp/places/route.ts:236
- **What's happening:** Query text is sent as a JSON body field to a hardcoded Google base URL — no user-controlled URL, so no SSRF. Only outbound `fetch` reached by untrusted input.
- **Why it matters:** Not a vulnerability today; matters only if the base URL ever becomes dynamic.
- **Recommendation:** Keep `baseUrl` constant; never derive egress URL from request input.
- **Expected impact:** Maintains SSRF-free status.
- **Effort estimate:** S

#### SE-L2 CSP relies on `'unsafe-inline'` for scripts (PPR tradeoff)
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/lib/proxy/csp.ts:28
- **What's happening:** Deliberate PPR-compat decision; XSS defense shifted to output sanitization + render-sink registry + `xss-canary` test.
- **Why it matters:** Weakens CSP defense-in-depth; one un-registered raw-HTML sink away from stored XSS.
- **Recommendation:** Keep the render-sink registry and `xss-canary` as required gates; revisit nonce-based CSP if PPR constraints relax.
- **Expected impact:** Keeps the gap a controlled, tested boundary.
- **Effort estimate:** M

## 9. Code Quality / Maintainability Findings (Principal Architect)

#### AR-M1 `server-only` guard applied inconsistently across secret-bearing modules
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/lib/supabase.ts:52-76 (no guard; exports admin client); src/lib/env.ts:61-79 (no guard; secret getters); guarded peers: src/lib/stripe.ts:1, src/lib/embeddings.ts:1, src/lib/rerank.ts:1, src/lib/costs/manual-costs.ts:1; src/lib/stories-data.ts:11-17 (browser-capable, imports supabase.ts)
- **What's happening:** The two modules exposing service-role/secret access lack `import 'server-only'`; the boundary is convention-only and `createAdminClient` is reachable from a browser-capable module graph.
- **Why it matters:** No leak today (lazy construction throws client-side), but a future module-scope call/const would ship a key to the browser with no compile error.
- **Recommendation:** Add `import 'server-only'` to supabase.ts; split secret getters into a guarded `env-server.ts`, or extract `createAdminClient` into a guarded `supabase-admin.ts`.
- **Expected impact:** Compiler-enforced credential-leak protection.
- **Effort estimate:** S

#### AR-M2 Server-only code transitively reachable through the `costs` barrel
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/lib/costs/index.ts:9-16; src/lib/costs/manual-costs.ts:1
- **What's happening:** The `costs` barrel re-exports the `server-only` `manual-costs`, so importing client-safe pricing helpers via the barrel would fail the build.
- **Why it matters:** Future build failure for legitimate client use; defeats tree-shaking of the guard.
- **Recommendation:** Keep client-safe pure helpers out of the server-only barrel, or import them via deep path; document the barrel as server-only.
- **Expected impact:** Prevents a confusing future build failure.
- **Effort estimate:** S

#### AR-L1 Unused exported type `ChatRequest`
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** src/lib/schemas.ts:328
- **What's happening:** Knip's single unused export across the codebase.
- **Why it matters:** Negligible; keeps the dead-code report from being perfectly clean.
- **Recommendation:** Delete the export (or drop `export`).
- **Expected impact:** Fully clean Knip report.
- **Effort estimate:** S

#### AR-S1 No automated circular-dependency / boundary guard in CI
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** package.json scripts (no madge/dependency-cruiser); knip.json (only graph tool wired)
- **What's happening:** The zero-cycle result was an ad-hoc `npx madge` run; nothing in CI enforces no-cycles or layer boundaries.
- **Why it matters:** Cycles/boundary violations creep in silently as the codebase grows (737 files); cheaper to prevent.
- **Recommendation:** Add a pinned `madge --circular` (or dependency-cruiser) CI step alongside Knip.
- **Expected impact:** Locks in the current clean structure.
- **Effort estimate:** M

## 10. Testing / QA Findings (QA / Reliability Lead)

**Suite results:** `npm run test` PASS — 371 files / 6788 tests, 0 failed, 0 skipped (73.3s). `npm run typecheck` PASS (all 4 projects). `npm run lint` PASS (`--max-warnings=0`). 0 `.skip`/`.only`/`.todo`.

#### QA-M2 E2E "voice booking" and "checkout" coverage is contract/auth-gated, not end-to-end transactional
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** e2e/voice-agents.spec.ts:39-164; e2e/checkout.spec.ts:4-139; e2e/mcp.spec.ts:29-127; package.json `test:e2e` (desktop/mobile/qa-journey only); e2e/stripe-real-checkout.spec.ts (credential-gated, not in default gate)
- **What's happening:** Default E2E verifies gating/rendering for the two highest-revenue flows but doesn't drive an authenticated purchase or completed booking; transactional E2E is release-gate-only.
- **Why it matters:** A wiring regression between well-tested units could pass all default CI gates and surface only in production.
- **Recommendation:** Confirm `prelaunch:live` runs in the release checklist; add at least one authenticated happy-path checkout assertion to the default `e2e` gate (Stripe test mode), or explicitly document transactional E2E as release-gate-only.
- **Expected impact:** Closes the "units green, wiring broken" blind spot for revenue flows.
- **Effort estimate:** M

#### QA-M1 Full-suite duration (~73s wall, ~110s test CPU) signals heavy environment churn
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** vitest.config.ts:14-28; run output (`environment 432.61s` aggregate)
- **What's happening:** jsdom/happy-dom environments set up/torn down a very large number of times; large setup/import time.
- **Why it matters:** Slow suites get run less; coverage job (instrumented re-run) is materially slower.
- **Recommendation:** Audit per-file `environment` pragmas — run pure-logic tests under `node`; tune pool.
- **Expected impact:** Faster local + CI loops, lower CI minutes.
- **Effort estimate:** M

#### QA-M3 Playwright CI retries=2 can mask genuine flakiness in revenue/voice flows
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** playwright.config.ts:17-22 (`retries: isCI ? 2 : 0`, `fullyParallel`, 15s timeout)
- **What's happening:** A test passing only on retry 2 is reported green with no surfaced signal; recent history shows active flake-fixing.
- **Why it matters:** Retry-masked races hide failures real (no-retry) users hit under load.
- **Recommendation:** Surface flaky counts in the run summary; fail/warn when `flaky > 0` for qa-journey/checkout.
- **Expected impact:** Converts silently-retried races into visible signals.
- **Effort estimate:** S

#### QA-L1 `withChatStreamStageTiming` timeout helper has no direct unit test
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/lib/chat-stream-timeouts.ts:28-63 (no co-located test; exercised only via route tests at chat/route.test.ts:880)
- **What's happening:** The actual `Promise.race`/timer-cleanup logic is covered only indirectly.
- **Why it matters:** Easy to refactor and silently break timer cleanup — the chat resilience mechanism.
- **Recommendation:** Add a fake-timers unit test for boundary reject, success+clear, and `[CHAT_STREAM_STAGE_TIMING]` log.
- **Expected impact:** Pins the chat resilience contract.
- **Effort estimate:** S

#### QA-L2 `chat-route-utils.ts` lacks a co-located test
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** src/lib/chat-route-utils.ts:1-26
- **What's happening:** A 26-line helper on the hot chat path has no co-located test (likely covered transitively; 95% gate limits risk).
- **Why it matters:** Core path helpers deserve pinned coverage.
- **Recommendation:** Verify coverage-gate hit; add a focused test only if branches uncovered.
- **Expected impact:** Minor robustness.
- **Effort estimate:** S

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

#### UX-H1 Three competing color systems; the official design tokens are effectively dead
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** tailwind.config.ts:46-56 (commented-out `paisaxe` palette + TODO); src/app/globals.css:12 (`--primary` sky blue, used by only 2 files); src/app/pricing/page.tsx:83-201 (green-500); src/components/immersive/voice-chat-elevenlabs.tsx:49-83 (amber/yellow); src/components/immersive/chat-upsell-cta.tsx:52-82 (green)
- **What's happening:** Three unrelated color identities (token blue barely used; conversion surfaces hardcoded green; voice amber); the intended brand colors sit commented out.
- **Why it matters:** No coherent brand color across the funnel; "premium = green" lives only as scattered literals and can't be retuned globally.
- **Recommendation:** Pick the brand accent (likely green), define it as a token/`--primary`, replace raw `green-*` literals, resolve the amber voice orb, delete the dead TODO.
- **Expected impact:** Single recognizable brand color; one-place retheme; removes the strongest "unfinished" signal.
- **Effort estimate:** M

#### UX-H2 Pricing has 3 tiers, but the upsell CTAs hardcode "€1.99" and bypass tier selection
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/pricing/page.tsx:20-24 (day/week/month); src/components/immersive/chat-upsell-cta.tsx:46,85 (`/pricing/checkout` + literal €1.99); src/components/premium/voice-purchase-cta.tsx:49,100 (literal €1.99 ×2)
- **What's happening:** The two in-context upsells advertise only €1.99 and the chat upsell routes to `/pricing/checkout` with no `tier` (defaults to day_pass), hiding weekly/monthly at the highest-intent moment; prices duplicated as literals in 4+ places.
- **Why it matters:** Direct conversion/revenue leak + stale-price risk + small bait-and-switch.
- **Recommendation:** Single shared `PRICING_TIERS` constant; CTAs show a range ("desde €1.99") or route to `/pricing`; deep-link must carry an explicit `tier`.
- **Expected impact:** Higher AOV, no stale-price risk, honest messaging.
- **Effort estimate:** M

#### UX-M5 Story background images use empty alt; no text alternative for the photo-driven content
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-viewer.tsx:285 (`alt=""`); src/components/immersive/related-stories.tsx:75 (`alt=""`); SR announcement only title/subtitle at story-viewer.tsx:256-258 (contrast favorites/page.tsx:236 `alt={story.title}`)
- **What's happening:** The hero photo — the primary content — is marked decorative, so SR users get only title/subtitle, never a description of the scenery.
- **Why it matters:** The core visual-discovery value collapses for blind/low-vision users; A11y budget ≥80%.
- **Recommendation:** Give the hero a meaningful alt (story description) or programmatically associate the visible description as its text alternative.
- **Expected impact:** Accessible parity for core content.
- **Effort estimate:** S

#### UX-M4 Error and 404 screens are bare and off-brand
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/error.tsx:22-43; src/app/not-found.tsx:9-25 (plain `bg-neutral-950`, no logo/imagery/brand color)
- **What's happening:** Global error and 404 are minimal centered text with a generic white-glass button — look like scaffolding next to the polished app.
- **Why it matters:** Error/404 are exactly when trust is fragile; blank pages read as "broken."
- **Recommendation:** Add the logo + brand accent (and optionally Asturias imagery); make the primary action a real branded button.
- **Expected impact:** Errors feel handled; brand reinforced at fragile moments.
- **Effort estimate:** S

#### UX-M1 Key discovery features are removed on mobile, not adapted
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/components/immersive/story-viewer.tsx:368-432 (autoplay/ambient, Surprise Me, Share, Suggest Place all `hidden md:*`), :435-497 (partial overflow mirror)
- **What's happening:** Signature ambient/autoplay (the "lean back" mode) is demoted to a mobile overflow menu while desktop gets a visible control; two divergent control lists invite drift.
- **Why it matters:** Mobile is the dominant device for an on-location tourism app.
- **Recommendation:** Promote the most-used control (ambient/autoplay) to a visible mobile affordance; drive desktop + overflow from one config array.
- **Expected impact:** Feature parity on the primary platform; less drift.
- **Effort estimate:** M

#### UX-M2 Asymmetric mobile tap zones (30% back / 70% forward) with no visual indication
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** src/app/globals.css:114-122 (`.touch-nav-left 30%`, `.touch-nav-right 70%`); src/components/immersive/navigation-hint.tsx:23-37 (one-time 3s hint via localStorage)
- **What's happening:** Invisible asymmetric tap zones; the only education is a once-per-device 3s hint, after which the model is undiscoverable and center-left taps go forward.
- **Why it matters:** Classic discoverability trap; mis-navigations for returning users.
- **Recommendation:** Reconsider the 30/70 split (50/50 convention) or show zones briefly on first taps; re-show the hint occasionally or add a subtle persistent chevron.
- **Expected impact:** Fewer mis-navigations; learnable navigation.
- **Effort estimate:** S

#### UX-M3 Spanish-first charter vs. 6 user-facing locales — content-parity risk
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** src/components/immersive/language-switcher.tsx:9-15 (es, ast, en, fr, de, pt); src/lib/i18n/; CLAUDE.md "Language & Tone"
- **What's happening:** Six switchable languages implied to be fully localized; in practice non-es/en are likely partial UI over Spanish story bodies.
- **Why it matters:** A DE visitor reading Spanish story descriptions is a broken promise — worse than not offering DE.
- **Recommendation:** Use `story-translations-coverage.test.ts` output to gate languages with insufficient coverage behind a flag, or label partial locales honestly.
- **Expected impact:** Avoids visibly broken localized experiences.
- **Effort estimate:** S (gating) / L (full translation)

#### UX-L1 Focus-ring offset color is hardcoded (`ring-offset-black`) while pages use `neutral-950`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/components/ui/button.tsx:22-24; also story-info-panel.tsx, story-toolbar.tsx, question-prompts.tsx, premium/voice-purchase-cta.tsx; contrast favorites/page.tsx:137 (`ring-offset-neutral-950`)
- **What's happening:** Focus rings offset against `black` on `neutral-950` pages; inconsistent across the codebase.
- **Why it matters:** Minor focus-indicator inconsistency; not tokenized.
- **Recommendation:** Tokenize the focus offset (standardize on `neutral-950`/`background`).
- **Expected impact:** Pixel-consistent focus rings; easier theming.
- **Effort estimate:** S

#### UX-L2 Artificial 300ms delays inserted into loading interactions
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** src/app/favorites/page.tsx:42-45 (`setTimeout(…, 300)`); src/components/immersive/story-viewer.tsx:128-132,146-150 (300ms transition timer, correctly skipped under reduced-motion)
- **What's happening:** Favorites pagination deliberately delays 300ms to show a spinner with no functional benefit.
- **Why it matters:** Intentional latency hurts perceived performance.
- **Recommendation:** Remove the favorites delay (render synchronously; spinner only on real pending fetch). Keep the story-transition crossfade timer.
- **Expected impact:** Snappier favorites pagination.
- **Effort estimate:** S

#### UX-S1 The component library and design tokens exist but the product is hand-rolled around them
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** src/components/ui/* (tokenized primitives) vs hand-built pages: pricing/page.tsx:148-210, favorites/page.tsx:135-140, chat-upsell-cta.tsx, error.tsx/not-found.tsx (raw `<button>`)
- **What's happening:** A real shadcn-style primitive set exists but most screens bypass it, re-implementing buttons/cards/radios inline — the root cause behind UX-H1/UX-L1.
- **Why it matters:** Scaffolding of a design system without the discipline; drift compounds.
- **Recommendation:** Adopt a "no raw `<button>` in pages" convention; route conversion/marketing through `Button`/`Card` with brand-token variants.
- **Expected impact:** Durable consistency; one place to retheme.
- **Effort estimate:** L

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|----|--------|-------|----------|--------------|--------|--------|
| BE-B1 | BE | Stripe webhook hardcodes day_pass (under-delivers paid tiers) | launch-blocker | Before | S | Correct paid fulfillment |
| BE-H1 | BE | Rate-limit `"unknown"` shared bucket | high | Before | S | Removes self-DoS / billing amplification |
| BE-H2 | BE | False-failed bookings on timeout | high | Before | M | Correct booking outcomes |
| FE-H1 | FE | Voice session + mic not torn down on unmount | high | Before | S | Stops abandoned billing / mic |
| FE-H2 | FE | Silent chat/voice failure UX | high | Before | M | Recoverable failures |
| DO-H1 | DO | No `onRequestError` → server errors miss Sentry | high | Before | S | Alertable server errors |
| UX-H1 | UX | Three competing color systems | high | Before | M | Coherent brand |
| UX-H2 | UX | Upsell CTAs hardcode €1.99, bypass tiers | high | Before | M | Conversion/AOV + honesty |
| AR-M1 | AR | server-only guard inconsistent | medium | Before | S | Compiler-enforced secret boundary |
| DO-M3 | DO | global-error/error Sentry capture unverified | medium | Before | S | Client crash visibility |
| QA-M2 | QA | E2E revenue flows not transactional | medium | Before | M | Wiring blind-spot |
| UX-M1 | UX | Mobile features removed not adapted | medium | Before | M | Mobile parity |
| UX-M2 | UX | Asymmetric invisible tap zones | medium | Before | S | Learnable nav |
| UX-M3 | UX | 6 locales content-parity risk | medium | Before | S/L | Honest localization |
| UX-M4 | UX | Bare off-brand error/404 | medium | Before | S | Trust at failure |
| UX-M5 | UX | Hero image `alt=""` | medium | Before | S | A11y parity |
| AR-M2 | AR | costs barrel server-only reachable | medium | After | S | Avoids future build break |
| BE-M1 | BE | Cron auth fallback unlogged | medium | After | S | Observable cron auth |
| BE-M2 | BE | SMS-completion RPC no retry | medium | After | M | No duplicate SMS |
| BE-M3 | BE | github-traffic delete unindexed | medium | After | S | Non-contending deletes |
| FE-M1 | FE | Providers no useMemo | medium | After | S | Fewer re-renders |
| FE-M2 | FE | SSE reader lock not released | medium | After | S | Deterministic cleanup |
| FE-M3 | FE | Chat list re-renders per token | medium | After | M | Smoother streaming |
| FE-M4 | FE | i18n post-hydration flash | medium | After | M | Correct first paint |
| PE-M1 | PE | Full multi-locale payload on landing | medium | After | M | Smaller payload |
| PE-M2 | PE | Proxy runs on all API routes | medium | After | M | Lower hot-path overhead |
| PE-M3 | PE | PostHog+Sentry bundle on landing | medium | After | M | Faster hydration |
| DO-M1 | DO | Migrations manual/decoupled | medium | After | M | Removes deploy-order outage |
| DO-M2 | DO | develop-smoke silent on failure | medium | After | S | Early warning |
| QA-M1 | QA | Slow suite / env churn | medium | After | M | Faster CI |
| QA-M3 | QA | Playwright retries mask flakiness | medium | After | S | Visible flake signal |
| BE-M4 | BE | subscription-optimizer no locking | medium | Later | S | No lost updates |
| AR-L1 | AR | Unused ChatRequest type | low | Later | S | Clean Knip |
| BE-L1 | BE | favorites unbounded array | low | Later | S | Bounded writes |
| BE-L2 | BE | Stripe RPC no timeout | low | Later | S | Faster failure |
| FE-L1 | FE | Low memoization | low | Later | M | Swipe smoothness |
| FE-L2 | FE | Math.random in useRef | low | Later | S | Clarity |
| PE-L1 | PE | ElevenLabs monolith chunk | low | Later | L | Faster voice open |
| PE-L2 | PE | feature-flags select * | low | Later | S | Smaller payload |
| DO-L1 | DO | Health storage limit hardcoded | low | Later | S | Accurate capacity alert |
| DO-L2 | DO | No alert on cron_auth misconfig | low | After | S | Observable cron auth |
| QA-L1 | QA | timeout helper untested | low | After | S | Pinned resilience |
| QA-L2 | QA | chat-route-utils untested | low | Later | S | Robustness |
| SE-L1 | SE | Places egress (no SSRF today) | low | After | S | Maintains posture |
| SE-L2 | SE | CSP unsafe-inline | low | Later | M | Defense-in-depth |
| UX-L1 | UX | Focus-ring offset hardcoded | low | After | S | Consistent focus |
| UX-L2 | UX | Artificial 300ms delays | low | After | S | Perceived perf |
| SE-S1 | SE | Dedicated security review required | strategic | Before | M | Verified guarantees |
| AR-S1 | AR | No CI circular-dep guard | strategic | Later | M | Locks-in structure |
| UX-S1 | UX | Design system bypassed | strategic | Later | L | Durable consistency |

## 13. Top 10 Highest-ROI Improvements

1. **BE-B1** — One small fix stops charging customers for product they don't receive; eliminates refund/chargeback/trust risk.
2. **FE-H1** — Small unmount cleanup stops runaway billable voice sessions + stuck mic; cost scales with traffic.
3. **DO-H1** — One-line `onRequestError` export makes all server-side launch-load failures alertable.
4. **BE-H1** — Small change closes a self-DoS / unbounded-LLM-cost bypass on the most expensive public endpoint.
5. **UX-H2** — Centralizing pricing + carrying a tier unlocks weekly/monthly AOV at the highest-intent moment.
6. **BE-H2** — Stops telling users their (actually-placed) booking failed during ElevenLabs latency.
7. **UX-H1** — A single brand accent removes the strongest "unfinished/templated" signal across the funnel.
8. **AR-M1** — Two `server-only` imports convert credential-leak protection from convention to compiler-enforced.
9. **FE-H2** — Turns silent chat/voice dead-ends into recoverable states on the most-used surface.
10. **UX-M5** — One alt-text change restores the core visual-discovery experience for SR users.

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- BE-B1: Stripe webhook hardcodes day_pass (under-delivers paid tiers)
- BE-H1: Rate-limit `"unknown"` shared bucket
- BE-H2: False-failed bookings on timeout
- FE-H1: Voice session + mic not torn down on unmount
- FE-H2: Silent chat/voice failure UX
- DO-H1: No `onRequestError` → server errors miss Sentry
- UX-H1: Three competing color systems
- UX-H2: Upsell CTAs hardcode €1.99, bypass tiers
- AR-M1: server-only guard inconsistent
- DO-M3: global-error/error Sentry capture unverified
- QA-M2: E2E revenue flows not transactional
- UX-M1: Mobile features removed not adapted
- UX-M2: Asymmetric invisible tap zones
- UX-M3: 6 locales content-parity risk
- UX-M4: Bare off-brand error/404
- UX-M5: Hero image `alt=""`
- SE-S1: Dedicated security review required

### After launch (Wave 2)
- AR-M2: costs barrel server-only reachable
- BE-M1: Cron auth fallback unlogged
- BE-M2: SMS-completion RPC no retry
- BE-M3: github-traffic delete unindexed
- FE-M1: Providers no useMemo
- FE-M2: SSE reader lock not released
- FE-M3: Chat list re-renders per token
- FE-M4: i18n post-hydration flash
- PE-M1: Full multi-locale payload on landing
- PE-M2: Proxy runs on all API routes
- PE-M3: PostHog+Sentry bundle on landing
- DO-M1: Migrations manual/decoupled
- DO-M2: develop-smoke silent on failure
- QA-M1: Slow suite / env churn
- QA-M3: Playwright retries mask flakiness
- DO-L2: No alert on cron_auth misconfig
- QA-L1: timeout helper untested
- SE-L1: Places egress (no SSRF today)
- UX-L1: Focus-ring offset hardcoded
- UX-L2: Artificial 300ms delays

### Later / strategic (Wave 3)
- BE-M4: subscription-optimizer no locking
- AR-L1: Unused ChatRequest type
- BE-L1: favorites unbounded array
- BE-L2: Stripe RPC no timeout
- FE-L1: Low memoization
- FE-L2: Math.random in useRef
- PE-L1: ElevenLabs monolith chunk
- PE-L2: feature-flags select *
- DO-L1: Health storage limit hardcoded
- QA-L2: chat-route-utils untested
- SE-L2: CSP unsafe-inline
- AR-S1: No CI circular-dep guard
- UX-S1: Design system bypassed

## 15. Open Questions / Assumptions

- **Assumption:** Real Vercel traffic always carries `x-vercel-forwarded-for`, so BE-H1 affects only edge-bypass/header-stripped requests — but the cost asymmetry justifies the fix regardless.
- **Assumption:** The `paisaxe-green` brand direction is the intended accent (UX-H1) — needs human confirmation of the final brand color.
- **Verify:** DO-M3 is inference — the `global-error.tsx`/`error.tsx` bodies must be read to confirm whether `Sentry.captureException` is already wired.
- **Verify:** BE-M3 index absence was inferred from a migrations grep — confirm no index exists outside `supabase/migrations/` before adding.
- **Scope note:** SE-S1 and the dynamic auth-bypass testing are process recommendations, not code findings.

## 16. Final Verdict

- **Verdict: NOT READY**
- **What would most worry me about shipping today?** BE-B1 — the first customer who buys a weekly or monthly pass is charged correctly but receives 24 hours of access, with a wrong ledger entry behind it. That is a live-money correctness bug on a live site. Paired with FE-H1 (abandoned billable voice sessions) and DO-H1 (those failures invisible in Sentry), today's ship would leak money and trust without observability.
- **What gives me confidence?** The fundamentals are excellent: 6788 green tests, strict typecheck across 4 projects, zero npm vulns, zero circular deps, mature idempotency/signature/timeout discipline, and a strong accessibility baseline. The blockers are specific, well-located, and mostly small-effort.
- **Next 5 actions (ordered):** 1) BE-B1 fix + regression test. 2) FE-H1 unmount cleanup. 3) DO-H1 `onRequestError` (verify DO-M3 in same pass). 4) BE-H1 rate-limit hardening. 5) UX-H1/UX-H2 brand + pricing centralization.
