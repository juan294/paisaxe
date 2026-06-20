# Security Report — Paisaxe

Date: 2026-06-19
Agent: Security Agent
Package version: paisaxe@1.5.1

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable.

Rationale: Third consecutive GREEN run. npm audit returns a fully clean tree for the third day running. The Jun 16 `npm audit fix` resolved all 9 prior advisories; the Jun 17 Dependabot merges (#639, #641, #643) introduced no new advisories; the Jun 19 triage built the project with `build:analyze` confirming the dep tree is intact. No new vulnerabilities detected.

## 2. Executive Summary

- 0 advisories detected. 0 exploitable.
- Third consecutive GREEN after the Jun 16 triage recovery. All controls stable.
- Outdated packages: 9 (down from 20 in the Jun 18 report). Detailed package list was empty in scan output — consistent with the post-Jun-17 dep batch pattern. Remaining outdated items are expected to be dev-tooling majors (typescript v6, knip v6, @vitejs/plugin-react v6) with no CVEs.
- dompurify updated to 3.4.11 (was 3.4.10 in Jun 18 report) by the Jun 17 dep batch. The transitive MPL-2.0 OR Apache-2.0 dual-license posture is unchanged; Apache-2.0 option taken.
- Jun 19 triage completed two outstanding engineering actions: (1) Voyage AI QA environment fix — preflight probe, env export to `npm run test:qa`, trimmed key read from shell or `.env.local`; (2) `npm run build:analyze` finally executed after 9+ cycle deferral — analyzer reports now available under `.next/analyze/`.
- License compliance: Pass. All flagged packages are approved exceptions, dual-license with a permissive option, or Paisaxe's own private package.
- Security headers: All present and correctly configured. No changes since Jun 17.
- CI/CD security automation: All controls active. 0 open Dependabot PRs.
- QA LLM safety status: Voyage AI 503 was the Jun 18 blocker (VOYAGE_API_KEY missing or unreachable). Jun 19 triage added preflight and env export — next QA cycle should clarify whether Voyage is reachable. Authority impersonation and instruction override tests remain unverified for 5 consecutive cycles; manual production safety check recommended before next release.

## 3. Vulnerability Table

No advisories this cycle.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | Clean |
| High | 0 | Clean |
| Moderate | 0 | Clean |
| Low | 0 | Clean |
| Total | 0 | Clean |

All 9 advisories from Jun 16 triage were resolved by `npm audit fix`. Three Dependabot batches merged Jun 17 introduced no new advisories. See Jun 16 report for per-advisory breakdown (all were non-exploitable; fixed as hygiene).

## 4. Detailed Exploitability Analysis

No High or Critical advisories this cycle. Nothing to analyze.

**Injection surface (QA Jun 18 partial confirmation):**
The pre-LLM injection detector confirmed working (1 test passed, 223ms). This covers the fast-path guard. The remaining 11 LLM-quality tests (authority impersonation, PII extraction, boundary violations, RAG consistency) were blocked by Voyage AI 503 — a QA environment issue, not a production security regression. Jun 19 triage added a Voyage reachability probe to the QA preflight so the next cycle will distinguish a key/network failure from an application regression before running the suite.

**In-house markdown renderer:**
`basic-markdown.tsx` replaced `react-markdown` on Jun 12. Coverage Agent Jun 16 confirmed 100% branch coverage on XSS-relevant paths: allowLinks-off, malformed/nested links, unsafe-URL patterns (javascript:, data:). No DOMPurify calls in `src/` — transitive DOMPurify advisories from `posthog-js` remain non-exploitable at the application layer.

**Webhook timing-safety:**
All 7 `timingSafeEqual` call sites remain verified and unchanged. No auth or webhook path modifications this cycle.

**CSRF:**
CSRF enforcement confirmed working via browser journey tests (10/10 green). `sendChatMessage()` includes CSRF tokens as of the Mar 23 fix. No regressions.

**make-booking idempotency:**
Coverage Agent Jun 16 confirmed the idempotency-lookup failure path now falls through to the 409 "already being processed" response — duplicate-suppression path verified end to end.

## 5. Prioritized Remediation Steps

No remediations required this cycle. The tree is clean.

**Carry-forward watch items (not blocking):**

1. Verify Voyage AI QA fix works next cycle: Jun 19 triage added the preflight probe and env export. If next QA run still reports 503, investigate whether VOYAGE_API_KEY is correctly set in the QA environment or whether Voyage AI is rate-limiting the test endpoint. LLM safety tests are the only remaining gap.

2. Monitor `@sentry/nextjs` for a release that re-introduces older OTel transitive versions. The OTel moderate advisories cleared by `npm audit fix` Jun 16 may reappear if a future Sentry release pins an older `@opentelemetry/core`. Run `npm audit --omit=dev` after each Sentry bump.

3. Dev-tooling majors — typescript v6, knip v6, `@vitejs/plugin-react` v6 — remain outdated. No CVEs. Low urgency; schedule as a dedicated upgrade batch when ready.

## 6. License Compliance

Scan result: Pass. `COPYLEFT LICENSES FOUND: false`. No strong copyleft (GPL/AGPL/SSPL).

Flagged packages (named explicitly):

**Actual concerns reviewed:**

- `@img/sharp-libvips-darwin-arm64@1.2.4` — LGPL-3.0-or-later. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 1). Pre-built native binary, dynamically linked via `sharp`'s Apache-2.0 API, no modifications, SaaS deployment. No copyleft obligation on Paisaxe code.
- `@img/sharp-libvips-darwin-arm64@1.3.0` — LGPL-3.0-or-later. APPROVED EXCEPTION. Second version alongside 1.2.4 (two `sharp` versions in the tree). Same analysis as above — both covered by Exception 1. No action needed.
- `dompurify@3.4.11` — (MPL-2.0 OR Apache-2.0). COMPLIANT, no exception needed. Dual-licensed; Paisaxe takes the Apache-2.0 option. Transitive via `posthog-js`. Bumped from 3.4.10 to 3.4.11 by the Jun 17 dep batch (#643).
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

Note: Two duplicate header entries appear in the scan output for several headers. This is an artifact of the header-fetch format (two responses captured), not actual duplicate header injection. The live CSP is correct.

## 8. CI/CD Security Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Pinned to `develop`. Three PRs merged Jun 17 (#639, #641, #643). 0 open Dependabot PRs. |
| Renovate | Not used | Intentional — Dependabot covers the same role. Not a gap. |
| Gitleaks | Active | Secret scanning in CI; scans git history. Confirmed active. |
| npm audit | Active | Runs in CI pipeline. Returns 0 findings. |
| License check | Active | `license-check.yml` blocks strong copyleft (GPL/AGPL/SSPL) on every PR. |

No CI/CD security gaps.

## 9. Outdated Packages with Security Implications

`npm audit` returns 0 findings. The scan reports 9 outdated packages; the detailed package list was empty in the scan output (consistent with the Jun 18 report pattern — a count/list format mismatch after the dep batch). Based on shared context, the remaining outdated items are expected to be dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) with no CVEs, and possibly a handful of minor-version production deps not yet in a Dependabot PR.

