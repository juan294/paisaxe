# Security Report — Paisaxe

Date: 2026-06-17
Agent: Security Agent
Package version: paisaxe@1.5.1

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable.

Rationale: The Jun 16 triage (`npm audit fix`) resolved all 9 previously open advisories in a single clean pass. Today's `npm audit` returns a fully clean tree with zero findings in both the production and dev dependency graphs. GREEN restored after 1-run YELLOW (Jun 16).

## 2. Executive Summary

- 0 advisories detected. 0 exploitable.
- `npm audit fix` (Jun 16 triage) bumped form-data 4.0.5 -> 4.0.6, vite 8.0.8 -> 8.0.16, ws 7.5.10 -> 7.5.11, @babel/core 7.29.0 -> 7.29.6, @opentelemetry/core 2.7.1 -> 2.8.0 (and dependent OTel packages), js-yaml 4.1.1 -> 4.2.0, and dompurify to 3.4.10 — all without major version bumps.
- `esbuild` and `protobufjs` audit pins moved from `dependencies` to `overrides` (Jun 16 triage). Production dep count: 36 -> 34. `npm audit --omit=dev` passes cleanly.
- License compliance: Pass. All flagged packages are either documented exceptions, dual-license with a permissive option, or Paisaxe's own private package.
- Security headers: All present and correctly configured (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- CI/CD security automation: All controls active. No gaps.
- Cross-agent note: QA safety guardrails (injection/PII/role-play resistance) are unverified for a 4th consecutive cycle due to issue #635 (harness port mismatch). No regression evidence, no confirmation either. No security action needed here — this is a QA harness fix.

## 3. Vulnerability Table

No advisories this cycle.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | Clean |
| High | 0 | Clean |
| Moderate | 0 | Clean |
| Low | 0 | Clean |
| Total | 0 | Clean |

All 9 advisories from Jun 16 were resolved by `npm audit fix`. See the Jun 16 report for the detailed per-advisory breakdown and exploitability analysis (they were all non-exploitable; fixed as hygiene).

## 4. Detailed Exploitability Analysis

No High or Critical advisories this cycle. Nothing to analyze.

The in-house `basic-markdown.tsx` renderer (replaced react-markdown on Jun 12, now at 100% test coverage including XSS-relevant link-safety branches per Coverage Agent Jun 16) remains the correct posture. There are zero DOMPurify calls in `src/` — confirmed by Coverage Agent and grep — so any transitive DOMPurify advisories introduced by posthog-js in the future will continue to be non-exploitable at the application layer.

Webhook timing-safety: All 7 `timingSafeEqual` call sites remain verified. CSRF enforcement confirmed passing (QA journey tests 10/10 green). No changes to the auth or webhook paths this cycle.

## 5. Prioritized Remediation Steps

No remediations required this cycle. The tree is clean.

Carry-forward watch items (not blocking):

1. Monitor `@sentry/nextjs` for a release that bumps `@opentelemetry/core` to >= 2.8.0. The OTel moderate advisories from the production Sentry tree (already fixed this cycle via `npm audit fix`) may re-appear if a future Sentry release re-introduces an older OTel transitive. Run `npm audit --omit=dev` to check.

2. Fix issue #635 (vitest.config.qa.ts webServer config). This is a QA harness concern, but it has a secondary security implication: 4 consecutive cycles without LLM safety test confirmation. The fix is a one-line `webServer` config addition to vitest.config.qa.ts, not a security code change.

3. Optional: run `npm run build:analyze` (webpack mode) once to get authoritative initial-load totals. Deferred 8+ cycles per Performance Agent. No security implication, but useful for confirming the dep cleanup from Jun 16 is bundle-neutral.

## 6. License Compliance

Scan result: Pass. `COPYLEFT LICENSES FOUND: false`. No strong copyleft (GPL/AGPL/SSPL).

Flagged packages (named explicitly):

**Actual concerns reviewed:**

- `@img/sharp-libvips-darwin-arm64@1.2.4` — LGPL-3.0-or-later. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 1). Pre-built native binary, dynamically linked via `sharp`'s Apache-2.0 API, no modifications, SaaS deployment. No copyleft obligation on Paisaxe code.
- `@img/sharp-libvips-darwin-arm64@1.3.0` — LGPL-3.0-or-later. APPROVED EXCEPTION. New version appearing alongside 1.2.4 (two `sharp` versions installed). Same analysis as above — both covered by Exception 1 in `docs/project/license-exceptions.md`. No action needed.
- `dompurify@3.4.10` — (MPL-2.0 OR Apache-2.0). COMPLIANT, no exception needed. Dual-licensed; Paisaxe takes the Apache-2.0 option (permissive). Transitive via `posthog-js`. Version bumped from 3.4.0 to 3.4.10 by `npm audit fix` on Jun 16.
- `expand-template@2.0.3` — (MIT OR WTFPL). COMPLIANT. Dual-licensed; MIT option is permissive. Build-tooling transitive.
- `paisaxe@1.5.1` — UNLICENSED. Our own private package (intentionally proprietary/unpublished). Not a third-party concern.

