# Security Report

> Auto-generated on 2026-04-22

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, **0 exploitable**. Third consecutive GREEN since commit `e66e510` (Apr 20) cleared the protobufjs Critical + dompurify Moderate advisories that had interrupted the prior 9-cycle streak on Apr 17. Production dependency surface fully clean. npm audit reports 0 vulnerabilities across the full tree. Remaining outdated packages are minor/patch only, with zero CVEs. No source-code security regressions this cycle.

---

## Vulnerability Analysis

**npm audit: 0 vulnerabilities across all dependencies.**

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|-----------------|
| — | — | No active advisories | — | — | — | — |

### Recently Resolved (retained for audit trail)

| Advisory | CVE | Resolution | Commit |
|----------|-----|-----------|--------|
| `protobufjs@7.5.4` — Critical (GHSA-xq3m-2v4x-88gg) | CVE-2024-31130 (prototype pollution via Object.setPrototypeOf on untrusted .proto input) | Transitive bump to >=7.5.5 via `npm audit fix` | `e66e510` (2026-04-20) |
| `dompurify@3.3.3` — Moderate (GHSA-39q2-94rc-95cp) | CVE-2025-26791 (ADD_TAGS/FORBID_TAGS bypass allowing mXSS) | Transitive bump to >3.3.3 (now 3.4.0) | `e66e510` (2026-04-20) |

**Exploitability assessment for the resolved pair:** neither was exploitable in this codebase — `protobufjs` was used only by `@opentelemetry/otlp-transformer` to serialize internal telemetry (no user input flowed into `.proto` parsing), and `dompurify` was pulled in solely by PostHog's internal sanitizer (application code has zero direct `DOMPurify.sanitize` call sites in `src/`). Fix was still applied on the general principle of keeping audit clean and avoiding future chain-of-trust issues.

---

## Persistent Security Controls (Verified)

### Security Headers

Verified in source. Live check skipped — dev server not running this cycle.