Security-relevant context on specific packages:

- `voyageai@0.1.0` — intentionally pinned. Its transitive `form-data` advisory was patched independently via `npm audit fix` on Jun 16. No CVE in voyageai itself. Do NOT bump voyageai — the pin is intentional.
- `@sentry/nextjs` — current post-Jun 17 batch. The OTel moderate advisories that were present in its transitive tree were cleared by `@opentelemetry/core 2.8.0` bump from `npm audit fix`. Watch for a future Sentry release re-introducing older OTel transitives.
- `posthog-js` — updated in Jun 17 batch (#643). `dompurify@3.4.11` transitive is the current patched version. PostHog's internal DOMPurify usage remains non-exploitable at the application layer.
- Dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) — no CVEs, low urgency. Out of scope for security remediation.

No production package is on an outdated version with an exploitable CVE.

## 10. Cross-Cycle Notes

- GREEN for 3rd consecutive cycle. The dependency tree is in the healthiest state it has been all quarter — 0 advisories, 0 open Dependabot PRs, 34/40 production deps current.
- Jun 19 triage cleared two long-running deferrals: Voyage AI QA env fix (added preflight, env export, key trimming) and `npm run build:analyze` (9+ cycles overdue, now executed; reports under `.next/analyze/`).
- dompurify bumped to 3.4.11 by Jun 17 dep batch — the prior Jun 18 report cited 3.4.10. Updated in this report.
- LLM safety guardrail status: Injection detection confirmed (Jun 18 QA partial run). Authority impersonation, PII extraction, and instruction override tests unverified for 5 consecutive cycles (Voyage AI 503 in QA environment). Jun 19 triage applied the QA fix — next cycle should report Voyage status before running the LLM suite. Manual safety review on production paisaxe.es remains recommended before any release.
- Two versions of `@img/sharp-libvips-darwin-arm64` (1.2.4 and 1.3.0) continue to appear in the license scan. Both are covered by Exception 1 in `docs/project/license-exceptions.md`. No new exception documentation required.
- `basic-markdown.tsx` (in-house renderer replacing react-markdown): 100% XSS-relevant branch coverage confirmed Jun 16. No DOMPurify dependency. Safe posture maintained.

---
