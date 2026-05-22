# Security Agent Report — 2026-05-21

## Status: YELLOW (advisory)

**1 advisory detected, 0 exploitable.** Same single moderate DoS advisory in transitive `brace-expansion@5.0.5` (loaded only via `eslint-plugin-react` → `minimatch` at lint time). Carries forward from May 19/20: existing `overrides.brace-expansion` pin in `package.json:138` (`">=5.0.5"`) is one patch behind the upstream fix (`>=5.0.6`). Not exploitable from any runtime code path. All other surface (CSP, HSTS, license, CI automation) remains in known-good state.

## Executive Summary

- **1 advisory total** (moderate), **0 exploitable** in the runtime bundle. Unchanged from May 20.
- `brace-expansion` is reachable only via `eslint-plugin-react` → `minimatch@10.2.4` — pure dev/build-time path. No client-side or server-runtime ingestion of user input.
- One-line fix still pending: bump `overrides.brace-expansion` in `package.json:138` from `">=5.0.5"` to `">=5.0.6"`, then `npm install`. `npm audit fix` will do the same in one shot.
- All seven security headers present in source and verified previously in production (CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy).
- CI security automation healthy: Dependabot configured, Gitleaks in CI, npm audit in CI, license-check in CI. Renovate not configured — Dependabot covers the surface.
- License compliance: no copyleft violations. The single LGPL-3.0 package is a platform-specific native binary (`@img/sharp-libvips-darwin-arm64`) covered by `docs/project/license-exceptions.md`.
- 25 outdated packages, all minor/patch, none CVE-bearing. Five-to-eight production deps still recommended to batch with Performance Agent's 16+ cycle overdue `npm run build:analyze`.

## Vulnerability Table

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| Moderate | brace-expansion@5.0.5 | GHSA-jxxr-4gwj-5jf2 (no CVE assigned) | DoS via large numeric range bypassing documented `max` protection in `expand(pattern)` | Yes — `npm audit fix` (upstream patch >=5.0.6) | NOT EXPLOITABLE. Dep reached only via `eslint-plugin-react` → `minimatch@10.2.4` → `brace-expansion@5.0.5`. Lint/build-time only; never invoked on user-controlled input at runtime. |

## Detailed Exploitability Analysis

### brace-expansion (GHSA-jxxr-4gwj-5jf2) — NOT EXPLOITABLE

**Dep chain.** `npm ls brace-expansion` returns exactly one path:

```
paisaxe@1.5.1
`-- eslint-plugin-react@7.37.5
  `-- minimatch@10.2.4
    `-- brace-expansion@5.0.5
```

**Why it does not apply here.**

1. `eslint-plugin-react` runs only during `eslint` invocations (CI lint job and pre-commit) — never at production runtime, never in the client bundle, never on a Vercel function execution path.
2. `minimatch` patterns inside ESLint come from project config (`eslint.config.mjs`, ignore patterns), not from user input.
3. No `src/` code imports `minimatch` or `brace-expansion` directly. Application glob handling is done by `globby` / Next.js routing, neither of which depends on this version chain.
4. Even at lint time, the only `brace-expansion` consumer is ESLint walking `node_modules` / source globs — none of which contain attacker-crafted numeric ranges like `{1..2147483647}`.

**Fix.** The override in `package.json:138` currently pins `"brace-expansion": ">=5.0.5"`, which still matches the vulnerable `5.0.5`. Two equivalent paths:

```bash
# Option A — let npm pick it up via the existing override
npm install   # only after bumping the override below

# Option B — let npm audit fix do both
npm audit fix
```

The sticky fix is to edit `package.json:138`:

```diff
-    "brace-expansion": ">=5.0.5",
+    "brace-expansion": ">=5.0.6",
```

Then `rm -rf node_modules package-lock.json && npm install` (or just `npm install` if you trust the resolver to honor the override on update).

## Prioritized Remediation Steps

1. **Bump `brace-expansion` override to `">=5.0.6"`** — one-line edit in `package.json:138` + `npm install`. Clears the only advisory. **Pair with Performance Agent's overdue `npm run build:analyze` and the prod-dep batch — single worktree session, one commit, attributable bundle delta.** Stop the dev server and `rm -rf .next` first to get a clean production build.
2. **Apply prod-dep batch (zero-CVE, non-urgent)**: `@anthropic-ai/sdk` 0.95.1 → 0.97.1, `posthog-js` 1.372.10 → 1.374.3, `@stripe/stripe-js` 9.4.0 → 9.6.0, `@stripe/react-stripe-js` 6.3.0 → 6.4.0, `@supabase/supabase-js` 2.105.4 → 2.106.1, `@sentry/nextjs` 10.52.0 → 10.53.1, `lucide-react` 1.14.0 → 1.16.0, `tailwind-merge` 3.5.0 → 3.6.0. Do NOT include `voyageai` (0.1.0 pin is intentional).
3. **Re-verify CSP via redirect-following curl** — the metrics script now follows redirects per May 14 triage (`-L` flag). Confirm next-cycle metrics show CSP on the 200 response (not the 308 hop).

## License Compliance — Pass

No copyleft violations. Flagged packages and disposition:

| Package | License | Disposition |
|---------|---------|-------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception — platform-specific native binary dependency of `sharp`. Documented in `docs/project/license-exceptions.md`. LGPL on a native shared library used via FFI does not impose copyleft on the calling JS. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Dual-licensed — we use under Apache-2.0. No copyleft burden. Documented in `docs/project/license-exceptions.md`. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed — MIT side applies. Permissive. |
| `paisaxe@1.5.1` | UNLICENSED | Our own root package. Intentional — not distributed. |
| `simple-concat@1.0.1` | MIT | False positive in flag script (MIT is permissive). No action. |
| `simple-get@4.0.1` | MIT | False positive in flag script. No action. |
| `@babel/template@7.28.6` | MIT | False positive in flag script. No action. |

`COPYLEFT LICENSES FOUND: false` confirmed by the license-check.

## Security Headers — Pass

All required headers present in source (`next.config.ts`) and previously verified live in production (May 10 triage, after the redirect-following fix in May 14 triage).

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` | Pass. PPR-compatible (`'self' 'unsafe-inline'`, no `'strict-dynamic'`, no nonce dependency — matches the constraints in CLAUDE.md "CSP and PPR Compatibility"). |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass (2-year, preload-eligible). |
| X-Frame-Options | `DENY` | Pass. Reinforced by `frame-ancestors 'none'` in CSP. |
| X-Content-Type-Options | `nosniff` | Pass. |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass. |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — microphone allow-listed for Pelayo voice agent (visitor voice flag), camera and geolocation denied. |

