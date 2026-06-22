# Security Report — Paisaxe

Date: 2026-06-21
Agent: Security Agent
Package version: paisaxe@1.6.0

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable.

Rationale: Fifth consecutive GREEN run. npm audit returns a fully clean tree. All security controls remain operational and correctly configured. The dependency tree is in its healthiest state this quarter.

## 2. Executive Summary

- 0 advisories detected. 0 exploitable.
- Fifth consecutive GREEN after the Jun 16 triage recovery.
- Package version bumped to 1.6.0 (from 1.5.1 in the Jun 20 report).
- Outdated packages: 12 (same count as Jun 20). Remaining outdated items are expected to be dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) with no CVEs. No production package has an exploitable CVE.
- License compliance: Pass. All flagged packages are approved exceptions, dual-licensed with a permissive option, or Paisaxe's own private package.
- Security headers: All present and correctly configured. No changes since Jun 17.
- CI/CD security automation: All controls active. Dependabot PR #647 (undici) identified as obsolete by Jun 21 triage — `undici@7.28.0` already on `develop` via `npm audit --omit=dev` clean; PR should be closed, not merged.
- Jun 21 triage fixed PR #702 Preview Smoke failure: preview health check (`/api/health`) no longer requires a production-only Sentry DSN (`sentry.status="unconfigured"` is accepted in preview environments). Not a security regression — production health checks remain unchanged.
- QA LLM safety status: Authority impersonation and instruction override tests remain unverified for a 6th consecutive cycle. The Jun 19 VOYAGE_API_KEY preflight fix flows the key through integration health tests but not into the Next.js dev server process under `npm run test:qa`. Root cause identified (QA Jun 21): the fix works when the key is already in the runner's shell environment; the qa-agent.sh must additionally source the key from `.env.local` before spawning the dev server. Manual safety check on paisaxe.es recommended before any production release.
- ElevenLabs account activity from a deleted personal agent (`agent_7901kk4r9v3wer`, 6 conversations Jun 20, now returning 404 from API) noted by Cost Analyst Jun 21. Not a Paisaxe agent, no security concern, no overage.

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

**Injection surface:**
Pre-LLM injection detection confirmed working (QA Jun 18, 1 test passed, 223ms; QA Jun 21, 2/12 passed — both injection tests via pre-LLM path). The fast-path guard is operating correctly. The remaining 10 LLM-quality tests (authority impersonation, PII extraction, boundary violations, RAG consistency) are being blocked by Voyage AI 503 in the QA environment. Root cause (QA Jun 21): `VOYAGE_API_KEY` is present in shell but does not propagate to the dev server process spawned by `npm run test:qa`. Fix path: qa-agent.sh must source the key from `.env.local` when not in shell, then pass it explicitly to the Next.js dev process.

**Admin image route (SSRF/DoS guard):**
Both oversize-image rejection paths in `stories/[id]/image/route.ts` (lines 157-160) have regression tests as of Coverage Agent Jun 20: (1) no-body path and (2) streaming ReadableStream > 10 MB triggers 400 + `reader.cancel()`. IPv4 and IPv6 SSRF checks remain fully covered (confirmed Coverage May 5). Hardens the download-size guard against DoS.

**In-house markdown renderer:**
`basic-markdown.tsx` (replaced `react-markdown` Jun 12) has 100% XSS-relevant branch coverage confirmed Jun 16: allowLinks-off, malformed/nested links, unsafe-URL patterns (javascript:, data:). No DOMPurify calls in `src/`. Transitive DOMPurify advisories from `posthog-js` remain non-exploitable at the application layer.

**Webhook timing-safety:**
All 7 `timingSafeEqual` call sites remain verified and unchanged. No auth or webhook path modifications this cycle.

**CSRF:**
CSRF enforcement confirmed working via browser journey tests (10/10 green, QA Jun 17-21 four consecutive stable weeks). `sendChatMessage()` includes CSRF tokens as of the Mar 23 fix. No regressions.

**make-booking idempotency:**
Coverage Agent Jun 16 confirmed the idempotency-lookup failure path falls through to the 409 "already being processed" response. Duplicate-suppression chain verified end to end.

**LiveKit chunk:**
Jun 20 triage confirmed the 412 KB `144d3bae` webpack chunk is LiveKit (ElevenLabs WebRTC transitive dep). Deferred/async via webpack runtime — zero first-paint cost. Loads only on voice widget interaction (click-to-mount since May 10). Not a direct attack surface in the Paisaxe application. No security concern.

