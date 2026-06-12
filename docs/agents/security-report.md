# Security Report — Paisaxe

**Date:** 2026-06-11
**Agent:** Security Agent
**Scope:** Dependency advisories, license compliance, CI/CD security automation, security headers, outdated packages

---

## 1. Health Status: GREEN

Zero advisories detected, zero exploitable. `npm audit` reports 0 vulnerabilities across all severities (critical/high/moderate/low all 0). License posture is compliant — no strong copyleft anywhere in the tree, all flagged packages either documented (Exception 1) or false positives/dual-licensed. All seven security headers verified present, including a full CSP with `object-src 'none'` and `frame-ancestors 'none'`. CI/CD security automation (Dependabot, Gitleaks, npm audit daily cron, license-check) fully active.

GREEN streak continues from Jun 10. Notable this cycle: the Jun 11 triage resolved the `@vercel/analytics` MPL exception (package is now MIT upstream — Exception 2 marked resolved in license-exceptions.md), and Dependabot PR #597 landed 19 production updates on develop.

---

## 2. Executive Summary

**0 advisories detected, 0 exploitable.**

- **Vulnerabilities:** 0 critical / 0 high / 0 moderate / 0 low. `npm audit` output: "found 0 vulnerabilities". Nothing to fix via `npm audit fix`. No exploitability analysis required — there is no advisory surface this cycle.
- **Licenses:** Compliant. `COPYLEFT LICENSES FOUND: false`. One weak-copyleft package (`@img/sharp-libvips-darwin-arm64@1.2.4`, LGPL-3.0-or-later) covered by documented Exception 1. `dompurify@3.4.0` is dual-licensed `(MPL-2.0 OR Apache-2.0)` — we may elect Apache-2.0, so no copyleft obligation. The `@vercel/analytics` MPL exception is now formally resolved (MIT upstream).
- **Security headers:** All seven present (HSTS with 2-year max-age + preload, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, full CSP). Header set captured twice in metrics, both identical — consistent across routes.
- **CI/CD:** Dependabot (pinned to develop), Gitleaks (full-history scan), npm audit (per-push, per-PR, and daily 08:00 UTC cron at moderate threshold for production deps), and license-check all active. No gaps. Renovate not configured — intentional, Dependabot covers the same ground.
- **Outdated packages:** 26 listed, but this is dominated by a **stale local `node_modules`**: Dependabot PR #597 (merged today, 19 production updates) updated `package.json`/lockfile (e.g. `next` is now `^16.2.9`) while local `node_modules` still has `next@16.2.7` and `@supabase/ssr@0.10.3`. A local `npm install` resolves most of the list. None of the 26 carries a CVE or open advisory.
- **Scan artifacts:** Two entries in the outdated list are inverted "downgrades" (`jsdom 29.1.1 -> 27.0.1`, `vitest 4.1.8 -> 3.2.6`) — the installed versions are ahead of the npm `latest` dist-tag. These must NOT be "fixed" by downgrading; they are npm-outdated artifacts, not actionable items.

---

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------------------|---------------|---------|-----------------|
| — | — | — | — | — | No advisories this cycle. `npm audit` reports 0 vulnerabilities. |

**Recently-resolved advisories (continuity record — all confirmed absent):**

| Severity | Package | Advisory | Status |
|----------|---------|----------|--------|
| Critical | protobufjs | GHSA-xq3m-2v4x-88gg | Resolved Apr 20 (upgraded >=7.5.5, commit `e66e510`). Never exploitable here (internal telemetry serialization only, no user-input path). |
| Moderate | dompurify | GHSA-39q2-94rc-95cp (CVE-2025-26791) | Resolved Apr 20 — now 3.4.0. Never exploitable (no application code calls DOMPurify directly; transitive via posthog-js only). |
| Moderate | postcss | GHSA-qx2v-qp2m-jg93 (CVE-2023-44270) | Resolved Apr 29 via `package.json` override (`postcss >= 8.5.10`). Build-time only, never shipped to clients. |
| Moderate | uuid | GHSA-w5hq-g745-h8pq | Resolved — resend pin synced. The `uuid.v4` code path we use was never affected. |

---

## 4. Detailed Exploitability Analysis (High / Critical)

