# Security Report — 2026-08-13

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable. `npm audit` reports 0 vulnerabilities across the full dependency tree (production + dev). No license violations. All security headers present in source. CI/CD security automation fully active.

## 2. Executive Summary

**0 advisories detected, 0 exploitable.** `npm audit` returned a clean result: 0 critical, 0 high, 0 moderate, 0 low. This continues the clean streak the security agent has reported in most recent cycles (last advisory-bearing cycle was 2026-04-25, resolved same week). License compliance: 0 copyleft violations in production dependencies — all flagged packages are either already-approved exceptions (documented in `docs/project/license-exceptions.md`) or dual-licensed packages where the permissive option applies. Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are all confirmed present in `next.config.ts`. CI/CD security automation (Dependabot, Gitleaks, npm audit) is fully wired into `.github/workflows/security.yml`. 25 packages are outdated (all minor/patch, no CVEs) — routine dependency hygiene, not a security gap.

**No shared-context items required security follow-up this cycle** — the two open cross-agent threads (Anthropic credit exhaustion, QA harness abort) are availability/operational issues, not security findings, and are already tracked by Cost Analyst/QA/Triage.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|----------------|---------|------------------|
| — | — | None found | — | — | `npm audit` clean: 0 critical / 0 high / 0 moderate / 0 low across production and dev dependency trees |

## 4. Detailed Exploitability Analysis

No high/critical (or any severity) advisories were reported by `npm audit`. There is nothing to analyze for exploitability this cycle. This is consistent with the security agent's 2026-04-20 GREEN report (0 advisories after the protobufjs/dompurify posthog-js chain was resolved) and the 2026-07-15 triage cycle, which brought the lockfile to a clean audit state and has held since.

## 5. Prioritized Remediation Steps

No remediation required for vulnerabilities. Routine hygiene only:

1. **Optional — dependency freshness batch** (low priority, no security driver): 25 outdated packages, all minor/patch version bumps with no associated CVEs (see §9). Can be batched in the next scheduled dependency-update cycle per the project's semver-gated Dependabot groups (`.github/dependabot.yml`, fixed 2026-07-15 to exclude majors from auto-grouping).
2. **No action needed** on Gitleaks, npm audit CI gate, or license-check workflow — all active and passing.

## 6. License Compliance

**0 copyleft violations in production dependencies.** Strict permissive-only policy (MIT, Apache-2.0, BSD, ISC) is enforced by `license-check.yml` for strong copyleft (GPL/AGPL/SSPL); weak copyleft triggers a warning but does not block.

Flagged packages (production tree) and their disposition:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.3.2` | LGPL-3.0-or-later | **Approved exception** — `docs/project/license-exceptions.md` Exception 1. Pre-built native binary, dynamically linked, no modifications, SaaS deployment (no binary distribution). No copyleft obligations triggered. |
| `dompurify@3.4.13` | `(MPL-2.0 OR Apache-2.0)` | Dual-licensed — Apache-2.0 option applies under the project's permissive-only policy. Transitive dep via `posthog-js`; not called directly from `src/`. Not a violation. |
| `expand-template@2.0.3` | `(MIT OR WTFPL)` | Dual-licensed — MIT option applies. Not a violation. |
| `paisaxe@1.6.0` | UNLICENSED | This is the project's own `package.json` (private, not published) — expected, not a third-party dependency. |
| `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT (scanner mis-flagged) | Actually MIT — appear in the flagged list due to scanner over-inclusion, not an actual license issue. |
| `@babel/template@7.29.7` | MIT (scanner mis-flagged) | Actually MIT — same as above. |

Dev+full-tree-only additions (not shipped to production, build-time only):

| Package | License | Status |
|---------|---------|--------|
| `lightningcss@1.32.0` + platform binaries | MPL-2.0 | **Approved exception** — `docs/project/license-exceptions.md` Exception 3. `devDependency` via Tailwind CSS v4 build tooling; file-level weak copyleft, not shipped to clients. |

**No new license exceptions required this cycle.** All flagged packages are already covered by documented exceptions, dual-license permissive options, or scanner false-positives on already-MIT packages.

## 7. Security Headers Status

All headers confirmed present in `next.config.ts` (server-rendered, not CSP-nonce-dependent — consistent with the project's PPR-compatibility constraint documented in CLAUDE.md):

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) | Present |
| `X-Frame-Options` | `DENY` | Present |
| `X-Content-Type-Options` | `nosniff` | Present |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Present |
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` | Present |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com https://checkout.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Present |

CSP correctly avoids `'strict-dynamic'` and nonce-only configurations per the project's PPR (`cacheComponents`) compatibility requirement — prerendered HTML has no nonces, so `'self' 'unsafe-inline'` is the deliberate, documented choice (see CLAUDE.md "CSP and PPR Compatibility"). `object-src 'none'` and `frame-ancestors 'none'` are both set, closing the two most common CSP gaps (plugin execution, clickjacking).

## 8. CI/CD Security Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Configured in `.github/dependabot.yml`, semver-gated to `minor`/`patch` per group since 2026-07-15 fix (prevents a repeat of the PR #726 incident where a `typescript` major rode along with a "production" group bump) |
| Gitleaks | Active | `.github/workflows/security.yml` — `gitleaks` job runs on push to `develop`/`main`, on PRs, and daily at 08:00 UTC (cron) |
| npm audit in CI | Active | Same workflow — `audit` job runs `npm audit --omit=dev --audit-level=moderate` (blocking) plus an informational full-tree audit |
| License check | Active | Separate `license-check.yml` workflow blocks strong copyleft (GPL/AGPL/SSPL) on all PRs |
| Renovate | Not configured | Dependabot covers this need; no gap |

Scan cadence was tightened from weekly to daily (2026-08 change, see workflow comment) — CVE detection latency reduced from ~6 days to <24h.

## 9. Outdated Packages (Security Implications)

25 packages outdated, **all minor/patch, zero associated CVEs**. None are exploitability-relevant; this is a hygiene item only. Selected notable ones:

- `next`: 16.2.12 → 16.3.0 (patch, framework — worth keeping current given prior CSP/PPR sensitivity, but no known vuln)
- `@supabase/supabase-js`: 2.112.0 → 2.112.3 (patch)
- `stripe`: 22.4.0 → 22.5.0 (patch, payments-adjacent — low urgency, no CVE)
- `@anthropic-ai/sdk`: 0.115.0 → 0.116.0 (patch)
- `@sentry/core` / `@sentry/nextjs`: 10.69.0 → 10.70.0 (patch)
- `@upstash/redis`, `@upstash/ratelimit`: patch-level bumps (rate-limiting infra)
- `typescript`: 6.0.3 → 7.0.2 — **major version**, excluded from Dependabot auto-grouping per the 2026-07-15 fix; requires a standalone migration, not a security action
- Remaining 17 packages: dev tooling, build plugins, testing libraries — all patch/minor, no CVEs

Recommendation: batch the 24 minor/patch bumps (excluding `typescript`) in the next scheduled dependency cycle; `typescript` 6→7 remains a deliberate standalone migration per existing project policy.

---