**Preview health check (PR #702, Jun 21 triage):**
The smoke test gate for preview deployments now accepts `sentry.status="unconfigured"` alongside `status="healthy"`. The production health check (`/api/health`) is unaffected — Sentry DSN is always present in production. No security regression. The change prevents false-positive preview failures from blocking PR merges.

**Dependabot PR #647 (undici):**
Jun 21 triage identified this PR as targeting `main` directly and as superseded — `undici@7.28.0` is already present on `develop` with `npm audit --omit=dev` clean. The PR should be closed/superseded rather than merged. Merging it directly to `main` without going through `develop` would bypass the branch protection workflow. No security gap — the vulnerable version is already gone from the tree.

## 5. Prioritized Remediation Steps

No vulnerability remediations required this cycle.

**Action items (prioritized):**

1. **[High — QA environment, no code change on main path]** Fix `qa-agent.sh` to source `VOYAGE_API_KEY` from `.env.local` when not already in the shell environment, then pass it explicitly to the Next.js dev process before `npm run test:qa`. This is the only remaining blocker for the 10 failed LLM safety tests. The fix was partially applied Jun 19 (preflight probe + shell export) but does not handle the case where the key is absent from the runner's shell. QA Jun 21 confirms the integration health probe passes (Voyage AI reachable) but the dev server process does not inherit the key.

2. **[Medium — housekeeping]** Close or supersede Dependabot PR #647 (undici) once the Jun 21 triage fix (`/api/health` preview gate alignment) lands on `develop`. Do not merge PR #647 directly to `main`. Undici is already updated on `develop`; the PR is obsolete.

3. **[Low — carry-forward watch item]** Monitor `@sentry/nextjs` for a future release that re-introduces older OTel transitive versions. The OTel moderate advisories cleared by `npm audit fix` Jun 16 may reappear if a future Sentry release pins an older `@opentelemetry/core`. Run `npm audit --omit=dev` after each Sentry bump.

4. **[Low — carry-forward]** Dev-tooling majors — typescript v6, knip v6, `@vitejs/plugin-react` v6 — remain outdated. No CVEs. Low urgency; schedule as a dedicated upgrade batch when ready.

5. **[Low — carry-forward]** Add `simple-concat` and `simple-get` to the license scanner allowlist to eliminate recurring false positives (both are MIT; scanner flags them due to parent-grouping heuristics).

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

`npm audit` returns 0 findings. The scan reports 12 outdated packages (unchanged from Jun 20). Based on shared context, the remaining outdated items are dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) with no CVEs.

Security-relevant context on specific packages:

- `voyageai@0.1.0` — intentionally pinned. Its transitive `form-data` advisory was patched independently via `npm audit fix` on Jun 16. No CVE in voyageai itself. Do NOT bump voyageai — the pin is intentional per Performance Agent.
- `@sentry/nextjs` — current post-Jun 17 batch. The OTel moderate advisories that were present in its transitive tree were cleared by `@opentelemetry/core 2.8.0` bump from `npm audit fix`. Watch for a future Sentry release re-introducing older OTel transitives.
- `posthog-js` — updated in Jun 17 batch (#643). `dompurify@3.4.11` transitive is the current patched version. PostHog's internal DOMPurify usage remains non-exploitable at the application layer.
- Dev-tooling majors (typescript v6, knip v6, `@vitejs/plugin-react` v6) — no CVEs, low urgency. Out of scope for security remediation.

No production package is on an outdated version with an exploitable CVE.

## 10. Cross-Cycle Notes

- GREEN for 5th consecutive cycle. All security controls stable.
- Package version bumped to 1.6.0. The `paisaxe@1.6.0` UNLICENSED flag in the scan output reflects our own private package — not a third-party concern.
- Jun 21 triage introduced two relevant security notes: (1) Dependabot PR #647 is obsolete (undici already updated, close it); (2) preview smoke test gate now accepts `sentry.status="unconfigured"` to avoid false-positive blocking — production path unaffected.
- LLM safety guardrail status: Injection detection confirmed working (QA Jun 21, 2/12 passed via pre-LLM path). Authority impersonation, PII extraction, and instruction override tests unverified for a 6th consecutive cycle. The VOYAGE_API_KEY fix from Jun 19 triage works when the key is already in the runner's shell but does not handle the case where qa-agent.sh must source it from `.env.local`. This is the sole remaining QA environment blocker. Manual safety review on paisaxe.es remains recommended before any production release.
- ElevenLabs deleted-agent activity (Jun 20): 6 conversations from `agent_7901kk4r9v3wer` (personal agent, now 404 from API). No Paisaxe agent involved, no character overage, no security concern. Flagged for awareness.
- Two versions of `@img/sharp-libvips-darwin-arm64` (1.2.4 and 1.3.0) continue to appear in the license scan. Both are covered by Exception 1 in `docs/project/license-exceptions.md`. No new exception documentation required.
- `basic-markdown.tsx` (in-house renderer replacing react-markdown): 100% XSS-relevant branch coverage confirmed Jun 16. No DOMPurify dependency. Safe posture maintained.
- Coverage Agent Jun 20 added a streaming body oversize-limit test for the admin image route: both oversize rejection paths (no-body and ReadableStream > 10 MB → 400 + `reader.cancel()`) are now covered. SSRF/DoS download-size guard hardened.

---