**False positives in the scan output (permissive licenses caught by scanner's parent-grouping):**

- `@babel/template@7.29.7` — MIT. No concern.
- `simple-concat@1.0.1` — MIT. No concern.
- `simple-get@4.0.1` — MIT. No concern.

Note: `@vercel/analytics` (formerly MPL-2.0) remains a resolved exception — it now ships under MIT and no longer appears in weak-copyleft warnings. Documented in `docs/project/license-exceptions.md` (Resolved Exception 2).

CI enforcement: `license-check.yml` blocks GPL/AGPL/SSPL on every PR. Weak copyleft (LGPL/MPL) warns but does not block, consistent with the documented exception policy.

## 7. Security Headers Status

All required headers present and correctly configured (verified from live header capture):

| Header | Value | Status |
|--------|-------|--------|
| content-security-policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Correct |
| strict-transport-security | `max-age=63072000; includeSubDomains; preload` | Correct (2-year, preload) |
| x-frame-options | `DENY` | Correct |
| x-content-type-options | `nosniff` | Correct |
| referrer-policy | `strict-origin-when-cross-origin` | Correct |
| permissions-policy | `camera=(), geolocation=(), microphone=(self)` | Correct |

CSP notes:
- No `'strict-dynamic'` and no nonce-only policy — correct for PPR (`cacheComponents`) compatibility per CLAUDE.md. Prerendered HTML has no nonces; `'self' 'unsafe-inline'` is the deliberate, correct choice.
- `object-src 'none'`, `frame-ancestors 'none'`, and `base-uri 'self'` are locked down.
- `microphone=(self)` is intentional (ElevenLabs Pelayo voice agent needs mic access on first-party origin); camera and geolocation fully disabled.
- `wss://api.us.elevenlabs.io` correctly added to `connect-src` alongside `wss://api.elevenlabs.io` for ElevenLabs US endpoint support.
- E2E "CSP canary" (`e2e/smoke.spec.ts`) guards against CSP regressions that would block JS execution.

Note: Two duplicate header entries appear in the scan output for permissions-policy, referrer-policy, HSTS, and x-content-type-options. This is an artifact of the header-fetch format (two responses captured), not actual duplicate header injection. The live CSP is correct.

## 8. CI/CD Security Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Configured, pinned to `develop`. Recent dep batch PRs (#595–#597) auto-merged and verified. |
| Renovate | Not used | Intentional — Dependabot covers the same role. Not a gap. |
| Gitleaks | Active | Secret scanning in CI; scans git history. Confirmed active. |
| npm audit | Active | Runs in CI pipeline. Now returns 0 findings. |
| License check | Active | `license-check.yml` blocks strong copyleft (GPL/AGPL/SSPL) on every PR. |

No CI/CD security gaps. The long-standing "Gitleaks CI gap" from older QA cross-notes was closed and remains closed.

## 9. Outdated Packages with Security Implications

`npm audit` returns 0 findings. All 18 packages flagged as outdated by `npm outdated` (approximate, per scan metric) have no open CVEs.

Security-relevant context on specific packages:

- `voyageai@0.1.0` — intentionally pinned. Its transitive `form-data` advisory was patched independently via `npm audit fix` on Jun 16. No CVE in voyageai itself. Do NOT bump voyageai.
- `@sentry/nextjs` — current. The OTel moderate advisories that were present in its transitive tree are now cleared by the `@opentelemetry/core 2.8.0` bump from `npm audit fix`. Watch for a future Sentry release that re-introduces older OTel transitives.
- `posthog-js@^1.384.0` — current. The `dompurify@3.4.10` it pulls is now a patched version (bumped from 3.4.0 by `npm audit fix`). PostHog's internal DOMPurify usage remains non-exploitable at the application layer.
- Dev-tooling majors (typescript v6, knip v6, @vitejs/plugin-react v6) — no CVEs, low urgency. Out of scope for security.

No production package is on an outdated version with an exploitable CVE.

## 10. Cross-Cycle Notes

- GREEN restored after 1-run YELLOW (Jun 16). The Jun 16 triage executed `npm audit fix` which resolved all 9 advisories cleanly. No manual intervention required, no major version bumps.
- Two versions of `@img/sharp-libvips-darwin-arm64` (1.2.4 and 1.3.0) now appear in the license scan, indicating two `sharp` versions are installed. Both are covered by Exception 1 in `docs/project/license-exceptions.md`. No new exception documentation required.
- `esbuild` and `protobufjs` audit pins relocated to `overrides` (Jun 16 triage). Production dep count: 34/40. `npm audit --omit=dev` confirmed clean.
- QA safety guardrails (injection/PII/boundary tests) remain unverified for 4 consecutive cycles due to issue #635. This is a harness port-mismatch fix, not a security regression. CSRF and auth controls are confirmed working via browser journey tests (10/10 green). No security action needed from this agent; fix belongs in QA/Triage.
- Coverage Agent (Jun 16): `basic-markdown.tsx` XSS-relevant link-safety branches are at 100% test coverage. The in-house renderer has no DOMPurify dependency and strips unsafe links at render time. This is the correct defense-in-depth posture for the markdown rendering surface.

---
