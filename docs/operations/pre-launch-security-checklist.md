# Pre-Launch Security Checklist

> SE-S1: Security gates that MUST be satisfied before every production release
> to `main`. Gates 2–6 need things automated CI doesn't have — live credentials,
> a running deployment, or external network access — so a human must execute
> each of those steps and record the result. Gate 1 (secret history scan) *is*
> fully automated in CI; it's listed here as a checklist item so the release
> manager confirms it passed for the exact commit/tree being released, not to
> ask for a manual re-scan.

This document converts SE-S1 from an open finding into a tracked, documented gate.
It is referenced by `CLAUDE.md` (Production Release Step 2) and must be completed
before the release PR is created.

---

## Gate 1 — Secret History Scan (Gitleaks) — Automated (CI Gate)

**Why:** Secrets committed to git history persist even after the file is
deleted, so a secret scan needs to cover history, not just the working tree.
The `Security Scan` workflow (`.github/workflows/security.yml`) already does
this: it checks out full git history (`fetch-depth: 0`) and runs a blocking
Gitleaks scan against it on every push to `develop`/`main`, every PR, and
daily at 08:00 UTC.

**What to do:** Confirm the `Gitleaks secret scan` check passed for the exact
commit/tree being released — not just "the PR is green" (see
`docs/runbooks/release-checklist.md` Step 1: squash merges don't preserve the
tested SHA, releases are identified by tree hash). Do not manually re-run
Gitleaks as a substitute for this; find the run for that commit/tree in the
Actions tab and confirm its status.

**If the CI job ever fails:** Don't read the failure details from the public
Actions log. CI's invocation (`gitleaks detect --source . --verbose`) has no
`--redact` flag, so a real match would print in plaintext. Pull the report
locally instead:

```bash
# Install gitleaks if not present
brew install gitleaks

# Scan the full git history with redaction (safe to run in a terminal)
gitleaks detect --source . --redact --report-format json --report-path /tmp/gitleaks-report.json

# Review any findings
cat /tmp/gitleaks-report.json | jq '.[] | {file, startLine, rule: .RuleID}'
```

**Pass criteria:** `Gitleaks secret scan` CI check is green for the released
commit/tree. False positives must be baseline-listed in `.gitleaks.toml`.

**Run by:** Automated (CI). Release manager confirms the check status before
every `develop → main` PR; falls back to the local redacted scan above only
if the CI check fails.

---

## Gate 2 — Admin-as-Non-Admin Probe (dynamic auth check)

**Why:** Unit tests mock the auth layer. A dynamic probe verifies the live stack
rejects non-admin users from admin endpoints — not just the mock.

**Requires:** QA test user credentials (`QA_TEST_USER_EMAIL` / `QA_TEST_USER_PASSWORD`).

```bash
# Step 1: Get an access token for the QA user (non-admin role)
# Log in via the app and capture the Supabase session token from browser DevTools
# (Network tab → /auth/v1/token → access_token in response body)
QA_TOKEN="<paste-token-here>"
BASE_URL="https://paisaxe.es"

# Step 2: Probe admin endpoints — all must return 403 (not 200)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $QA_TOKEN" \
  "$BASE_URL/api/admin/analytics"
# Expected: 403

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $QA_TOKEN" \
  "$BASE_URL/api/admin/stories"
# Expected: 403

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $QA_TOKEN" \
  "$BASE_URL/api/admin/agent-reports"
# Expected: 403
```

**Pass criteria:** All admin endpoints return 403 (not 200, not 500) for the
non-admin QA user.

**Automated coverage (unit tests):**
- `src/lib/admin-auth.test.ts` — `validateAdminAuth` → 401 when no session,
  403 when role is 'user', 403 when profile not found, 500 when DB error.
- `src/lib/admin-auth.test.ts` — `withAdmin` HOF → 401 response, handler not
  called; 403 response for non-admin user.
- `src/lib/admin-auth.test.ts` — `withAdminRead` HOF → 401 and 403 cases.
- `src/app/api/admin/analytics/route.test.ts` — returns 401 on missing auth.
- `src/app/api/admin/stories/route.test.ts` — returns 401 on missing auth.
- Multiple other `src/app/api/admin/*/route.test.ts` files assert 401/403.

---

## Gate 3 — Cron Endpoint Without VERCEL_CRON_SECRET

**Why:** Cron jobs must reject unauthenticated callers. The live environment
uses `VERCEL_CRON_SECRET`; verifying that this header is required prevents
unintended external triggering.

```bash
BASE_URL="https://paisaxe.es"

# Probe cron endpoints without the secret header — all must return 401
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/cron/fail-stale-bookings"
# Expected: 401

curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/cron/fail-stale-translations"
# Expected: 401

curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/cron/content-discovery"
# Expected: 401
```

