# Security Report — Paisaxe

**Date:** 2026-06-06
**Agent:** Security Agent
**Scope:** Dependency vulnerabilities, license compliance, security headers, CI/CD automation, outdated packages

---

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable. Clean `npm audit` (production and dev). All security headers present and correct in source and live response. License policy compliant — no strong copyleft, both weak-copyleft packages documented. CI/CD security automation fully active (Gitleaks, npm audit daily, license-check, Vercel env safety).

---

## 2. Executive Summary

**0 advisories detected, 0 exploitable.**

The dependency tree is clean. `npm audit` returns "found 0 vulnerabilities" across both production and dev scopes — there is no Critical/High/Moderate/Low advisory to triage this cycle, and nothing to fix via `npm audit fix`.

Defensive posture is strong and unchanged from the last clean cycle:

- **CSP** is correctly tuned for PPR (`'self' 'unsafe-inline'`, no `'strict-dynamic'`, no nonce dependency), with XSS defense moved to output sanitization in the react-markdown render sinks. Confirmed identical in source (`src/lib/proxy/csp.ts`) and live header.
- **All seven security headers** (HSTS preload, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, plus CSP with `frame-ancestors 'none'` and `object-src 'none'`) are present.
- **License compliance** holds: no GPL/AGPL/SSPL anywhere. The two weak-copyleft packages (sharp-libvips LGPL, dompurify's MPL option) are documented or dual-licensed under a permissive option.
- **CI/CD security** is comprehensive: Gitleaks secret scanning, `npm audit --audit-level=moderate` on every PR plus a daily schedule, a dedicated license-check workflow, and a Vercel env-safety guard.

The only open items are routine dependency hygiene (27 outdated packages, none carrying a CVE) and standing dev-tooling drift, neither of which affects production security.

---

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|---------------|---------|-----------------|
| — | — | — | — | — | **No advisories. `npm audit` reports 0 vulnerabilities (Critical 0, High 0, Moderate 0, Low 0).** |

There are no GHSA/CVE identifiers to cross-reference this cycle. The advisory chains active in late April — `protobufjs` (GHSA-xq3m-2v4x-88gg, Critical, transitive via posthog-js) and `dompurify` (GHSA-39q2-94rc-95cp, Moderate) — were both resolved by `npm audit fix` (commit `e66e510`, reported 2026-04-20), and the later postcss/uuid chains (Apr 25) have likewise cleared. None reappear in the current tree.

---

## 4. Detailed Exploitability Analysis

No high or critical advisories are present, so there is no per-finding exploitability analysis required this cycle.

For completeness, the standing exploitability posture of the codebase (independent of advisories) remains:

- **XSS via markdown render**: Mitigated at the sink, not via CSP nonces. `voice-chat.tsx` uses explicit component overrides with no raw-HTML passthrough; `safe-markdown.tsx` uses an `allowedElements` allowlist with `unwrapDisallowed`. Registry tracked in `docs/project/markdown-render-sinks.md`, regression-guarded by `e2e/xss-canary.spec.ts`. The `'unsafe-inline'` in CSP is a deliberate PPR trade-off, not a gap.
- **Clickjacking**: Blocked by `frame-ancestors 'none'` (CSP) and `X-Frame-Options: DENY` (defense in depth).
- **Webhook forgery / timing attacks**: Previously verified — all webhook signature comparisons use `timingSafeEqual`. No dependency change this cycle touched that path.
- **CSRF**: Double-submit token enforcement plus Origin checking (SE-M2 hardening) confirmed working by the QA agent since 2026-03-23.

---

## 5. Prioritized Remediation Steps

No security remediation is required this cycle. The following are routine, low-urgency hygiene items:

1. **(Optional, hygiene) Batch the production dependency updates.** 27 packages are behind latest, none with a CVE. The Dependabot weekly grouped PRs (`production` + `dev-and-types`) already handle this automatically; no manual `npm audit fix` is needed because there is nothing to fix.
   ```bash
   # Verify clean state (already clean)
   npm audit --omit=dev --audit-level=moderate
   # Let Dependabot's grouped PRs land, or manually:
   npm update
   ```
2. **(No action) `voyageai` stays pinned at 0.1.0.** Dependabot explicitly ignores `>= 0.2.0` because the 0.2.x ESM build has bare directory imports Turbopack cannot resolve. The 0.1.0 -> 0.3.1 "outdated" entry is expected and must not be force-bumped without verifying the ESM fix landed upstream.
3. **(No action) `jsdom` (29.1.1 -> 27.0.1) and `vitest` (4.1.7 -> 3.2.6)** show a *lower* "latest" than installed — a dist-tag artifact, not a real downgrade target. Both are dev-only (testing). Leave as-is.

---

## 6. License Compliance

**Policy:** permissive-only (MIT, Apache-2.0, BSD, ISC). **Result: compliant.** `COPYLEFT LICENSES FOUND: false`. No GPL, AGPL, or SSPL present anywhere in the tree.

Flagged packages by name and disposition:

| Package | License | Disposition |
|---------|---------|-------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | **Documented exception** (`license-exceptions.md` Exception 1). Weak copyleft; pre-built native binary, dynamically linked via `sharp` (Apache-2.0), unmodified, SaaS deployment — no copyleft obligation. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | **Dual-licensed — elect Apache-2.0.** No exception needed; the Apache-2.0 option is fully permissive. (`license-exceptions.md` Exception 2 documents `@vercel/analytics` MPL-2.0 separately; dompurify's MPL surfaces only as the OR clause and carries no obligation under the Apache-2.0 election.) |
| `paisaxe@1.5.1` | UNLICENSED | **Intentional — this is our own private package.** Marked UNLICENSED to prevent accidental npm publication. Not a third-party risk. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed — elect MIT. Permissive, no obligation. |
| `@babel/template@7.28.6` | MIT | False-positive flag (scanner heuristic). MIT is permissive. |
| `simple-concat@1.0.1` | MIT | False-positive flag. MIT is permissive. |
| `simple-get@4.0.1` | MIT | False-positive flag. MIT is permissive. |

License distribution summary: MIT 389, Apache-2.0 36, BSD-3-Clause 19, ISC 17, BSD-2-Clause 8, plus permissive long-tail (BlueOak-1.0.0, FSL-1.1-MIT, 0BSD, Unlicense, MIT-0, CC-BY-4.0, and the dual-license OR clauses above). The single LGPL entry is the documented sharp-libvips exception.

---

## 7. Security Headers Status

All confirmed present in the live response and matching source (`src/lib/proxy/csp.ts`, `next.config.ts`):

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass |

CSP notes:
- `'unsafe-inline'` in `script-src` is a **deliberate PPR design choice** (documented at `csp.ts:1-21`), not a weakness — nonces would force dynamic rendering on CSP-sensitive routes and conflict with `cacheComponents`/PPR static shells. XSS is defended at the markdown render sinks instead.
- `'strict-dynamic'` is correctly **absent** (per CLAUDE.md, it would override `'self'` and break all scripts on prerendered pages).
- `frame-ancestors 'none'` and `object-src 'none'` lock down framing and plugin embedding.
- Source verified by `src/lib/security-headers.test.ts` and `src/proxy.test.ts`.

---

## 8. CI/CD Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — weekly (Monday), targets `develop`, grouped `production` + `dev-and-types` PRs, limit 10. Explicitly ignores `voyageai >= 0.2.0` (broken ESM). GitHub Actions ecosystem also tracked. |
| npm audit in CI | Active | `security.yml` — `npm audit --omit=dev --audit-level=moderate` on every push/PR to develop & main, **plus a daily 8:00 UTC schedule** (reduced CVE detection latency from ~6 days to <24h). Informational full audit also runs. |
| Gitleaks | Active | `security.yml` — Gitleaks 8.21.2, `detect --source . --verbose`, full-depth checkout. |
| License check | Active | `license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL); warns on weak copyleft (LGPL/MPL) per documented policy. |
| Vercel env safety | Active | `security.yml` — asserts the legacy agent-runner override key is absent from Vercel production env before deploy. |
| Renovate | Not configured | Intentional — Dependabot covers this role. No gap. |

No CI/CD security gaps. Gitleaks is present and running, closing out the "Gitleaks CI gap" flagged in earlier QA cycles.

---

## 9. Outdated Packages with Security Implications

27 packages outdated; **none carry a known CVE** (corroborated by the clean `npm audit`). No security-driven upgrade is required. Notable entries:

- **Production (minor/patch, hygiene only):** `@anthropic-ai/sdk` 0.100.1 -> 0.101.0, `next` 16.2.6 -> 16.2.7, `@sentry/core` & `@sentry/nextjs` 10.55.0 -> 10.56.0, `@supabase/supabase-js` 2.106.2 -> 2.107.0, `@stripe/react-stripe-js` 6.4.0 -> 6.6.0, `posthog-js` 1.376.4 -> 1.381.0, `react`/`react-dom` 19.2.6 -> 19.2.7, several `@radix-ui/*` minors. All deferred to Dependabot's grouped PRs.
- **`posthog-js` 1.376.4 -> 1.381.0:** Worth prioritizing in the next batch only because posthog-js was the source of the (now-resolved) protobufjs/dompurify transitive advisories in April — keeping it current minimizes the re-exposure window. No current advisory.
- **`pdfjs-dist` 5.7.284 -> 6.0.227 (major):** A devDependency / build-pipeline only — confirmed not shipped to the client bundle (per Performance agent, Jun 4). No client-side exposure regardless of version.
- **`voyageai` 0.1.0 -> 0.3.1:** Pinned by policy (Dependabot ignore). Do NOT bump — 0.2.x ESM build is broken under Turbopack. No security implication.
- **`jsdom` 29 -> 27, `vitest` 4 -> 3:** Dev/test only, dist-tag artifacts. No security relevance.

---

## Cross-Agent Notes

- **Performance Agent:** No new client-side dependencies entered the graph this cycle; the confirmed 3,398 KB bundle breach is a size issue, not a security one. `voyageai` stays pinned at 0.1.0. `pdfjs-dist`/`pdf-parse` confirmed devDependency-only — not in the client breach path. Shelving the ElevenLabs voice chunk (605 KB) has no security impact either direction.
- **Cost Analyst Agent:** 0 advisories — no security cost or risk contribution to the 113-day revenue drought. ElevenLabs voice shelving is security-neutral.
- **QA Agent:** Safety guardrails (CSRF + Origin enforcement) remain correct and should not be weakened by any test-harness fix. 0 advisories means no security action items blocking QA this cycle.
- **Coverage Agent:** Webhook `timingSafeEqual` paths and CSRF error branches remain the security-critical coverage targets; no regression risk introduced this cycle.

---
