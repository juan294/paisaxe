# Deep Engineering Audit Report — Paisaxe

**Date:** 2026-04-18
**Branch audited:** `develop`
**Method:** Repo recon → four parallel deep-dive subagents (security, correctness/payments, performance/RAG, tests/observability/infra) → direct verification reads of high-severity claims before locking in severity.

---

## 0. Post-Review Corrections (v2 — 2026-04-18)

This document was reviewed after publication. Five findings were downgraded or corrected; the correction trail is preserved here for auditability.

| Original claim | Corrected status | Why |
|---|---|---|
| CSP as "Critical / Ship Blocker" XSS defense gap (§3.2) | **Downgraded to High / Schedule Soon — "defense-in-depth gap," not a confirmed exploit chain.** | `src/components/immersive/voice-chat.tsx:311` uses `ReactMarkdown` with explicit `components={}` overrides and no `rehype-raw`; `src/components/admin/agents-dashboard/safe-markdown.tsx:34` uses `allowedElements` + `unwrapDisallowed`. No sink found that emits raw HTML. The dead nonce scaffolding is real and misleading — the *exploit* claim was not. |
| PII logging fix targeting `src/lib/logger.ts` (§3.4) | **Fix rewritten.** The cited leak sites (`stripe/route.ts:107`, `chat/stream/route.ts:163`) use `console.error` directly, not the shared Pino logger. Pino redaction alone would not close the leaks. Remediation must migrate those callsites to the logger *first*, or install a process-wide `console` shim. | The original recommendation would have left the exact exposure it named still in place. |
| Stripe atomicity labeled "Confirmed" (§3.1) | **Retained as Ship Blocker, but posture honestly labeled "Confirmed-by-logic, migration-checked post-review."** Migration `077_stripe_webhook_events.sql` verified after the initial report: `event_id TEXT UNIQUE NOT NULL` exists, so the 23505 catch branch is sound, and the logic of the defect holds. | Original report claimed verification I had not yet done. The defect is real; the confidence label was premature. |
| "Chat stream catch branch never exercised" (§3.5) | **Corrected.** `src/app/api/chat/stream/route.test.ts:315` and `:343` already test an async generator that yields partial output and then throws, asserting both the error event and structured logging. | Real remaining gap is **abort/disconnect propagation only**, not absence of stream-error coverage. |
| `select("*")` on stories tables (§5) | **Removed.** `StoryRow` (`src/types/immersive.ts:147`) has ~23 fields and `rowToStory` consumes most of them. Projection savings may exist on narrow list views but the generic claim was not supported by the consumer code. | — |

Readers should treat the rest of the document as corrected inline where the fix was localized, and rely on §0 as the index of every demoted finding.

---

## 1. Scope and Assumptions

**Reviewed**: Next.js 16 App Router site (`paisaxe.es`/`paisaxe.com`), TypeScript strict, Supabase (PostgreSQL+RLS+pgvector), Stripe checkout, ElevenLabs voice, Anthropic + Voyage AI, Vercel deployment, Pino logging, Sentry. Source under `src/`, `supabase/migrations/053–077`, `e2e/`, `.github/workflows/`, configs.

**Assumptions**: Vercel runtime defaults, no internal infra access (no logs, no DB inspection, no Sentry events), no measured latencies — performance claims are estimates from code shape. Cannot verify live RLS state in Supabase, only what migrations declare.

**Limitations**: 5,976 tests not executed; `gh run` history not consulted; no review of `.husky` hook contents; no inspection of every migration (skimmed 049, 053, 055, 066–077). No live traffic data to confirm exploitability of webhook ordering.

---

## 2. Executive Summary

The codebase is **mixed-quality with one Critical correctness defect and one Critical security weakness, both shippable today**. Engineering hygiene is unusually high for a solo project — strong test scaffolding (5,976 tests), CSRF + Origin checks, webhook signature verification, RLS on every user table, advisory-locked crons, modular proxy pipeline, ADR-driven conventions. But the highest-stakes paths (Stripe → access provisioning, CSP) have specific, fixable defects that a senior reviewer would block release on.

