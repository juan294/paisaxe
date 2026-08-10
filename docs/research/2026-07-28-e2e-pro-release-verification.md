# Research: Mapping Paisaxe's Release Verification to the CC-RPI E2E Pro Template

- **Date**: 2026-07-28
- **Branch researched**: `develop` @ `5fc124ca`
- **Template mapped against**: `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md` (template version 1.0, 1,536 lines)
- **Local seed copy**: `docs/release/e2e-pro-playbook.md` (byte-identical to the template; not yet adapted)
- **Status**: Research only. This document records what exists. It proposes nothing.

> Per the project's RPI rules, this phase documents current-state truth with `file:line` evidence.
> No improvements are suggested here. Open decisions are listed in §10 for the user to resolve
> before any planning begins.

---

## 1. Executive Summary

Paisaxe has substantial test assets — 20 Playwright specs, a sharded Vitest suite, 11 CI workflows,
5 required status checks on `main`, real branch protection with admin enforcement, and a
database-enforced synthetic-fixture safety gate. What it does not have is a release **contract**:
nothing binds evidence to a candidate, nothing prevents a vacuous pass, no check is marked
release-required, and nothing gates tagging on evidence.

Five findings dominate the mapping:

1. **No deployed artifact is meaningfully tested.** The required `Playwright E2E` check runs
   against `http://localhost:3100` with dummy credentials (`playwright.config.ts:7,110-118`). The
   only required check that touches a real deployed build is `Smoke test Vercel preview`, whose
   entire assertion surface is two `curl` calls (`preview-smoke.yml:106-125`).
2. **The candidate SHA does not survive the release.** The repo now permits squash merges only, so
   the commit that lands on `main` is a new object CI never tested (§3.2).
3. **Preview runs against production data and live-mode vendors.** There is exactly one Supabase
   project in the org, and Preview-scope Stripe keys are live-mode, not test-mode (§4).
4. **Requiredness does not exist as a concept.** Zero tests carry any tag; branch protection is the
   only requiredness signal, and it operates at job granularity (§5.2).
5. **The app cannot identify itself.** No endpoint exposes a commit, build ID, or version (§3.3).

---

## 2. Project Adaptation Profile

Verified values only. Template §5 fields that could not be confirmed are marked `UNVERIFIED`.

| Area | Paisaxe value | Evidence |
|---|---|---|
| Project | Paisaxe | `CLAUDE.md:1` |
| Repository visibility | Private | `gh repo view --json visibility` → `PRIVATE` |
| Primary product type | Web app (Next.js 16 App Router) | `CLAUDE.md` Tech Stack table |
| Package/build system | npm + Next.js | `package.json` |
| Integration branch | `develop` | `CLAUDE.md` Git Workflow |
| Production branch | `main` (repo default branch) | `gh repo view --json defaultBranchRef` → `main` |
| Merge strategy | **Squash only** (`allow_squash_merge: true`, `allow_merge_commit: false`, `allow_rebase_merge: false`) | `gh api repos/juan294/paisaxe` |
| Release artifact | Vercel deployment built from `main` HEAD | `vercel ls`; prod alias `paisaxe-git-main-thecreativetoken.vercel.app` |
| Deployment provider | Vercel (org `thecreativetoken`, project `prj_KWgR1x8PQHfOnDkcPuHXGaTUWgff`) | `.vercel/project.json:1` |
| Local test target | `http://localhost:3100` | `playwright.config.ts:6-7` |
| Preview target | Vercel Preview, SSO-protected | `preview-smoke.yml:56-61`; SSO confirmed by 302 to `vercel.com/sso-api` |
| Staging target | **None** | No staging project in `vercel projects ls`; no second Supabase project |
| Production target | `paisaxe.es` / `paisaxe.com` | `vercel projects ls` |
| Test runners | Vitest + Playwright | `package.json:29,31` |
| Unit command | `npm run test` → `vitest run` | `package.json:29` |
| E2E command | `npm run test:e2e` → `playwright test --project=desktop --project=mobile --project=qa-journey` | `package.json:31` |
| Typecheck command | `npm run typecheck` (4 sub-projects: app, scripts, e2e, edge) | `package.json` |
| Lint command | `npm run lint` (`lint:src` + `lint:scripts`) | `package.json` |
| Build command | `npm run build` | `package.json` |
| Release-report command | **None exists** | No release/version/tag/publish npm script exists |
| Primary datastore | Supabase Postgres 17.6.1.063, project `asturias` (`axoishtlumlswzhegseq`, eu-central-2) | `supabase projects list`; `docs/operations/operations.md:173` |
| Object/media storage | Supabase Storage: `story-images`, `pdf-images` (both public) | `004_admin_curation.sql:12-14`, `016_pdf_images_bucket.sql:6-8` |
| Queue/event system | Postgres-backed outbox/lease tables (`booking_sms_jobs`, `translate_webhook_events`, `cron_job_locks`) | `079_webhook_idempotency_rpcs.sql:29`, `088_voice_booking_durability.sql:6` |
| Authentication | Supabase Auth + Google OAuth; RBAC via `user_profiles.role` | `src/lib/admin-auth.ts:26-148` |
| Payments/entitlements | Stripe (day pass → `voice_purchases`) | `src/lib/stripe.ts:64-71`, `040_voice_purchases.sql:5` |
| Email/notifications | Resend (email), Twilio (SMS) | `src/lib/email.ts:51`, `src/lib/twilio-sms.ts:39-51` |
| Other external vendors | Anthropic, Voyage AI, ElevenLabs, Upstash Redis, PostHog, Google Places, OpenWeatherMap | §6 |
| Observability | Pino structured JSON; **Sentry present but inert**; PostHog production-only | `src/lib/logger.ts:136`, `src/instrumentation.ts:56-58` |
| Hardware/real-device surfaces | None | No mobile/desktop app in repo |
| Agent command directory | `.claude/commands/` | Directory listing |
| Release approver | Repository owner (solo dev, self-approval permitted but click required) | `CLAUDE.md` Production Release |
| Rollback authority | Repository owner | `CLAUDE.md` Production Safety |

