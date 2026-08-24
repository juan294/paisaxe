# Security Report — 2026-08-20

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable. `npm audit` reports 0 vulnerabilities across the full dependency tree (production + dev). No license violations (production allowlist check passes: 361/361 packages). All 6 security headers present in source and CSP verified free of the PPR-incompatible `strict-dynamic`/nonce-only patterns this project explicitly forbids. CI/CD security automation (Dependabot, Gitleaks, npm audit) fully active.

## 2. Executive Summary

**0 advisories detected, 0 exploitable.** `npm audit` returns a clean result: 0 critical, 0 high, 0 moderate, 0 low, across both the production-only and full (prod+dev) dependency trees. This is a second consecutive clean cycle (prior report: 2026-08-13, also GREEN).

License compliance is clean: `npm run check-licenses` passes 361/361 production dependencies against the strict SPDX allowlist in `scripts/check-production-licenses.ts`. All 7 flagged packages from the raw license scan are accounted for — either exact-match permissive licenses that only *looked* concerning in the raw summary (see §6), or documented, justified exceptions in `docs/project/license-exceptions.md`.

Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are confirmed present in both the raw metrics scan and in source (`next.config.ts` for the static 5, `src/lib/proxy/csp.ts` for the dynamic CSP applied in `src/proxy.ts`). A dedicated test (`src/lib/security-headers.test.ts`) asserts `'strict-dynamic'` is never present in `script-src` — the specific misconfiguration this project's CLAUDE.md flags as breaking PPR.

9 packages are outdated, all minor/patch version bumps with no associated CVEs — routine dependency hygiene, not a security gap. No shared-context items from other agents required security follow-up this cycle; the only open cross-cutting thread (ElevenLabs cost overage, per Cost Analyst 2026-08-20) is a billing/cost issue, not a security finding.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|----------------|---------|------------------|
| — | — | None found | — | — | `npm audit` clean: 0 critical / 0 high / 0 moderate / 0 low across production and dev dependency trees |

## 4. Detailed Exploitability Analysis

No advisories of any severity were reported by `npm audit --omit=dev --audit-level=moderate` or the full `npm audit`. There is nothing to analyze for exploitability this cycle. This continues the clean streak established after the 2026-07-15 triage cycle brought the lockfile to a fully clean audit state (0 vulnerabilities), which has held for over a month across every subsequent security-agent report (2026-08-06, 2026-08-13, and now 2026-08-20).

## 5. Prioritized Remediation Steps

No remediation required for vulnerabilities — none exist. Routine hygiene only:

1. **Optional — dependency freshness batch** (low priority, no security driver): 9 outdated packages, all minor/patch bumps with no associated CVEs (see §9). Safe to batch in the next scheduled dependency cycle under `.github/dependabot.yml`'s semver-gated grouping (majors always ride as standalone PRs, never silently grouped with safe updates).
2. **No action needed** on Gitleaks, npm audit CI gate, or license-check workflow — all active, passing, and unchanged since the last cycle.

## 6. License Compliance

