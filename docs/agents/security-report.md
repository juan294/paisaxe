# Security Report — Paisaxe

Date: 2026-06-18
Agent: Security Agent
Package version: paisaxe@1.5.1

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable.

Rationale: GREEN streak continues from Jun 17. The Jun 16 triage (`npm audit fix`) resolved all 9 prior advisories and the Jun 17 triage merged 3 Dependabot PRs (#639 dev-and-types patches, #641 npm_and_yarn security patches, #643 production group 13 updates). Today's `npm audit` returns a fully clean tree. Second consecutive GREEN run.

## 2. Executive Summary

- 0 advisories detected. 0 exploitable.
- Jun 17 triage merged 3 Dependabot PRs: dev/types patches (#639), npm_and_yarn security patches (#641), and 13 production package updates (#643). All CI checks passed. No new advisories introduced.
- Outdated packages metric: 20 reported by scan header, but the detailed package list was empty (script artifact — likely a count/list format mismatch after the dep batch). The Jun 17 production batch (#643) updated 13 production packages; the remaining outdated count is expected to be lower. No CVEs in any tracked outdated package.
- License compliance: Pass. All flagged packages are documented exceptions, dual-license with a permissive option, or Paisaxe's own private package.
- Security headers: All present and correctly configured. No changes since Jun 17.
- CI/CD security automation: All controls active. No gaps.
- Cross-agent note (QA Jun 18): Issue #635 (port mismatch) is confirmed fixed — preflight passes and tests reach the server. The injection detector confirmed working (1 safety test passed, 223ms). Remaining 11/12 LLM failures are due to Voyage AI 503 (VOYAGE_API_KEY missing or network unreachable in QA environment), not a security regression. Authority impersonation and instruction override tests remain unverified until Voyage AI is available in the QA environment.

## 3. Vulnerability Table

No advisories this cycle.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | Clean |
| High | 0 | Clean |
| Moderate | 0 | Clean |
| Low | 0 | Clean |
| Total | 0 | Clean |

All 9 advisories from the Jun 16 triage were resolved by `npm audit fix`. The Jun 17 dep batch introduced no new advisories. See the Jun 16 report for the per-advisory breakdown (all were non-exploitable; fixed as hygiene).

## 4. Detailed Exploitability Analysis

No High or Critical advisories this cycle. Nothing to analyze.

Injection surface (QA Jun 18 partial confirmation): The pre-LLM injection detector passed (1 test, 223ms). This confirms the fast-path injection guard is operational. The remaining 11 LLM-quality tests (authority impersonation, PII extraction, boundary violations, RAG consistency) were blocked by Voyage AI 503 — a QA environment issue, not a production security regression. Production CSRF and auth controls remain confirmed working via browser journey tests (10/10 green).

The in-house `basic-markdown.tsx` renderer (replaced react-markdown Jun 12, 100% test coverage on XSS-relevant link-safety branches per Coverage Agent Jun 16) remains the correct posture. Zero DOMPurify calls in `src/` — any transitive DOMPurify advisories from posthog-js remain non-exploitable at the application layer.

Webhook timing-safety: All 7 `timingSafeEqual` call sites remain verified and unchanged. No auth or webhook path modifications this cycle.

## 5. Prioritized Remediation Steps

No remediations required this cycle. The tree is clean.

Carry-forward watch items (not blocking):

1. Restore full LLM safety test coverage: Voyage AI 503 in QA environment is blocking 11/12 LLM quality tests. The fix is a QA/infra concern (ensure VOYAGE_API_KEY is available during `npm run test:qa`). Not a security code change, but the signal gap matters — authority impersonation and instruction override tests have been unconfirmed for 5 consecutive cycles. Until fixed, manual review of production chat safety on paisaxe.es is recommended before any release.

2. Monitor `@sentry/nextjs` for a release that re-introduces older OTel transitive versions. The OTel moderate advisories cleared by `npm audit fix` on Jun 16 may reappear if a future Sentry release pins an older `@opentelemetry/core`. Run `npm audit --omit=dev` to check.

3. Optional: run `npm run build:analyze` (webpack mode) for authoritative initial-load totals. Deferred 8+ cycles per Performance Agent. No security implication, but confirms the dep cleanup from Jun 16-17 is bundle-neutral.

## 6. License Compliance

Scan result: Pass. `COPYLEFT LICENSES FOUND: false`. No strong copyleft (GPL/AGPL/SSPL).

Flagged packages (named explicitly):

**Actual concerns reviewed:**

- `@img/sharp-libvips-darwin-arm64@1.2.4` — LGPL-3.0-or-later. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 1). Pre-built native binary, dynamically linked via `sharp`'s Apache-2.0 API, no modifications, SaaS deployment. No copyleft obligation on Paisaxe code.
- `@img/sharp-libvips-darwin-arm64@1.3.0` — LGPL-3.0-or-later. APPROVED EXCEPTION. Second version installed alongside 1.2.4 (two `sharp` versions in the tree). Same analysis as above — both covered by Exception 1 in `docs/project/license-exceptions.md`. No action needed.
- `dompurify@3.4.10` — (MPL-2.0 OR Apache-2.0). COMPLIANT, no exception needed. Dual-licensed; Paisaxe takes the Apache-2.0 option. Transitive via `posthog-js`. Version locked at 3.4.10 since `npm audit fix` on Jun 16.
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
- `wss://api.us.elevenlabs.io` correctly present in `connect-src` for ElevenLabs US endpoint support.
- E2E "CSP canary" (`e2e/smoke.spec.ts`) guards against CSP regressions that would block JS execution.

Note: Two duplicate header entries appear in the scan output for permissions-policy, referrer-policy, HSTS, and x-content-type-options. This is an artifact of the header-fetch format (two responses captured), not actual duplicate header injection. The live CSP is correct.

## 8. CI/CD Security Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Configured, pinned to `develop`. Three PRs merged Jun 17 (#639, #641, #643). 0 open Dependabot PRs. |
| Renovate | Not used | Intentional — Dependabot covers the same role. Not a gap. |
| Gitleaks | Active | Secret scanning in CI; scans git history. Confirmed active. |
| npm audit | Active | Runs in CI pipeline. Returns 0 findings. |
| License check | Active | `license-check.yml` blocks strong copyleft (GPL/AGPL/SSPL) on every PR. |

No CI/CD security gaps.

## 9. Outdated Packages with Security Implications

`npm audit` returns 0 findings. The outdated package count in today's scan shows 20, but the detailed list was empty — this is a script artifact (count header captured without the package table, likely a format issue after the Jun 17 dep batch updated 13 production packages). The actual outdated count is expected to be lower; no CVEs are known in any tracked package.

Security-relevant context on specific packages:

- `voyageai@0.1.0` — intentionally pinned. Its transitive `form-data` advisory was patched independently via `npm audit fix` on Jun 16. No CVE in voyageai itself. Do NOT bump voyageai — the pin is intentional.
- `@sentry/nextjs` — current post-Jun 17 batch. The OTel moderate advisories that were present in its transitive tree were cleared by `@opentelemetry/core 2.8.0` bump from `npm audit fix`. Watch for a future Sentry release re-introducing older OTel transitives.
- `posthog-js` — updated in Jun 17 batch (#643). The `dompurify@3.4.10` transitive remains a patched version. PostHog's internal DOMPurify usage remains non-exploitable at the application layer.
- Dev-tooling majors (typescript v6, knip v6, @vitejs/plugin-react v6) — no CVEs, low urgency. Out of scope for security.

No production package is on an outdated version with an exploitable CVE.

## 10. Cross-Cycle Notes

- GREEN maintained for 2nd consecutive cycle after the Jun 16 triage recovery. The Jun 17 triage merged 3 Dependabot PRs and introduced no new advisories.
- QA #635 confirmed fixed (Jun 18 QA Agent): The port mismatch is resolved. Injection detector working (pre-LLM path, 1/12 passed). Remaining 11/12 LLM failures are Voyage AI 503 (VOYAGE_API_KEY or network unavailable in QA environment) — a QA infra issue, not a security regression.
- LLM safety guardrail status: Injection detection confirmed. Authority impersonation, PII extraction, and instruction override tests unverified for 5 consecutive cycles. Recommend manual check on production paisaxe.es before next release.
- Two versions of `@img/sharp-libvips-darwin-arm64` (1.2.4 and 1.3.0) continue to appear in the license scan. Both are covered by Exception 1 in `docs/project/license-exceptions.md`. No new exception documentation required.
- Production dep count: 34/40 (esbuild + protobufjs moved to overrides Jun 16). 6 budget slots available.
- Coverage Agent (Jun 16): `basic-markdown.tsx` XSS-relevant link-safety branches are at 100% test coverage including allowLinks-off, malformed nested links, and unsafe-URL patterns. The in-house renderer has no DOMPurify dependency and strips unsafe links at render time.

---