**Pass criteria:** All cron endpoints return 401 without the `x-vercel-cron`
header.

**Automated coverage (unit tests):**
- `src/lib/cron-auth.test.ts` — validates the cron secret check.
- `src/app/api/cron/fail-stale-bookings/route.test.ts:41` — returns 401 when
  Vercel-Cron header is missing.
- `src/app/api/cron/fail-stale-translations/route.test.ts` — same pattern.
- `src/app/api/cron/content-discovery/route.test.ts` — same pattern.

---

## Gate 4 — MCP Endpoints Without MCP_API_SECRET

**Why:** MCP endpoints are called by ElevenLabs voice agents using a shared
secret. They must reject callers that don't present the correct `x-mcp-secret`
header.

```bash
BASE_URL="https://paisaxe.es"

# Probe MCP endpoints without secret — all must return 401
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/mcp/places?query=sidra"
# Expected: 401

curl -s -o /dev/null -w "%{http_code}" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"test"}' \
  "$BASE_URL/api/mcp/places"
# Expected: 401
```

**Pass criteria:** All MCP endpoints return 401 without the `x-mcp-secret`
header.

**Automated coverage (unit tests):**
- `src/lib/mcp-auth.test.ts` — `validateMcpSecret` returns false when header
  is missing, wrong value, empty string, or env var is unset.
- `src/app/api/mcp/places/route.test.ts:74` — GET returns 401 when
  x-mcp-secret is missing.
- `src/app/api/mcp/places/route.test.ts:82` — GET returns 401 when wrong.
- `src/app/api/mcp/places/route.test.ts:91` — GET returns 401 when env var
  is not set.
- `src/app/api/mcp/places/route.test.ts:276` — POST returns 401 when missing.
- `src/app/api/mcp/places/route.test.ts:287` — POST returns 401 when wrong.
- `src/app/api/mcp/make-booking/route.test.ts` — same patterns.
- `src/app/api/mcp/weather/route.test.ts` — same patterns.

---

## Gate 5 — Stripe Webhook Without Valid Signature

**Why:** The Stripe webhook endpoint writes to the database. It must reject
requests without a valid `stripe-signature` header.

```bash
BASE_URL="https://paisaxe.es"

# Probe without signature header — must return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed"}' \
  "$BASE_URL/api/webhooks/stripe"
# Expected: 401
```

**Automated coverage (unit tests):**
- `src/app/api/webhooks/stripe/route.test.ts:95` — returns 401 when signature
  header is missing.
- `src/app/api/webhooks/stripe/route.test.ts:103` — returns 401 when signature
  is invalid.

---

## Gate 6 — Full Stripe Integration (prelaunch:live)

**Why:** The unit and E2E mock suites cannot verify the real Stripe→webhook→DB
path. This requires live test-mode credentials.

```bash
# Requires: STRIPE_TEST_SECRET_KEY, STRIPE_TEST_WEBHOOK_SECRET,
#           STRIPE_TEST_DAY_PASS_PRICE_ID, QA_TEST_USER_EMAIL,
#           QA_TEST_USER_PASSWORD, SUPABASE_SERVICE_ROLE_KEY
npm run prelaunch:live
```

This runs `e2e/stripe-real-checkout.spec.ts` which:
1. Authenticates as the QA test user
2. Completes a full Stripe test-mode checkout with card `4242 4242 4242 4242`
3. Manually fires the `checkout.session.completed` webhook
4. Polls the DB to confirm the purchase record was created
5. Verifies the "Start Talking" CTA appears after page reload

**Pass criteria:** The test passes end-to-end without retries.

---

## XSS Canary (Automated — CI Gate)

The XSS canary runs automatically in CI on every push as part of the default
`desktop` Playwright project (`e2e/xss-canary.spec.ts`). It verifies that
injected `<script>` tags and `onerror` attributes are stripped before reaching
the DOM in the chat markdown renderer.

This gate does NOT need manual execution — it is already a required CI check.

---

## Checklist Summary

Before creating a `develop → main` release PR, confirm:

- [ ] Gate 1: `Gitleaks secret scan` CI check is green for the released commit/tree
- [ ] Gate 2: Admin endpoints return 403 for non-admin QA user
- [ ] Gate 3: Cron endpoints return 401 without `x-vercel-cron` header
- [ ] Gate 4: MCP endpoints return 401 without `x-mcp-secret` header
- [ ] Gate 5: Stripe webhook returns 401 without valid signature
- [ ] Gate 6: `npm run prelaunch:live` passes end-to-end
- [x] XSS canary: runs automatically in CI (no manual step needed)

Record the results as a comment on the release PR before requesting merge.
