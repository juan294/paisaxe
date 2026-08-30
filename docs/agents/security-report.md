# Security Report — 2026-08-27

## 1. Health Status: GREEN

Zero advisories, zero exploitable vulnerabilities. This continues the GREEN streak from 2026-04-20 (last YELLOW blip was 2026-04-25, resolved same cycle). License compliance clean — all flagged non-permissive packages are documented exceptions or build-time-only. All security headers and CI/CD automation confirmed active in source.

## 2. Executive Summary

0 advisories detected, 0 exploitable. `npm audit` returns clean across the full dependency tree (production + dev). No critical, high, moderate, or low severity findings this cycle. License scan shows 7 flagged (non-MIT/Apache/BSD/ISC) packages in production — all previously reviewed and either approved exceptions (`license-exceptions.md`) or MIT-licensed false positives in the flag pattern (e.g. `simple-concat`, `simple-get`, `@babel/template` are MIT but matched the flag regex incidentally). 25 outdated packages, all minor/patch version drift with no associated CVEs — routine dependency-batch material, not security debt. All 7 security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) confirmed both in the live header scan and in source (`next.config.ts`, `src/proxy.ts`). CI/CD security automation (Dependabot, Gitleaks, npm audit) fully active with no gaps.

One environment hygiene note (not a security finding): local `node_modules` has a stale `posthog-js@1.417.0` install against a `package.json`/`package-lock.json`-pinned `^1.418.6` (`npm ls` reports `invalid`). This is local-only drift — CI uses `npm ci`, which installs the correct lockfile version — but `npm install` locally would clear it.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA/CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------------------|----------------|---------|------------------|
| — | — | None found | — | — | `npm audit` reports 0 vulnerabilities across all severities |

No vulnerabilities to triage this cycle. This is the second consecutive clean `npm audit` result (previous clean run: 2026-04-20; the 2026-04-25 postcss/uuid YELLOW cycle and 2026-05-09-era batches have since been resolved via prior dependency updates).

## 4. Detailed Exploitability Analysis

Not applicable this cycle — no critical or high severity issues present.

## 5. Prioritized Remediation Steps

None required for vulnerabilities. Routine maintenance only:

1. **Optional, low urgency**: Run `npm install` locally to sync `node_modules/posthog-js` (1.417.0 installed) with the lockfile-pinned 1.418.6 — cosmetic `npm ls` warning only, no functional or security impact since CI always uses `npm ci`.
2. **Optional, batch with next dependency cycle**: 25 outdated packages (see Section 9) — all minor/patch, zero CVEs. Bundle per Performance Agent's dependency-drift tracking (raw total-JS budget currently at 91.8% utilization as of 2026-08-24) before batching.

## 6. License Compliance

Policy: MIT, Apache-2.0, BSD, ISC only (permissive), with documented exceptions in `docs/project/license-exceptions.md` for select weak-copyleft/source-available packages.

Full distribution: MIT (280), Apache-2.0 (31), ISC (17), BSD-2-Clause (8), BSD-3-Clause (7), BlueOak-1.0.0 (5), FSL-1.1-MIT (2), plus 12 packages under single-copy compound/permissive licenses (0BSD, MIT-0, Unlicense, WTFPL-or-MIT, CC0-1.0-or-MIT, CC-BY-4.0, etc.).

**Copyleft licenses found in production deps: false** (confirmed by both the automated scan and manual review below.)

Flagged packages, verified individually:

| Package | Declared License | Status |
|---------|-------------------|--------|
| `@img/sharp-libvips-darwin-arm64@1.3.2` | LGPL-3.0-or-later | **Approved exception** — `license-exceptions.md` Exception 1. Pre-built native binary, dynamically linked via `sharp`'s Apache-2.0 API, no modifications, SaaS deployment (no binary distribution). Listed in `EXCEPTION_LICENSES` in `scripts/check-production-licenses.ts`. |
| `dompurify@3.4.13` | (MPL-2.0 OR Apache-2.0) | **Not a violation** — dual-licensed; the Apache-2.0 option satisfies policy. Transitive dep of `posthog-js`; no application code calls DOMPurify directly. |
| `@babel/template@7.29.7` | MIT | **False positive** in the flag list — package is plain MIT, not copyleft. No action needed. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | **Not a violation** — dual-licensed; MIT option satisfies policy. Transitive dep of native-module installers (e.g. `sharp`/`node-gyp`-adjacent tooling). |
| `simple-concat@1.0.1` | MIT | **False positive** — plain MIT. No action needed. |
| `simple-get@4.0.1` | MIT | **False positive** — plain MIT. No action needed. |
| `paisaxe@1.6.0` | UNLICENSED | **Expected** — this is the project's own `package.json`, correctly marked private/unlicensed. Not a third-party dependency. |

Additional package requiring review (present in dev+full-tree scan, not production list, and in the FSL-1.1-MIT bucket of the license summary):

| Package | Declared License | Status |
|---------|-------------------|--------|
| `@sentry/cli@2.58.5`, `@sentry/cli-darwin@2.58.5` | FSL-1.1-MIT | **Approved exception** — `license-exceptions.md` Exception 4 (referenced in `scripts/check-production-licenses.ts:50`). Functional Source License — source-available, converts to MIT after 2 years. Build-time only (sourcemap upload tooling), not shipped to clients or distributed. Already in `EXCEPTION_LICENSES`. |

