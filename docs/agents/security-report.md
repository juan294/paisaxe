# Security Report — Paisaxe

Date: 2026-06-30
Agent: Security Agent
Package version: paisaxe@1.6.0

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable.

Rationale: Fourteenth consecutive GREEN run. npm audit returns a fully clean tree. All security controls operational. QA Jun 30 reports YELLOW (12/12 LLM recovered, 6/10 journeys) — LLM safety guardrails confirmed GREEN for the 5th consecutive cycle; journey failures are timing/race conditions in the test harness, not application security regressions. Security headers live-verified via metrics output. All known controls stable.

## 2. Executive Summary

- 0 advisories detected. 0 exploitable. Fourteenth consecutive GREEN.
- **LLM safety guardrails: CONFIRMED WORKING (QA Jun 30, 5th consecutive GREEN cycle, 12/12).** After the Jun 29 false positive (authority impersonation regex `/config/i` matching "configurations" in a safe refusal), LLM tests fully recovered to 12/12. Model correctly refuses impersonation, injection, PII extraction, and all 6 safety categories.
- **Journey regressions this cycle (QA Jun 30, 6/10):** Journeys J1, J2, J3, J6 all fail in the Anonymous User story navigation block due to element-not-visible races on story-title h1 and next-story-button non-response. Three harness fixes remain unapplied for 3+ consecutive cycles. These are test reliability defects, not security issues.
- **Coverage hardening (Coverage Jun 30):** Closed `String(err)` false branches across the entire codebase — all 8 `src/lib/admin-api/*.ts` catch blocks, `auth-provider.tsx` two error-init paths, `use-favorites.ts`, `use-feature-flags.ts`, `supabase-auth.ts`, and `story-viewer.tsx`. Branch coverage reached 95.15% (+0.50pp). No new security-relevant gaps found.
- **Security headers: LIVE-VERIFIED this cycle.** All 6 required headers confirmed in metrics output: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Configuration unchanged.
- **Outdated packages: 20** (up from 18 on Jun 29, detail enumeration unavailable this cycle). No production package has an exploitable CVE.
- License compliance: Pass. No copyleft violations. All flagged packages are approved exceptions, dual-licensed with a permissive option, or the project's own private package.
- CI/CD security automation: All active. GitHub code scanning and secret scanning remain disabled — owner action required.

## 3. Vulnerability Table

No active advisories this cycle.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | Clean |
| High | 0 | Clean |
| Moderate | 0 | Clean |
| Low | 0 | Clean |
| Total | 0 | Clean |

**Remaining GitHub alert (informational):**

| Severity | Package | Advisory | Description | Status |
|----------|---------|----------|-------------|--------|
| LOW | @babel/core | GHSA-4x5r-pxfx-6jf8 | Arbitrary file read in build pipeline | Dev-only; open until babel ships patch |

## 4. Detailed Exploitability Analysis

No new advisories this cycle. The sections below document standing security controls and carry-forward analysis.

**LLM safety guardrails (RECOVERED — all 6 categories GREEN, 5th consecutive cycle):**

QA Jun 30 confirms 12/12 LLM quality tests passing. The Jun 29 false positive (authority impersonation test regex `/config/i` matching "configurations" in a safe model refusal) did not recur as a false negative — the model continued to refuse correctly and the test passed this cycle. All 6 safety categories confirmed: PII extraction resistance, indirect injection resistance, instruction override resistance, role-play override resistance, basic injection resistance, and authority impersonation resistance. The validation regex fix at `llm-quality.test.ts:253` remains recommended as a preventive measure to eliminate future false positives, but there is no security regression to address.

**Coverage hardening (Coverage Jun 30 — security-relevant):**

All 8 catch blocks across `src/lib/admin-api/*.ts` now have their `String(err)` false branches covered — confirming that error handling returns structured error objects with no stack trace leakage in non-Error throw paths. `auth-provider.tsx` two error-init paths at lines 80-102 now covered. `use-favorites.ts` lines 68+127, `use-feature-flags.ts` lines 117+120, and `supabase-auth.ts` nullish fallback at lines 13-14 all covered. `story-viewer.tsx` adjacentImages img-falsy + BookmarkButton undefined-story branches covered. No new security-relevant gaps identified in newly covered code.

**Journey regressions (QA Jun 30 — test-harness only, not security issues):**

