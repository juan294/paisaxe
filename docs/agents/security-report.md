# Security Report — 2026-05-03

## Status: GREEN

`npm audit` reports **0 advisories** across all severities. **0 exploitable**, **0 fixable** (because none exist). The clean streak continues from Apr 20 (YELLOW on Apr 17 and Apr 25 were fully resolved). No new advisories introduced by recent commits or dep bumps.

## Executive Summary

- **0 advisories detected, 0 exploitable** in `package-lock.json`. Production attack surface is clear.
- **License compliance: Pass.** No copyleft violations. Two non-permissive deps (`@img/sharp-libvips-*` LGPL-3.0 and `@vercel/analytics` MPL-2.0) are documented exceptions in `docs/project/license-exceptions.md`. `dompurify@3.4.0` is dual-licensed (MPL-2.0 OR Apache-2.0) — Apache-2.0 elected. Three scanner false positives (`simple-concat`, `simple-get`, `@babel/template`) are MIT. `expand-template` is MIT OR WTFPL — MIT elected.
- **Security headers**: 4 of 7 headers confirmed via partial live check (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy all pass). CSP and HSTS source-verified but not in live check output — CSP is proxy-injected (not visible to header-only curl), HSTS is production-gated. All 7 confirmed correct in source.
- **CI/CD security automation**: All channels active — Dependabot (pinned to `develop`), Gitleaks, `npm audit --omit=dev --audit-level=moderate`, license-check. No gaps.
- **Outdated packages**: 8 total, none with security relevance. Five are dev-only or pre-release-channel; three are production minor/patch. `voyageai@0.1.0` intentionally pinned (v0.2.x ESM build is broken; ignore entry in `dependabot.yml`, reverted in `749048e5`).
- **Static-analysis attack surface**: 4 webhook endpoints all use `crypto.timingSafeEqual`, double-submit CSRF tokens enforced (Origin + token, SE-M2). QA confirmed safety guardrails (injection, role-play override, PII) passing for first time since Apr 26 (YELLOW, 11/12 — one regex miss, not a guardrail failure).

## Vulnerability Table

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| — | — | — | — | — | None — `npm audit` exits clean. |

No Critical, High, Moderate, or Low advisories this cycle.

## Detailed Exploitability Analysis

No advisories present this cycle. Historical reference (all resolved):

- **GHSA-xq3m-2v4x-88gg (protobufjs Critical, transitive via posthog-js)** — resolved `e66e510` (Apr 18). Vulnerable `parse(reflectionObject)` only reachable via OpenTelemetry transport; PostHog ships as a deferred client-side chunk that does not feed user-controlled protobuf to the affected parser.
- **GHSA-39q2-94rc-95cp (dompurify Moderate, transitive via posthog-js)** — resolved `e66e510`. Application code does not call DOMPurify directly (`grep -r 'DOMPurify\|dompurify' src/` returns 0 hits). ADD_TAGS+FORBID_TAGS bypass requires application-level invocation that does not exist.
- **GHSA-qx2v-qp2m-jg93 (postcss XSS, build-time)** — resolved upstream (postcss >= 8.5.10 in Next.js bundle). Build-time only; no production attack surface.
- **GHSA-p7fg-763f-g4gf (@anthropic-ai/sdk Local Filesystem Memory Tool)** — resolved `52b8f484` + `3163f478` (Apr 30 dep batch). LFS Memory Tool is unused in the codebase; vulnerability was never reachable.
- **GHSA-w5hq-g745-h8pq (uuid bounds-check, transitive)** — resolved by dep tree updates. `uuid.v4()` code path not affected.

## Prioritized Remediation Steps

1. **No security action required this cycle.** Bundle is clean; license compliance intact.
2. **Optional cosmetic dep refresh** (housekeeping, not security-driven) — queued by Triage May 3 in a separate worktree:
   ```bash
   # When the maintenance window opens:
   git worktree add -b chore/dep-refresh-may .worktrees/dep-refresh-may develop
   cd .worktrees/dep-refresh-may
   npm install postcss@8.5.13 posthog-js@1.372.6 zod@4.4.2
   # DO NOT bump voyageai — pinned at 0.1.0 (broken ESM in 0.2.x)
   npm audit
   npm run typecheck && npm run test && npm run lint
   ```
3. **Add CSP to live header check** in the security metrics script. The current check captures 4 headers but misses CSP (proxy-injected) and HSTS (prod-only). Running `curl -sSI https://paisaxe.es/` would catch all 7 headers in one shot and confirm production delivery.

## License Compliance

Plain-MIT and permissive licenses account for 526 of 533 unique license entries (98.7%). Flagged packages:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Documented exception (Exception 1, `license-exceptions.md`). Dynamically linked native binary; no copyleft obligation triggered for SaaS deployment. |
| `dompurify@3.4.0` | MPL-2.0 OR Apache-2.0 | Apache-2.0 selected via dual-license election. No exception entry needed. |
| `@vercel/analytics` (transitive) | MPL-2.0 | Documented exception (Exception 2, `license-exceptions.md`). File-level weak copyleft; no modifications; SaaS deployment. |
| `paisaxe@1.5.1` | UNLICENSED | Project itself — proprietary, not distributed. Intentional. |
| `expand-template@2.0.3` | MIT OR WTFPL | MIT elected via dual-license. No action. |
| `simple-concat@1.0.1` | MIT | Scanner false positive — `package.json` declares `MIT`. No action. |
| `simple-get@4.0.1` | MIT | Scanner false positive — `package.json` declares `MIT`. No action. |
| `@babel/template@7.28.6` | MIT | Scanner false positive — plain MIT. No action. |
| `MIT*` (2 packages) | MIT (inferred) | MIT confirmed via LICENSE file. No action. |