| Header | Source | Value | Status |
|--------|--------|-------|--------|
| `Strict-Transport-Security` | `next.config.ts` | `max-age=63072000; includeSubDomains; preload` (prod only) | Pass |
| `X-Content-Type-Options` | `next.config.ts` | `nosniff` | Pass |
| `X-Frame-Options` | `next.config.ts` | `DENY` | Pass |
| `Referrer-Policy` | `next.config.ts` | `strict-origin-when-cross-origin` | Pass |
| `Permissions-Policy` | `next.config.ts` | `camera=(), geolocation=(), microphone=(self)` | Pass |
| `Content-Security-Policy` | `src/lib/proxy/csp.ts` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; ...` | Pass |

**CSP note (load-bearing):** `'self' 'unsafe-inline'` is intentional and required because PPR (`cacheComponents`) prerenders HTML at build time without nonces. Reintroducing `'strict-dynamic'` or nonce-only policy would block all scripts. The `CSP canary` test in `e2e/smoke.spec.ts` guards this. Do not "tighten" the script-src without first reverting PPR or adding nonces through a dynamic root layout.

### Webhook / Request Authentication

- 4 production webhook endpoints (Stripe, ElevenLabs x2, Voice) all verify signatures via `crypto.timingSafeEqual`.
- 7 `timingSafeEqual` call sites audited — all use equal-length buffers (preventing length-leak side channel).
- CSRF middleware active on all state-changing routes. Origin-not-allowed path covered by tests (coverage agent, 2026-04-20).

### Auth Controls

- Supabase session refresh in `src/proxy.ts` via `getUser()`.
- Admin routes gated by `validateAdminAuth()` (cookie-based) and `user_profiles.role = 'admin'` check.
- `admin_audit_log` (migration 076) and `stripe_webhook_events` (migration 077) now provide audit trails — internal infrastructure, no user-facing surface.

---

## License Compliance

**No copyleft violations.** All 7 flagged packages reviewed and approved.

| Package | License | Status | Reason |
|---------|---------|--------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved — documented in `docs/project/license-exceptions.md` | Dynamically linked native binary; LGPL permits dynamic linking without copyleft propagation. Platform-specific binary, not bundled client-side. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Approved | Dual-licensed; we use under Apache-2.0 which is non-copyleft. Pulled transitively via PostHog. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Approved | Dual-licensed; we use under MIT. |
| `paisaxe@1.0.0` | UNLICENSED | Expected | This is our own root package — intentional to prevent accidental npm publish. |
| `@babel/template@7.28.6` | MIT | Scanner false positive (not actually flagged license) | Plain MIT. |
| `simple-concat@1.0.1` | MIT | Scanner false positive | Plain MIT. |
| `simple-get@4.0.1` | MIT | Scanner false positive | Plain MIT. |

License aggregates (1,060 deps scanned): MIT 373, Apache-2.0 66, ISC 18, BSD-3-Clause 17, BSD-2-Clause 8, BlueOak-1.0.0 5. Strongly permissive-skewed, as required by `docs/project/license-exceptions.md`.

---

## CI/CD Security Automation

| Control | Status | Location |
|---------|--------|----------|
| Dependabot | Configured, pinned to `develop` branch | `.github/dependabot.yml` |
| Renovate | Not configured | Not needed — Dependabot covers npm + Actions. |
| Gitleaks | Active in CI | `.github/workflows/security.yml` |
| npm audit | Active in CI | `.github/workflows/security.yml` |
| License check | Active in CI | `.github/workflows/license-check.yml` |
| Knip (unused-code scan) | Active in CI | `.github/workflows/knip.yml` |
| Lighthouse (a11y/perf) | Active in CI | `.github/workflows/lighthouse.yml` |
| Branch protection on `main` | Enforced — lint-and-typecheck, test, build, e2e required | GitHub repo settings |
| Force-push to `main` | Blocked | GitHub repo settings |

No gaps identified.

---

## Outdated Packages With Security Implications

10 total outdated (vs 3 last cycle — minor/patch drift accumulated over 2 days). **Zero CVEs. No security-driven upgrades required.**

| Package | Current | Latest | Scope | Security Relevance |
|---------|---------|--------|-------|--------------------|
| `@supabase/supabase-js` | 2.103.3 | 2.104.0 | Production | None — patch release. Auth flows unchanged. |
| `@tailwindcss/postcss` | 4.2.2 | 4.2.4 | Dev-only | None. |
| `@typescript-eslint/eslint-plugin` | 8.58.2 | 8.59.0 | Dev-only | None. |
| `@vitest/coverage-v8` | 4.1.4 | 4.1.5 | Dev-only | None. |
| `jsdom` | 29.0.2 | 27.0.1 | Dev-only | Pre-release channel; intentionally pinned. None. |
| `knip` | 6.5.0 | 6.6.1 | Dev-only | None — just upgraded 6.4.1->6.5.0 in `171c9ff`. |
| `posthog-js` | 1.369.3 | 1.369.5 | Production | None — patch. Already past the 1.369.2 security bar (protobufjs/dompurify fix). |
| `resend` | 6.12.0 | 6.12.2 | Production | None — patch release. |
| `tailwindcss` | 4.2.2 | 4.2.4 | Dev-only | None. |
| `vitest` | 4.1.4 | 3.2.4 | Dev-only | Pre-release channel; intentionally pinned. None. |

All production upgrades (`@supabase/supabase-js`, `posthog-js`, `resend`) are patch-level with no CVE or behavior delta. Safe to batch in next triage cycle; no urgency.

---

## Prioritized Remediation Steps

**None required.** No exploitable vulnerabilities, no policy violations, no missing controls.

### Operational housekeeping (non-security):
1. Batch patch-level prod dep upgrades (`@supabase/supabase-js`, `posthog-js`, `resend`) in next triage cycle — low risk, keeps audit surface tight.
2. Monitor GitHub Dependabot alerts for divergence from local audit (local is authoritative; GitHub can lag).

---

## Cross-Agent Context Used

- **Coverage Agent (2026-04-21):** Maintenance-mode cache Supabase-URL invalidation path now fully covered in `src/lib/proxy/maintenance.test.ts` — prevents cross-tenant state leak on project URL change. All webhook, CSRF origin, and auth-refresh paths also covered.
- **Cost Analyst (2026-04-21):** posthog-js advisories resolved by `e66e510`. 0 vulnerabilities confirmed. No cost-related security concerns.
- **Performance Agent (2026-04-21):** `sentry.client.config.ts:10-12` has session replay enabled (`replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0.01`). Performance flagged this as a bundle optimization; from a security standpoint, session replay captures DOM + user input — review PII masking config before any production rollout beyond current low sample rate.
- **Triage Agent (2026-04-20):** Waves 1-2 remediation complete. Wave 3 items (#321-#335) still open in backlog — flag for security review if any touch auth, webhook, or CSP code paths.

---
