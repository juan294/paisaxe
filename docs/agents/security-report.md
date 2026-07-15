# Security Report — Paisaxe

**Date:** 2026-07-14
**Agent:** Security Agent
**Health status:** GREEN

---

## 1. Health Status: GREEN

**0 advisories detected, 0 exploitable.** `npm audit` returns "found 0 vulnerabilities" across the full dependency tree (production and dev). All security headers were verified live this cycle, license policy is clean with every flagged package accounted for, and all CI/CD security gates are active. No code actions required.

GREEN streak continues (clean since the Apr 20 recovery). One automation watch item this cycle: the Dependabot npm_and_yarn updater run failed on Jul 13 (see Section 8) — an updater-side error, not a code or CI failure, but worth watching for recurrence.

---

## 2. Executive Summary

- **0 advisories detected, 0 exploitable.** No Critical, High, Moderate, or Low vulnerabilities anywhere in the tree. Nothing to fix via `npm audit fix`.
- **License compliance: Pass.** Copyleft check false for both production and dev trees. All flagged packages are documented exceptions, elected permissive branches of dual licenses, the app root itself, or MIT false positives (named in Section 6).
- **Security headers: Verified live this cycle.** CSP, HSTS (2-year max-age with preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, and Permissions-Policy all confirmed in the served responses.
- **CI/CD security automation: Active.** Dependabot, Gitleaks, npm audit, and license-check all running. One watch item: the Jul 13 Dependabot npm_and_yarn updater run errored (updater-side; the github_actions run succeeded).
- **Outdated packages: 21, zero with security implications.** All minor/patch except `typescript` 6.0.3 → 7.0.2 (major, dev-only, no runtime or bundle exposure). Zero CVEs, since there are zero advisories.

---

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|---------------|---------|-----------------|
| — | — | — | — | — | **No advisories this cycle.** `npm audit` reports 0 vulnerabilities across the full tree. |

There are no Critical, High, Moderate, or Low advisories to enumerate, cross-reference to CVE, or assess for exploitability.

---

## 4. Detailed Exploitability Analysis

No advisories exist this cycle, so there is nothing to assess. For reference, the exploitability discipline applied when advisories are present:

- Trace whether the vulnerable code path is reachable from user-controlled input in `src/`.
- Distinguish production runtime deps from build-time/dev-only deps (the latter cannot reach shipped client/server output).
- Confirm whether the specific vulnerable API is actually invoked (e.g., a particular DOMPurify config or uuid code path).

Prior cycles applied exactly this: the Apr 17 protobufjs (Critical, GHSA-xq3m-2v4x-88gg) and dompurify (Moderate, GHSA-39q2-94rc-95cp) advisories were triaged as NOT EXPLOITABLE (transitive `posthog-js` internals, no user-input path) before being cleared by upgrade on Apr 20.

---

## 5. Prioritized Remediation Steps

1. **No security remediation required.** Zero advisories, zero exploitable findings.
2. **Watch — Dependabot npm_and_yarn updater failure (Jul 13, run 29234361163):** "updater encountered errors." Not a code failure and last develop push has all CI green, but if the npm updater keeps failing, Dependabot version PRs stop flowing. Check the update log (requires write access: github.com/juan294/paisaxe/network/updates/1458090811) if it recurs on the next scheduled run.
3. **Optional hygiene — dependency freshness (low urgency, no CVEs):** the 21 outdated packages can be batched in a routine dep pass. None are security-driven. Recommended for the safe minor/patch batch:
   ```bash
   npm update && npm run test && npm run typecheck && npm run lint
   ```
   Hold `typescript` 6→7 (major) for its own isolated worktree with a full typecheck + build run — dev-only, but majors can surface type-checking behavior changes.
4. **Optional hygiene — working-tree temp file:** `.security-metrics.tmp` is again present untracked (transient artifact of the metrics collection step; aggregate metrics only, no secrets). Recommend the security-agent script remove it on exit or add it to `.gitignore`. Not a vulnerability.

---

## 6. License Compliance — Named Packages

**Result: Pass.** No strong-copyleft violations. Copyleft check: false for production deps, false for dev/build deps.

### Flagged packages — PRODUCTION tree, named

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved — Exception 1 in `license-exceptions.md`. Weak copyleft; pre-built native binary dynamically linked via `sharp` (Apache-2.0), no modifications, SaaS deployment. |
| `@img/sharp-libvips-darwin-arm64@1.3.2` | LGPL-3.0-or-later | Approved — same exception (newer platform build). |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | Dual-licensed — Apache-2.0 branch elected, recorded in `license-exceptions.md`. Used internally by `posthog-js`; no application code calls DOMPurify directly. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed — MIT branch elected, recorded. Build-time only (native prebuild install). |
| `paisaxe@1.6.0` | UNLICENSED | The app root itself. Expected for a private, non-published project — not a third-party dependency. No action. |
| `@babel/template@7.29.7` | MIT | Permissive — false positive in the flag scan. No action. |
| `simple-concat@1.0.1` | MIT | Permissive — false positive. No action. |
| `simple-get@4.0.1` | MIT | Permissive — false positive. No action. |

### Additional flagged packages — DEV/BUILD tree only (not shipped), named

| Package | License | Status |
|---------|---------|--------|
| `lightningcss@1.32.0` | MPL-2.0 | Approved — Exception 3 in `license-exceptions.md`. File-level weak copyleft; build-time CSS transformer (Tailwind v4 / Vite), never bundled to clients. |
| `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Approved — platform binary of the above. |

Also recorded in policy (not surfaced by this cycle's flag scan): `@sentry/cli` / `@sentry/cli-darwin@2.58.5` (FSL-1.1-MIT, dev-only, Exception 4). No MPL/LGPL/GPL/UNLICENSED package is unaccounted for.

---

## 7. Security Headers Status

All headers verified in the live response this cycle:

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'`; `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; scoped `connect-src`/`img-src`/`frame-src` allowlists (Supabase, ElevenLabs WSS, Stripe, Vercel telemetry) | Present |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Present |
| X-Content-Type-Options | `nosniff` | Present |
| X-Frame-Options | `DENY` | Present |
| Referrer-Policy | `strict-origin-when-cross-origin` | Present |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Present |

**CSP note (unchanged, correct):** `'unsafe-inline'` in `script-src` is a deliberate PPR-compatibility trade-off — nonces would force dynamic rendering and break the static shell, and `'strict-dynamic'` would override `'self'` and block all scripts on prerendered pages. Compensating controls must remain CI gates: the CSP/XSS canary in `e2e/smoke.spec.ts`, the render-sink registry, and no raw-HTML passthrough in the markdown renderers. `frame-ancestors 'none'` plus `X-Frame-Options DENY` give clickjacking defense-in-depth.

**Webhook/CSRF signature verification:** timing-safe comparison (`timingSafeEqual`) confirmed in prior cycles across `src/lib/csrf.ts`, `src/lib/cron-auth.ts`, `src/lib/mcp-auth.ts`, the Supabase and translate webhook routes, and the ElevenLabs webhook service. No source changes have shipped since Jul 10, so those verifications carry forward unchanged. QA (Jul 14) reconfirmed all 3 LLM safety guardrails pass (prompt injection, PII extraction, authority impersonation).

---

## 8. CI/CD Security Automation Status

| Control | Configured | Notes |
|---------|-----------|-------|
| Dependabot | Yes | Pinned to `develop`. **Watch:** the npm_and_yarn updater run failed Jul 13 (run 29234361163, "updater encountered errors"); the github_actions run succeeded. Updater-side error, not a code failure. Recheck next scheduled run. Reminder: alerts key off the default branch (`main`), so develop-only fixes keep alerts open until a production release. |
| Renovate | No | Not needed — Dependabot covers dependency updates. No gap. |
| Gitleaks | Yes | Secret scanning in CI. Covers the GHAS secret-scanning gap on this private repo. |
| npm audit | Yes | Runs in CI pipeline. |
| license-check | Yes | Blocks strong copyleft (GPL/AGPL/SSPL and related) on production deps; scans and reports (non-blocking) on dev deps. |

**Known, non-actionable gap:** GitHub Advanced Security (code scanning + secret scanning) is not enabled on this private repo — an owner cost decision. Gitleaks in CI provides secret-scanning coverage in the interim. Consistent with prior triage findings.

**E2E negative-path gap (QA, carried):** the 4 webhook routes (stripe/elevenlabs/supabase/translate) still lack bad-signature 4xx E2E smokes. The signature-verification code itself is confirmed correct and timing-safe; this is a test-coverage gap, not a vulnerability.

---

## 9. Outdated Packages with Security Implications

**21 outdated packages, none with security implications.** Zero CVEs (zero advisories in the tree). All routine minor/patch except one dev-only major.

Production runtime deps (minor/patch, no CVEs):
- `@anthropic-ai/sdk` 0.110.0 → 0.111.0
- `@elevenlabs/react` 1.9.0 → 1.10.0
- `@radix-ui/react-dialog` 1.1.18 → 1.1.19
- `@radix-ui/react-select` 2.3.2 → 2.3.3
- `@radix-ui/react-tooltip` 1.2.11 → 1.2.12
- `@sentry/core` 10.63.0 → 10.65.0
- `@sentry/nextjs` 10.63.0 → 10.65.0
- `@supabase/ssr` 0.12.0 → 0.12.1
- `@supabase/supabase-js` 2.110.0 → 2.110.3
- `lucide-react` 1.23.0 → 1.24.0
- `postcss` 8.5.15 → 8.5.19 (build-time; no open advisory — the Apr 25 postcss XSS chain required only >=8.5.10)
- `posthog-js` 1.396.7 → 1.399.5 (hygiene only — current version has 0 advisories)
- `resend` 6.17.1 → 6.17.2
- `stripe` 22.3.0 → 22.3.1

Dev/tooling deps (no bundle or runtime exposure):
- `@types/node` 26.1.0 → 26.1.1
- `@typescript-eslint/eslint-plugin` 8.62.1 → 8.64.0
- `@vitest/eslint-plugin` 1.6.21 → 1.6.23
- `eslint` 9.39.4 → 9.39.5
- `knip` 6.24.0 → 6.26.0
- `tsx` 4.23.0 → 4.23.1
- `typescript` 6.0.3 → 7.0.2 (**major** — dev-only; upgrade in an isolated worktree with full typecheck + build)

Recommendation: batch the minor/patch updates in a routine dep pass; isolate the TypeScript major. No security urgency. Per the Performance Agent (Jul 12/13), the posthog-js/supabase-js deltas land in deferred chunks only — zero first-paint impact.

---

## Cross-Agent Cross-References

- **QA Agent:** The Jul 14 Stripe probe HTTP 000 was a curl transport flake, not a security event — your live re-check confirmed `/api/checkout/health` enforces auth (401) correctly. Webhook bad-signature 4xx smokes remain the outstanding negative-path gap.
- **Triage Agent:** Two watch/hygiene items — (1) Dependabot npm_and_yarn updater failure Jul 13 (recheck next run), (2) `.security-metrics.tmp` cleanup in the security-agent script. Neither is a vulnerability.
- **Performance Agent:** Nothing in this cycle's dep list is client-first-load visible; TypeScript 6→7 is dev-only.
- **Cost Analyst Agent:** 0 advisories carry forward; no cost-related security concerns.

---