**Top urgent actions, in order**:
1. Fix the **non-atomic Stripe dedup → voice grant** sequence — users can pay and never receive access on a single retry-able failure (§3.1). **Only confirmed Ship Blocker.**
2. Harden the **agent-run route** — it relies on `NODE_ENV !== "development"` as a trust boundary, which is fragile in Vercel and shells out to `spawn("bash", ...)` (§3.3).
3. Close the **PII leak surface at source callsites** (`console.error` in webhook and stream routes) — and add Pino redaction + Sentry `beforeSend` as the backstop (§3.4).
4. Either restore the **CSP nonce** end-to-end or delete the dead nonce scaffolding and document the intended weakening — current code is defense theater but not a known exploit chain (§3.2). **Downgraded from Ship Blocker.**
5. Add **AbortSignal propagation** to chat SSE so client disconnects stop Anthropic generation (§3.5). Existing error-event handling is tested; only the cancel path is missing.

The site is not in immediate danger of mass compromise. Item 1 is a revenue/trust defect that *will* eventually fire on a single transient DB error. Items 2–5 are hardening.

---

## 3. Top Five Most Critical Recommendations

### 1. Non-atomic Stripe dedup leaves "paid but no access" state on transient failure

**Category:** Bug / Reliability (payments)
**Severity:** Critical
**Confidence:** Confirmed-by-logic + migration verified post-review (`supabase/migrations/077_stripe_webhook_events.sql` declares `event_id TEXT UNIQUE NOT NULL`, so the 23505 branch is sound and the defect reasoning holds)
**Priority Label:** Ship Blocker
**Affected Area:** `src/app/api/webhooks/stripe/route.ts:44–110`

**Evidence:**
```ts
// 78–80: dedup row written FIRST
const { error: dedupError } = await supabase
  .from("stripe_webhook_events").insert({ event_id: event.id });
// 84–88: 23505 → "duplicate" (correct)
// 98–110: voice_purchases insert; on failure returns 500
const { error: insertError } = await supabase
  .from("voice_purchases").insert({ user_id, ... });
if (insertError) return NextResponse.json({ error: "Database error" }, { status: 500 });
```

**Problem:** The dedup row commits before `voice_purchases.insert`. If the second insert fails (Postgres hiccup, RLS regression, FK violation, network glitch), the route returns 500 → Stripe retries with the same `event.id` → next attempt sees the dedup row at line 51–56 → returns `200 duplicate` → **no access is ever granted**. The user has been charged, has a Stripe receipt, and the system silently refuses to ever try again.

**Root Cause:** Two writes to two tables outside a transaction, with the dedup write before the side-effect write. The "happy path race" the dedup is defending against (concurrent duplicate webhooks) is actually well-handled by the `23505` branch — but the failure path is broken.

**Impact:** Customer pays and has no day pass; support burden; refund/chargeback risk; trust erosion. Probability is low per request but compounding over volume.

**Recommended Fix:** Make the operation atomic:
- Wrap both inserts in a Postgres function (`SECURITY DEFINER`, `SET search_path = ''`) called via `supabase.rpc('grant_day_pass_idempotent', { event_id, user_id, payment_intent, expires_at })`. Inside: `INSERT INTO stripe_webhook_events ... ON CONFLICT DO NOTHING RETURNING id;` — if no row returned → already processed → no-op success. Else `INSERT INTO voice_purchases`. Both in one transaction; either both commit or neither does.
- Alternatively: insert dedup row **after** voice_purchases insert; rely solely on the unique constraint to handle the concurrent-duplicate race (the 23505 branch already exists at line 84). Less clean but a small patch.

**Implementation Notes:** A Postgres function is the right primitive here; you already use them elsewhere in `supabase/migrations/`. Add a regression test that mocks `voice_purchases.insert` to fail and asserts the dedup row was *not* written.

**Validation / Regression Test Plan:** Extend `src/app/api/webhooks/stripe/route.test.ts` (has 493 lines of tests already): add `it("does not record dedup when voice_purchases insert fails")`; assert subsequent webhook with same event_id retries successfully.

**Estimated Effort:** S (1–3 hours)