### 2.1 Environment truth table

Template §5 explicitly warns not to infer fidelity from an environment's name. Verified values:

| Environment | Exact artifact? | Real auth? | Real datastore? | Real vendors? | Safe writes? | Main limitations |
|---|---|---|---|---|---|---|
| **Local** | No | Only if `.env.local` has real creds | Local Docker Postgres (`config.toml`, port 54322) or remote | Whatever `.env.local` holds | Yes, if pointed at local DB | No build/runtime parity |
| **CI** | No — separate build with dummy env (`ci.yml:205-212`) | No — `https://example.supabase.co` | No | No — dummy keys, no network calls in build | Yes (nothing real is reachable) | Zero runtime or vendor coverage |
| **Preview** | **Yes** for PRs → `main` (built from PR head SHA) | Yes | **Production `asturias` project** (see §4.1) | **Live-mode**, incl. live Stripe keys | **NO** | SSO-protected; `develop`-push previews are build-skipped (§4.2) |
| **Production** | Yes — built from `main` HEAD | Yes | Yes | Yes | N/A | Live site |

Template §5 closing instruction: *"If production is the first full-integration environment, record
that as an open release risk."* **Paisaxe's condition is adjacent and arguably worse**: Preview is a
full-integration environment, but it integrates against *production* data and *live* vendors, so it
is not a safe rehearsal surface. There is no environment where a state-changing probe is both
realistic and safe.

---

## 3. Release Topology and Candidate Identity

### 3.1 Branch and tag state