No high or critical advisories are present — nothing to analyze. The standing containment facts that limit blast radius of future advisories remain true and were re-verified in recent cycles:

- **dompurify (3.4.0, transitive via posthog-js) is never called by application code** — zero matches in `src/`. Any future dompurify advisory has no user-controlled input path through our code. Primary XSS defense is sanitization at the react-markdown render sinks (`voice-chat.tsx`, `safe-markdown.tsx`), gated by the `e2e/xss-canary.spec.ts` test.
- **Webhook surface:** all 4 webhook endpoints use timing-safe comparison (7 `timingSafeEqual` call sites, verified Apr 17, unchanged since).
- **CSRF:** Origin + double-submit token enforcement confirmed working since SE-M2 hardening; QA safety tests (injection, role-play override, PII extraction) passing since May 3.
- **SSRF:** image proxy blocks private IPv4 and IPv6 ranges (fc00::/7, fe80::/10, ff02::/8), covered by tests (Coverage Agent, May 5).
- **Database:** migrations 089–092 (RLS on `admin_audit_log` + 4 operational tables, internal function access revocation, `daab51ae`) reviewed — these harden the Supabase advisor findings and are security-positive. Documentation Agent confirms no doc impact.

---

## 5. Prioritized Remediation Steps

No security-driven remediation is required. Hygiene items, in order:

1. **Run `npm install` locally** to materialize the #597 production batch (19 packages: `next` 16.2.9, `@supabase/ssr` 0.12.0, `@supabase/supabase-js` 2.108.1, `@sentry/nextjs` 10.57.0, `@anthropic-ai/sdk` 0.104.1, etc.). CI is unaffected (installs from lockfile), but local tests and the next bundle measurement run against stale modules until this happens. Note `posthog-js@1.384.0` is already materialized (Jun 10 triage); 1.386.1 is available for the next batch.
   ```bash
   cd /Users/juan/code/paisaxe && npm install
   ```
2. **Do NOT act on the inverted entries** `jsdom 29.1.1 -> 27.0.1` and `vitest 4.1.8 -> 3.2.6` — installed versions are ahead of the `latest` dist-tag; downgrading would be a regression. Consider teaching the metrics script to drop entries where installed > latest.
3. **`@supabase/ssr` 0.10.3 -> 0.12.0 is auth-surface** — after `npm install`, run the auth E2E flows (login, session refresh in `src/proxy.ts`) before the next release. Two minor versions on the session-cookie layer deserve a smoke pass.
4. **Next batch candidates (no CVEs, low urgency):** `voyageai` remains intentionally pinned at 0.1.0 (broken ESM in 0.2.x+, Dependabot ignore rule in place — 0.3.1 listed in outdated output is expected noise); `sharp` 0.35.0 is a minor with libvips bump — verify the LGPL exception still matches the shipped `@img/sharp-libvips-*` version when it lands.

---

## 6. License Compliance

`COPYLEFT LICENSES FOUND: false` (strong copyleft). Flagged-package review, by name:

| Package | License | Assessment |
|---------|---------|------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | **Approved — Exception 1** in `docs/project/license-exceptions.md`. Dynamically-linked prebuilt binary, unmodified, SaaS deployment — no copyleft obligation. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | **Compliant — dual-licensed.** We elect Apache-2.0; no MPL obligation attaches. No exception needed. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | **Compliant — dual-licensed.** We elect MIT. |
| `paisaxe@1.5.1` | UNLICENSED | **Expected** — this is the application package itself (private, proprietary). Not a dependency. |
| `@babel/template@7.28.6` | MIT | **False positive** — flagged by name pattern, license is plain MIT. |
| `simple-concat@1.0.1` | MIT | **False positive** — plain MIT. |
| `simple-get@4.0.1` | MIT | **False positive** — plain MIT. |

Other notable license families in the tree, all permissive or acceptable: BlueOak-1.0.0 (5 packages, permissive), FSL-1.1-MIT (2 packages — `@sentry/cli` + platform binary, dev-only build tooling, converts to MIT after 2 years, assessed acceptable in prior cycles), CC-BY-4.0 (1, data/docs attribution), Unlicense/0BSD/MIT-0 (public-domain-equivalent).

