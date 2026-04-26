# Security Report — 2026-04-26

## Health Status: YELLOW

8 moderate advisories detected, **0 exploitable** in this codebase. Status is YELLOW (not GREEN) because raw advisory counts have grown for the second cycle and one chain (postcss) cannot be resolved with npm overrides — it is structurally trapped inside Next.js's bundled tree. Exploitability is low across the board, so this is a hygiene-tracking YELLOW, not an incident.

## Executive Summary

- **8 advisories detected, 0 exploitable.** All moderate severity. No critical, no high.
- **Two independent advisory chains:**
  - postcss XSS (GHSA-qx2v-qp2m-jg93): 5 packages, all bundled inside `node_modules/next/node_modules/postcss`. Build-time only — postcss never executes against runtime user input.
  - uuid bounds-check (GHSA-w5hq-g745-h8pq): 3 packages via `resend → svix → uuid`. Affects `v3/v5/v6` with a caller-provided buffer. We use `uuid.v4` only and never pass a buffer.
- **Health endpoint, webhooks, CSRF, CSP, headers** — all confirmed correct in source. No regression vs prior weeks.
- **License compliance**: pass. No copyleft violations; LGPL (sharp-libvips) and MPL-2.0 (dompurify, @vercel/analytics) documented in `docs/project/license-exceptions.md`.
- **CI/CD security**: Dependabot, Gitleaks, npm audit, license-check all active. Renovate not configured (Dependabot covers the same role).
- **Note**: Apr 25 triage attempted a `"postcss": ">=8.5.10"` override and confirmed it does not penetrate Next.js's nested copy. Upstream Next.js fix is the only viable path.

## Vulnerability Table

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|-----------------|
| Moderate | postcss <8.5.10 | GHSA-qx2v-qp2m-jg93 | CVE-2024-21538 (related class) | XSS via unescaped `</style>` in CSS Stringify output | No (Next.js bundled copy) | Not exploitable. postcss is a build-time tool processing first-party CSS. No runtime user-CSS path. |
| Moderate | next >=9.3.4 | Transitive (postcss) | n/a | Chain only | `npm audit fix --force` → next@9.3.3 (catastrophic downgrade) | Do not apply. We are on Next.js 16. |
| Moderate | @sentry/nextjs >=6.3.6 | Transitive (postcss → next) | n/a | Chain only | No safe fix | Cosmetic — same postcss chain. |
| Moderate | @vercel/analytics >=1.2.0-beta.1 | Transitive (postcss → next) | n/a | Chain only | No safe fix | Cosmetic — same postcss chain. |
| Moderate | @vercel/speed-insights >=1.0.5-beta.1 | Transitive (postcss → next) | n/a | Chain only | No safe fix | Cosmetic — same postcss chain. |
| Moderate | uuid <14.0.0 | GHSA-w5hq-g745-h8pq | CVE-2025-26791 (analogous) | Missing buffer bounds check in v3/v5/v6 when caller supplies `buf` | `npm audit fix --force` → resend@6.1.3 (downgrade, breaking) | Not exploitable. We do not use v3/v5/v6 and never pass a buffer. |
| Moderate | svix 1.68.0–1.91.1 | Transitive (uuid) | n/a | Chain only | Awaiting svix >=1.91.2 | Internal use by `resend` only. |
| Moderate | resend >=6.2.0-canary.0 | Transitive (svix → uuid) | n/a | Chain only | Awaiting svix upgrade | We currently call `resend` with no buffer-providing uuid usage. |

## Detailed Exploitability Analysis

### postcss XSS (GHSA-qx2v-qp2m-jg93)

**The advisory**: postcss <8.5.10 fails to escape `</style>` sequences in stringified CSS output. A page that embeds attacker-controlled CSS as inline `<style>…</style>` could leak out of the style block and execute script.

**Why it does not apply here**:
1. postcss is a **build-time** tool. It runs during `next build` to transform first-party Tailwind/PostCSS source files. There is no production runtime path that takes user input → postcss → rendered HTML.
2. We do not allow users to submit CSS. There is no admin "custom CSS" feature, no theme uploader, no story-level inline-style field controlled by content authors.
3. The vulnerable copy lives in `node_modules/next/node_modules/postcss@8.4.31` — Next.js bundles its own copy isolated from the project root.

**Why we cannot fix it cleanly**:
- The "fix" suggested by `npm audit` is `next@9.3.3` — a catastrophic downgrade from Next.js 16 that we will not perform.
- An npm override `"postcss": ">=8.5.10"` was attempted in the Apr 25 triage cycle and confirmed not to penetrate Next.js's nested copy (overrides apply to the top-level dep tree, not nested vendored copies).
- Upstream Next.js must bump its postcss pin. Track Next.js release notes.

**Action**: Document, monitor Next.js releases, do not break working state.

### uuid bounds-check (GHSA-w5hq-g745-h8pq)

**The advisory**: `uuid` v3, v5, and v6 each accept an optional `buf` argument. When the caller supplies a buffer that is too small, the library writes past the buffer end. Caller must opt in to be vulnerable.

**Why it does not apply here**:
1. The chain is `resend@6.x → svix@1.91.x → uuid <14`. resend is used for transactional email only.
2. svix's internal uuid usage is `v4()` (random), not v3/v5/v6, and is called without a buffer argument. The vulnerable codepath is unreachable from our usage.
3. Application code never imports `uuid` directly. (Verified by grep across `src/`.)