- `main` is 26 commits behind `develop`; `develop` is missing 2 commits that are on `main`
  (`a6f51f67` PR #738 `hotfix/prod-deps`, `3c9bcd63` PR #707 dependabot) — both landed on `main`
  from non-`develop` branches, bypassing the integration branch entirely.
- Tags: `v1.5.1, v1.5.0, v1.4.0, v1.2.0, v1.1.0, v1.0.0` (no `v1.3.0`). Tags point at `main` merge
  commits, not `develop` commits.
- `package.json:3` declares `1.6.0` and `CHANGELOG.md` has a `## [1.6.0] - 2026-06-20` section, but
  **no `v1.6.0` tag exists**. Release PR #702 ("release: v1.6.0") is `CLOSED`, `mergedAt: null`.
- No workflow has an `on: push: tags:` trigger — tagging triggers no verification whatsoever.

### 3.2 Candidate identity — the central architectural problem

Historical `develop→main` release PRs (#557, #555, #553, #384, #116) were **true two-parent merge
commits**, e.g. `625a6bc2` with parents `ba6b89b3` (prior `main`) and `d8ebd460` (`develop` tip). In
that model the tested `develop` SHA survives as a real ancestor inside `main`.

That model is no longer available. Live repo settings permit **squash only**. Demonstrated
concretely on PR #738: the tested head was `9411eada`; the commit on `main` is `a6f51f67` — a new
object that existed on no branch before the merge and was never run through CI as such.

Consequences, all verified:

- `preview-smoke.yml:24-26` triggers on `pull_request: branches: [main]` **only**. It never runs on
  push to `main`. Therefore **no smoke or health probe ever targets a real Vercel deployment of the
  final squashed commit.**
- `ci.yml:22-26` and `e2e.yml:3-7` do trigger on push to `main`, so the squashed commit gets a fresh
  CI run — but those are the dummy-env suites (§5.1), which prove nothing about the deployed build.
- Template D06 requires evidence to identify the exact candidate. Under squash merge, **binding
  evidence to a commit SHA is impossible past the merge boundary.**

### 3.3 The app cannot identify itself

- `src/app/api/health/route.ts` returns `{status, timestamp, cron_auth, sentry}` — confirmed live
  against production: `{"status":"healthy","timestamp":"2026-07-28T18:14:39.556Z","cron_auth":{"status":"ok"},"sentry":{"status":"unconfigured"}}`.
  **No commit, version, or build identifier.**
- `/api/health/live` returns `{status:"live", timestamp}`; `/api/health/db` returns connectivity
  stats. Neither carries identity.
- Repo-wide grep for `VERCEL_GIT_COMMIT_SHA`, `NEXT_PUBLIC_*COMMIT*`, `BUILD_ID`, `buildId`,
  `gitCommitSha`: **zero hits in application code**. Only `VERCEL_GIT_COMMIT_REF` (branch name) is
  read, at `next.config.ts:107`, solely to gate Sentry sourcemap upload.
- Today, commit→deployment binding exists **only** externally, via the GitHub Deployments API —
  which `preview-smoke.yml:56-61` and `ci.yml:260-262` already query by exact SHA.

---

## 4. Environment Fidelity

### 4.1 One database, shared by Preview and Production

- `supabase projects list` returns exactly one Paisaxe project across the org's 7: `asturias`
  (`axoishtlumlswzhegseq`). No `paisaxe-preview` or `paisaxe-staging` exists.
- `docs/operations/operations.md:173` states "Linked Supabase project: `asturias`" — singular.
- `docs/operations/migration-policy.md` contains zero mentions of "preview" or "staging".
- `src/lib/environment.ts:21-42` — `getEnvironment()` returns only `"development"` or
  `"production"`; **there is no `"preview"` value**. Preview deployments run `NODE_ENV=production`
  with a non-localhost `NEXT_PUBLIC_SITE_URL`, so they resolve to `"production"` and read the
  **production** rows of `feature_flags`.
- Vercel Preview scope holds `STRIPE_SECRET_KEY` and `STRIPE_DAY_PASS_PRICE_ID` — **not**
  `STRIPE_TEST_*`. Those test-mode names exist only in `.env.example` for local dev.

**UNVERIFIED**: the Preview and Production `NEXT_PUBLIC_SUPABASE_URL` values were not compared
byte-for-byte, because that requires printing a secret. The inference rests on there being exactly
one Supabase project in the org, plus the documentation and `getEnvironment()` evidence above.

**Consequence**: a state-changing probe against a Preview deployment writes to the production
database and transacts against live-mode Stripe. Template D19/D20 boundaries cannot currently be
honored in Preview.

### 4.2 Preview builds are skipped except on PRs to `main`

`vercel.json:3` sets `"ignoreCommand": "test \"$VERCEL_ENV\" != \"production\""`. Vercel semantics:
exit 0 skips the build. For `VERCEL_ENV=preview` the test is true → exit 0 → **build skipped**.

Observed in `vercel ls`: Preview deployments are overwhelmingly `Canceled` at 4–5s duration.
Production deployments are `Ready` at ~1m.

However, PRs targeting `main` **do** produce real Preview builds. Verified from the successful
`preview-smoke` run `29987381056` (PR `hotfix/prod-deps`, 2026-07-23): it resolved
`https://paisaxe-n2b620cmy-thecreativetoken.vercel.app` — the "Ready Preview, 42s" deployment — and
received a genuine `{"status":"healthy",...}` response.

**UNVERIFIED**: the precise mechanism by which PR-to-`main` previews escape the `ignoreCommand`
skip while `develop`-push previews do not. The empirical behavior is confirmed; the cause is not.

Consequence: `ci.yml`'s `develop-smoke` job generally has no real artifact to probe — consistent
with it being `continue-on-error: true` (`ci.yml:236`) and documented as never blocking
(`ci.yml:220-221,234-236`).

---

## 5. What the Required Checks Actually Prove

### 5.1 The five required checks on `main`

Branch protection requires exactly these contexts (`gh api .../branches/main/protection`):
`["Lint & Typecheck", "Test", "Build", "Playwright E2E", "Smoke test Vercel preview"]`, with
`strict: true`, 1 approving review, `dismiss_stale_reviews: true`, `enforce_admins: true`,
force-push and deletion blocked.

| Required check | What it actually exercises | Deployed artifact? |
|---|---|---|
| `Lint & Typecheck` (`ci.yml:34`) | ESLint + 4 `tsc` projects + `check-verification-coverage` + `check-migrations` | No |
| `Test` (`ci.yml:168`) | Thin aggregator over 4 sharded `coverage-shard` jobs + `coverage-merge`; `if: always()` with manual failure propagation (`ci.yml:171,179-182`) | No |
| `Build` (`ci.yml:186`) | `npm run build` with **dummy env vars** (`ci.yml:207-212`); file header states it "does NOT exercise the real Vercel runtime" (`ci.yml:3-5`) | No |
| `Playwright E2E` (`e2e.yml:15`) | 20 specs against `http://localhost:3100` with dummy credentials | **No** |
| `Smoke test Vercel preview` (`preview-smoke.yml:40`) | Two `curl` assertions: `/api/health` returns 200 with `status=="healthy"`, and homepage returns 200 | **Yes — the only one** |

`develop` has **no required status checks at all** — the protection object contains no
`required_status_checks` key. Nothing is a hard gate before code lands on the integration branch.

### 5.2 Requiredness metadata does not exist

Direct grep across `e2e/*.spec.ts` for `@smoke`, `@release-required`, `@critical`, `@slow`:
**zero matches**. No Playwright `tag:` option, no annotations, no title convention. Template D05
("requiredness is machine-readable") has no substrate in this repo today. The only requiredness
signal is GitHub branch protection, which operates at whole-job granularity.

### 5.3 The E2E suite never tests a deployment

`playwright.config.ts:7` — `const baseURL = \`http://localhost:${e2ePort}\`` (default port 3100).
There is no environment variable that repoints `baseURL` at a deployed URL. The `webServer` block
(`playwright.config.ts:97-119`) starts a local server with hardcoded dummy credentials:

```
ANTHROPIC_API_KEY: "dummy_key_for_e2e"
VOYAGE_API_KEY: "dummy_key_for_e2e"
NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy_key_for_e2e"
STRIPE_SECRET_KEY: "sk_test_dummy_for_e2e"
STRIPE_DAY_PASS_PRICE_ID: "price_test_dummy_for_e2e"
```

Projects defined: `desktop`, `mobile`, `qa-journey`, `stripe-integration`, `visual-desktop`,
`visual-mobile` (`playwright.config.ts:54-93`). `retries: isCI ? 2 : 0` (`:33`); reporters
`html`/`github`/`list` in CI (`:35`).

### 5.4 Vacuous-pass and credential-skip inventory (template D03/D04)

| Location | Mechanism | Effect |
|---|---|---|
| `e2e/mcp.spec.ts` — 16 `test.skip` calls (`:51,64,79,128,144,161,199,212,227,276,290,308,365,380,399,514`) | `test.skip(!process.env.MCP_API_SECRET, ...)` | `MCP_API_SECRET` is absent from the Playwright `webServer` env, so **all 16 skip on every CI run**. The MCP route validation surface is untested inside a required check. |
| `preview-smoke.yml:98-105`, `:118-125` | `if [ -z "$VERCEL_AUTOMATION_BYPASS_SECRET" ]` → **exit 0** when actor is `dependabot[bot]`, else exit 1 | A **required** check passes without probing `/api/health` or the homepage on every Dependabot PR. |
| `e2e-stripe-integration.yml:70-77` + `if: steps.secrets.outputs.run == 'true'` gates (`:87,91,95,99,117`) | Missing any of 9 secrets → `run=false`, exit 0 | Job reports success having executed **zero** Stripe tests on scheduled/PR runs. Not currently required, but is the clearest D03 shape in the repo. |
| `ci.yml:236` | `continue-on-error: true` on `develop-smoke` | Runtime health failure cannot fail CI (documented as intentional). |
| `security.yml:76-80,83` | Steps gated on `env.VERCEL_TOKEN != ''` | `vercel-env-safety` no-ops when Vercel creds absent. Not required. |

Legitimate, non-vacuous skips (project-scoped, not credential-gated): `test.skip(isMobile, ...)` in
`author-pill.spec.ts` (7×), `immersive.spec.ts` (2×), `interactive-controls.spec.ts` (6×), plus
viewport-width skips in `qa-journey.spec.ts:337`, `pre-launch.spec.ts:269`, `suggestions.spec.ts:21-25`.

Two clarifications that cut the other way, in Paisaxe's favour:

- **The authenticated QA journeys do run in CI.** `qa-journey.spec.ts:488-492` skips journeys 9–12
  without `QA_TEST_USER_EMAIL`/`PASSWORD`, but `e2e.yml:63-64` supplies both, so they execute for
  real. The skip only fires locally.
- **The auth fixtures fail loudly rather than skipping.** `e2e/fixtures/auth.ts:139-143,154-157`
  **throws** when credentials are missing, with the comment "Fail loudly if credentials are not
  configured — silent skips hide CI misconfigurations." This is the correct D04 posture and the
  exact opposite of `mcp.spec.ts`'s pattern.
- Playwright reports skipped tests with status `skipped`, distinct from `passed`, in all three
  configured reporters (`playwright.config.ts:35`). So the 16 MCP skips are *visible* in output —
  the failure is that nothing **blocks** on them, which is precisely template D04.

`e2e/stripe-real-checkout.spec.ts:90-95` also skips without the three `STRIPE_TEST_*` secrets, but
it is excluded from the default gate by `testIgnore` (`playwright.config.ts:61,70`) and runs only
under the `stripe-integration` project via `prelaunch:live`.

### 5.5 Gates that are sound

Three scripts were audited specifically for D03/D04 holes and found clean:

- `scripts/run-prelaunch-gate.ts` — runs 5 steps unconditionally
  (`check-verification-coverage`, `check-env`, `check-migrations`, `build`, `test:e2e`); zero
  `process.env` reads, zero conditionals; fail-fast, no aggregation, no swallowing
  (`:82-95,109-112,123-126`). Validates that `prelaunch:live` is byte-exact (`:66-69`) but never
  executes it — that split is documented.
- `scripts/check-verification-coverage.ts` — ~11 unconditional static assertions; uncaught throw on
  first violation; no env vars, no credentials. Cannot pass vacuously.
- `scripts/check-migrations.ts` — **no database or credential dependency at all**; it is a static
  linter over `supabase/migrations/*.sql` (6 checks, aggregated, exit 1 if any error). It is
  therefore not the Chapa "pending-migration check skips without credentials" defect — but note the
  corollary: **there is no live pending-migration verification anywhere in CI.** `supabase db push`
  appears in zero workflows; migrations are applied manually by a human
  (`docs/operations/migration-policy.md:176`, `docs/operations/rollback.md:158`).

---

## 6. Capability Surface

56 API route files under `src/app/api/**`. Summary by authorization class:

| Class | Count / examples | Guard |
|---|---|---|
| Admin | ~30 routes under `/api/admin/*` | `validateAdminAuth()` / `withAdmin()` (service-role client, bypasses RLS) / `withAdminRead()` (cookie client, RLS-bound) — `src/lib/admin-auth.ts:26-148,159-172,182-216` |
| Authenticated user | `/api/favorites`, `/api/suggestions`, `/api/checkout/day-pass`, `/api/checkout/embedded`, `/api/voice-access` | `supabase.auth.getUser()` / `getUserFromRequest` |
| MCP-secret gated | `/api/mcp/places`, `/api/mcp/weather`, `/api/mcp/make-booking`, `/api/mcp/save-favorite` | `validateMcpSecret` + rate limiting |
| Cron | 6 routes under `/api/cron/*` | GET: Vercel Cron header / `verifyVercelCron`; POST: `validateAdminAuth` |
| Webhooks | Stripe, ElevenLabs, Supabase, translate | Signature/shared-secret verification (below) |
| Public | `/api/chat`, `/api/chat/stream`, `/api/feature-flags`, `/api/health*` | Rate limiting only |

Webhook verification:

| Webhook | Method | Evidence |
|---|---|---|
| `/api/webhooks/stripe` | Stripe SDK signature on `stripe-signature` | `src/app/api/webhooks/stripe/route.ts:46,58` |
| `/api/webhooks/elevenlabs` | HMAC-SHA256 of `timestamp.rawBody`, 30-min replay window | `src/app/api/webhooks/elevenlabs/route.ts:85-92`; `elevenlabs-webhook-service.ts:106-140` |
| `/api/webhooks/supabase` | `timingSafeEqual` on `x-webhook-secret` | `src/app/api/webhooks/supabase/route.ts:49-61` |
| `/api/webhooks/translate` | Same shared-secret pattern | `src/app/api/webhooks/translate/route.ts:154-166` |
| `/api/mcp/make-booking/status` (Twilio callback) | **No signature validation found** — returns `{received:true}` | `src/app/api/mcp/make-booking/status/route.ts:17-19` |

Page routes are public except `/admin`, which is gated **client-side only** via `useAdminRole()`
(`src/components/admin/admin-shell.tsx:19,95`) with no server-side redirect.

`src/proxy.ts` (96 lines) handles canonical-domain redirect, `/story/:slug` rewrite, maintenance
mode, CORS preflight, CSRF validation, Supabase session refresh, CSP header, CSRF cookie
(`src/proxy.ts:20-82`), matching everything except `_next/static` and `_next/image` (`:87-96`).

---

## 7. Persistent State and Test-Data Safety

### 7.1 Tables and lifecycle states

28 tables across 96 migration files (`NNN_description.sql`; `005`, `023`, `024` are known gaps
declared in `check-migrations.ts:11-15`). Ten are E2E-write-relevant: `user_favorites`,
`user_profiles`, `story_suggestions`, `voice_purchases`, `pending_bookings`, `booking_sms_jobs`,
`elevenlabs_webhook_events`, `voice_saved_places`, `stripe_webhook_events`, and `stories` (via
`curation_status`).

13 status/lifecycle state machines exist. Notably, **no `CREATE TYPE ... AS ENUM` exists anywhere**;
all are `text` columns. Three have **no `CHECK` constraint at all** — `pending_bookings.status`
(`053:17`), `translate_webhook_events.status` (`079:18`), `booking_sms_jobs.status` (`079:35`) — so
the database will accept an arbitrary status string; validity is enforced only in application/RPC
code.

Storage: two public buckets, `story-images` and `pdf-images`.

### 7.2 Synthetic-data safety is enforced in the database

Template D19 requires run-scoped, identifiable, cleaned-up fixtures. Paisaxe's current position:

- `supabase/migrations/045_qa_test_user_cleanup.sql` defines `cleanup_qa_test_user(test_email)` as
  `SECURITY DEFINER` with `SET search_path = ''` (`:13-14`), granted to `service_role` only (`:56`),
  which **raises unless the email matches `qa-test-%@paisaxe.dev`** (`:22-24`). This is a
  database-layer guarantee, not client-side validation.
- `e2e/fixtures/auth.ts:24-26` mirrors it: `^qa-test-[a-z0-9]+@paisaxe\.dev$`.
- Cleanup runs before *and* after each `authenticatedPage` use (`auth.ts:161,185`) and in a
  `try/finally` for the Stripe spec (`stripe-real-checkout.spec.ts:102,218-219`).

Two gaps against the template:

1. **Not run-scoped.** It is a single fixed QA account, not `<prefix>-<RUN_ID>`. Concurrent runs
   share one identity.
2. **Cleanup is split.** The RPC deletes only `user_favorites` (`045:41-42`); `voice_purchases` is
   handled separately by `cleanupVoicePurchases()` (`stripe-real-checkout.spec.ts:54-66`). No single
   mechanism guarantees zero residue, and no residue evidence is emitted.

No evidence was found that any test can touch real user data.

---

## 8. Vendor Seams and Evidence Oracles

| Vendor | Local stub for tests | Real-vendor probe | Degradation |
|---|---|---|---|
| Anthropic | `vi.mock("@anthropic-ai/sdk")` | None (dummy key in CI) | **Dev/prod parity gap**: curl subprocess in dev/test vs SDK in prod (`src/lib/claude.ts:1-13`, issue #534) |
| Voyage AI | None found | None | `rerank.ts:28-59` falls back to original order; `generateEmbedding` has **no try/catch** (`embeddings.ts:27-58`) |
| ElevenLabs | `vi.mock("@/lib/services/elevenlabs-call-service")` | None | try/catch at `elevenlabs-call-service.ts:54,119` |
| Stripe | `vi.mock("@/lib/stripe")` | **Yes** — real test-mode checkout, `e2e/stripe-real-checkout.spec.ts` | Rejection path tested (`day-pass/route.test.ts:407`) |
| Upstash Redis | `vi.mock("@upstash/redis")` | None | **Fails closed in production** (`rate-limit.ts:238-241`) |
| Resend / Twilio | Twilio mocked (`retry-booking-sms/route.test.ts:26`) | None | Missing-cred guards return `{success:false}` rather than throwing |

The Stripe real-vendor path is genuine test mode and polls real Supabase for the resulting
`voice_purchases` row (`stripe-real-checkout.spec.ts:189-207`). However **inbound delivery is
simulated**: the spec signs its own event via `Stripe.webhooks.generateTestHeaderString` and POSTs
it to the app (`:174-185`). Stripe→app delivery is never exercised.

**Available oracle layers today** (template §7 requires selecting every layer capable of disproving
the UI result):

- UI/client — yes, Playwright (but only against localhost).
- HTTP — yes.
- Datastore — yes, and already demonstrated via `expect.poll` on `voice_purchases`.
- Object storage / queue-event / vendor — not asserted by any test.
- **Telemetry — unavailable.** Sentry is inert (no DSN; `instrumentation.ts:56-58` logs
  `[SENTRY_UNCONFIGURED]`; confirmed live in the production health response as
  `"sentry":{"status":"unconfigured"}`). PostHog is production+hostname gated
  (`posthog-provider.tsx:17-22`). Pino logs have no queryable sink configured in this repo.
- **Cleanup — partial** (§7.2).

---

## 9. Known Escapes and Existing Contradictions

### 9.1 Historical escapes visible in repo evidence

| Escape | Failure class | Durable coverage now? |
|---|---|---|
| **2026-03-24 Dependabot→`main` production outage.** Next.js 16.2.1 crashed all Vercel serverless functions; an agent merged 7 Dependabot PRs straight to `main` without authorization. Full CoE: `docs/coe/2026-03-24-dependabot-production-incident.md` | Unauthorized merge to production + no preview verification + framework upgrade treated as a patch bump | **Largely** — `dependabot.yml:5` now targets `develop`; `Smoke test Vercel preview` added as a required check 2026-04-23; 1-approval gate added 2026-04-19 (`branch-protection.md:17-18`); CoE rules codified into `CLAUDE.md` Production Safety. **Gap**: recovery failed twice because a fresh `--prod` rebuild was used instead of a promote (CoE `:85-90`), and `incident.md:64` still recommends that command (§9.2 item 2) |
| Migration `087` recorded as applied but **never took effect**; RLS stayed `rowsecurity=false` on 4 operational tables until `090` re-applied it (`090_fix_rls_operational_tables.sql:5-8`) | Silent no-op migration; no post-apply verification | Partial — `check-migrations.ts:120-179` now statically asserts RLS posture for those 4 tables, but nothing verifies the **live** DB state |
| Admin-only RLS policies compared `user_profiles.id` instead of `user_profiles.user_id`, silently ineffective (`057_fix_platform_costs_rls.sql:1-3`, `067_fix_webhook_config_rls.sql:4-7`) | Authorization policy that parses but grants nothing | No test asserts an admin-only table actually denies a non-admin |
| **Anthropic credit exhaustion (2026-07-20, issue #734)** — production chat returning 500s | Vendor quota/billing, invisible to mocked tests | **No — and issue #734 is still OPEN as of 2026-07-28 (8 days).** `docs/agents/qa-report.md` (2026-07-22) calls it "a confirmed recurrence… still unresolved". No `alerting-runbook.md` entry exists for it; detection is the weekly QA agent plus manual log inspection. All Anthropic tests use dummy keys |
| `voyageai` 0.2.x broken ESM build broke `/api/chat` | Third-party dependency regression | Yes — reverted (`749048e5`), pinned in `dependabot.yml:15-18`. Minor inconsistency: a later commit `70de3bd4` upgraded to 0.4.x while the ignore rule appears to remain |
| Visual diffs could never block a merge (`continue-on-error: true`) | Non-blocking gate | **Yes** — fixed, `e2e.yml:74-77` (issue #441) |
| CSP/PPR script blocking | Deployed-runtime-only config failure | Yes — CSP canary in `e2e/smoke.spec.ts:22-33`. **UNVERIFIED whether this was ever a live outage**: no CoE or issue documents one, and `CLAUDE.md:273`'s phrasing ("If CSP ever blocks scripts again") reads as preventive. Recorded as a guardrail, not a confirmed escape |

Not confirmed from repo evidence despite being expected: a "Supabase silent fallback" incident
(exists only as a rule in `.claude/skills/supabase/SKILL.md:56-71`, no incident doc) and a "Vercel
stale build cache" incident (no issue, CoE, or commit match). Both **UNVERIFIED** — they may be
operator memory rather than repo-recorded escapes.

### 9.2 Contradictions in current instructions (template Wave A1)

Ordered by blast radius.

1. **`/deploy` skill has no authorization gate at all.** `.claude/skills/deploy/SKILL.md` is 6 lines
   in full: run tests → create PR to main → wait for CI green → **merge PR to main** → verify. No
   STOP, no user-authorization step. This directly contradicts `CLAUDE.md:48-56` ("No agent may
   perform ANY of the following without the user explicitly saying 'do it'…" — which lists both
   "Create a PR targeting `main`" and "Merge a PR into `main`") and `CLAUDE.md:67` ("CI being green
   (necessary but not sufficient)"). It is user-invocable as `/deploy`, and is the shortest, most
   literal "how do I deploy" document in the repo. **Highest-severity contradiction found.**
2. **`incident.md` recommends the exact command that prolonged a real outage.**
   `.claude/commands/incident.md:64` suggests `vercel deploy --prod [deployment-url]` as rollback.
   `.claude/skills/deployment-safety/SKILL.md:84-97` explicitly labels this "Wrong" and prescribes
   `vercel rollback`. `docs/operations/rollback.md:24-35` uses `vercel rollback <id>`;
   `alerting-runbook.md:51-57` uses `vercel promote <url>`. Per the CoE timeline
   (`docs/coe/2026-03-24-dependabot-production-incident.md:85-90`), a fresh `--prod` rebuild is
   precisely what failed twice during that incident's recovery. Three docs were fixed afterwards;
   `incident.md` was not.
3. **Merge strategy, plus an unattended-merge gate bypass.** `CLAUDE.md:113-117` prescribes
   `gh pr merge --merge`, which would **fail** against the live repo (`allow_merge_commit: false`).
   `.claude/commands/release.md:224-227` prescribes `gh pr merge --squash --auto`. Beyond the
   strategy mismatch, `--auto` merges **unattended** as soon as CI passes — so no second human
   "merge it" ever occurs, which is a second, distinct violation of `CLAUDE.md:52,67`.
4. **Required check names.** `CLAUDE.md:75` and `docs/operations/branch-protection.md:6` both list
   job *ids* (`lint-and-typecheck`, `test`, `build`, `e2e`); branch protection enforces display
   *names* (`Lint & Typecheck`, `Test`, `Build`, `Playwright E2E`). Only `Smoke test Vercel preview`
   matches literally. Harmless to humans; breaks any script grepping `gh pr checks` output.
5. **`gitleaks.yml` does not exist.** `operations.md:345` and `quality-agents.md:36,45,306` describe
   a standalone workflow running daily at 04:00 UTC. Ground truth: gitleaks is a job inside
   `security.yml:17-34`, and the schedule is `0 8 * * *` (`security.yml:8-10`), with an inline
   comment confirming the change was deliberate and the docs never followed.
6. **`pnpm` vs `npm`.** The repo is npm-only (`package.json:153` `"packageManager": "npm@11.4.0"`,
   only `package-lock.json` exists), but six agent-facing files hardcode `pnpm`:
   `.claude/commands/fix-ci.md:29`, `.claude/skills/ci-workflow/SKILL.md:46,61-62,79`,
   `.claude/skills/deployment-safety/SKILL.md:62`, `.claude/skills/git-workflow/SKILL.md:69,76`,
   `.claude/skills/multi-agent/SKILL.md:77`, `.claude/skills/error-patterns/SKILL.md:31`. These are
   unadapted cc-rpi template artifacts.
7. **False cross-reference.** `docs/operations/pre-launch-security-checklist.md:9-10` claims it "is
   referenced by `CLAUDE.md` (Production Release Step 2)". `CLAUDE.md:83-96` contains no mention of
   it, gitleaks, or any of its six gates. Six manual security gates are therefore documented but
   unreferenced by the procedure that supposedly requires them.
8. **No `/explore-release` command exists** in `.claude/commands/` — template Wave B has no
   implementation here (unlike the Chapa reference, where it exists but is mis-wired).
9. **Version/tag drift.** `package.json:3` = `1.6.0`; `CHANGELOG.md` documents 8 versions but only
   6 tags exist — `v1.3.0` and `v1.6.0` have entries and no tags. PR #702 was closed unmerged, and
   `CHANGELOG.md:8-9`'s `[Unreleased]` section is empty, implying v1.6.0 is *considered* released.
10. **Stale counts.** `README.md:107,205` "83 migration files" (actual **96**);
    `README.md:207-208` "9 workflows" (actual **11**); `quality-agents.md:33` "18 spec files"
    (actual **20**); `operations.md:33` "~6,347 tests" (actual **7,274** per
    `docs/agents/coverage-report.md`, 2026-07-23). `operations.md:344` and `README.md:220` describe
    `security.yml` as weekly with `--audit-level=critical`; it is daily with
    `--omit=dev --audit-level=moderate` (`security.yml:8-10,57`), and neither doc mentions its third
    job `vercel-env-safety`. `operations.md:324` omits the `madge --circular` step present at
    `ci.yml:68`.

Checked and **not** contradictory: `docs/operations/operations.md:189-194` documents 6 Vercel crons
matching `vercel.json:5-30` exactly (the Chapa-equivalent cron drift does not exist here). Every
`npm run` command referenced in `CLAUDE.md`'s release process was verified to exist in
`package.json`: `test`, `typecheck`, `lint`, `prelaunch`, `prelaunch:live`, `test:e2e`,
`check-verification-coverage`, `check-env`, `check-migrations`.

### 9.3 Rollback capability (assessed)

`docs/operations/rollback.md` is a real, executable runbook, not prose. Four procedures: Vercel CLI
rollback (`:24-35`, with an explicit "NEVER promote a broken deployment 'briefly' to capture logs"
warning at `:41`); code revert on `develop` → PR (`:45-93`); dependency-upgrade revert (`:95-106`);
and database **forward-only compensation migrations** — explicitly no `down.sql`, no native rollback
(`:110-169`), cross-referencing `migration-policy.md`'s DO-M1 ordering rule. It opens by citing the
2026-03-24 incident: "Roll back first, investigate second" (`:5`).

Notably, it is **not linked** from `docs/operations/operations.md` (the canonical ops doc — `grep -n
rollback` returns zero hits) nor from `CLAUDE.md`'s Project File Locations table (`CLAUDE.md:383-391`).

---

## 10. Decisions Required Before Planning

These cannot be resolved from repository evidence. They are the user's to make.

**D-A. Candidate identity.** Squash merge means the tagged `main` commit was never tested. Options
observed as mechanically available: (a) bind evidence to the immutable Vercel deployment ID and
promote that exact deployment; (b) change merge strategy back to merge-commit so the tested SHA
survives; (c) accept post-merge re-verification on `main` before tagging. Each has different
implications for `preview-smoke.yml`'s trigger.

**D-B. Where can a state-changing probe safely run?** Preview currently shares the production
database and holds live-mode Stripe keys. Until this changes, no environment supports a safe
mutating release probe. Options: provision a second Supabase project; add Stripe test-mode keys to
Preview scope; or restrict release probes to read-only.

**D-C. Which checks become `@release-required`?** No tagging exists, so the initial set is a
greenfield choice. Template A3 asks for coverage of: deployed identity, public/authenticated health,
one critical read, one critical state change, an authorization denial, datastore readback, cleanup,
the most important vendor seam, and the highest-risk recent regression.

**D-D. Evidence storage and retention.** No release evidence is persisted today. Current CI artifact
retention is 1 day (coverage blobs) to 14 days (Playwright/Lighthouse reports);
`preview-smoke`/`security`/`develop-smoke` upload nothing.

**D-E. Wave scope.** Template §"Adoption scaling" states Wave A is the mandatory floor and C–H are
adopted by risk. Which waves are justified for a solo-maintainer, pre-traction site.

**D-F. Whether to fix the two vacuous-pass holes now** (`preview-smoke` Dependabot exit-0;
`e2e-stripe-integration` zero-test green) as part of Wave A, or track separately.

---

## 11. Immediately Actionable Non-Template Findings

Surfaced during research, outside the E2E Pro scope, recorded so they are not lost:

- **Issue #734 (Anthropic credit exhaustion) is still open**, 8 days, and `docs/agents/qa-report.md`
  (2026-07-22) records it as an unresolved recurrence affecting production chat.
- **`.claude/skills/deploy/SKILL.md` would merge to `main` on green CI with no authorization gate**
  (§9.2 item 1). It is user-invocable as `/deploy`.
- **`Security Scan` is currently failing on `main`** (scheduled run, 2026-07-28T08:55:04Z). Cause
  not investigated.
- `/api/mcp/make-booking/status` accepts Twilio status callbacks with **no signature verification**.
- `develop` has **zero** required status checks despite being the branch all development lands on.
- `MCP_API_SECRET` is set in no workflow and no Playwright env, so 16 of 31 MCP specs have never run
  in CI.
- A stray `paisaxe-hotfix` Vercel project exists alongside `paisaxe`; the `hotfix/prod-deps` branch
  is still present locally.
- `scripts/launchd/` tracks 7 plists but 8 are installed (`docs-freshness-agent.plist` and
  `cost-analyst-agent.plist` are installed but untracked).
- Locale count disagreement: `operations.md:313` says 5 locales, `quality-agents.md:224` says 6
  (adds `ast`). UNVERIFIED which is current.

---

## Appendix: Research Method

Five parallel read-only agents covered release topology/CI, test suite, environments/candidate
identity, capability surface/state/vendors, and documentation drift. All five reported. Findings
were verified independently by the lead where they were decisive: production `/api/health` was
probed directly, `vercel ls` and `gh run view --log` were used to resolve the preview-build question
empirically, and the requiredness-tag and Playwright `baseURL` findings were confirmed by direct
grep rather than accepted from an agent summary.

One lead-introduced error was corrected during synthesis: an initial count of 22 Playwright specs
was wrong (the directory also contains `fixtures/`, `tsconfig.json`, `storage-state.json`, and a
snapshots directory). The verified count is **20** `*.spec.ts` files.

Unit-test layer, for completeness: 373 `*.test.ts(x)` files under `src/` plus 10 under `scripts/`;
`vitest.config.ts:35-51` sets coverage thresholds of statements 95 / branches 90 / functions 95 /
lines 95, and `:52-56` caps `maxWorkers: 4` locally with a comment attributing admin-UI dialog
timeouts to worker starvation. A separate `vitest.config.qa.ts` covers `src/tests/qa/**` with longer
timeouts for real API calls, run only via `npm run test:qa`.

No files outside this document and `docs/release/e2e-pro-playbook.md` were created or modified. No
writes were performed against Vercel, Supabase, GitHub, or any vendor.
