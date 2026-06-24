# Security Report — Paisaxe

Date: 2026-06-23
Agent: Security Agent
Package version: paisaxe@1.6.0

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable.

Rationale: Seventh consecutive GREEN run. npm audit returns a fully clean tree. All security controls operational. LLM safety guardrails verified for 2nd consecutive cycle — 12/12 QA safety tests pass including authority impersonation, role-play override, and injection resistance.

## 2. Executive Summary

- 0 advisories detected. 0 exploitable.
- Seventh consecutive GREEN after the Jun 16 triage recovery.
- **QA LLM safety: STABLE.** Jun 23 QA Agent confirms 12/12 LLM tests passing (100%) for the second consecutive cycle post-fix. All safety guardrails verified: injection resistance, role-play override, authority impersonation, PII extraction, boundary violations, RAG consistency. The `VOYAGE_API_KEY` fix (triage commit `937bbdea`, merge `97d82db2`) is stable in the launchd/cron context.
- **Journey test regression (harness, not product):** Jun 23 QA shows 8/10 journeys passing. Failures in Journey 2 (ArrowRight nav) and Journey 5 (i-key overlay) are caused by `page.evaluate(() => window.focus())` being unreliable in headless Playwright. Click-based Journey 1 passes with the same navigation logic — confirmed harness flakiness, not a production regression. No code change between Jun 22 (10/10) and Jun 23 (8/10).
- Outdated packages: 14 (up from 12 yesterday — scanner variation, no CVEs). No production package has an exploitable CVE.
- License compliance: Pass. All flagged packages are approved exceptions, dual-licensed with a permissive option, or Paisaxe's own private package.
- Security headers: All present and correctly configured. Unchanged since Jun 17.
- CI/CD security automation: All controls active. Dependabot PR #647 (undici) remains obsolete — close/supersede, do not merge.
- Remaining manual item: Full production Day Pass purchase and Pelayo voice widget verification on paisaxe.es. 130-day revenue drought / 126-day voice silence remain unexplained by automated means.

## 3. Vulnerability Table

No advisories this cycle.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | Clean |
| High | 0 | Clean |
| Moderate | 0 | Clean |
| Low | 0 | Clean |
| Total | 0 | Clean |

All prior advisories were resolved by `npm audit fix` Jun 16 and Dependabot merges Jun 17. See Jun 16 report for per-advisory breakdown (all were non-exploitable; fixed as hygiene).

## 4. Detailed Exploitability Analysis

No High or Critical advisories this cycle. Nothing to analyze.

**LLM safety guardrails (STABLE — 2nd consecutive clean cycle):**
QA Jun 23 confirms 12/12 LLM tests passing for the second consecutive cycle since the VOYAGE_API_KEY fix. All safety guardrails verified:
- Injection resistance: Pass
- Role-play override: Pass
- Authority impersonation: Pass
- PII extraction resistance: Pass
- Instruction boundary violations: Pass
- RAG hallucination resistance, cross-PDF synthesis, no external fabrication: All Pass

QA Jun 23 also reports 4/4 integration health: Voyage AI, Supabase, Stripe, App all pass.

**Journey keyboard failures (harness-level, not security concern):**
Journey 2 (ArrowRight navigation) and Journey 5 (i-key overlay toggle) fail in the Jun 23 QA run due to `page.evaluate(() => window.focus())` being unreliable in headless Playwright. Click-based Journey 1 passes with the same `goToNext()` logic. No code changes between Jun 22 (10/10) and Jun 23 (8/10). The dialog timeout fix (`6a75b659`) is unrelated to keyboard handling. QA agent recommends replacing `window.focus()` with `page.getByTestId("story-viewer").first().click()` before keypress events in `e2e/qa-journey.spec.ts` lines 101 and 196/203.

**Injection surface:**
Pre-LLM injection detection confirmed working end-to-end. All 12 safety tests pass for 2nd consecutive cycle. No manual production safety check required before the next release from a QA standpoint.

**Admin image route (SSRF/DoS guard):**
Both oversize-image rejection paths in `stories/[id]/image/route.ts` (lines 157-160) have regression tests as of Coverage Agent Jun 20: (1) no-body path and (2) streaming ReadableStream > 10 MB triggers 400 + `reader.cancel()`. IPv4 and IPv6 SSRF checks remain fully covered (confirmed Coverage May 5). DoS download-size guard hardened.

**In-house markdown renderer:**
`basic-markdown.tsx` (replaced `react-markdown` Jun 12) has 100% XSS-relevant branch coverage confirmed Jun 16: allowLinks-off, malformed/nested links, unsafe-URL patterns (javascript:, data:). No DOMPurify calls in `src/`. Transitive DOMPurify from `posthog-js` remains non-exploitable at the application layer.

