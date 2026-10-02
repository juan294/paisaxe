# Secret Inventory & Rotation Runbook

> Which secrets exist, where each copy lives, and the order to rotate them in
> without an outage. Values are never recorded here — only env var **names**
> (already visible in `.env.example` and `scripts/check-env.ts`), storage
> locations, and consuming code paths.

Addresses DO-M3 (#830): before this document, no single place listed which
secrets exist, which systems hold each copy, or the ordered steps to rotate
one safely.

## Scope

This covers real credentials — API keys, tokens, webhook/shared secrets,
passwords — not every `.env.example` entry. Public identifiers that are safe
to expose (`NEXT_PUBLIC_*` values, OAuth client IDs, Stripe price IDs, phone
numbers, email addresses) are out of scope; they need no rotation procedure
because their disclosure is not a security event.

`npm run check-secret-inventory` (`scripts/check-secret-inventory.ts`) checks
this document against `.env.example` for drift in both directions: every
credential-shaped var in `.env.example` must have a row below, and every row
below must still exist in `.env.example` (or be on the explicit
GitHub-Actions-only allowlist inside the script, for secrets like
`VERCEL_TOKEN` that the app never reads via `process.env`).

## How to read the table

- **Storage** — every place a copy of the value is configured. A secret with
  more than one location is **multi-homed**: rotating it means updating every
  location, and the order matters when two locations must agree with each
  other for a request to succeed.
- **Cadence** — proposed rotation frequency. No formal policy existed before
  this document; these are defaults for a solo-operator project, not
  externally mandated. Adjust in this file if the operator decides otherwise.
- **Consuming code** — where to look when a rotation breaks something.

## Inventory

| Secret | Purpose | Storage | Consuming code | Cadence |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API (chat, embeddings prompts, agents) | Vercel (Production + Preview); GitHub Actions secret (Claude Review workflow); local `.env.local` | `src/lib/claude.ts`, `src/config/agent-prompts.ts` | Annual, or immediately on suspected leak |
| `SUPABASE_SERVICE_KEY` | Server-side Supabase admin client (bypasses RLS) | Vercel (Production + Preview); GitHub Actions secret (`SUPABASE_SERVICE_KEY`, used by Playwright/integration CI) | `src/lib/supabase*.ts` (admin client construction) | Annual, or immediately on suspected leak — highest blast radius in this table |
| `VOYAGE_API_KEY` | Embeddings (voyage-3.5) and reranking (rerank-2.5) | Vercel (Production + Preview); local `.env.local` (for `npm run seed-db`) | `src/lib/embeddings.ts`, `src/lib/rerank.ts` | Annual |
| `ELEVENLABS_API_KEY` | Dedicated voice-agent runtime API key (Pelayo, booking, marketing agents) | Vercel (Production + Preview). Local `.env.local` may use the same variable name only with a distinct operations key; never copy the production runtime value there. | `src/lib/elevenlabs-credentials.ts`, `src/lib/elevenlabs-signed-session.ts`, `src/lib/services/elevenlabs-call-service.ts` | Annual, through `docs/runbooks/elevenlabs-credential-rotation.md` |
| `ELEVENLABS_WEBHOOK_SECRET` | Verifies inbound post-call webhooks from ElevenLabs | Vercel (Production + Preview); ElevenLabs dashboard (webhook config) | `src/lib/services/elevenlabs-webhook-service.ts` | Annual — **multi-homed**, see below |
| `GITHUB_TOKEN` (PAT) | GitHub traffic stats sync | Vercel (Production); local `.env.local` (optional) | `src/app/api/cron/github-traffic-sync/route.ts` | Annual, or on scope change (PAT is `repo`-scoped) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth for admin sign-in | Supabase Dashboard (Authentication → Providers → Google) — **not read from `process.env` by the app**; `.env.example` documents it for reference only | Configured entirely in Supabase Auth, no in-app consumer | Per Google Cloud Console guidance; no forced cadence |
| `MCP_API_SECRET` | Authenticates MCP tool requests (weather, places, booking) | Vercel (Production + Preview) | `src/lib/mcp-auth.ts` | Annual |
| `OPENWEATHERMAP_API_KEY` | Voice agent weather tool | Vercel (Production + Preview) | `src/app/api/mcp/weather/route.ts` | As needed (free-tier key, low sensitivity) |
| `GOOGLE_PLACES_API_KEY` | Voice agent places tool; content-discovery cron | Vercel (Production + Preview) | `src/app/api/mcp/places/route.ts`, `src/app/api/cron/content-discovery/route.ts` | Annual (billed API — rotate if usage looks anomalous) |
| `STRIPE_SECRET_KEY` | Live-mode Stripe API (checkout, revenue analytics) | Vercel (Production only — never Preview/Test) | `src/lib/stripe.ts` | Annual, or immediately on suspected leak |
| `STRIPE_WEBHOOK_SECRET` | Verifies live-mode Stripe webhook signatures | Vercel (Production); Stripe Dashboard (webhook endpoint config) | `src/lib/stripe.ts` (webhook route) | Annual — **multi-homed**, rotate together with the Stripe Dashboard webhook endpoint's signing secret |
| `STRIPE_TEST_SECRET_KEY` / `STRIPE_TEST_WEBHOOK_SECRET` | Test-mode Stripe for CI E2E (`e2e-stripe-integration.yml`) | GitHub Actions secrets only; local `.env.local` for `npm run test:e2e:stripe` | `scripts/run-stripe-e2e.ts` | As needed — test-mode only, no production blast radius |
| `QA_TEST_USER_PASSWORD` | Dedicated Supabase Auth test user for CI/E2E | GitHub Actions secret; Supabase Auth (the test user's actual password) | Stripe E2E workflow, QA test suites | As needed — rotate in Supabase Auth and the GitHub secret together |
| `WEBHOOK_SECRET` | Shared secret for Supabase→app database webhooks and manual/pg_cron POST recovery | Vercel (Production + Preview); Supabase `webhook_config` table (`key = 'secret'`) | `src/lib/cron-auth.ts` (`verifyWebhookSecret`), `src/app/api/webhooks/supabase/route.ts` | Annual — **multi-homed**, see below |
| `TWILIO_AUTH_TOKEN` | Twilio SMS (booking confirmations, QA alerts) | Vercel (Production + Preview) | `src/lib/twilio-sms.ts` | Annual |
| `CREDENTIALS_ENCRYPTION_KEY` | Encrypts stored third-party credentials at rest | Vercel (Production + Preview) | `src/lib/encryption.ts`, `src/lib/credentials.ts` | **Do not rotate casually** — rotating without a re-encryption migration makes existing encrypted rows unreadable. Treat as compromise-only; plan a re-encrypt-then-rotate migration before changing it. |
| `RESEND_API_KEY` | Transactional email (admin alerts) | Vercel (Production + Preview) | `src/lib/email.ts` | Annual |
| `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting, embedding cache | Vercel (Production + Preview); Upstash console | `src/lib/rate-limit.ts`, `src/lib/embedding-cache.ts` | Annual |
| `CRON_SECRET` | Vercel Cron request auth; gates `/api/health` build-identity disclosure; local release-identity verification | Vercel (Production — Vercel's Cron feature reads this same env var to construct its own `Authorization` header); local `.env.local` (operator's copy, for `scripts/release/candidate-identity.ts`) | `src/lib/cron-auth.ts` (`verifyVercelCron`), `src/app/api/health/route.ts`, `scripts/release/candidate-identity.ts` | Annual — **multi-homed** (see below): the operator's local copy goes stale silently after a Vercel-side rotation |
| `HEALTH_PROBE_SECRET` | Authenticates ElevenLabs deep health and candidate/deployed release preflight | Vercel Production; local operator environment during release verification (not provisioned in Vercel Preview or used by any workflow) | `src/app/api/health/voice/route.ts`, `scripts/release/check-elevenlabs-voice-preflight.mjs` | Annual — **multi-homed**; rotate both stores before the next release probe |
| `POSTHOG_PERSONAL_API_KEY` | Server-side PostHog analytics API (admin dashboard) | Vercel (Production) | `src/app/api/admin/analytics/route.ts`, `src/app/api/admin/costs-analytics/route.ts` | Annual |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bypasses Vercel deployment protection for release-verification probes | Vercel (Deployment Protection settings); local `.env.local` | `scripts/release/candidate-identity.ts`, `scripts/check-health-readiness.mjs` | Annual |
| `VERCEL_TOKEN` | CI-only: `vercel-env-safety` job reads deployed env var names via the Vercel API | GitHub Actions secret only — **not in `.env.example`**, the app never reads it | `.github/workflows/security.yml` | Currently **unset** (action required — see `operations.md` CI/CD Workflows). Once added: annual |
| `SUPABASE_LOCAL_ANON_KEY` | Local Docker Supabase stack override | Local `.env.local` only (optional; defaults to the well-known `supabase start` demo anon key) | `src/test/local-supabase.ts` | Not sensitive — it is the public, well-known local-dev default; no rotation needed |
| `SUPABASE_LOCAL_SERVICE_ROLE_KEY` | Local Docker Supabase stack override, service-role-only RPC tests (#871) | Local `.env.local` only (optional; defaults to the well-known `supabase start` demo service-role key) | `src/test/local-supabase.ts` | Not sensitive — it is the public, well-known local-dev default; no rotation needed |

## Multi-homed secrets: rotation order

Rotating any single-homed secret (only one storage location) is: generate the
new value at the provider → update the Vercel env var → redeploy → confirm
`/api/health` or the relevant feature still works → revoke the old value at
the provider. The four secrets below need a specific order because two
storage locations must agree with each other mid-rotation.

### WEBHOOK_SECRET rotation (Vercel and Supabase webhook_config)

Supabase's `notify_webhook()` trigger (migration `013_database_webhooks.sql`)
reads the secret from the `webhook_config` table and sends it as a header;
the Next.js app validates that header against the `WEBHOOK_SECRET` Vercel env
var. Webhook delivery is fire-and-forget (`pg_net`, non-blocking) — a
mismatch window drops in-flight webhook-triggered revalidations, it does not
cause a user-facing outage, because the `revalidate: 60` data cache still
serves stale-but-correct content until the next natural cache refresh.

1. Generate the new secret value.
2. Have both update commands ready before running either, to minimize the
   mismatch window:
   ```sql
   UPDATE webhook_config SET value = '<new-secret>' WHERE key = 'secret';
   ```
   ```bash
   vercel env rm WEBHOOK_SECRET production
   vercel env add WEBHOOK_SECRET production   # paste <new-secret>
   ```
3. Run the Supabase `UPDATE`, then immediately trigger a Vercel redeploy so
   the new env var takes effect (env var changes require a redeploy to reach
   running functions).
4. Verify: update a `stories` or `feature_flags` row and confirm
   `[STORIES_CACHE_MISS]` / a successful `POST /api/webhooks/supabase` shows
   in the log drain with no `[CRON_AUTH_REJECTED]` events.

### CRON_SECRET rotation (Vercel and the operator's local copy)

Vercel's own Cron feature reads this env var to construct the
`Authorization: Bearer <value>` header it sends on every scheduled
invocation — there's no separate "Vercel Cron secret" to configure, it's the
same env var. The second location is the operator's local `.env.local`,
consumed by `scripts/release/candidate-identity.ts` during releases.

1. Rotate the Vercel env var and redeploy — Vercel Cron and `/api/health`
   both pick up the new value from the same source, no coordination needed
   between them.
2. Update the operator's local `.env.local` with the same new value.
3. If step 2 is skipped, the failure mode is silent until the next release:
   `candidate-identity.ts --verify` will report the deployment's build
   identity as unreadable/unauthorized, not that the secret is stale — check
   here first if that script starts failing after a `CRON_SECRET` change.

### SUPABASE_SERVICE_KEY rotation (Vercel and GitHub Actions)

Same Supabase-issued value duplicated in two independent secret stores.

1. Rotate the key in the Supabase Dashboard (Settings → API) — this
   immediately invalidates the old value.
2. Update the Vercel `SUPABASE_SERVICE_KEY` env var and redeploy immediately
   — production admin operations (auth, RLS-bypassing queries) fail with the
   old value the moment step 1 completes.
3. Update the `SUPABASE_SERVICE_KEY` GitHub Actions repository secret so CI
   integration tests don't start failing on the next run.

### STRIPE_WEBHOOK_SECRET rotation (Vercel and Stripe Dashboard)

Stripe issues a new signing secret whenever a webhook endpoint's secret is
rolled in the Dashboard — the old and new secrets are both valid for a grace
period Stripe manages, so this one has more slack than the others.

1. In the Stripe Dashboard, roll the signing secret for the
   `/api/webhooks/stripe` endpoint.
2. Update the Vercel `STRIPE_WEBHOOK_SECRET` env var and redeploy.
3. Confirm via Stripe Dashboard → Webhooks → recent deliveries that
   signature verification succeeds post-redeploy, then let the old secret
   expire naturally (or revoke it immediately in the Dashboard once the new
   one is confirmed working).

## Revocation (suspected compromise)

For any secret in the table above, in order:

1. **Revoke or rotate at the source first** (Supabase Dashboard, Stripe
   Dashboard, Anthropic Console, etc.) — this is the step that actually stops
   an attacker; everything after this is restoring service, not containment.
2. Follow the relevant rotation order above (if the secret is multi-homed) to
   restore service with the new value.
3. If the leak was via git history (not just a runtime log or a
   misconfigured client), also run Gitleaks locally against the full history
   to confirm scope, and check whether other secrets appear in the same
   commit.
4. File a post-mortem issue: `gh issue create --title "Incident: <secret>
   compromised <date>" --label "type: security,priority: critical,area:
   infra"`.
5. For `CREDENTIALS_ENCRYPTION_KEY` specifically: rotation on compromise
   requires decrypting all existing rows with the old key and re-encrypting
   with the new one in the same migration window — a bare env var swap
   leaves existing rows undecryptable. Plan this as a data migration, not an
   env var change.

## See also

- [Operations Guide](./operations.md) — pg_cron jobs, health endpoints, CI/CD workflows
- [Alerting Runbook](./alerting-runbook.md) — Cron Auth Rejected, Rate Limit Backend Degraded
- [Rollback](./rollback.md) — service recovery when a rotation goes wrong
- `.env.example` — the authoritative list of all env vars, secret and non-secret
- `scripts/check-env.ts` — verifies every `process.env` var used in `src/`/`scripts/` is documented in `.env.example`
- `scripts/check-secret-inventory.ts` — verifies this document stays in sync with `.env.example`