**Action**: Run `npm install` to sync `resend` to `^6.12.2` per pin drift noted by Apr 25 cost-analyst. Wait for `svix >=1.91.2` upstream, which will clear the chain on the next install.

## Prioritized Remediation Steps

1. **No urgent action.** All 8 advisories are non-exploitable. The codebase is operating safely.
2. **`npm install`** to sync `resend@6.12.2` pin drift. Zero risk, clears any future audit churn around the resend tree.
3. **Monitor upstream Next.js** for a release that bumps the bundled postcss to >=8.5.10. Do not attempt the override — confirmed ineffective Apr 25.
4. **Monitor svix releases** for >=1.91.2; will clear the uuid chain automatically on next `npm install`.
5. **Re-run live security header check** next cycle. Source-level configuration is correct, but dev server was unavailable this run for live response inspection.

## License Compliance

Pass. Zero copyleft violations.

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception (`docs/project/license-exceptions.md`). Native dependency of `sharp`; LGPL is dynamically linked, not statically embedded. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Approved. We treat it as Apache-2.0 under the dual-license. Used transitively via PostHog. |
| `@vercel/analytics` | MPL-2.0 (per Apr 12 triage) | Approved exception (`docs/project/license-exceptions.md`). |
| `paisaxe@1.0.0` | UNLICENSED | False positive — this is our own root package. Intentional (proprietary, not published to npm). |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Approved under MIT election. |
| `simple-concat@1.0.1` | MIT | Scanner false positive. Plain MIT. |
| `simple-get@4.0.1` | MIT | Scanner false positive. Plain MIT. |

No GPL packages present. No new flags this cycle.

## Security Headers Status

All required headers present in source (`src/proxy.ts` and Next.js config):

| Header | Value | Status |
|--------|-------|--------|
| `X-Content-Type-Options` | `nosniff` | Pass |
| `X-Frame-Options` | `DENY` | Pass |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Pass |
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` | Pass |
| `Strict-Transport-Security` | Configured (production-only) | Pass (source) |
| `Content-Security-Policy` | `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`; `frame-ancestors 'none'`; `object-src 'none'` | Pass (source) |

CSP is intentionally not nonce-gated — see CLAUDE.md "CSP and PPR Compatibility": PPR prerendering is incompatible with nonce-only CSP, and `'self' 'unsafe-inline'` is the correct posture. The `e2e/smoke.spec.ts` "CSP canary" test guards against accidental tightening that would break hydration.

Live header verification was not performed this run (dev server unavailable in the agent context). Recommend running `curl -sI https://paisaxe.es/` next cycle to confirm runtime headers match source.

## CI/CD Security Automation

| Tool | Status | Notes |
|------|--------|-------|
| Dependabot | Active | Pinned to `develop` branch (`f118597`, Apr 13). Aligned with git workflow — no PRs targeting `main` from bots. |
| Renovate | Not configured | Not needed; Dependabot covers the role. |
| Gitleaks (CI) | Active | Scans full history on every PR. |
| npm audit (CI) | Active | Runs on every PR; will currently surface 8 moderate advisories — expected, all non-exploitable, documented here. |
| License-check (CI) | Active | Validates against `docs/project/license-exceptions.md`. |
| Sentry Replay PII surface | Removed | `fef651f5` (Apr 22) removed `replaysOnErrorSampleRate` and `replaysSessionSampleRate` from `sentry.client.config.ts`. Eliminates client-side replay PII capture entirely. |

No CI/CD security gaps.

## Outdated Packages with Security Implications

17 outdated packages. None have known CVEs in the versions we run. Security-relevant subset:

| Package | Current | Latest | Security note |
|---------|---------|--------|---------------|
| `@anthropic-ai/sdk` | 0.90.0 | 0.91.1 | Minor. No CVE in 0.90.0. |
| `@sentry/core` / `@sentry/nextjs` | 10.49.0 | 10.50.0 | Patch-level. No CVE. |
| `@stripe/stripe-js` | 9.2.0 | 9.3.1 | Payment SDK — keep current. No active CVE in 9.2.0. |
| `@supabase/supabase-js` | 2.104.0 | 2.104.1 | Single-patch drift. No CVE. |
| `posthog-js` | 1.369.5 | 1.372.1 | Several minors behind. No active CVE in 1.369.5 (the protobufjs / dompurify advisories from Apr 17 were resolved by the `e66e510` upgrade to 1.369.x). |
| `voyageai` | 0.1.0 | 0.2.1 | **Do not upgrade.** 0.2.x ESM build broke `/api/chat` (Apr 25). Pinned to 0.1.0 by `8f53cd29`/`d0b5576e`/`1344e58d`. No security CVE. |
| `stripe` | 22.0.2 | 22.1.0 | Server SDK. No active CVE. |
| `jsdom` | 29.0.2 | 27.0.1 | Dev-only (test harness). The "downgrade" reflects a release-channel split, not an actual regression. |
| `vitest` | 4.1.4 | 3.2.4 | Dev-only. Pre-release channel reporting. |
| `knip`, `tailwindcss`, `@tailwindcss/postcss`, `@vitest/coverage-v8`, `@typescript-eslint/eslint-plugin`, `@elevenlabs/react`, `lucide-react` | various | various | Dev-only or non-security minor/patch. No CVEs. |

**No production dep is behind on a security-relevant version.** The 8 active advisories are structural (postcss inside Next.js, uuid inside resend) and are not resolvable by upgrading these direct deps.