**Webhook timing-safety:**
All 7 `timingSafeEqual` call sites remain verified and unchanged. No auth or webhook path modifications this cycle.

**CSRF:**
CSRF enforcement confirmed working via browser journey tests. `sendChatMessage()` includes CSRF tokens as of the Mar 23 fix. Journey 1 (click-based navigation) passes cleanly; keyboard-driven journey failures are harness-level, not CSRF-related. No regressions.

**make-booking idempotency:**
Coverage Agent Jun 16 confirmed the idempotency-lookup failure path falls through to the 409 "already being processed" response. Duplicate-suppression chain verified end to end.

**LiveKit chunk:**
Jun 20 triage confirmed the 412 KB `144d3bae` webpack chunk is LiveKit (ElevenLabs WebRTC transitive dep). Deferred/async via webpack runtime — zero first-paint cost. Loads only on voice widget interaction (click-to-mount since May 10). Not a direct attack surface in the Paisaxe application. No security concern.

**Anthropic model call sites:**
Jun 22 triage removed obsolete `claude-sonnet-4-20250514` references and centralized all runtime callers on `claude-sonnet-4-6`. Reduces risk of stale model IDs generating unexpected behaviors. Full test suite 6,956/6,956 passing post-change.

**Dependabot PR #647 (undici):**
Identified as obsolete by Jun 21 triage. `undici@7.28.0` is already present on `develop` with `npm audit --omit=dev` clean. The PR targets `main` directly and would bypass the branch protection workflow. No security gap — the vulnerable version is already gone from the tree. The PR should be closed/superseded.

## 5. Prioritized Remediation Steps

No vulnerability remediations required this cycle.

**Action items (prioritized):**

1. **[Medium — housekeeping]** Close or supersede Dependabot PR #647 (undici). Do not merge it directly to `main`. Undici is already updated on `develop`; the PR is obsolete and targets the wrong branch.

2. **[Medium — harness fix]** Harden keyboard journey tests in `e2e/qa-journey.spec.ts`. Replace `page.evaluate(() => window.focus())` with `page.getByTestId("story-viewer").first().click()` before keypress events at lines 101 and 196/203. This eliminates the harness-level flakiness causing Journey 2 and Journey 5 failures without weakening production coverage.

3. **[Medium — manual only]** Verify Pelayo voice widget and Day Pass purchase flow on paisaxe.es. Automated tests confirm the application layer is healthy (12/12 LLM tests, 8/10 journeys — keyboard failures are harness-level), but automated coverage cannot exercise a live payment or voice session. 130-day revenue drought / 126-day voice silence remain unexplained. This is a product/operations verification, not a security vulnerability.

4. **[Low — carry-forward watch item]** Monitor `@sentry/nextjs` for a future release that re-introduces older OTel transitive versions. The OTel moderate advisories cleared by `npm audit fix` Jun 16 may reappear if a future Sentry release pins an older `@opentelemetry/core`. Run `npm audit --omit=dev` after each Sentry bump.

5. **[Low — carry-forward]** Dev-tooling majors — typescript v6, knip v6, `@vitejs/plugin-react` v6 — remain outdated. No CVEs. Low urgency; schedule as a dedicated upgrade batch when ready.

6. **[Low — carry-forward]** Add `simple-concat` and `simple-get` to the license scanner allowlist to eliminate recurring false positives (both are MIT; scanner flags them due to parent-grouping heuristics).

## 6. License Compliance

Scan result: Pass. `COPYLEFT LICENSES FOUND (production deps): false`. `COPYLEFT LICENSES FOUND (dev/build deps, non-blocking): false`. No strong copyleft (GPL/AGPL/SSPL).

Flagged packages (named explicitly):

**Production tree — reviewed:**

- `@img/sharp-libvips-darwin-arm64@1.2.4` — LGPL-3.0-or-later. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 1). Pre-built native binary, dynamically linked via `sharp`'s Apache-2.0 API, no modifications, SaaS deployment. No copyleft obligation on Paisaxe code.
- `@img/sharp-libvips-darwin-arm64@1.3.0` — LGPL-3.0-or-later. APPROVED EXCEPTION. Second version alongside 1.2.4 (two `sharp` versions in the tree). Same analysis as above — both covered by Exception 1. No action needed.
- `dompurify@3.4.11` — (MPL-2.0 OR Apache-2.0). COMPLIANT, no exception needed. Dual-licensed; Paisaxe takes the Apache-2.0 option. Transitive via `posthog-js`. No application code calls DOMPurify directly (confirmed by grep: 0 matches in `src/`).
- `expand-template@2.0.3` — (MIT OR WTFPL). COMPLIANT. Dual-licensed; MIT option is permissive. Build-tooling transitive.
- `paisaxe@1.6.0` — UNLICENSED. Our own private package (intentionally proprietary/unpublished). Not a third-party concern.

