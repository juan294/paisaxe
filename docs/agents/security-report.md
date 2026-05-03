# Security Report — 2026-05-02

## Status: GREEN

`npm audit` reports **0 advisories** across all severities. **0 exploitable**, **0 fixable** (because none exist). The previous YELLOW cycles (Apr 17 posthog-js transitive advisories; Apr 25 postcss/uuid chains) have fully resolved upstream and via `npm audit fix`. No new advisories since the Apr 30 dep batch (`3163f478`).

## Executive Summary

- **0 advisories detected, 0 exploitable** in `package-lock.json`. Production attack surface is currently free of known CVEs.
- **License compliance: Pass.** No copyleft violations. Two non-permissive deps (`@img/sharp-libvips-*` LGPL-3.0 and `@vercel/analytics` MPL-2.0) are documented exceptions in `docs/project/license-exceptions.md`. `dompurify@3.4.0` is dual-licensed (MPL-2.0 OR Apache-2.0) — Apache-2.0 is selected. Three flagged scanner false positives (`simple-concat`, `simple-get`, `expand-template`) are MIT or MIT/WTFPL dual-licensed.
- **Security headers**: All seven configured in source (`next.config.ts` + `src/proxy.ts`). HSTS prod-gated, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimised, CSP via proxy. Live-header check skipped (server not running).
- **CI/CD security automation**: All channels active — Dependabot (pinned to `develop`), Gitleaks, `npm audit --omit=dev --audit-level=moderate`, license-check. No gaps.
- **Outdated packages**: 8 total, none with security relevance — five dev-only, three production minor/patch. `voyageai@0.1.0` intentionally pinned (v0.2.x ESM build is broken; documented in `dependabot.yml` ignore list and reverted in `749048e5`).
- **Static-analysis attack surface**: 4 webhook endpoints all use `crypto.timingSafeEqual`, double-submit CSRF tokens enforced (Origin + token), Stripe dedup race protected by 23505 constraint with 100% branch coverage (coverage agent, Apr 23).

## Vulnerability Table

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| — | — | — | — | — | None — `npm audit` exits clean. |

There are no Critical, High, Moderate, or Low advisories to report this cycle.

## Detailed Exploitability Analysis

Not applicable — no advisories present. For historical reference (resolved):

- **GHSA-xq3m-2v4x-88gg (protobufjs Critical, transitive via posthog-js)** — resolved by `e66e510` (Apr 18). Was never exploitable here: vulnerable `parse(reflectionObject)` is reachable only through OpenTelemetry transport, and Paisaxe ships PostHog as a deferred client-side chunk that does not feed user-controlled protobuf to the affected parser.
- **GHSA-39q2-94rc-95cp (dompurify Moderate, transitive via posthog-js)** — resolved by `e66e510`. Application code does not invoke DOMPurify directly (`grep -r 'DOMPurify\|dompurify' src/` returns 0 hits in product code); the ADD_TAGS+FORBID_TAGS bypass requires application-level usage that does not exist.
- **GHSA-qx2v-qp2m-jg93 (postcss XSS, build-time)** — resolved upstream (Next.js bundle now ships postcss >= 8.5.10). Build-time only; no production attack surface.
- **GHSA-p7fg-763f-g4gf (@anthropic-ai/sdk Local Filesystem Memory Tool)** — resolved by `52b8f484` + `3163f478` (Apr 30 dep batch). Was never exploitable: the LFS Memory Tool feature is unused in the codebase.

## Prioritized Remediation Steps

1. **No security action required this cycle.** The bundle is clean and license compliance is intact.
2. **Optional, low-priority dep refresh** when a maintenance window opens:
   ```bash
   git worktree add -b chore/dep-refresh-may .worktrees/dep-refresh-may develop
   cd .worktrees/dep-refresh-may
   npm install postcss@8.5.13 posthog-js@1.372.6 zod@4.4.2
   # DO NOT bump voyageai — pinned at 0.1.0 (broken ESM in 0.2.x)
   npm audit
   npm run typecheck && npm run test && npm run lint
   ```
   This is housekeeping, not a security fix. None of these patches resolve advisories — they keep noise low and shrink future Dependabot diffs.
3. **Verify CSP at runtime next cycle.** Source confirms correct headers, but the agent has not validated live response headers in over a week (server-not-running each run). Next cycle should `curl -sSI https://paisaxe.es/` and grep for the seven headers.

## License Compliance

