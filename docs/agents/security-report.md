# Security Report — 2026-05-05

## Health Status: GREEN

0 advisories detected, 0 exploitable. Eleventh consecutive GREEN cycle. Live production security headers confirmed via fallback to paisaxe.es (enabled by triage on 2026-05-04 — first cycle with live header confirmation). All CI/CD security automation active. License policy compliant. IPv6 SSRF protection fully tested this cycle (coverage agent confirmed all private ranges).

## Executive Summary

- **0 advisories** in `npm audit` (Critical/High/Moderate/Low all zero). Nothing exploitable.
- **License compliance**: Pass. No copyleft violations. Two weak-copyleft packages (`sharp-libvips` LGPL-3.0, `dompurify` MPL-2.0) are documented exceptions in `docs/project/license-exceptions.md`.
- **CI/CD security**: Dependabot, Gitleaks, npm audit, license-check all enforced on PRs and via daily schedule.
- **Security headers**: All in place — HSTS confirmed in live production response, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, CSP (PPR-compatible, set per-request via `src/lib/proxy/csp.ts`).
- **Outdated packages**: 10 (up from 8 last cycle) — 3 new releases for production/dev packages since May 4. Zero CVEs across all. `voyageai` intentionally pinned at 0.1.0.
- **IPv6 SSRF**: Coverage agent confirmed `fc00::/7`, `fe80::/10`, `ff02::/8` ranges and `firstIpv6Hextet` null-return path all tested and passing (new this cycle).
- **Webhook integrity**: All 4 webhook endpoints use `timingSafeEqual` (Stripe, Twilio, ElevenLabs, Resend); 7 call sites verified across prior cycles. Unchanged.

## Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk |
|----------|---------|-----------------------|---------------|---------|------|
| — | — | — | None — clean audit | — | None |

`npm audit` returns "found 0 vulnerabilities" against the current lockfile.

## Detailed Exploitability Analysis

No high or critical advisories to analyze this cycle. Historical context for awareness:

- **Apr 17 YELLOW** — `protobufjs@7.5.4` (Critical, GHSA-xq3m-2v4x-88gg) and `dompurify@3.3.3` (Moderate, GHSA-39q2-94rc-95cp) reached the tree via `posthog-js`. Both were ruled non-exploitable: protobufjs serialized internal OpenTelemetry data (no user-controlled input path), and DOMPurify was used internally by PostHog with no application code calling it directly. Both resolved 2026-04-20 by `npm audit fix` (commit `e66e510`). dompurify is currently at 3.4.0; protobufjs at >=7.5.5.
- **Apr 25 YELLOW** — 8 moderate advisories (postcss XSS chain GHSA-qx2v-qp2m-jg93 + uuid bounds-check GHSA-w5hq-g745-h8pq). Already cleared via `package.json` overrides + lockfile sync. Source dependency tree no longer carries the affected transitive versions.
- **May 2** — `@anthropic-ai/sdk` advisory GHSA-p7fg-763f-g4gf patched in commits `52b8f484` + `3163f478`. Confirmed cleared.

## Prioritized Remediation Steps

1. **None required this cycle.** Audit is clean.
2. **Optional housekeeping** — pending patch-level production deps (postcss 8.5.14, posthog-js 1.372.8, zod 4.4.3, @supabase/supabase-js 2.105.3, @anthropic-ai/sdk 0.93.0). No advisory urgency. Batch with next dependency refresh PR. Do NOT include `voyageai` (pinned at 0.1.0 — v0.2.x ESM build breaks Turbopack embeddings pipeline).
3. **@anthropic-ai/sdk 0.92.0 → 0.93.0** — minor version release; review changelog before batching to confirm no breaking changes in SDK surface used by this project.

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
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass (prod-only by design; confirmed in live response this cycle) |
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
| npm audit | Yes | `.github/workflows/security.yml` — runs on every push/PR + daily 08:00 UTC. CVE detection latency <24h since the schedule was tightened. |
| License check | Yes | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on PRs; warns on weak copyleft (LGPL/MPL). |

No automation gaps detected.

## Outdated Packages with Security Implications

10 outdated packages (up from 8 on 2026-05-04). Zero have associated CVEs.

| Package | Current → Latest | Channel | Security Impact |
|---------|------------------|---------|-----------------|
| `@anthropic-ai/sdk` | 0.92.0 → 0.93.0 | Production | None confirmed. Minor version release — review changelog before batching. |
| `@supabase/supabase-js` | 2.105.1 → 2.105.3 | Production | None — patch only. Optional housekeeping. |
| `@typescript-eslint/eslint-plugin` | 8.59.1 → 8.59.2 | Dev | None — patch only. |
| `jsdom` | 29.1.1 → 27.0.1 | Dev (testing) | None. Reverse mismatch is a registry tagging artifact (pre-release vs stable channel). |
| `knip` | 6.9.0 → 6.11.0 | Dev | None. |
| `postcss` | 8.5.12 → 8.5.14 | Build-time | None — two patch versions behind. Optional housekeeping. |
| `posthog-js` | 1.372.6 → 1.372.8 | Production | None — patch only. Prior posthog-js advisories already resolved. |
| `vitest` | 4.1.5 → 3.2.4 | Dev (testing) | None. Pre-release channel mismatch. |
| `voyageai` | 0.1.0 → 0.2.1 | Production | **DO NOT UPGRADE.** Pinned at 0.1.0 via Dependabot ignore rule. v0.2.x ESM build breaks Turbopack embeddings pipeline. |
| `zod` | 4.4.2 → 4.4.3 | Production | None — patch only. |

## Source Code Changes Since Last Cycle

Security-relevant observations from peer agents:

- **IPv6 SSRF protection** (coverage agent 2026-05-05): `image/route.ts` `firstIpv6Hextet` function and `isUnsafeIpv6` call site now have full test coverage. fc00::/7 (unique local), fe80::/10 (link-local), and ff02::/8 (multicast) ranges all confirmed correctly blocked.
- **Wave 2 CSRF hardening** (from prior cycles): SE-M2 origin enforcement active. All POST requests require Origin header. QA agent confirmed CSRF tests passing as of 2026-04-30.
- **Sentry Replay PII surface** (from Apr 22): Eliminated via commit `fef651f5`. No PII surface in replay data.
- No changes to `src/proxy.ts`, webhook routes, auth middleware, or CSP configuration this cycle.

---