**False positives in the scan output (permissive licenses caught by scanner's parent-grouping):**

- `@babel/template@7.29.7` — MIT. No concern.
- `simple-concat@1.0.1` — MIT. No concern.
- `simple-get@4.0.1` — MIT. No concern.

**Dev + build tree additional flags (non-blocking):**

- `lightningcss@1.32.0` — MPL-2.0. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 3). Build-time only (Tailwind CSS v4 + Vite); not distributed to users. No copyleft obligation.
- `lightningcss-darwin-arm64@1.32.0` — MPL-2.0. Same exception as above.

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
| Dependabot | Active | Pinned to `develop`. Three PRs merged Jun 17 (#639, #641, #643). PR #647 (undici) is obsolete — close/supersede, do not merge. |
| Renovate | Not used | Intentional — Dependabot covers the same role. Not a gap. |
| Gitleaks | Active | Secret scanning in CI; scans git history. Confirmed active. |
| npm audit | Active | Runs in CI pipeline. Returns 0 findings. |
| License check | Active | `license-check.yml` blocks strong copyleft (GPL/AGPL/SSPL) on every PR. |

No CI/CD security gaps. One housekeeping action: close Dependabot PR #647 (undici) — the underlying dep is already updated on `develop`.

## 9. Outdated Packages with Security Implications

`npm audit` returns 0 findings. The scan reports 14 outdated packages (up from 12 on Jun 22 — scanner variation, no new CVEs introduced). No production package has an exploitable CVE.

Security-relevant context on specific packages:

- `voyageai@0.1.0` — intentionally pinned. Its transitive `form-data` advisory was patched independently via `npm audit fix` on Jun 16. No CVE in voyageai itself. Do NOT bump voyageai — the pin is intentional per Performance Agent.
- `@sentry/nextjs` — current post-Jun 17 batch. The OTel moderate advisories that were present in its transitive tree were cleared by `@opentelemetry/core 2.8.0` bump from `npm audit fix`. Watch for a future Sentry release re-introducing older OTel transitives.
- `posthog-js` — updated in Jun 17 batch (#643). `dompurify@3.4.11` transitive is the current patched version. PostHog's internal DOMPurify usage remains non-exploitable at the application layer.
- Dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) — no CVEs, low urgency. Out of scope for security remediation.

No production package is on an outdated version with an exploitable CVE.

## 10. Cross-Cycle Notes

- GREEN for 7th consecutive cycle. All security controls stable.
- **LLM safety guardrails STABLE:** QA Jun 23 confirms 12/12 tests passing for 2nd consecutive cycle since the VOYAGE_API_KEY fix (`937bbdea`, `97d82db2`). The fix is durable in launchd/cron context.
- **Journey keyboard harness flakiness:** 8/10 journeys Jun 23 (vs 10/10 Jun 22). Failures in Journey 2 and Journey 5 are `window.focus()` unreliability in headless Playwright — harness issue, not production regression. Recommended fix: replace with `page.getByTestId("story-viewer").first().click()` in `e2e/qa-journey.spec.ts` lines 101 and 196/203.
- **Outdated package count:** 14 (scanner variation vs 12 Jun 22). No new CVEs. No security action required.
- Package version remains 1.6.0. The `paisaxe@1.6.0` UNLICENSED flag in the scan output reflects our own private package — not a third-party concern.
- Dependabot PR #647 (undici) remains obsolete. It targets `main` directly and is superseded by the dep already updated on `develop`. Close/supersede without merging.
- Two versions of `@img/sharp-libvips-darwin-arm64` (1.2.4 and 1.3.0) continue to appear in the license scan. Both are covered by Exception 1 in `docs/project/license-exceptions.md`. No new exception documentation required.
- `basic-markdown.tsx` (in-house renderer replacing react-markdown): 100% XSS-relevant branch coverage confirmed Jun 16. No DOMPurify dependency. Safe posture maintained.
- Coverage Agent Jun 20 added streaming body oversize-limit test for the admin image route: both rejection paths (no-body and ReadableStream > 10 MB) are now covered. SSRF/DoS download-size guard hardened.
- Production smoke checks (Jun 22 triage): `/api/health` 200, `/api/checkout/health` 401 expected, `/immersive` chat + voice upgrade entry point visible, `/pricing` €1.99 visible, `/pricing/checkout` sign-in gate visible.

---
