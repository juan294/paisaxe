# Security Report — Paisaxe

**Date:** 2026-06-10
**Agent:** Security Agent
**Scope:** Dependency advisories, license compliance, CI/CD security automation, security headers, outdated packages

---

## 1. Health Status: GREEN

Zero advisories detected, zero exploitable. `npm audit` reports 0 vulnerabilities across all severities (critical/high/moderate/low all 0). License posture is compliant with no strong copyleft anywhere in the tree, all seven security headers are present and verified (live capture this cycle, both header sets identical), and CI/CD security automation (Dependabot, Gitleaks, npm audit daily cron, license-check) is fully active.

This extends the GREEN streak that resumed Apr 20 (interrupted only by the Apr 25 transitive-chain YELLOW, resolved Apr 29). Notable positive change this cycle: `@vercel/analytics@2.0.1` is now MIT-licensed upstream — the MPL-2.0 exception (license-exceptions.md Exception 2) is moot.

---

## 2. Executive Summary

**0 advisories detected, 0 exploitable.**

- **Vulnerabilities:** 0 critical / 0 high / 0 moderate / 0 low. `npm audit` output: "found 0 vulnerabilities". Nothing to fix via `npm audit fix`.
- **Exploitability:** Not applicable — no advisories to assess. No attack surface from the dependency graph this cycle.
- **Licenses:** Compliant. `COPYLEFT LICENSES FOUND: false`. One weak-copyleft package (`@img/sharp-libvips-darwin-arm64`, LGPL-3.0-or-later) covered by documented Exception 1. New this cycle: FSL-1.1-MIT identified as `@sentry/cli` + `@sentry/cli-darwin` (dev-only build tooling, source-available, not copyleft — assessed acceptable, see Section 6). `UNLICENSED` is the Paisaxe app package itself (expected).
- **Security headers:** All seven present, verified via live header capture. HSTS preload (2-year max-age), X-Frame-Options DENY, CSP with `object-src 'none'` and `frame-ancestors 'none'`.
- **CI/CD:** Dependabot (pinned to develop), Gitleaks, npm audit (daily cron + per-PR), license-check all active. No gaps.
- **Outdated packages:** 31 behind (up from 27 on Jun 7). None carry a CVE or open advisory. One local-environment inconsistency found: the Jun 10 triage bumped posthog-js to `^1.384.0` in package.json and the lockfile, but local `node_modules` still has 1.376.4 — a local `npm install` is pending (CI is unaffected; it installs from the lockfile).

---

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------------------|---------------|---------|-----------------|
| — | — | — | — | — | No advisories this cycle. `npm audit` reports 0 vulnerabilities. |

**Recently-resolved advisories (for continuity — no longer present):**

| Severity | Package | Advisory | Status |
|----------|---------|----------|--------|
| Critical | protobufjs | GHSA-xq3m-2v4x-88gg | Resolved Apr 20 (upgraded >=7.5.5, commit `e66e510`). Never exploitable here (telemetry-only path). |
| Moderate | dompurify | GHSA-39q2-94rc-95cp (CVE-2025-26791) | Resolved Apr 20 — now 3.4.0. Never exploitable (no application code calls DOMPurify). |
| Moderate | postcss | GHSA-qx2v-qp2m-jg93 (CVE-2023-44270) | Resolved Apr 29 via override. Build-time only. |
| Moderate | uuid | GHSA-w5hq-g745-h8pq | Resolved — resend pin synced. uuid.v4 path was never affected. |

---

## 4. Detailed Exploitability Analysis (High / Critical)

No high or critical advisories are present, so there is nothing to analyze this cycle. The standing containment facts remain true and were re-verified in recent cycles:

- **dompurify (3.4.0, transitive via posthog-js) is never called by application code** — zero matches in `src/`. Any future dompurify advisory has no user-controlled input path through our code. Primary XSS defense is output sanitization at the react-markdown render sinks (`voice-chat.tsx`, `safe-markdown.tsx`), gated by `e2e/xss-canary.spec.ts`.
- **Webhook surface:** all 4 webhook endpoints use timing-safe comparison (7 `timingSafeEqual` call sites, verified Apr 17 and unchanged since).
- **CSRF:** Origin + double-submit token enforcement confirmed working since the SE-M2 hardening; QA safety tests (injection, role-play override, PII extraction) passing since May 3.
- **SSRF:** image proxy IPv6 ranges (fc00::/7, fe80::/10, ff02::/8) covered by tests (Coverage Agent, May 5).