**CSP notes (carried).** Script-src uses `'self' 'unsafe-inline'` instead of nonces — required because PPR (`cacheComponents`) prerenders HTML at build time without nonces. Switching to nonce-only would force the root layout dynamic and break the static shell. This is the documented and correct trade-off.

## CI/CD Security Automation — Healthy

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Configured | Pinned to `develop`. Generated PRs #582 and #583 successfully merged this cycle. |
| Renovate | Not configured | Acceptable — Dependabot covers npm and gh-actions surface. |
| Gitleaks in CI | Active | Scans git history on every PR. |
| npm audit in CI | Active | Fails on high/critical. Moderate (brace-expansion) is informational and does not block. |
| License check in CI | Active | Enforces allowed list (MIT, Apache-2.0, BSD, ISC, BlueOak, plus documented exceptions). |
| Smoke test on preview | Active | E2E "CSP canary" verifies JavaScript executes — guards against any CSP regression that would block scripts. |

**Known structural gap (carried).** Dependabot PRs cannot consume `VERCEL_AUTOMATION_BYPASS_SECRET`, so the smoke test fails on Dependabot PRs. This is a secret-forwarding limitation in GitHub Actions, not a security weakness. User merges manually after confirming green elsewhere.

## Outdated Packages — 25 (zero CVE-bearing)

Selected production deps with security relevance (none vulnerable, all minor/patch):

| Package | Current | Latest | Class | Notes |
|---------|---------|--------|-------|-------|
| @anthropic-ai/sdk | 0.95.1 | 0.97.1 | prod | LLM SDK. Patch only — no security advisories. |
| posthog-js | 1.372.10 | 1.374.3 | prod | Analytics SDK. May shift the deferred PostHog chunk (~196 KB) after upgrade — Performance Agent should re-measure in `build:analyze`. |
| @stripe/stripe-js | 9.4.0 | 9.6.0 | prod | Payments SDK. |
| @stripe/react-stripe-js | 6.3.0 | 6.4.0 | prod | Payments wrapper. |
| @supabase/supabase-js | 2.105.4 | 2.106.1 | prod | DB / auth client. |
| @sentry/nextjs | 10.52.0 | 10.53.1 | prod | Error tracking. |
| @sentry/core | 10.52.0 | 10.53.1 | prod | Sentry core. |
| @elevenlabs/react | 1.6.0 | 1.6.2 | prod | Voice SDK (deferred, click-to-mount). |
| @next/eslint-plugin-next | 16.2.4 | 16.2.6 | dev | Pulls in vulnerable brace-expansion chain indirectly — bumping does NOT clear the advisory since the chain comes via `eslint-plugin-react`. |
| @next/bundle-analyzer | 16.2.4 | 16.2.6 | dev | |
| @playwright/test | 1.59.1 | 1.60.0 | dev | |
| jsdom | 29.1.1 | 27.0.1 | dev | Major downgrade in `latest` — likely a metric artifact (test channel divergence). No action. |
| vitest | 4.1.5 | 3.2.4 | dev | Same divergence pattern — `latest` < installed. No action. |
| knip | 6.11.0 | 6.14.1 | dev | |
| voyageai | 0.1.0 | 0.2.1 | prod | **DO NOT UPGRADE** — pin is intentional (carried from prior memory). |

## Webhook & CSRF Surface — Unchanged

- All 4 webhook endpoints (Stripe, ElevenLabs, Supabase, translate) use `timingSafeEqual` for HMAC comparison — 7 call sites total, all verified previously and unchanged this cycle.
- CSRF double-submit token enforcement confirmed working (QA Agent May 3 onward — 12/12 LLM tests pass with Origin-bearing client). SE-M2 origin enforcement still in place.
- Sentry Replay PII surface remains eliminated (commit `fef651f5`, Apr 22).
- Coverage Agent confirms all webhook DB-error and SMS-enqueue-failure paths fully covered.
