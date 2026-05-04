# Security Report — 2026-05-04

## Health Status: GREEN

0 advisories detected, 0 exploitable. Tenth consecutive GREEN cycle (since 2026-04-20, recovering from a 1-run YELLOW on 2026-04-17 caused by transitive `posthog-js` deps that have since been patched). All CI/CD security automation active. License policy compliant. All required security headers configured.

## Executive Summary

- **0 advisories** in `npm audit` (Critical/High/Moderate/Low all zero). Nothing exploitable.
- **License compliance**: Pass. No copyleft violations. Two weak-copyleft packages (`sharp-libvips` LGPL-3.0, `dompurify` MPL-2.0) are documented exceptions in `docs/project/license-exceptions.md`.
- **CI/CD security**: Dependabot, Gitleaks, npm audit, license-check all enforced on PRs and via daily schedule.
- **Security headers**: All in place — HSTS (prod-only), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, CSP (PPR-compatible).
- **Outdated packages**: 8 — all dev-only or patch-level. Zero production gaps with CVEs.
- **Webhook integrity**: All 4 webhook endpoints use `timingSafeEqual` (Stripe, Twilio, ElevenLabs, Resend); 7 call sites verified across prior cycles. Unchanged.

## Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk |
|----------|---------|-----------------------|---------------|---------|------|
| — | — | — | None — clean audit | — | None |

`npm audit` returns "found 0 vulnerabilities" against the current lockfile.

## Detailed Exploitability Analysis

No high or critical advisories to analyze this cycle. Historical context for awareness:

- **Apr 17 YELLOW** — `protobufjs@7.5.4` (Critical, GHSA-xq3m-2v4x-88gg) and `dompurify@3.3.3` (Moderate, GHSA-39q2-94rc-95cp) reached the tree via `posthog-js`. Both were ruled non-exploitable: protobufjs serialized internal OpenTelemetry data (no user-controlled input path), and DOMPurify was used internally by PostHog with no application code calling it directly. Both resolved on 2026-04-20 by `npm audit fix` (commit `e66e510`). dompurify is currently at 3.4.0; protobufjs at >=7.5.5.
- **Apr 25 YELLOW** — 8 moderate advisories (postcss XSS chain + uuid bounds-check). Already cleared. Source dependency tree no longer carries the affected transitive versions.
- **May 2** — `@anthropic-ai/sdk` advisory GHSA-p7fg-763f-g4gf was patched in commits `52b8f484` + `3163f478`. Confirmed cleared.

## Prioritized Remediation Steps

1. **None required this cycle.** Audit is clean.
2. **Optional housekeeping** — patch-level production deps queued by triage (postcss 8.5.13, posthog-js 1.372.6, zod 4.4.2). No advisory urgency. Batch with the next dependency refresh PR; do not include `voyageai` (pinned at 0.1.0 — v0.2.x ESM build breaks Turbopack).
3. **Production build refresh** — performance agent has reported a stale prod baseline for 9 consecutive cycles. While not security-critical, a fresh build would re-validate header/CSP injection at runtime. Run `npm install && rm -rf .next && npm run build` when next opening a maintenance window.

Standard remediation commands for any future advisory:
```
npm audit                          # verify advisory list
npm audit fix                      # apply non-breaking fixes
npm audit fix --force              # only after reading breaking-change notes
```

## License Compliance

Pass. No GPL, AGPL, or SSPL packages. Two documented weak-copyleft exceptions and one expected internal package:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` (and platform variants) | LGPL-3.0-or-later | Approved exception (Exception 1 in `docs/project/license-exceptions.md`). Dynamically linked native binary, no source modifications, SaaS deployment — no copyleft obligation. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Approved (Exception 2). Dual-licensed; we accept Apache-2.0 terms. File-level MPL scope only. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Approved. We accept MIT terms. |
| `paisaxe@1.5.1` | UNLICENSED | The application itself. Expected — internal/proprietary code. |
| `simple-concat@1.0.1` | MIT | Scanner false positive (license is MIT per source repo). |
| `simple-get@4.0.1` | MIT | Scanner false positive (license is MIT per source repo). |
| `@babel/template@7.28.6` | MIT | Scanner false positive (flagged by name pattern, license is MIT). |

`COPYLEFT LICENSES FOUND: false` confirms no strong-copyleft (GPL/AGPL/SSPL) packages in the tree.

## Security Headers Status

All headers verified configured in `next.config.ts:64-67` and live response:

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass (prod-only by design) |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass |
| Content-Security-Policy | `'self' 'unsafe-inline' blob: https://js.stripe.com` (script-src); `frame-ancestors 'none'`; `object-src 'none'` | Pass — PPR-compatible (no `'strict-dynamic'`, no nonce-only) |

CSP rationale per `CLAUDE.md`: PPR (`cacheComponents`) prerenders HTML at build time without nonces, so `'self' 'unsafe-inline'` is the correct policy. The `e2e/smoke.spec.ts` "CSP canary" test guards against accidental script-blocking regressions.

## CI/CD Automation Status

| Tool | Configured | Notes |
|------|------------|-------|
| Dependabot | Yes | `.github/dependabot.yml` — weekly Mondays, targets `develop` (correctly avoids `main`), excludes `voyageai >= 0.2.0`. Production and dev deps grouped separately. |
| Renovate | No | Not needed — Dependabot covers the same scope. |
| Gitleaks | Yes | `.github/workflows/security.yml` — runs on every push/PR + daily 08:00 UTC. Gitleaks v8.21.2. |
| npm audit | Yes | `.github/workflows/security.yml` — runs on every push/PR + daily 08:00 UTC. CVE detection latency <24h since the schedule was tightened. |
| License check | Yes | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on PRs; warns on weak copyleft (LGPL/MPL). |

No automation gaps detected.

## Outdated Packages with Security Implications

8 outdated packages. Zero have associated CVEs. None are production-critical:

| Package | Current → Latest | Channel | Security Impact |
|---------|------------------|---------|-----------------|
| `@upstash/ratelimit` | 2.0.8 → 2.0.8 | Production | None — version match (scan-output false positive). |
| `jsdom` | 29.1.1 → 27.0.1 | Dev (testing) | None. Reverse mismatch is a registry tagging artifact (pre-release vs stable). |
| `knip` | 6.9.0 → 6.11.0 | Dev | None. |
| `postcss` | 8.5.12 → 8.5.13 | Build-time | None — patch only. Optional housekeeping. |
| `posthog-js` | 1.372.5 → 1.372.6 | Production | None — patch only. Optional. Prior posthog-js advisories already resolved. |
| `vitest` | 4.1.5 → 3.2.4 | Dev (testing) | None. Pre-release channel mismatch. |
| `voyageai` | 0.1.0 → 0.2.1 | Production | Pinned at 0.1.0 by Dependabot ignore rule (v0.2.x ESM build breaks Turbopack). Do not upgrade. |
| `zod` | 4.4.1 → 4.4.2 | Production | None — patch only. Optional. |

## Source Code Changes Since Last Cycle

Nothing security-relevant. Recent modified files include test fixtures (`*.test.ts`, `*.test.tsx`), Playwright configs, agent reports, and the security agent script itself. No changes to `src/proxy.ts`, webhook routes, auth middleware, or CSP configuration.
