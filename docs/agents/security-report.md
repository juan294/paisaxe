# Security Report — 2026-04-27

## Health Status: YELLOW

8 moderate advisories detected. **0 exploitable** in this codebase. Two independent transitive-dependency chains carry the advisories — one is build-time only (postcss), the other is unreachable through our usage pattern (uuid). YELLOW reflects the audit count; operational risk is low.

## Executive Summary

- **8 advisories detected, 0 exploitable.** All moderate, all transitive, all blocked from real exploitation by either build-time isolation or unused code paths.
- **0 critical, 0 high.** No remote code execution, auth bypass, or data-exfiltration vectors.
- **0 fixable via `npm audit fix`.** Both fix paths require breaking-change downgrades (`next@9.3.3`, `resend@6.1.3`) — both nonsensical against our installed versions (we are on `next@16.x` and `resend@6.12.x`).
- **License compliance: Pass.** Three flagged licenses (LGPL, MPL, UNLICENSED) are all approved exceptions documented in `docs/project/license-exceptions.md`.
- **CI/CD security automation: Solid.** Dependabot, Gitleaks, npm audit, and license-check all run in CI.
- **Security headers: Pass.** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all configured in source. Live verification skipped this cycle (no running server).
- **Status change vs Apr 25**: YELLOW (stable). Same 8 advisories, same exploitability conclusion.

## Vulnerability Table

| Severity | Package | Advisory | Attack Vector | Fixable | Risk |
|----------|---------|----------|---------------|---------|------|
| Moderate | postcss <8.5.10 | GHSA-qx2v-qp2m-jg93 (PostCSS Stringify XSS via unescaped `</style>`) | XSS via attacker-controlled CSS string parsed at build time. Requires writing malicious CSS into the build pipeline. | No — Next.js bundles `postcss@8.4.31` internally; npm overrides don't penetrate `node_modules/next/node_modules/`. | Not exploitable. Build-time only; no user-supplied CSS path. |
| Moderate | next (transitive of postcss) | Same (GHSA-qx2v-qp2m-jg93) | Inherited from bundled postcss. | No. | Not exploitable — same build-time isolation. |
| Moderate | @sentry/nextjs (transitive of next) | Same | Inherited. | No. | Not exploitable. |
| Moderate | @vercel/analytics (transitive of next) | Same | Inherited. | No. | Not exploitable. |
| Moderate | @vercel/speed-insights (transitive of next) | Same | Inherited. | No. | Not exploitable. |
| Moderate | uuid <14.0.0 | GHSA-w5hq-g745-h8pq (uuid: missing buffer bounds check in v3/v5/v6 when `buf` is provided) | Buffer overflow if caller passes a too-small `buf` argument to `uuid.v3/v5/v6`. | Indirectly via `npm install` after svix releases >=1.91.2 upstream. | Not exploitable. Our code never imports `uuid` directly (grep confirms 0 matches in `src/`). svix uses `uuid.v4` (unaffected). |
| Moderate | svix (transitive of uuid via resend) | Same | Inherited. | No (await upstream). | Not exploitable. |
| Moderate | resend (transitive of svix) | Same | Inherited. | No. | Not exploitable. |

## Detailed Exploitability Analysis

### Chain 1: postcss XSS (5 advisories)

**Advisory**: `GHSA-qx2v-qp2m-jg93` — PostCSS Stringify can output unescaped `</style>` sequences when serializing CSS that contains attacker-controlled content. Could allow CSS-injection-to-HTML-injection if the resulting CSS is inlined into a `<style>` tag at runtime with attacker input.

**Reachability in this codebase**:
1. We use postcss only via `@tailwindcss/postcss` at **build time** (`postcss.config.mjs`). It runs once during `next build`, processing authored Tailwind classes and project CSS — not user input.
2. The vulnerable copy is the one Next.js bundles internally (`node_modules/next/node_modules/postcss@8.4.31`), not the top-level `postcss@8.5.10` we depend on directly.
3. No runtime path takes user input and passes it through `postcss.stringify()`. CSS is shipped as static `*.css` assets — no runtime stringification of user data.

**Why npm overrides don't fix this**: Next.js 16.x ships with its own pinned `postcss@8.4.31` inside `node_modules/next/node_modules/postcss`. We confirmed Apr 25 that adding `"postcss": ">=8.5.10"` to `package.json` overrides does not penetrate Next's nested copy. The only durable fix is upstream — Next.js must release a version that bumps the inner postcss to >=8.5.10.

**Status**: Track Next.js releases. No code action available.

### Chain 2: uuid bounds-check (3 advisories)

**Advisory**: `GHSA-w5hq-g745-h8pq` — `uuid.v3()`, `uuid.v5()`, `uuid.v6()` accept an optional `buf` parameter. If the caller provides a buffer smaller than 16 bytes, the library writes past the buffer end. Requires the caller to (a) use the affected versions, (b) explicitly pass a too-small buffer.

**Reachability in this codebase**:
1. `grep -r 'from "uuid"'` in `src/`: **zero matches**. We do not import `uuid` directly anywhere.
2. The advisory reaches us through `resend → svix → uuid`. svix uses `uuid.v4()`, which does **not** accept a `buf` argument and is unaffected by the advisory.
3. No remote path, attacker, or input flow can trigger the bounds-check failure through our code.

**Status**: Wait for svix >=1.91.2 (will pull uuid >=14.0.0). `npm install` is already current. No action required.

## Prioritized Remediation Steps