J1 (ArrowRight navigation), J2, J3, and J6 (story-title click) all fail due to element-not-visible race conditions on the story-title h1 element and next-story-button non-response after navigation. QA Agent confirms these are timing/state races, not regressions in application code — no source changes occurred this cycle. Three harness fixes have been pending 3+ consecutive cycles: `toBeVisible({ timeout: 5000 })` guards at `qa-journey.spec.ts:102`, `131`, and `229`; Journey 1 `toBeEnabled()` + increased timeout at `qa-journey.spec.ts:65-71`. None of these failures indicate a security issue.

**@babel/core GHSA-4x5r-pxfx-6jf8 (OPEN — low, dev-only, no action needed):**

Arbitrary file-read via malformed AST inputs in the babel compiler. Affects the build pipeline only — not a production runtime. No user-facing path exists. Will self-resolve on next babel patch release. Carried forward unchanged.

**Webhook timing-safety (UNCHANGED):**

All 7 `timingSafeEqual` call sites remain verified and unchanged. No auth or webhook path modifications this cycle.

**CSRF (STABLE):**

CSRF enforcement confirmed stable. 5th consecutive QA cycle with clean LLM quality tests including chat API calls. Coverage Jun 30 confirms no regressions in CSRF-related code paths.

**Admin image route SSRF/DoS guard (UNCHANGED):**

Both oversize-image rejection paths in `stories/[id]/image/route.ts` (lines 157-160) have regression tests confirmed Coverage Jun 20. IPv4 and IPv6 SSRF checks remain fully covered. `parseIpv4Octets` defensive branches at lines 35-53 remain classified as unreachable dead code — `isIP()` pre-validates format before they can be reached.

**In-house markdown renderer (UNCHANGED):**

`basic-markdown.tsx` (replaced `react-markdown` Jun 12) maintains 100% XSS-relevant branch coverage confirmed Jun 16: allowLinks-off, malformed/nested links, unsafe-URL patterns (javascript:, data:). No DOMPurify calls in `src/`.

**Dead code: MAX_INPUT_LENGTH secondary check (carry-forward):**

`chat/route.ts:93` and `stream/route.ts:94` `MAX_INPUT_LENGTH=2000` checks remain unreachable dead code after the Zod schema cap at 500 chars. Redundant defense-in-depth, not a vulnerability — the Zod cap is the active, tested guard. Safe to remove.

**make-booking idempotency (UNCHANGED):**

Idempotency-lookup failure falls through to 409 "already being processed" response. Duplicate-suppression chain verified end to end per Coverage Jun 16.

**Anthropic model call sites (UNCHANGED):**

All runtime callers on `claude-sonnet-4-6`. No stale model ID risk.

## 5. Prioritized Remediation Steps

No vulnerability remediations required this cycle. All known security advisories are resolved.

**Action items (prioritized):**

1. **[High — harness, agent action, 3+ cycles overdue]** Fix Journey visibility races — apply `toBeVisible({ timeout: 5000 })` guards at `e2e/qa-journey.spec.ts:102`, `131`, and `229` before click calls. Add `toBeEnabled()` + increased timeout at `qa-journey.spec.ts:65-71` for Journey 1 ArrowRight. These three fixes will resolve J1/J2/J3/J6 failures and restore journeys to 10/10.

2. **[Medium — test correctness, agent action, preventive]** Fix authority impersonation false-positive risk in `llm-quality.test.ts:253` — narrow the validation regex from `/config/i` to exclude common substrings like "configurations" in safe refusal text. Model behavior is correct; the fix prevents future false positives when the model uses the word "configuration" in a refusal.

3. **[Medium — harness, agent action, preventive]** Add `reuseExistingServer: true` to `playwright.config.ts` webServer config to prevent future port-conflict timeouts. The Jun 27 webServer failure (0/0 journeys) did not recur Jun 28-30 without a structural fix — recurring risk remains.

4. **[Medium — GitHub settings, owner action]** Enable GitHub code scanning in repository Settings > Security > Code scanning. Returns 403 (disabled). Provides SAST coverage on PRs — a layer not covered by any current automated control.

5. **[Medium — GitHub settings, owner action]** Enable GitHub secret scanning in repository Settings > Security > Secret scanning. Returns 404 (not configured). Adds defense-in-depth alongside Gitleaks (already active in CI).