**Why This Rank:** Money + access correctness in a live revenue path. Single-replay needed to manifest. No other defect in the audit has a clean line from "single transient DB error" to "user paid but nothing happened."

---

### 2. CSP nonce infrastructure is dead code; policy is `'unsafe-inline'` defense-in-depth gap (NOT a confirmed exploit)

**Category:** Security (defense-in-depth)
**Severity:** High (downgraded from Critical post-review)
**Confidence:** Confirmed for the dead-code + policy weakness claim. **NOT confirmed as exploitable** — audited render sinks use safe `ReactMarkdown` configurations.
**Priority Label:** Schedule Soon (downgraded from Ship Blocker post-review)
**Affected Area:** `src/lib/proxy/csp.ts:21–24`, `src/proxy.ts:45–46, 52`

**Evidence:**
```ts
// proxy.ts
const nonce = generateNonce();
request.headers.set("x-csp-nonce", nonce);
// ...
response.headers.set("Content-Security-Policy", buildCspHeader(nonce));

// csp.ts — nonce parameter is _underscored and unused
export function buildCspHeader(_nonce: string): string {
  return ["script-src 'self' 'unsafe-inline' blob: https://js.stripe.com", ...]
}
```

**Problem:** `'unsafe-inline'` neuters CSP for scripts and the nonce generated at `proxy.ts:45–46` is forwarded downstream but never embedded in the CSP header or any `<script nonce=…>`. The scaffolding reads as if CSP nonces are in play; they are not.

**What this is NOT (post-review correction):** It is not a known XSS chain today. The two audited render paths for LLM-authored content both use safe configurations:
- `src/components/immersive/voice-chat.tsx:311` — `ReactMarkdown` with explicit `components={{ p, strong, ul, ol, li, a }}` overrides and no `rehype-raw` / no `allowDangerousHtml`. Raw HTML in markdown is rendered as text.
- `src/components/admin/agents-dashboard/safe-markdown.tsx:34` — `<ReactMarkdown allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed>` (allowlist excludes `script`, `img`, `a`, `iframe`).

So the real risk is **defense-in-depth removed + reader confusion from dead code**, not an exploitable sink.

**Root Cause:** The team wanted PPR compatibility (intentional, per the comment at `csp.ts:13–19`) and disabled nonces, but left the generation/forwarding scaffolding in place. New readers reasonably assume nonces are doing work.

**Impact:** No known present-day impact. Future impact is catastrophic if any code path — a new markdown plugin, a `dangerouslySetInnerHTML` for server-rendered admin content, a copy-paste of rich text somewhere — ever introduces an XSS sink. With `'unsafe-inline'` that introduction becomes a working exploit with zero CSP backstop.

**Recommended Fix:** Two paths, pick one:
- **Path A (preferred, more secure):** Move CSP-sensitive routes to dynamic rendering, restore `headers()` read of `x-csp-nonce` in the layout, and switch CSP to `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:` per CSP3. Keep PPR for non-script-critical pages.
- **Path B (minimal):** Delete `generateNonce`, the `request.headers.set("x-csp-nonce", ...)` line, and the `_nonce` parameter. Add SRI (`integrity=`) for any external scripts (Stripe). Document in CSP comment that `'unsafe-inline'` is the *intended* policy and primary defense is output sanitization in `react-markdown` config — then audit that config.

**Implementation Notes:** Either way, add an E2E test that injects `<img src=x onerror=fetch('/csp-canary')>` into a user-controlled field that flows to chat output, and assert no canary fetch was made. The existing `e2e/smoke.spec.ts` "CSP canary" tests JS *executes*; add the inverse test.

**Validation / Regression Test Plan:** Playwright test injecting common XSS payloads through chat input → assert no `script` execution occurs. Audit `react-markdown` props for `rehypePlugins`/`allowDangerousHtml` (must be off).

**Estimated Effort:** M for Path A (4–8h, PPR interaction is real); S for Path B.

**Why This Rank:** XSS in a chat surface is one of the highest-impact web vulnerabilities, and the current state is "defense theater." Either fix it for real or be honest about the threat model — both are fine; the current middle-ground is the worst option.

---