**Status change this cycle:** Exception 2 (`@vercel/analytics`, formerly MPL-2.0) formally marked **resolved 2026-06-11** — the installed 2.0.1 package now ships under MIT. Only Exception 1 (sharp-libvips LGPL) remains active.

---

## 7. Security Headers Status

All seven headers present (captured live, two identical sets in metrics):

| Header | Value | Assessment |
|--------|-------|------------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass — 2-year max-age, preload-eligible. |
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ... object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass. `'unsafe-inline'` in script-src is a documented, deliberate trade-off for PPR/cacheComponents compatibility (nonces are incompatible with the prerendered static shell — see CLAUDE.md CSP section). `frame-ancestors 'none'` + `object-src 'none'` + scoped connect-src/img-src/frame-src are correct. E2E CSP canary in `e2e/smoke.spec.ts` guards against script-blocking regressions. |
| X-Frame-Options | `DENY` | Pass — redundant belt-and-braces with `frame-ancestors 'none'`. |
| X-Content-Type-Options | `nosniff` | Pass. |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass. |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — microphone self-only is required for the Pelayo voice widget. |

No header changes since the last cycle. No action needed.

---

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — weekly Monday, **target-branch develop** (production-safety compliant), grouped (production / dev-and-types), voyageai >=0.2.0 ignored (broken ESM). PRs #596/#597 from this week's run merged. |
| Gitleaks | Active | `security.yml` — full-history scan (`fetch-depth: 0`) on push/PR to develop+main and daily 08:00 UTC cron. |
| npm audit | Active | `security.yml` — `npm audit --omit=dev --audit-level=moderate` blocking on production deps, plus informational full audit. Runs per-push, per-PR, and on the daily cron. |
| License check | Active | `license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on PRs; warns on weak copyleft (LGPL/MPL) per policy. |
| Vercel env safety | Active | `security.yml` — asserts the legacy agent-runner override key is absent from Vercel env. |
| Renovate | Not configured | Intentional — Dependabot covers dependency automation. Not a gap. |

No gaps. The daily cron keeps CVE detection latency under 24h.

---

## 9. Outdated Packages with Security Implications

26 entries reported, but the list is **inflated by stale local `node_modules`** — PR #597 (merged 2026-06-11) already bumped 19 production packages in `package.json`/lockfile; locally installed copies lag until `npm install` runs. Security-relevant subset:

| Package | Installed | Available | Security relevance |
|---------|-----------|-----------|--------------------|
| `next` | 16.2.7 | 16.2.9 (already in package.json) | Framework — patch releases routinely include security fixes. Highest-value install. |
| `@supabase/ssr` | 0.10.3 | 0.12.0 (already in package.json) | Auth/session-cookie layer. Smoke-test auth flows after install. |
| `@supabase/supabase-js` | 2.106.2 | 2.108.1 | Auth-adjacent client. Patch-level. |
| `@sentry/nextjs` / `@sentry/core` | 10.55.0 | 10.57.0 | Error-tracking — handles request data; keep current. |
| `@anthropic-ai/sdk` | 0.100.1 | 0.104.1 | API client for chat pipeline. No advisory. |
| `@stripe/stripe-js` / `@stripe/react-stripe-js` | 9.7.0 / 6.5.0 | 9.8.0 / 6.6.0 | Payment surface — keep current as hygiene. No advisory. |
| `sharp` | 0.34.5 | 0.35.0 | Image processing (historical CVE source via libvips). No current advisory. Re-verify LGPL exception version on upgrade. |
| `posthog-js` | 1.384.0 | 1.386.1 | Carries dompurify transitively (past advisory source). Current install clean. |
| `voyageai` | 0.1.0 | 0.3.1 | **Intentionally pinned** — 0.2.x+ has broken ESM. Dependabot ignore rule in place. Do not upgrade. |
| `jsdom`, `vitest` | 29.1.1 / 4.1.8 | "27.0.1" / "3.2.6" | **Scan artifacts — installed is ahead of `latest` dist-tag. Do not downgrade.** Dev-only regardless. |

None of the outdated packages has an open GHSA/CVE. The single action that resolves most of this table is a local `npm install`.

---