**No GPL, AGPL, or SSPL detected.** `license-check.yml` enforces the permissive-only policy on every PR.

## Security Headers Status

Partial live check this cycle (server available — 4 headers verified):

| Header | Live Check | Source | Value |
|--------|------------|--------|-------|
| Content-Security-Policy | Not in output (proxy-injected; live curl needed) | `src/lib/proxy/csp.ts` via `src/proxy.ts` | `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`; `frame-ancestors 'none'`; `object-src 'none'` |
| Strict-Transport-Security | Not in output (production-gated) | `next.config.ts:64` | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | DENY — Pass | `next.config.ts:67` | `DENY` |
| X-Content-Type-Options | nosniff — Pass | `next.config.ts:66` | `nosniff` |
| Referrer-Policy | strict-origin-when-cross-origin — Pass | `next.config.ts:68` | `strict-origin-when-cross-origin` |
| Permissions-Policy | camera=(), geolocation=(), microphone=(self) — Pass | `next.config.ts:69` | `camera=(), geolocation=(), microphone=(self)` |

CSP retains `'unsafe-inline'` as a deliberate trade-off for PPR (Partial Prerendering) compatibility — documented in `CLAUDE.md` "CSP and PPR Compatibility". The E2E "CSP canary" test in `e2e/smoke.spec.ts` verifies JS execution is not blocked.

## CI/CD Automation Status

| Channel | Configured | Notes |
|---------|------------|-------|
| Dependabot | Yes | `target-branch: develop`, weekly Monday cadence, `open-pull-requests-limit: 10`. voyageai pinned via ignore rule. PRs target `develop` (not `main`) since `f118597`. |
| Renovate | No | Not used; Dependabot covers the same ground. Not a gap. |
| Gitleaks | Yes | `.github/workflows/security.yml` on every push/PR; full-history scan via `gitleaks detect --source . --verbose`. |
| `npm audit` (prod) | Yes | `npm audit --omit=dev --audit-level=moderate` — fails build on moderate+ advisories. |
| `npm audit` (full) | Yes | `npm audit \|\| true` — informational reporting only. |
| License check | Yes | `license-check.yml` blocks GPL/AGPL/SSPL; warns on LGPL/MPL. |
| Bundle-size guard | Yes | `bundle-size.yml` enforces 2,100/3,100 KB split budgets (raised triage May 2). |
| E2E security smoke | Yes | `e2e/smoke.spec.ts` CSP canary; `e2e/pre-launch.spec.ts` covers admin auth boundary. |

No CI security gaps detected.

## Outdated Packages with Security Implications

Eight outdated packages, **none with security implications**:

| Package | Current | Latest | Type | Risk |
|---------|---------|--------|------|------|
| `@upstash/ratelimit` | 2.0.8 | 2.0.8 | prod | Already current (false positive in scanner). None. |
| `jsdom` | 29.1.1 | 27.0.1 | dev | Pre-release channel; installed is ahead of npm `latest` tag. None. |
| `knip` | 6.9.0 | 6.11.0 | dev | Two minor versions behind; dev-only, no CVEs. None. |
| `postcss` | 8.5.12 | 8.5.13 | dev/build | Patch. None. |
| `posthog-js` | 1.372.5 | 1.372.6 | prod | Patch. None — all prior advisories cleared. |
| `vitest` | 4.1.5 | 3.2.4 | dev | Pre-release channel; installed is ahead of npm `latest` tag (4.x vs stable 3.x). None. |
| `voyageai` | 0.1.0 | 0.2.1 | prod | **DO NOT UPGRADE** — v0.2.x ESM build breaks embeddings (Turbopack bare dir imports). Pinned in `dependabot.yml`, reverted in `749048e5`. None. |
| `zod` | 4.4.1 | 4.4.2 | prod | Patch. None. |

No production package has security-relevant version skew. The single non-trivial gap (`voyageai`) is an intentional pin with documented rationale.

## Cross-Cycle Notes

- **QA Agent (May 3)**: Safety guardrails (injection, role-play, PII) confirmed passing for the first cycle since Apr 26. The one LLM test failure ("Hallucination resistance", 11/12) was a regex miss, not a guardrail breach. No security action required.
- **Coverage Agent (May 3)**: Stripe webhook + chat stream both reached 100% branch coverage (Apr 23). No new security-relevant coverage gaps.
- **Triage (May 3)**: Dep refresh (postcss 8.5.13, posthog-js 1.372.6, zod 4.4.2) queued in separate worktree. These are cosmetic — no advisory resolution.
- **Performance Agent (May 2)**: Bundle now at 3,008 KB / 3,100 KB total budget. Dep bumps can silently grow the bundle — future batch upgrades should benchmark `du -sk .next/static/chunks` before/after merge.

---