### 3. Admin agent-runner shells out to bash with `NODE_ENV` as part of the trust boundary

**Category:** Security
**Severity:** High
**Confidence:** Highly Likely
**Priority Label:** Fix Before Next Release
**Affected Area:** `src/app/api/admin/agents/run/route.ts:50–100`

**Evidence:**
```ts
const auth = await validateAdminAuth();
if (!auth.valid) return auth.error;

if (process.env.NODE_ENV !== "development" && !process.env.ALLOW_AGENT_RUN) {
  return NextResponse.json({ error: "Agent runs are only allowed in development" }, { status: 403 });
}
// ...
const child = spawn("bash", [scriptPath], { cwd: projectRoot, detached: true, ... });
```

**Problem:** Admin auth IS enforced first (good), but the secondary gate combines two fragile signals: (a) `NODE_ENV !== "development"` is **always** `production` on Vercel including preview deployments, and (b) `ALLOW_AGENT_RUN` is a single env-var flip away from enabling shell execution in any environment. The route then spawns `bash` against scripts on disk. If an admin account is compromised (or a stale admin row remains in `user_profiles`), and `ALLOW_AGENT_RUN` ever ends up set in any deployed env, attacker has RCE on the Vercel function.

`agentKey` is allow-listed against `AGENT_SCRIPTS` (good), so direct command injection through the body is closed. The risk is the env-var flip, not the body.

**Root Cause:** Convenience override (`ALLOW_AGENT_RUN`) layered on top of `NODE_ENV` instead of a per-environment explicit toggle. Vercel's env-var UI makes accidental enable trivial.