1. **No urgent action required.** Both advisory chains are non-exploitable in this codebase.
2. **Monitor Next.js releases** for an inner-postcss bump (clears 5 advisories in one shot).
3. **Monitor svix upstream** for >=1.91.2 (clears 3 advisories).
4. **Live header verification** — re-run `curl -I https://paisaxe.es` next cycle to confirm CSP/HSTS over the wire (skipped this cycle, no running server).
5. **Batch production minor/patch bumps** in the next triage cycle (Stripe, Supabase, Sentry, Anthropic SDK). None are urgent.

## License Compliance

**Status: Pass.** Exactly 3 non-permissive licenses appear in the dep tree, all approved:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception. Documented in `docs/project/license-exceptions.md`. Native shared library used dynamically by `sharp`; LGPL allows linking against proprietary code via dynamic linking. |
| `dompurify@3.4.0` | MPL-2.0 OR Apache-2.0 | Approved exception. We elect Apache-2.0 under the dual license. Pulled in transitively by `@vercel/analytics`. |
| `paisaxe@1.0.0` | UNLICENSED | This is our own package — intentionally not open-sourced. Not a violation. |

**Scanner false positives** (these are actually MIT, scanner mis-grouped):
- `simple-concat@1.0.1` — MIT
- `simple-get@4.0.1` — MIT
- `expand-template@2.0.3` (MIT OR WTFPL — we elect MIT)
- `@babel/template@7.28.6` — MIT (appears in flagged list as a grouping artifact)

**No copyleft violations** (no GPL, no AGPL, no SSPL).

## Security Headers Status

Verified in source (`src/proxy.ts` and `next.config.ts`):

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...` | Pass — PPR-compatible (no `'strict-dynamic'`, no nonces). |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` (production only) | Pass |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — microphone scoped to self for ElevenLabs voice. |
| frame-ancestors (in CSP) | `'none'` | Pass |
| object-src (in CSP) | `'none'` | Pass |

**Live verification**: Skipped this cycle (no running server). Source-level configuration is correct.

## CI/CD Security Automation Status

| Mechanism | Status | Notes |
|-----------|--------|-------|
| Dependabot | Configured | Pinned to `develop` branch (commit `f118597`). Weekly schedule. |
| Renovate | Not configured | Intentional — Dependabot covers the same surface. |
| Gitleaks in CI | Configured | Runs on every push; blocks merge on findings. |
| npm audit in CI | Configured | Runs in `lint-and-typecheck` and security-scan jobs. |
| License check in CI | Configured | Validates against allowlist; blocks merge on copyleft introductions. |
| CSRF protection | Configured | `sendChatMessage()` and all mutation endpoints validated. Stable since Mar 23. |
| Webhook signature validation | Configured | All 4 endpoints use `crypto.timingSafeEqual` (7 call sites verified). |
| Pre-commit hooks | Configured | Push accountability + dirty-pull guard. |

**No CI/CD automation gaps.**

## Outdated Packages with Security Implications

18 outdated packages reported. None have known CVEs. Production security-relevant items:

| Package | Current | Latest | Security note |
|---------|---------|--------|---------------|
| `@sentry/core` | 10.49.0 | 10.50.0 | Minor — error reporting library. Low priority. |
| `@sentry/nextjs` | 10.49.0 | 10.50.0 | Minor — same. |
| `@stripe/stripe-js` | 9.2.0 | 9.3.1 | Patch + minor — payment SDK. Verify changelog before bump. |
| `@supabase/supabase-js` | 2.104.0 | 2.104.1 | Patch — auth + database client. Safe to bump. |
| `stripe` (server) | 22.0.2 | 22.1.0 | Minor — server-side Stripe. Verify changelog. |
| `@anthropic-ai/sdk` | 0.90.0 | 0.91.1 | Minor — Claude API client. |
| `posthog-js` | 1.369.5 | 1.372.1 | Minor — analytics. |
| `postcss` (top-level) | 8.5.10 | 8.5.12 | Patch — already past advisory floor; only the Next-bundled inner copy is the concern. |
| `vitest` | 4.1.4 | 3.2.4 | **Downgrade reported** — scanner artifact (we are on a pre-release channel). Ignore. |
| `jsdom` | 29.0.2 | 27.0.1 | Same — pre-release channel. Ignore. |

**Dev-only outdated** (no production impact): `@typescript-eslint/eslint-plugin`, `@vitest/coverage-v8`, `knip`, `@tailwindcss/postcss`, `tailwindcss`, `lucide-react`, `voyageai` (intentionally pinned to `0.1.0` per `8f53cd29` — voyageai 0.2.x ESM build broke `@/lib/embeddings`; do **not** auto-bump).

**Recommendation**: Batch the production minor/patch bumps in the next triage cycle. None are urgent. Avoid auto-bumping `voyageai`.

## Cross-Agent Findings

- **Performance Agent** (Apr 26): Sentry Replay removal (`fef651f5`) eliminated the Replay PII exfiltration surface. Confirmed not loaded as integration — saved 0 bundle KB but closed a privacy attack vector.
- **QA Agent** (Apr 27): All safety, prompt-injection, and PII-extraction tests pass. CSRF stable since Mar 23. No security-test regressions.
- **Coverage Agent** (Apr 23): Stripe webhook at 100% branch coverage including all error paths (signature failure, non-Error throws, null `amount_total`). CSRF origin-not-allowed branch covered.
- **Cost Analyst Agent** (Apr 27): No cost-related security concerns. Twilio $0.24 anomaly (Apr 3-4) is operational, not a security event.
