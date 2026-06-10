# Security Report — Paisaxe

**Date:** 2026-06-07
**Agent:** Security Agent
**Scope:** Dependency advisories, license compliance, CI/CD security automation, security headers, outdated packages

---

## 1. Health Status: GREEN

Zero advisories detected, zero exploitable. The dependency tree is clean (`npm audit` reports 0 vulnerabilities across all severities). The two transitive advisories from the Apr 17 / Apr 25 cycles (protobufjs Critical, dompurify Moderate, postcss/uuid chains) have all been resolved upstream and no longer appear. License posture is compliant, all seven security headers are present and correct in source, and CI/CD security automation (Dependabot, Gitleaks, npm audit, license-check) is fully active.

GREEN holds. The dompurify chain that drove prior YELLOW reports is now at 3.4.0 (advisory cleared).

---

## 2. Executive Summary

**0 advisories detected, 0 exploitable.**

- **Vulnerabilities:** 0 critical / 0 high / 0 moderate / 0 low. `npm audit` output: "found 0 vulnerabilities".
- **Exploitability:** Not applicable — no advisories to assess. There is no attack surface from the dependency graph this cycle.
- **Licenses:** Compliant. No strong copyleft (GPL/AGPL/SSPL). Two weak-copyleft packages (LGPL-3.0 via sharp's native binary, and a dual-licensed MPL-2.0-OR-Apache-2.0 package) are both covered — one by a documented exception, one by license choice. The `UNLICENSED` flag is the Paisaxe app package itself (expected for a private project).
- **Security headers:** All seven present and verified in source (`src/lib/proxy/csp.ts`, applied via `src/proxy.ts`). HSTS preload, X-Frame-Options DENY, CSP with `object-src 'none'` and `frame-ancestors 'none'`.
- **CI/CD:** Dependabot (pinned to develop), Gitleaks, npm audit (daily cron + per-PR), and license-check all active. No gaps.
- **Outdated packages:** 27 packages behind, all production-safe minor/patch bumps or dev-only. None carry CVEs. None are security-driving.

---

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------------------|---------------|---------|-----------------|
| — | — | — | — | — | No advisories this cycle. `npm audit` reports 0 vulnerabilities. |

**Recently-resolved advisories (for continuity — no longer present):**

| Severity | Package | Advisory | Status |
|----------|---------|----------|--------|
| Critical | protobufjs | GHSA-xq3m-2v4x-88gg (prototype-pollution family) | Resolved — upgraded to >=7.5.5 (commit `e66e510`, Apr 20). Cleared. |
| Moderate | dompurify | GHSA-39q2-94rc-95cp (CVE-2025-26791, mXSS via nesting) | Resolved — now 3.4.0 (>3.3.3). Cleared. |
| Moderate | postcss | GHSA-qx2v-qp2m-jg93 (CVE-2023-44270, line-break parsing) | Resolved — override / upgrade applied. Cleared. |
| Moderate | uuid | GHSA-w5hq-g745-h8pq | Resolved — resend pin synced. Cleared. |

---

## 4. Detailed Exploitability Analysis (High / Critical)

No high or critical advisories are present this cycle, so there is nothing to analyze. For the record, the controls that previously contained transitive advisories remain in place:

- **dompurify is never called by application code.** `grep` over `src/` returns zero matches for `dompurify` / `DOMPurify`. It is pulled in transitively by `posthog-js` (`paisaxe -> posthog-js@1.376.4 -> dompurify@3.4.0`) and used only inside PostHog's internal analytics. Even if a future dompurify advisory lands, there is no user-controlled input path through our code. Primary XSS defense in this app is output sanitization in the react-markdown render sinks (`voice-chat.tsx`, `safe-markdown.tsx`), enforced by `e2e/xss-canary.spec.ts` — not CSP, by deliberate PPR-compatibility design.
- **protobufjs was telemetry-only.** It served internal OpenTelemetry serialization, not user input — never exploitable in this codebase even while the advisory was open.

---

## 5. Prioritized Remediation Steps

No security-driven remediation is required this cycle.

**Hygiene (low priority, batchable with the next dependency cycle):**

1. **Sync posthog-js lockfile drift.** `npm ls` reports `posthog-js@1.376.4 invalid: "^1.378.1" from the root project` — the installed version is behind the package.json range, and the outdated list shows a further bump available (1.376.4 -> 1.382.0). Run `npm install` to reconcile, then batch the minor bump:
   ```bash
   npm install
   npm install posthog-js@latest
   ```
   This is hygiene, not a vulnerability fix — current posthog-js carries no open advisory.

2. **Batch the 27 outdated packages** (see Section 9) into a single Dependabot-grouped PR rather than one-by-one. All are minor/patch or dev-only.

3. **Hold voyageai at 0.1.0.** Do NOT include `voyageai` in any upgrade batch — 0.2.x has a broken ESM build (Turbopack cannot resolve its bare dir imports). This is already pinned in `.github/dependabot.yml`.

---

## 6. License Compliance

**Status: Compliant.** No strong copyleft. CI `license-check.yml` blocks GPL-2.0, GPL-3.0, AGPL-1.0/3.0, EUPL-1.1/1.2, SSPL-1.0, BSL-1.1, CPAL-1.0, OSL-3.0, CPOL-1.02 on every PR.

Flagged packages by name (MPL / LGPL / GPL / UNLICENSED scan):

| Package | License | Assessment |
|---------|---------|------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | **Approved exception.** Documented in `docs/project/license-exceptions.md` (Exception 1). Weak copyleft; dynamically linked pre-built native binary under `sharp` (Apache-2.0), no modifications, SaaS deployment — no copyleft obligation triggered. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | **No concern.** Dual-licensed — Apache-2.0 may be elected, sidestepping MPL entirely. Transitive via posthog-js. (Note: `@vercel/analytics` MPL-2.0 is separately covered by Exception 2.) |
| `paisaxe@1.5.1` | UNLICENSED | **Expected.** This is the Paisaxe application package itself — a private, proprietary project. Not a third-party dependency. No action. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | No concern. MIT may be elected. |
| `@babel/template@7.28.6` | MIT | False positive (matched on the `template` substring). MIT — permissive. |
| `simple-concat@1.0.1` | MIT | False positive (string-match). MIT — permissive. |
| `simple-get@4.0.1` | MIT | False positive (string-match). MIT — permissive. |

The remaining license distribution is overwhelmingly permissive: MIT (389), Apache-2.0 (36), BSD-3-Clause (19), ISC (17), BSD-2-Clause (8), BlueOak-1.0.0 (5), plus a handful of dual-licensed permissive packages. The scan reports `COPYLEFT LICENSES FOUND: false`.

---

## 7. Security Headers Status

All seven headers present and verified in source (`src/lib/proxy/csp.ts` builds the CSP; `src/proxy.ts` applies the header set; tested by `src/lib/security-headers.test.ts` and `src/proxy.test.ts`).

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass — 2-year max-age, preload-eligible |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — mic scoped to self for ElevenLabs voice |
| Content-Security-Policy | see below | Pass |
| (frame protection) | `frame-ancestors 'none'` + `object-src 'none'` in CSP | Pass |

**CSP:** `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

The `'unsafe-inline'` in script-src is a deliberate, documented design choice for PPR/`cacheComponents` compatibility (prerendered static shells carry no nonce). `'strict-dynamic'` and nonce-only CSP are explicitly avoided per CLAUDE.md and the file header in `csp.ts`. XSS defense is shifted to react-markdown output sanitization at the render sinks, with `e2e/xss-canary.spec.ts` as the regression gate. This is correct for the architecture and is not a finding. `'unsafe-eval'` is added only in `development`.

---

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — npm + github-actions, weekly Monday, **target-branch: develop** (never main — correct, respects production safety). Grouped production / dev-and-types PRs. voyageai >=0.2.0 ignored. |
| Renovate | Not configured | Intentional — Dependabot covers the need. No gap. |
| Gitleaks | Active | `security.yml` — full-history secret scan (`fetch-depth: 0`), Gitleaks 8.21.2, on push + PR. |
| npm audit | Active | `security.yml` — production deps, fails at moderate threshold, **daily 08:00 UTC cron** (latency reduced from ~6 days to <24h) plus per-PR. Informational full audit always runs. |
| license-check | Active | `license-check.yml` — `license-checker --production`, blocks all strong copyleft on every PR. |
| Vercel env safety | Active | `security.yml` — asserts the legacy agent-runner override key is absent from Vercel env before deploy. |

No CI/CD security gaps. The "Gitleaks CI gap" that QA flagged in earlier cycles was closed; Gitleaks is confirmed present and running here.

---

## 9. Outdated Packages with Security Implications

27 packages behind. **None carry a known CVE or open advisory.** Production-relevant entries, ordered by recommended priority:

| Package | Current -> Latest | Type | Note |
|---------|------------------|------|------|
| posthog-js | 1.376.4 -> 1.382.0 | prod | Highest priority — also fixes the lockfile `invalid` drift vs package.json `^1.378.1`. No advisory; hygiene. |
| next | 16.2.6 -> 16.2.7 | prod | Patch. Framework patch — verify on preview before any release (deployment-safety rule). |
| @anthropic-ai/sdk | 0.100.1 -> 0.102.0 | prod | Minor. |
| @supabase/supabase-js | 2.106.2 -> 2.107.0 | prod | Patch. |
| @sentry/core, @sentry/nextjs | 10.55.0 -> 10.56.0 | prod | Patch — error-tracking pipeline. |
| @stripe/react-stripe-js | 6.4.0 -> 6.6.0 | prod | Minor — payments surface; verify checkout after bump. |
| @radix-ui/* (dialog, label, select, slot, tooltip) | various patch/minor | prod | UI primitives. |
| pdfjs-dist | 5.7.284 -> 6.0.227 | dev/build | Major. Confirmed devDependency (per Performance Agent) — never shipped to client. Low urgency. |
| voyageai | 0.1.0 -> 0.3.1 | prod | **DO NOT upgrade** — 0.2.x+ ESM build is broken under Turbopack. Pinned in dependabot. |
| jsdom | 29.1.1 -> 27.0.1 | dev | Dev-only test env. The "downgrade" reflects a pre-release/channel mismatch — no security impact. |
| vitest, @vitest/* | 4.1.x -> 3.2.6 / patch | dev | Dev-only test runner. No security impact. |
| knip, tsx, eslint plugins, @types/* | various | dev | Dev tooling. No security impact. |

**Assessment:** No outdated package is exploitable or advisory-bearing. The single hygiene item worth pulling forward is the posthog-js sync (resolves the lockfile `invalid` state). Everything else is safe to batch on the normal Dependabot cadence. Framework (next) and payments (Stripe) bumps require preview verification, not a CI-green-and-merge.

---

## Summary

GREEN. Zero advisories, zero exploitable, fully license-compliant, all security headers correct in source, and complete CI/CD security automation. The only open items are dependency hygiene (posthog-js lockfile drift + a batchable 27-package update set), none of which are security-driving. No security blockers for the long-discussed tier-downgrade / voice-shelving decision — voice shelving is security-neutral.