---

## 5. Prioritized Remediation Steps

No security-driven remediation is required. Hygiene items, in order:

1. **Run `npm install` in the project root.** The Jun 10 triage commit bumped posthog-js to `^1.384.0` in package.json and package-lock.json, but local `node_modules` still holds 1.376.4 (`npm ls` reports `invalid`). CI is unaffected (lockfile is correct); this only affects local dev/test fidelity.
   ```bash
   cd /Users/juan/code/paisaxe && npm install
   ```
2. **Batch the remaining outdated packages** (Section 9) on the normal Dependabot cadence. Dependabot PR #595 (dev-and-types) already auto-merged; #594 (production group) was rebased by triage and should land next.
3. **Hold voyageai at 0.1.0.** Do NOT include `voyageai` (0.1.0 -> 0.3.1 shown in outdated) in any batch — 0.2.x+ has a broken ESM build under Turbopack. Already ignored in `.github/dependabot.yml`.
4. **Optional cleanup:** mark Exception 2 in `docs/project/license-exceptions.md` as resolved — `@vercel/analytics@2.0.1` now ships under MIT (verified in the installed package), so the MPL-2.0 exception no longer applies to any current dependency.

---

## 6. License Compliance

**Status: Compliant.** No strong copyleft (GPL/AGPL/SSPL) anywhere in the tree. CI `license-check.yml` blocks strong copyleft on every PR.

Flagged packages by name (MPL / LGPL / GPL / UNLICENSED / FSL scan):

| Package | License | Assessment |
|---------|---------|------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | **Approved exception** (Exception 1, `docs/project/license-exceptions.md`). Weak copyleft; dynamically linked pre-built binary under `sharp`, unmodified, SaaS deployment — no copyleft obligation triggered. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | No concern. Dual-licensed — Apache-2.0 may be elected, sidestepping MPL entirely. Transitive via posthog-js. |
| `@sentry/cli@2.58.5`, `@sentry/cli-darwin@2.58.5` | FSL-1.1-MIT | **Acceptable.** Functional Source License — source-available, NOT copyleft; each release converts to MIT after 2 years. Restricts only "competing use" (building a competing error-tracking product). Paisaxe consumes it as dev-only build tooling via `@sentry/nextjs` (sourcemap upload at build time); never shipped to clients. No obligation triggered. |
| `paisaxe@1.5.1` | UNLICENSED | Expected — the Paisaxe application package itself (private, proprietary). Not a third-party dependency. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | No concern. MIT may be elected. |
| `@babel/template@7.28.6` | MIT | False positive (substring match on `template`). Permissive. |
| `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT | False positives (string-match). Permissive. |

**Change vs prior cycles:** `@vercel/analytics@2.0.1` no longer appears in the flagged list — it is now MIT upstream (verified in the installed package's manifest). Exception 2 is moot and can be marked resolved.

Remaining distribution is overwhelmingly permissive: MIT (389), Apache-2.0 (36), BSD-3-Clause (19), ISC (17), BSD-2-Clause (8), BlueOak-1.0.0 (5, permissive), plus dual-licensed permissive packages. Scan verdict: `COPYLEFT LICENSES FOUND: false`.

---

## 7. Security Headers Status

All seven headers present — **verified via live header capture this cycle** (two identical header sets captured; CSP present on the page response). Source of truth: `src/lib/proxy/csp.ts` builds the CSP, `src/proxy.ts` applies the set; tested by `src/lib/security-headers.test.ts` and `src/proxy.test.ts`.

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass — 2-year max-age, preload-eligible |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — mic scoped to self for ElevenLabs voice |
| Content-Security-Policy | full policy below | Pass |
| (frame protection) | `frame-ancestors 'none'` + `object-src 'none'` in CSP | Pass |

**CSP:** `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