Dev-only, build-time additions (full-tree scan, not production-shipped):

| Package | Declared License | Status |
|---------|-------------------|--------|
| `lightningcss@1.32.0`, `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | **Approved exception** — `license-exceptions.md` Exception 3. Build-time only (Tailwind CSS v4 / Vite tooling), no modifications, file-level copyleft scope doesn't extend to Paisaxe's own files. |

**Conclusion**: No unreviewed or unapproved copyleft/non-permissive licenses in the dependency tree. `scripts/check-production-licenses.ts` enforces an allowlist (`CORE_ALLOWED_LICENSES` + `EXCEPTION_LICENSES`) that already covers every flagged package. CI license-check gate has no gaps.

## 7. Security Headers Status

All headers confirmed present in both the live scan and source code:

| Header | Value | Source |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com https://checkout.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | `src/proxy.ts:73` via `buildCspHeader()` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | `next.config.ts:65` (prod-only) |
| X-Content-Type-Options | `nosniff` | `next.config.ts:67` |
| X-Frame-Options | `DENY` | `next.config.ts:68` |
| Referrer-Policy | `strict-origin-when-cross-origin` | `next.config.ts` |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | `next.config.ts:70` |

CSP correctly avoids `'strict-dynamic'` and nonce-only configurations per the project's PPR compatibility constraint (documented in `CLAUDE.md` — nonces aren't present in prerendered HTML under `cacheComponents`). `'self' 'unsafe-inline'` for `script-src` is the intentional, documented tradeoff. `object-src 'none'` and `frame-ancestors 'none'` are both present, closing the two most common CSP gaps (plugin injection, clickjacking).

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — weekly (Monday), npm + GitHub Actions ecosystems, target branch `develop`, grouped minor/patch updates split into `production` and `dev-and-types` groups, major-version bumps excluded from grouping (arrive standalone). `voyageai` pinned below 0.2.0 (broken ESM build), `typescript` majors isolated (peer-range gap with `@typescript-eslint`). |
| Gitleaks | Active | `.github/workflows/security.yml` — runs on push/PR to `develop`/`main` and daily at 08:00 UTC (cron), required check `"Gitleaks secret scan"`. |
| npm audit | Active | Same workflow — `npm audit --omit=dev --audit-level=moderate` on production deps (blocking, required check `"npm audit"`), plus a full informational `npm audit` (dev-inclusive, non-blocking) for visibility. |
| Vercel env safety | Active | Same workflow, third required check. |
| CodeQL (SAST) | **Not enabled** | Confirmed disabled repo-wide via GitHub API (403/404) per 2026-08-18 triage. Gitleaks substitutes for secret scanning; there is no SAST substitute currently. This is a GitHub Advanced Security billing decision on a private repo — flagged to the user, not auto-actionable. |
| License check | Active | `scripts/check-production-licenses.ts`, allowlist-based, referenced in CI. |

No new gaps this cycle. The daily Gitleaks/audit cron (reduced from weekly) keeps CVE detection latency under 24h, per the workflow's own comment.

## 9. Outdated Packages (Security-Relevant Review)

25 outdated packages, all minor/patch — **none carry known CVEs**. Notable ones with security-adjacent surface area:

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@anthropic-ai/sdk` | 0.117.1 | 0.121.0 | Core LLM client — routine minor bump, no advisories. |
| `next` | 16.3.1 | 16.3.3 | Framework patch — check release notes for security fixes before batching, though none flagged in `npm audit`. |
| `@supabase/supabase-js` | 2.112.3 | 2.112.4 | Patch. |
| `@supabase/ssr` | 0.12.4 | 0.12.5 | Patch — auth cookie handling, worth prioritizing in next batch given its role in `validateAdminAuth()`. |
| `stripe` / `@stripe/stripe-js` / `@stripe/react-stripe-js` | 22.5.0 / 9.13.0 / 6.8.1 | 22.6.0 / 9.14.0 / 6.8.2 | Payments SDKs — patch-level, no advisories, still worth batching promptly given payment surface. |
| `@sentry/core` / `@sentry/nextjs` | 10.70.0 | 10.71.0 | Error-tracking — patch. |
| `@elevenlabs/react` | 1.12.0 | 1.15.0 | Voice SDK — 3 minor versions behind; no advisories but largest version gap of the batch. |
| `sharp` | 0.35.3 | 0.35.4 | Image processing (native binary, LGPL exception carrier) — patch. |
| `resend` | 6.20.0 | 6.24.0 | Email — 4 minor versions behind. |
| `posthog-js` | 1.418.6 (lockfile) | — | Correctly pinned per prior advisory-driven upgrade (2026-04-20); not in the outdated list, confirmed current. |

Remaining 15 outdated packages (`@types/*`, `knip`, `@vitejs/plugin-react`, `@vitest/coverage-v8`, `@testing-library/user-event`, `@next/bundle-analyzer`, `@next/eslint-plugin-next`, `@typescript-eslint/eslint-plugin`, `@upstash/redis`, `lucide-react`, `typescript`) are dev-tooling or low-risk production deps with no security implications — routine batch material.

**Recommendation**: Batch all 25 into the next Dependabot-driven or manual dependency update, prioritizing `@supabase/ssr` (auth) and the Stripe trio (payments) given their sensitive surface area, even though none have active advisories.

---