Plain-MIT-and-friends across the vast majority of the dep tree (526 of 533 unique licenses, 98.7%). Flagged packages:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Documented exception (Exception 1, license-exceptions.md). Dynamically linked native binary; no copyleft obligation triggered for SaaS deployment. |
| `dompurify@3.4.0` | MPL-2.0 OR Apache-2.0 | Apache-2.0 selected via dual-license election. No exception entry needed. |
| `@vercel/analytics` (transitive in tree) | MPL-2.0 | Documented exception (Exception 2, license-exceptions.md). |
| `paisaxe@1.5.1` | UNLICENSED | This is the project itself. Intentional — Paisaxe is proprietary and not distributed. |
| `expand-template@2.0.3` | MIT OR WTFPL | MIT selected via dual-license election. No action. |
| `simple-concat@1.0.1` | MIT | Scanner false positive — `package.json` declares `MIT`. No action. |
| `simple-get@4.0.1` | MIT | Scanner false positive — `package.json` declares `MIT`. No action. |
| `MIT*` (2 packages) | MIT (inferred from LICENSE file, not declared in package.json) | Acceptable — MIT in both cases per LICENSE file inspection. No action. |

**No GPL, AGPL, or SSPL detected.** No new copyleft licenses since the Apr 12 baseline. `license-check.yml` continues to enforce the permissive-only policy on every PR.

## Security Headers Status

Live header check skipped (no dev server). Source verification:

| Header | Source | Value |
|--------|--------|-------|
| Content-Security-Policy | `src/proxy.ts` (via `buildCspHeader()`) | `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`; `frame-ancestors 'none'`; `object-src 'none'` |
| Strict-Transport-Security | `next.config.ts` (production-gated) | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | `next.config.ts` | `DENY` |
| X-Content-Type-Options | `next.config.ts` | `nosniff` |
| Referrer-Policy | `next.config.ts` | `strict-origin-when-cross-origin` |
| Permissions-Policy | `next.config.ts` | `camera=(), geolocation=(), microphone=(self)` |

CSP retains `'unsafe-inline'` as a deliberate trade-off for PPR (Partial Prerendering) compatibility — documented in `CLAUDE.md` "CSP and PPR Compatibility". The E2E "CSP canary" test in `e2e/smoke.spec.ts` verifies JS still executes.

## CI/CD Automation Status

| Channel | Configured | Notes |
|---------|------------|-------|
| Dependabot | Yes | `target-branch: develop`, weekly Monday cadence, `open-pull-requests-limit: 10`, voyageai pinned via ignore rule. |
| Renovate | No | Not used; Dependabot covers the same ground. Not a gap. |
| Gitleaks | Yes | `.github/workflows/security.yml` runs on every push/PR; full-history scan via `gitleaks detect --source . --verbose`. |
| `npm audit` (prod) | Yes | `npm audit --omit=dev --audit-level=moderate` — fails build on moderate+ advisories. |
| `npm audit` (full) | Yes | `npm audit \|\| true` reports advisories without failing build (informational). |
| License check | Yes | `license-check.yml` blocks GPL/AGPL/SSPL; warns on LGPL/MPL. |
| Bundle-size guard | Yes | `bundle-size.yml` enforces 2,100/3,100 KB split budgets (raised by triage Apr 25 / May 2). |
| E2E security smoke | Yes | `e2e/smoke.spec.ts` CSP canary; `e2e/pre-launch.spec.ts` covers admin auth boundary. |

**No CI security gaps detected.** Apr 14 commit `f118597` pinned Dependabot to `develop`, eliminating the prior workflow risk of bot PRs targeting `main`.

## Outdated Packages with Security Implications

Eight outdated packages, **none with security implications**:

| Package | Current | Latest | Type | Risk |
|---------|---------|--------|------|------|
| `@upstash/ratelimit` | 2.0.8 | 2.0.8 | prod | Already current (false positive in scanner). None. |
| `jsdom` | 29.1.1 | 27.0.1 | dev | Local install ahead of npm `latest` tag. None. |
| `knip` | 6.9.0 | 6.10.0 | dev | Patch. None. |
| `postcss` | 8.5.12 | 8.5.13 | dev | Patch. None. |
| `posthog-js` | 1.372.5 | 1.372.6 | prod | Patch. None — Apr advisories already cleared. |
| `vitest` | 4.1.5 | 3.2.4 | dev | Pre-release channel; latest stable is 3.2.x. None. |
| `voyageai` | 0.1.0 | 0.2.1 | prod | **DO NOT UPGRADE** — v0.2.x ESM build is broken (Turbopack bare dir imports). Pinned in `dependabot.yml` and reverted in `749048e5`. None. |
| `zod` | 4.4.1 | 4.4.2 | prod | Patch. None. |

No production package is more than two minor versions behind. The single non-trivial gap (`voyageai`) is an intentional pin tracked via Dependabot ignore.

## Cross-Cycle Notes

- Performance Agent (May 1) reported the dep batch `3163f478` cleared the `@anthropic-ai/sdk` advisory but added +22 KB to the bundle. Trade-off recorded — future curated bumps should benchmark bundle impact before merge.
- QA Agent (Apr 30) confirmed CSRF Origin enforcement (SE-M2) is correct; the harness regression was a Node.js fetch quirk, not a production weakness. Triage shipped the harness fix on May 2.
- Cost Analyst (May 2) flags 78-day revenue drought. No security contribution; production verification of Pelayo + Day Pass remains the user's call.