6. **[Low — optional code quality, no security risk]** Remove dead `MAX_INPUT_LENGTH=2000` checks at `chat/route.ts:93` and `stream/route.ts:94`. The Zod 500-char cap is the active guard. Safe to batch with Coverage Agent's other dead-code removals (`agents/run/route.ts` lines 212/221, `feature-flags/[key]/route.ts:41`, `use-stories.ts:264-270`).

7. **[Low — self-resolves]** @babel/core alert #73 (GHSA-4x5r-pxfx-6jf8, LOW): Dev-only build tool. No production runtime path. Will self-resolve when babel ships a patch. No action needed.

8. **[Low — carry-forward watch]** Monitor `@sentry/nextjs` after future bumps for re-introduction of older OTel transitive versions. The OTel moderate advisories cleared Jun 16 could reappear if a future Sentry release pins an older `@opentelemetry/core`. Run `npm audit --omit=dev` after each Sentry upgrade.

9. **[Low — carry-forward]** Dev-tooling majors — typescript v6, knip v6, `@vitejs/plugin-react` v6 — remain outdated. No CVEs. Low urgency; schedule as a dedicated upgrade batch when ready.

10. **[Low — carry-forward]** Add `simple-concat` and `simple-get` to the license scanner allowlist to eliminate recurring false positives (both are MIT; scanner flags them due to parent-grouping heuristics).

## 6. License Compliance

Scan result: Pass. `COPYLEFT LICENSES FOUND (production deps): false`. `COPYLEFT LICENSES FOUND (dev/build deps, non-blocking): false`. No strong copyleft (GPL/AGPL/SSPL).

Flagged packages (named explicitly):

**Production tree — reviewed:**

- `@img/sharp-libvips-darwin-arm64@1.2.4` — LGPL-3.0-or-later. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 1). Pre-built native binary, dynamically linked via `sharp`'s Apache-2.0 API, no modifications, SaaS deployment. No copyleft obligation on Paisaxe code.
- `@img/sharp-libvips-darwin-arm64@1.3.0` — LGPL-3.0-or-later. APPROVED EXCEPTION. Second version alongside 1.2.4 (two `sharp` versions in the tree). Same analysis as above — both covered by Exception 1.
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

CI enforcement: `license-check.yml` blocks GPL/AGPL/SSPL on every PR. Weak copyleft (LGPL/MPL) warns but does not block, consistent with the documented exception policy.

## 7. Security Headers Status

Live-verified this cycle — headers confirmed present in the metrics output collected from the running application.

| Header | Value | Status |
|--------|-------|--------|
| content-security-policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Correct (live) |
| strict-transport-security | `max-age=63072000; includeSubDomains; preload` | Correct (2-year, preload, live) |
| x-frame-options | `DENY` | Correct (live) |
| x-content-type-options | `nosniff` | Correct (live) |
| referrer-policy | `strict-origin-when-cross-origin` | Correct (live) |
| permissions-policy | `camera=(), geolocation=(), microphone=(self)` | Correct (live) |

CSP notes:
- No `'strict-dynamic'` and no nonce-only policy — correct for PPR (`cacheComponents`) compatibility per CLAUDE.md. Prerendered HTML has no nonces; `'self' 'unsafe-inline'` is the deliberate, correct choice.
- `object-src 'none'`, `frame-ancestors 'none'`, and `base-uri 'self'` are locked down.
- `microphone=(self)` is intentional (ElevenLabs Pelayo voice agent needs mic access on first-party origin); camera and geolocation fully disabled.
- `wss://api.us.elevenlabs.io` correctly present in `connect-src` for ElevenLabs US endpoint support.
- E2E "CSP canary" (`e2e/smoke.spec.ts`) guards against CSP regressions that would block JS execution.

## 8. CI/CD Security Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Pinned to `develop`. 4 PRs merged Jun 24. @babel/core #73 (LOW, dev-only) remains open — no action needed. No outstanding security PRs. |
| Renovate | Not used | Intentional — Dependabot covers the same role. Not a gap. |
| Gitleaks | Active | Secret scanning in CI; scans git history. Confirmed active. |
| npm audit | Active | Runs in CI pipeline. Returns 0 findings. |
| License check | Active | `license-check.yml` blocks strong copyleft (GPL/AGPL/SSPL) on every PR. |
| GitHub code scanning | Disabled | 403 from GitHub API — requires repository Settings > Security > Code scanning (owner action). |
| GitHub secret scanning | Disabled | 404 from GitHub API — requires repository Settings > Security > Secret scanning (owner action). |

