# Security Report — 2026-05-07

## Health Status: GREEN

0 advisories detected, 0 exploitable. Thirteenth consecutive GREEN cycle. Live production security headers confirmed via paisaxe.es fallback. Outdated package count rose from 10 to 17 this cycle — driven by new minor releases for next, react, react-dom, stripe, and resend — all zero CVEs. SMS webhook error paths (retry-booking-sms, make-booking, elevenlabs webhook) now fully covered by coverage agent tests. All CI/CD security automation active. License policy compliant.

## Executive Summary

- **0 advisories** in `npm audit` (Critical/High/Moderate/Low all zero). Nothing exploitable.
- **Outdated packages**: 17 (up from 10). New arrivals: `next` 16.2.5, `react`/`react-dom` 19.2.6, `stripe` 22.1.1, `resend` 6.12.3, `@next/bundle-analyzer` and `@next/eslint-plugin-next` 16.2.5. Zero CVEs across all 17.
- **@anthropic-ai/sdk** is now 3 minor versions behind (0.92.0 vs 0.95.0 latest). No CVE, but changelog review recommended before upgrading given this project's dependency on streaming and tool-use surfaces.
- **voyageai MUST NOT be upgraded.** Pinned at 0.1.0 — v0.2.x ESM build breaks the Turbopack embeddings pipeline. Dependabot ignore rule enforced.
- **License compliance**: Pass. No copyleft violations. Two documented weak-copyleft exceptions remain unchanged.
- **Security headers**: All confirmed in live production response (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- **Webhook coverage hardened**: Coverage agent (2026-05-07) fully covered SMS DB error paths in `retry-booking-sms/route.ts` (80% → 100%), `make-booking/route.ts` (94.53% → 99.21%), and `elevenlabs/route.ts` (94.15% → 96.75%).
- **Webhook integrity**: All 4 webhook endpoints use `timingSafeEqual`; 7 call sites verified. Unchanged.
- **IPv6 SSRF protection**: `fc00::/7`, `fe80::/10`, `ff02::/8` ranges and `firstIpv6Hextet` null-return path confirmed tested and passing (coverage agent 2026-05-05).

## Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk |
|----------|---------|-----------------------|---------------|---------|------|
| — | — | — | None — clean audit | — | None |

`npm audit` returns "found 0 vulnerabilities" against the current lockfile.

## Detailed Exploitability Analysis

No high or critical advisories to analyze this cycle. Historical context for awareness:

- **Apr 17 YELLOW** — `protobufjs@7.5.4` (Critical, GHSA-xq3m-2v4x-88gg) and `dompurify@3.3.3` (Moderate, GHSA-39q2-94rc-95cp) reached the tree via `posthog-js`. Both ruled non-exploitable: protobufjs serialized internal OpenTelemetry data (no user-controlled input path); DOMPurify was used internally by PostHog with no application code calling it directly. Both resolved 2026-04-20 by `npm audit fix` (commit `e66e510`). dompurify is currently at 3.4.0; protobufjs at >=7.5.5.
- **Apr 25 YELLOW** — 8 moderate advisories (postcss XSS chain GHSA-qx2v-qp2m-jg93 + uuid bounds-check GHSA-w5hq-g745-h8pq). Cleared via `package.json` overrides + lockfile sync.
- **May 2** — `@anthropic-ai/sdk` advisory GHSA-p7fg-763f-g4gf patched in commits `52b8f484` + `3163f478`. Confirmed cleared.

## Prioritized Remediation Steps

1. **None required this cycle.** Audit is clean.
2. **@anthropic-ai/sdk 0.92.0 → 0.95.0** — now 3 minor versions behind. Review changelogs for 0.93.0, 0.94.0, and 0.95.0 before batching, particularly for any changes to Sonnet 4.6 streaming, tool-use, or prompt-cache surfaces used by this project. No CVE.
3. **Optional housekeeping batch** — `next` 16.2.5, `react`/`react-dom` 19.2.6, `stripe` 22.1.1, `resend` 6.12.3, `@next/bundle-analyzer` 16.2.5, `@next/eslint-plugin-next` 16.2.5, `@elevenlabs/react` 1.4.0 (measure 482 KB deferred chunk before/after), `@upstash/redis` 1.38.0, `posthog-js` 1.372.9. All minor/patch, zero CVEs. Do NOT include `voyageai`.

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

All headers confirmed in live production response (fallback to paisaxe.es active since triage 2026-05-04):

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass (prod-only by design; confirmed in live production response) |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass |
| Content-Security-Policy | `'self' 'unsafe-inline' blob: https://js.stripe.com` (script-src); `frame-ancestors 'none'`; `object-src 'none'` | Pass — PPR-compatible (no `'strict-dynamic'`, no nonce-only). Set per-request by `src/lib/proxy/csp.ts`, not captured in static header probe. |

CSP note: CSP is injected per-request by `src/lib/proxy/csp.ts` (`'unsafe-eval'` added in development only). Because it is not a static `next.config.ts` header, the metrics script header probe does not capture it. CSP correctness is guarded by the `e2e/smoke.spec.ts` "CSP canary" test, which verifies JavaScript executes on each E2E run.

## CI/CD Automation Status

| Tool | Configured | Notes |
|------|------------|-------|
| Dependabot | Yes | `.github/dependabot.yml` — weekly Mondays, targets `develop` (correctly avoids `main`), excludes `voyageai >= 0.2.0`. Production and dev deps grouped separately. |
| Renovate | No | Not needed — Dependabot covers the same scope. |
| Gitleaks | Yes | `.github/workflows/security.yml` — runs on every push/PR + daily 08:00 UTC. Gitleaks v8.21.2. |
| npm audit | Yes | `.github/workflows/security.yml` — runs on every push/PR + daily 08:00 UTC. CVE detection latency <24h. |
| License check | Yes | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on PRs; warns on weak copyleft (LGPL/MPL). |

No automation gaps detected.

## Outdated Packages with Security Implications

17 outdated packages. Zero have associated CVEs. 7 new packages this cycle vs prior report (next ecosystem minor + stripe/resend patches).

| Package | Current | Latest | Channel | Security Impact |
|---------|---------|--------|---------|-----------------|
| `@anthropic-ai/sdk` | 0.92.0 | 0.95.0 | Production | None confirmed. Now 3 minor versions behind — review 0.93.0–0.95.0 changelogs before batching. |
| `@elevenlabs/react` | 1.3.0 | 1.4.0 | Production | None — minor release. Measure deferred ElevenLabs chunk (482 KB) before/after. |
| `@next/bundle-analyzer` | 16.2.4 | 16.2.5 | Dev | None — patch to match next 16.2.5. |
| `@next/eslint-plugin-next` | 16.2.4 | 16.2.5 | Dev | None — patch to match next 16.2.5. |
| `@typescript-eslint/eslint-plugin` | 8.59.1 | 8.59.2 | Dev | None — patch only. |
| `@upstash/redis` | 1.37.0 | 1.38.0 | Production | None — minor release. |
| `jsdom` | 29.1.1 | 27.0.1 | Dev (testing) | None. Reverse mismatch is a registry tagging artifact (pre-release vs stable channel). |
| `knip` | 6.9.0 | 6.12.0 | Dev | None. |
| `next` | 16.2.4 | 16.2.5 | Production | None — patch only. |
| `posthog-js` | 1.372.8 | 1.372.9 | Production | None — patch only. Prior posthog-js advisories already resolved. |
| `react` | 19.2.5 | 19.2.6 | Production | None — patch only. New this cycle. |
| `react-dom` | 19.2.5 | 19.2.6 | Production | None — patch only. New this cycle. |
| `resend` | 6.12.2 | 6.12.3 | Production | None — patch only. New this cycle. |
| `stripe` | 22.1.0 | 22.1.1 | Production | None — patch only. New this cycle. |
| `vitest` | 4.1.5 | 3.2.4 | Dev (testing) | None. Pre-release channel mismatch. |
| `voyageai` | 0.1.0 | 0.2.1 | Production | **DO NOT UPGRADE.** Pinned at 0.1.0 via Dependabot ignore rule. v0.2.x ESM build breaks Turbopack embeddings pipeline. |
| `zod` | 4.4.2 | 4.4.3 | Production | None — patch only. |

## Source Code Changes Since Last Cycle

Security-relevant observations from this cycle and peer agents:

- **Coverage agent (2026-05-07)**: SMS webhook error paths fully covered — `retry-booking-sms/route.ts` (80% → 100%), `make-booking/route.ts` (94.53% → 99.21%), `elevenlabs/route.ts` (94.15% → 96.75%). Security-sensitive payment and communication failure paths are now verified.
- **Triage agent (2026-05-05)**: Committed posthog-js 1.372.6→1.372.8, @supabase/supabase-js 2.105.1→2.105.3, postcss 8.5.12→8.5.14 patches. Auto-merged Dependabot PR #578 (zod 4.4.2→4.4.3 + knip 6.9.0→6.11.0). Total JS confirmed 2,999 KB with no advisory regressions.
- **No changes** to `src/proxy.ts`, webhook routes, CSRF enforcement, or CSP configuration this cycle.
- **Admin audit log RLS** (commit `012492d3`, prior cycle): Remains in effect. Row-level security on `admin_audit_log` satisfies Supabase Security Advisor.

---