The `'unsafe-inline'` in script-src is a deliberate, documented design choice for PPR/`cacheComponents` compatibility (prerendered static shells carry no nonce; `'strict-dynamic'` would block all scripts per CSP Level 3). XSS defense is shifted to react-markdown output sanitization with `e2e/xss-canary.spec.ts` as the regression gate, plus the CSP-canary test in `e2e/smoke.spec.ts`. Correct for the architecture; not a finding.

---

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — npm + github-actions, weekly, target-branch develop (never main). Grouped production / dev-and-types PRs. #595 auto-merged Jun 10; #594 rebased. voyageai >=0.2.0 ignored. |
| Renovate | Not configured | Intentional — Dependabot covers the need. No gap. |
| Gitleaks | Active | `security.yml` — full-history secret scan on push + PR. |
| npm audit | Active | `security.yml` — production deps, fails at moderate threshold, daily 08:00 UTC cron plus per-PR. |
| license-check | Active | `license-check.yml` — `license-checker --production`, blocks strong copyleft on every PR. |
| Vercel env safety | Active | `security.yml` — asserts the legacy agent-runner override key is absent from Vercel env. |

No CI/CD security gaps.

---

## 9. Outdated Packages with Security Implications

31 packages behind. **None carry a known CVE or open advisory.** Notable entries:

| Package | Current -> Latest | Type | Note |
|---------|------------------|------|------|
| posthog-js | 1.376.4 -> 1.384.0 | prod | Already resolved in package.json/lockfile (^1.384.0, Jun 10 triage) — only local `npm install` pending. Not a vulnerability. |
| next | 16.2.6 -> 16.2.9 | prod | Patch x3. Framework patch — verify on preview before any release (deployment-safety rule). |
| @supabase/supabase-js 2.106.2 -> 2.108.1, @supabase/ssr 0.10.3 -> 0.12.0 | prod | Auth/session surface — the most security-relevant bumps in the set. No advisory, but prioritize in the next batch. |
| @sentry/core, @sentry/nextjs | 10.55.0 -> 10.57.0 | prod | Error-tracking pipeline. Patch-level. |
| @stripe/react-stripe-js 6.4.0 -> 6.6.0, @stripe/stripe-js 9.7.0 -> 9.8.0 | prod | Payments surface — verify checkout after bump. |
| @anthropic-ai/sdk | 0.100.1 -> 0.104.1 | prod | Minor. |
| @elevenlabs/react | 1.6.4 -> 1.6.5 | prod | Patch. |
| @radix-ui/* (5 pkgs), @tailwindcss/typography, react/react-dom 19.2.6 -> 19.2.7 | prod | Routine patch/minor. |
| pdfjs-dist | 5.7.284 -> 6.0.227 | dev/build | Major. devDependency only — never shipped to client. pdfjs has a history of CVEs (e.g. CVE-2024-4367) but the server-side extraction context here is not browser-exposed. Low urgency; batch when convenient. |
| voyageai | 0.1.0 -> 0.3.1 | prod | **DO NOT upgrade** — broken ESM build under Turbopack. Pinned in dependabot. |
| jsdom 29.1.1 -> 27.0.1, vitest 4.1.7 -> 3.2.6 | dev | Installed versions are AHEAD of the latest dist-tag (pre-release channel) — `npm outdated` artifacts, not actionable downgrades. No security impact. |
| knip, tsx, @types/*, eslint plugins, @vitest/*, @next/bundle-analyzer | dev | Dev tooling. No security impact. |

**Assessment:** Nothing outdated is exploitable or advisory-bearing. The Supabase pair (auth surface) is the highest-value security-adjacent bump for the next batch. Framework (next) and payments (Stripe) bumps need preview verification, not just CI-green.

---

## Summary

GREEN. Zero advisories, zero exploitable, license-compliant (with the FSL-1.1-MIT packages now explicitly named and assessed), all seven security headers verified live, and complete CI/CD security automation. Open items are pure hygiene: local `npm install` to materialize the posthog-js 1.384.0 bump, the routine 31-package batch (Supabase pair first), and an optional license-exceptions.md cleanup now that `@vercel/analytics` is MIT. No security blockers for the tier-downgrade / voice-shelving decision — it remains security-neutral.