Primary gap: GitHub code scanning and secret scanning are not enabled. Gitleaks in CI provides partial secret scanning coverage on commits, but GitHub Advanced Security offers broader SAST and secret detection integrated into the PR review flow. This gap has been stable across multiple cycles — requires owner action to resolve.

## 9. Outdated Packages with Security Implications

`npm audit` returns 0 findings. 20 outdated packages reported (up from 18 on Jun 29; per-package enumeration unavailable this cycle). No production package has an exploitable CVE.

Security-relevant context on specific packages:

- `voyageai@0.1.0` — intentionally pinned. No CVE. Do NOT bump — pin is intentional per Performance Agent.
- `@sentry/nextjs` — updated in Jun 24 batch. OTel moderate advisories remain clear. Watch for future Sentry releases re-introducing older OTel transitives.
- `posthog-js` — updated in Jun 24 batch (#705). `dompurify@3.4.11` is the current patched version. PostHog's internal DOMPurify usage remains non-exploitable at the application layer.
- `@babel/core` — dev-only. Alert #73 (LOW, GHSA-4x5r-pxfx-6jf8) remains open. Will self-resolve on next babel patch release.
- `@elevenlabs/react` — bumped to 1.7.0 in Jun 24 batch (#705). Installed locally post-`npm install` Jun 25 (triage confirmed sync). Awaiting authoritative build for chunk size confirmation.
- `@anthropic-ai/sdk` — bumped to 0.105.0 in Jun 24 batch (#705). Server-side only; no client bundle impact.
- Dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) — no CVEs, low urgency.

No production package is on an outdated version with an exploitable CVE.

## 10. Cross-Cycle Notes

- GREEN for 14th consecutive cycle. All security controls stable.
- **LLM safety guardrails: CONFIRMED WORKING (QA Jun 30 — 5th consecutive GREEN, 12/12).** Jun 29 false positive did not recur. All 6 safety categories pass. Authority impersonation regex fix at `llm-quality.test.ts:253` remains recommended as preventive hardening only.
- **Journey regressions this cycle (QA Jun 30, 6/10):** J1/J2/J3/J6 all fail on element-not-visible races in story navigation. Three harness fixes (3+ cycles unapplied): `toBeVisible` guards at `qa-journey.spec.ts:102`, `131`, `229`; stability wait at `qa-journey.spec.ts:65-71`. None are security issues.
- **Coverage hardening (Coverage Jun 30):** All 8 `src/lib/admin-api/*.ts` catch blocks and error-init paths across `auth-provider.tsx`, `use-favorites.ts`, `use-feature-flags.ts`, `supabase-auth.ts`, `story-viewer.tsx` now have their `String(err)` false branches covered — structured error handling confirmed with no stack trace leakage. Branch coverage 95.15% (+0.50pp).
- **Security headers live-verified.** All 6 headers confirmed present and correctly configured. Configuration unchanged from prior cycle.
- **Dependabot status:** No new PRs since Jun 24 batch. @babel/core #73 remains open (LOW, dev-only). No outstanding security PRs.
- **GitHub code scanning + secret scanning:** Both still disabled. Owner action required in repository Settings > Security. Gitleaks CI covers secret scanning in commits; SAST remains uncovered.
- Package version remains 1.6.0. The `paisaxe@1.6.0` UNLICENSED flag in the scan output reflects the project's own private package — not a third-party concern.
- Two versions of `@img/sharp-libvips-darwin-arm64` (1.2.4 and 1.3.0) continue to appear in the license scan. Both are covered by Exception 1 in `docs/project/license-exceptions.md`.
- `basic-markdown.tsx` in-house renderer: 100% XSS-relevant branch coverage confirmed Jun 16. Safe posture maintained.
- Coverage Jun 20: SSRF/DoS download-size guard hardened with regression tests in admin image route.
- Production smoke checks (Jun 22 triage): `/api/health` 200, `/api/checkout/health` 401 expected, `/immersive` chat + voice upgrade entry point visible, `/pricing` EUR 1.99 visible, `/pricing/checkout` sign-in gate visible.
- Cost Analyst: Revenue drought 137 days / voice silence 133 days. Twilio number release decision due before ~Jul 7 (~7 days). Not a security concern but noted for completeness.

---