**Impact:** RCE on the serverless function with whatever permissions the function has (env vars include `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc.). Function memory is short-lived, but exfil of secrets is a single curl away.

**Recommended Fix:**
- Remove `ALLOW_AGENT_RUN` entirely. Gate exclusively on `process.env.VERCEL_ENV === undefined` (i.e., local only) **and** keep `validateAdminAuth`.
- Or: move the runner to a separate, *not deployed*, dev-only Express/Vite tool outside the Next.js app surface.
- Add a deploy-time check (CI step) that fails the build if `ALLOW_AGENT_RUN` is present in `vercel env pull` for any environment.

**Implementation Notes:** The `runningAgents` Map at line 31 is also a real leak in any environment that *does* run this — but moot once the route is local-only.

**Validation / Regression Test Plan:** Unit test that POSTs to the route with `VERCEL_ENV=preview` and any `ALLOW_AGENT_RUN` value → asserts 403.

**Estimated Effort:** S (30 min)

**Why This Rank:** Highest blast-radius if it ever fires: full secret exfiltration. Probability is low because the gate is double-locked, but the construction is "careful but fragile" — a single misconfiguration → RCE.

---

### 4. Logger and Sentry have no PII scrubbing

**Category:** Security / Compliance
**Severity:** High
**Confidence:** Highly Likely
**Priority Label:** Fix Before Next Release
**Affected Area:** `src/lib/logger.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

**Evidence:** Inspection of Pino config in `src/lib/logger.ts` confirms no `redact` paths. All three Sentry configs (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) lack `beforeSend` / `beforeBreadcrumb` hooks. **Crucially, the highest-volume leak paths bypass the shared logger entirely**:
- `src/app/api/webhooks/stripe/route.ts:107` — `console.error("[stripe-webhook] Failed to insert purchase:", insertError)` where `insertError` from Supabase routinely includes the payload (with `user_id`, `payment_provider_id`).
- `src/app/api/chat/stream/route.ts:163` — `console.error("[CHAT_STREAM_FAILURE]", { error: err.message, ... })`.
- Grep for `console.error`, `console.warn`, `console.info` across `src/app/api/**` surfaces many more direct callsites.

**Problem:** Vercel forwards stdout to log drains; Sentry auto-captures unhandled errors with serialized request bodies and user objects. In a Spanish-domain product subject to GDPR, emitting emails, phone numbers (Twilio SMS flow), Stripe customer IDs, or session tokens to those sinks is a reportable incident.

**Root Cause (post-review correction):** Two independent gaps, both required for a complete fix:
1. **Pino/Sentry have no redaction config** — but this only helps for logs that *go through the shared logger*.
2. **Many production callsites use `console.*` directly**, bypassing Pino. Redacting Pino alone would leave those leaks in place — which is the reviewer's precise critique of the original v1 remediation.

**Impact:** Compliance exposure (GDPR Art. 32). Token/secret leak risk if any error path includes a request header. Insider-threat vector via log access.

**Recommended Fix (rewritten post-review):**
1. **Migrate `console.*` callsites in `src/app/api/**` to the shared logger** — this is a mechanical change (~20–40 sites). Enforce with a custom ESLint rule: `no-restricted-syntax` forbidding `CallExpression[callee.object.name="console"]` under `src/app/api/`.
2. **Or** (cheaper, riskier): install a process-wide `console` shim at module init (`src/instrumentation.ts` or equivalent) that routes `console.error`/`warn`/`info` through Pino. Verify no double-logging with Sentry's console-capture integration.
3. **Then** add Pino `redact: { paths: ['*.email', '*.phone', '*.token', '*.authorization', 'req.headers.cookie', 'req.headers.authorization', '*.stripe_customer_id', '*.payment_provider_id', '*.user_id'], censor: '[REDACTED]' }`.
4. **Then** add Sentry `beforeSend(event) { /* strip event.request.cookies + event.request.data; hash event.user.email */ return event; }` in all three configs.
5. Add a regression test asserting that a representative webhook error path does not include a real email/user_id substring in the captured log output.

Steps 1 (or 2) **must** ship with or before 3–4, otherwise the named leaks remain open.

**Estimated Effort:** S for redact+beforeSend alone (1–2h), **M if doing the callsite migration properly** (3–5h + lint rule).

**Why This Rank:** Continuous low-severity leak, not a single high-severity breach — but it accumulates and is the kind of thing auditors and DPAs flag immediately. Cheap to fix.

---

### 5. Chat SSE has no upstream cancellation on client disconnect

**Category:** Reliability / Cost
**Severity:** High
**Confidence:** Confirmed
**Priority Label:** Schedule Soon
**Affected Area:** `src/app/api/chat/stream/route.ts:23–195`

**Scope note (post-review correction):** The original v1 of this finding also claimed the `catch` branch was "never exercised against realistic mid-stream failure." That claim was wrong — `src/app/api/chat/stream/route.test.ts:315` and `:343` already test an async generator yielding partial output and then throwing, asserting both the `error` SSE event and structured logging (`[CHAT_STREAM_FAILURE]`). That coverage stays. The remaining gap is strictly **abort/disconnect propagation**, below.

**Evidence:**
```ts
// No `request.signal` is read or forwarded into streamChatResponse / Anthropic
const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const chunk of streamChatResponse(...)) {
        controller.enqueue(...);  // emits "text" events
      }
      controller.enqueue(/* type: done */);
    } catch (error) {
      controller.enqueue(/* type: error */);  // after possibly many text events
      controller.close();
    }
  },
});
```

**Problem:** When the client disconnects (user navigates away, retries), Anthropic generation continues to completion and is billed. `request.signal` is never observed; `streamChatResponse` is never passed an `AbortController`. On a slow chat with frequent re-prompts, this multiplies cost and ties up sockets.

**Secondary (lower-priority) concern:** The handler can emit N `text` events and then a single `error` event. Clients that already painted partial text are left to decide whether to keep or discard it. The server-side coverage exists; the *client-side contract* ("on `error`, discard rendered partial") is implicit.

**Impact:** Cost amplification (Voyage rerank already happens *before* the stream, so it's wasted on disconnects too); user sees partial Spanish answers then a generic error and is unsure whether to trust the partial; Anthropic-side rate-limit headroom consumed.

**Recommended Fix:**
- Read `request.signal` at the top of POST. Construct an `AbortController`, link it to `request.signal` via `addEventListener('abort')`, pass `controller.signal` into the Anthropic SDK call (the SDK supports it). Add a test that aborts the request mid-stream and asserts `streamChatResponse` was aborted.
- Optionally tighten the error contract: send `{ type: "error", message, hadPartialContent: <boolean> }` and document the client-side discard rule.

**Estimated Effort:** S–M (2–4h with abort test; add more if expanding the error contract)

**Why This Rank:** Not a security issue and not a hard correctness bug — but it's the most likely path to runaway cost and the most likely UX defect a user will hit. Given Anthropic spend is on a personal account with no programmatic billing visibility, a stuck loop is invisible.

---

## 4. Confirmed Bugs and Defects

Beyond the top five:

- **`src/app/auth/callback/route.ts:42–50`** — `exchangeCodeForSession` failure silently redirects to `/immersive` with no logging. Users hit a "logged in but not really" state with no telemetry. **Fix:** log error, redirect to `/login?error=session_exchange_failed`.
- **`src/lib/rerank.ts:23`** — Early return only on `chunks.length === 0`. When `chunks.length <= topK`, rerank still runs (~300ms + Voyage tokens) for zero ordering benefit. **Fix:** `if (chunks.length <= topK) return chunks;`.
- **`src/app/api/admin/agents/run/route.ts:31`** — Module-scoped `runningAgents = new Map<>()` accumulates finished agents indefinitely; logs ring-buffered to 500 lines × ~200B each. Real leak in long-lived containers. (Mooted by recommendation §3.3 if route is moved local-only.)
- **`src/app/api/health/route.ts:16`** — `probeCache: Map` is module-scoped; stale entries only purged on cache *read*. Slow drift, but not catastrophic.
- **CSP wildcard `wss://*.elevenlabs.io`** (`csp.ts:28`) — overly broad. Tighten to known subdomain.
- **`stripe-webhook` returns 500 on missing `user_id`** (line 64) — Stripe will retry forever. Should be 200 + alert (event is unrecoverable, retrying won't help). Same pattern for the no-`payment_intent` branch (line 74) which correctly returns 200.

**Rejected claims** (subagent overreach — noted for future trust calibration):
- "Stripe webhook race condition double-grants access" — **wrong**. The unique constraint at line 84 + ordering of inserts means the dedup INSERT serializes concurrent requests; only one ever reaches the voice_purchases insert. The real Stripe defect is §3.1, not a race.
- "Embedding cache unbounded growth" — **wrong**. `EmbeddingCache.set` enforces `maxSize` LRU eviction at lines 53–58. Bounded.
- "RLS `USING (true)` policies are exploitable" — **misleading**. They're scoped `TO service_role`; only exploitable if the service-role key leaks, which is a different problem.
- "JSON-LD escaping is a bug" — **wrong**. Subagent flagged then self-corrected; it's safe.

---

## 5. Performance and Efficiency Findings

- ~~`select("*")` on `stories`~~ — **Removed post-review.** `StoryRow` (`src/types/immersive.ts:147`) has ~23 fields and `rowToStory` consumes nearly all of them. Projection savings would require finding narrow list views that only use `title`/`slug`/`displayOrder` — not the case at the call sites originally flagged.
- **Feature flag fetched per request** in chat (`src/lib/feature-flags-server.ts` via `isFeatureFlagEnabled('asturianu_touches')` at `chat/stream/route.ts:128`) — confirm the in-process cache TTL; if present, fine; if not, move to `Promise.all` with the search step.
- **Rerank no-op case** — `rerank.ts:23` only short-circuits on `chunks.length === 0`. When `chunks.length <= topK` the Voyage rerank call still fires (~300ms + tokens) for zero ordering benefit. Cheap one-liner fix (also listed in §4).
- **Stream encoding overhead** — each token JSON-stringified individually (`stream/route.ts:148`). Real impact is ~10ms/response at 50 tokens; not urgent.
- **Dynamic imports of `claude`/`embeddings`/`search`/`feature-flags-server`** at lines 91–96 are intentional (Turbopack workaround documented at lines 84–90). Don't undo this without the original repro. **Senior should verify the comment is still accurate** (Next.js 16.2.4 may have moved on).

---

## 6. Refactoring and Maintainability Findings

- The `proxy.ts` pipeline (`src/proxy.ts`) is unusually clean — modular, readable, well-numbered. Use as the template for similar pipelines.
- `health/route.ts` at 357 lines is borderline — consider extracting probe runners into `src/lib/health/*` with a small registry pattern. Improves testability.
- Several admin API subdirectories (`agents-summary`, `agent-reports`, `agents/run`) overlap conceptually — consider a single `agents/` namespace.
- `src/lib/` has 80+ files at root; introducing subdirectories (`auth/`, `payments/`, `chat/`, `voice/`) would speed onboarding. Not urgent.

---

## 7. Test Coverage and Validation Gaps

Strong areas (verified actual assertions, not just call-throughs):
- Stripe webhook: 493 LoC of tests — covers signature, dedup, missing fields. **Add the §3.1 regression test.**
- Day-pass checkout: 335 LoC.
- Admin auth: covers admin + non-admin negative case.
- CSRF: covers token mismatch, exempt routes, origin.
- Cron auth: covers secret + trimming.

Real gaps:
- ~~Chat stream error path~~ — **correction:** `stream/route.test.ts:315` and `:343` already test partial-yield-then-throw and assert both the `error` SSE event and `[CHAT_STREAM_FAILURE]` structured log. The real chat-stream gap is **client-disconnect abort propagation** (see §3.5), not error-path coverage.
- **No XSS canary** (CSP test verifies JS *runs* — needs the *inverse* test for §3.2).
- **No abort/disconnect test** for SSE (§3.5).
- **E2E checkout/chat are smoke navigations**, not end-to-end with Stripe test mode + real Claude (`e2e/checkout.spec.ts`, `e2e/chat.spec.ts` both mock the backing endpoints).
- **Two `waitForTimeout` calls** in `e2e/visual-regression.spec.ts` (300ms) and `e2e/author-pill.spec.ts` (600ms) — replace with explicit `waitFor` to reduce flake.
- **No CI concurrency cancel** in `.github/workflows/*.yml` — multiple pushes pile up runs. **Add `concurrency: { group: '${{ github.ref }}', cancel-in-progress: true }`.**

---

## 8. Fastest High-Value Wins

| Win | Effort | Payoff |
|---|---|---|
| Pino `redact` config (§3.4) | 30 min | GDPR posture immediately better |
| Sentry `beforeSend` hooks | 30 min | Same |
| Rerank `<= topK` early return | 5 min | ~300ms saved on small-result queries; Voyage tokens saved |
| ~~Tighten `stories` `select(...)` projections~~ — removed post-review (see §0) | — | — |
| Auth callback error logging | 10 min | Debuggability of broken sign-ins |
| CI `concurrency: cancel-in-progress` | 5 min | Cheaper, faster CI |
| Replace 2 `waitForTimeout` calls | 15 min | Less flake |
| Atomic `grant_day_pass_idempotent` RPC (§3.1) | 1–3h | Closes Critical defect |

---

## 9. Second-Stage Proposal

| # | Title | Category | Why | Effort | Impact |
|---|---|---|---|---|---|
| 1 | Move agent runner to local-only dev tool | Security | Removes RCE blast-radius entirely (§3.3 hardening) | M | High |
| 2 | Add request correlation IDs (X-Request-ID) propagated through Pino + Sentry | Observability | Today: cross-system debugging is needle-in-haystack | S | High |
| 3 | Health endpoint timeouts on Supabase/external probes | Reliability | Prevents `/api/health` from hanging during DB stalls; uptime monitor false-flags | S | Medium |
| 4 | Audit `react-markdown` config (`rehypePlugins`, `allowDangerousHtml`) | Security | Last-line XSS defense given current CSP | S | High |
| 5 | Upgrade `lucide-react` from `^1.8.0` (verify — may be correct current major) | Perf/Hygiene | Smaller bundle, fewer icon bugs | S | Medium |
| 6 | Add `ON CONFLICT DO NOTHING` everywhere webhook-style writes happen, not just Stripe | Reliability | Same defect class likely in `webhooks/elevenlabs`, `webhooks/translate` | M | Medium |
| 7 | Add a "fail-stale-translation" cron tied to `translate-story` status | Reliability | Prevents indefinite "translating…" UI states | S | Low/Med |
| 8 | Document the SSE event taxonomy (`text`, `done`, `error`, `hadPartialContent`) in `src/types/` | Maintainability | Today, contract is implicit; new client features will drift | S | Medium |
| 9 | Verify Vercel region (`cdg1` per `vercel.json`) matches Supabase region | Performance | Cross-region latency is invisible in profiling | XS | Variable |
| 10 | Add E2E test using Stripe test-mode end-to-end (no mocks) | Test Gap | Catches real integration breakage; preview-only smoke is too late | M | High |

---

## 10. Senior Developer Review Notes

Items to verify manually before acting on this report:

1. ~~Confirm §3.1 by reading the migration~~ — **done post-review.** `077_stripe_webhook_events.sql` declares `event_id TEXT UNIQUE NOT NULL`, so the 23505 branch is sound and the defect reasoning holds. Still worth verifying `voice_purchases` has no CHECK or FK that would cause routine inserts to fail — the defect's *probability* scales with that failure rate.
2. **Reproduce the Turbopack/Anthropic HTTP issue** (`stream/route.ts:84–90`) on Next.js 16.2.4 today. The dynamic-import workaround is real engineering debt — if it's no longer needed, ~150ms TTFB win.
3. **Test the `react-markdown` render path manually**: paste `<img src=x onerror=alert(1)>` into chat, observe browser. Combined with §3.2 this confirms whether you have a working second line of defense.
4. **Inspect `src/lib/proxy/csrf-proxy.ts`** (not opened in this audit): the proxy at `proxy.ts:41–42` calls `handleCsrfValidation(request)` synchronously — confirm it's actually checking the token on every state-changing API route, including `/api/admin/*`.
5. **Read `e2e/checkout.spec.ts`** yourself — the audit flags that it mocks `/api/voice-access`. If true, the entire payments flow has zero true integration coverage.
6. **Verify no admin route accepts a `user_id` from request body and acts on it** without re-checking that the caller is admin or that the target is the caller. (Audit was sample-based, not exhaustive.)
7. **Validate `VERCEL_ENV` is unset in Vercel preview/prod for `ALLOW_AGENT_RUN`** today (`vercel env ls`). If anything's set, treat as a current-state incident.
8. **Confirm Pino isn't already redacting** via a wrapper not visible in the original grep — re-read `src/lib/logger.ts` end-to-end before implementing §3.4.

---

## 11. Final Engineering Verdict

**Health: Mixed-Strong.** The codebase reads like a careful solo engineering effort with above-average rigor — modular proxy, comprehensive RLS, advisory-locked crons, dedup-aware webhook handler, real CSRF + Origin enforcement, ~6,000 unit tests, ADRs, and clean separation of concerns. The bugs that exist are not signs of carelessness but of two specific patterns: (a) "almost-atomic" multi-write sequences (Stripe), and (b) "defense scaffolding kept after defense was disabled" (CSP nonce). Both are senior-level mistakes, not junior ones, and both are 1–4 hours to fix.

**Biggest technical risks (revised post-review)**, in order: Stripe non-atomicity (§3.1) > Agent-runner trust boundary (§3.3) > PII leak at `console.*` callsites (§3.4) > CSP defense-in-depth gap (§3.2) > SSE abort propagation (§3.5).

**The code is stable on the happy path and fragile on the failure path.** The only confirmed Ship Blocker is §3.1. §3.2 was downgraded from Ship Blocker after verifying the two audited markdown sinks are safely configured; treat it as a hardening task, not a release gate.

**Recommended sequence**: (1) §3.1 atomic RPC + regression test (only hard blocker), (2) §3.3 remove `ALLOW_AGENT_RUN`, (3) §3.4 callsite migration + Pino redact + Sentry `beforeSend`, (4) §3.2 CSP decision (Path A or B), (5) §3.5 abort propagation. §3.1 this week; §3.3–3.4 next; §3.2 + §3.5 in the following sprint.

---

*Document version history: v1 published 2026-04-18 with five findings downgraded/corrected by reviewer feedback the same day. See §0 for the correction index.*