**Production dependency license check: PASS (361/361).** `npm run check-licenses` (`scripts/check-production-licenses.ts`) enforces a strict SPDX-exact-match allowlist (not the substring-matching `license-checker --onlyAllow`, which was found to silently admit source-available licenses like `FSL-1.1-MIT` under a bare `"MIT"` token — see the script's header comment, issue #847 / SE-M3). Compound `AND`/`OR` SPDX expressions are parsed token-by-token; an `OR` expression passes if any branch is allowed (electing the permissive branch), an `AND` expression requires every branch to be allowed.

Named packages from the raw scan, resolved against this logic:

| Package | Raw license string | Status | Why |
|---|---|---|---|
| `@babel/template@7.29.7` | `MIT` | Compliant | Straightforward MIT; appeared in the flagged list due to a scanner quirk, not an actual license concern. |
| `@img/sharp-libvips-darwin-arm64@1.3.2` | `LGPL-3.0-or-later` | **Approved exception** | Exception 1 in `docs/project/license-exceptions.md` — weak copyleft, pre-built binary dynamically linked (not modified/statically linked), SaaS deployment (no binary distribution to end users). `LGPL-3.0-or-later` is in `EXCEPTION_LICENSES`. |
| `dompurify@3.4.13` | `(MPL-2.0 OR Apache-2.0)` | Compliant (OR resolved) | Dual-licensed; the `Apache-2.0` branch is in `CORE_ALLOWED_LICENSES`, so the check elects that branch per policy. No project code imports DOMPurify directly (this is a transitive dep). |
| `expand-template@2.0.3` | `(MIT OR WTFPL)` | Compliant (OR resolved) | Dual-licensed; `MIT` branch is allowed. |
| `paisaxe@1.6.0` | `UNLICENSED` | Not applicable | This is the project's own root package (`private: true`), never distributed as a dependency. Explicitly skipped by `findDisallowedLicenses` (`if (entry.private) continue`). |
| `simple-concat@1.0.1` | `MIT` | Compliant | Plain MIT; flagged by the raw scanner alongside its sibling `simple-get` for no license-policy reason. |
| `simple-get@4.0.1` | `MIT` | Compliant | Same as above. |

**Dev-only additional flags (non-blocking, build-time only):**

| Package | License | Status |
|---|---|---|
| `lightningcss@1.32.0` + `lightningcss-darwin-arm64@1.32.0` | `MPL-2.0` | **Approved exception** (Exception 3, `docs/project/license-exceptions.md`) — devDependency of `@tailwindcss/postcss`/`vite` build tooling, never shipped to clients. File-level weak copyleft; no modifications made. Not in `EXCEPTION_LICENSES` because `check-production-licenses.ts` only scans `--production` deps — this package is correctly out of scope for the production gate, and its risk is independently documented. |

**Net result: 0 copyleft violations in the shipped application.** All flagged packages are either plain-permissive (misclassified by the raw string scan), correctly-excluded dual-licenses, the project's own private package, or documented exceptions with CI enforcement (`EXCEPTION_LICENSES` in `scripts/check-production-licenses.ts`, cross-referenced against `docs/project/license-exceptions.md`).

## 7. Security Headers Status

All 6 headers confirmed present in source, matching the live-scan output:

| Header | Value | Source | Status |
|---|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | `next.config.ts:65` (prod-only conditional) | Pass |
| `X-Content-Type-Options` | `nosniff` | `next.config.ts:67` | Pass |
| `X-Frame-Options` | `DENY` | `next.config.ts:68` | Pass |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `next.config.ts:69` | Pass |
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` | `next.config.ts:70` | Pass |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | `src/lib/proxy/csp.ts` via `src/proxy.ts:73` | Pass |

CSP specifics verified against this project's PPR-compatibility constraints (CLAUDE.md "CSP and PPR Compatibility"):
- No `'strict-dynamic'` in `script-src` — confirmed by both the live scan output and a dedicated regression test (`src/lib/security-headers.test.ts:56-58`, `expect(scriptSrc).not.toContain("'strict-dynamic'")`). `'strict-dynamic'` would override `'self'` per CSP Level 3 and block all scripts on PPR-prerendered pages, which ship without nonces.
- No nonce-only `script-src` — the policy correctly uses `'self' 'unsafe-inline'`, which works on statically prerendered HTML that lacks nonces.
- `object-src 'none'` and `frame-ancestors 'none'` present, closing off plugin-based and clickjacking vectors.
- `e2e/smoke.spec.ts`'s "CSP canary" test (per CLAUDE.md) provides an E2E backstop if this policy ever regresses to block script execution.

## 8. CI/CD Automation Status

| Control | Status | Detail |
|---|---|---|
| Dependabot | Active | `.github/dependabot.yml` — weekly (Monday) npm + GitHub Actions scans on `develop`. Semver-gated grouping: minor/patch changes group by production vs. dev/types; major bumps (e.g. TypeScript 6→7) always arrive standalone, never silently riding a batch that could break CI. `voyageai` pinned below 0.2.0 (documented ESM/Turbopack incompatibility). |
| Gitleaks | Active | `.github/workflows/security.yml` — `gitleaks` job runs `gitleaks detect --source . --verbose` on push (develop/main), PR, and a daily 08:00 UTC cron (tightened from weekly, cutting CVE/secret detection latency from ~6 days to <24h). |
| npm audit in CI | Active | Same workflow — `npm audit --omit=dev --audit-level=moderate` gates production dependencies at moderate+ severity; a second informational `npm audit || true` step reports the full tree (including dev) without failing the build. |
| License check | Active | `npm run check-licenses` (`scripts/check-production-licenses.ts`) — strict SPDX-exact allowlist, not substring matching. Verified passing this cycle (361/361). |
| Concurrency control | Active | `security.yml` cancels in-progress runs per-ref except on `main`, avoiding redundant scans on rapid pushes while never cancelling a `main`-targeted run. |

No gaps identified. Renovate is not configured, but Dependabot fully covers the same surface (npm + GitHub Actions ecosystems) with equivalent scheduling, so this is not a finding.

## 9. Outdated Packages

9 outdated packages, all minor/patch, no known CVEs against any of them (confirmed via `npm audit` returning 0 vulnerabilities across the full dev+prod tree, which would surface any of these if a CVE existed):

| Package | Current | Latest | Type | Security-relevant? |
|---|---|---|---|---|
| `@anthropic-ai/sdk` | 0.117.1 | 0.120.0 | Production | No CVE; routine SDK update |
| `@elevenlabs/react` | 1.12.0 | 1.13.0 | Production | No CVE; voice SDK minor bump |
| `@testing-library/user-event` | 14.6.4 | 14.6.5 | Dev | No CVE; test-only |
| `@upstash/ratelimit` | 2.0.8 | 2.0.8 | Production | Version string artifact only (`v2.0.8` vs `2.0.8`) — already current, not a real gap |
| `@vitejs/plugin-react` | 6.0.5 | 6.1.0 | Dev | No CVE; build-time only |
| `@vitest/coverage-v8` | 4.1.10 | 4.1.11 | Dev | No CVE; test-only |
| `lucide-react` | 1.31.0 | 1.33.0 | Production | No CVE; icon library, minor bump |
| `posthog-js` | 1.417.0 | 1.418.5 | Production | No CVE currently; this package has previously carried transitive advisories (protobufjs/dompurify, resolved 2026-04-20) — worth prioritizing in the next batch given that history, though nothing outstanding today |
| `typescript` | 6.0.3 | 7.0.2 | Dev | No CVE; major version, intentionally excluded from Dependabot auto-grouping per `dependabot.yml` (peer-range incompatibility with `@typescript-eslint`) — do not batch with the others |

**Recommended batch**: the 7 minor/patch production+dev packages (excluding `typescript`, which needs a standalone migration once the lint toolchain supports TS 7, and `@upstash/ratelimit`, which is already current). All are low-risk, no-CVE routine updates.

---
