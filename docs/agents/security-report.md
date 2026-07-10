# Security Report — 2026-07-09

## 1. Health Status: GREEN

Zero vulnerability advisories in `npm audit`, zero exploitable issues, zero copyleft license violations in either the production or dev/build trees, all security headers verified live and in source, CI/CD security automation fully active. The one open GitHub Dependabot alert (#73, @babel/core, LOW) is patched on `develop` but — new finding this cycle — remains accurately open because alerts are computed from the default branch (`main`), whose lockfile still resolves the vulnerable 7.29.0. It is not exploitable and will close on the next production release.

## 2. Executive Summary

**0 advisories detected, 0 exploitable.** `npm audit` reports zero vulnerabilities across the full dependency tree (Critical: 0, High: 0, Moderate: 0, Low: 0). Nothing to triage, nothing to fix, no exploitability analysis required this cycle.

**Root cause identified for the persistent Dependabot alert #73 (@babel/core, GHSA-4x5r-pxfx-6jf8 / CVE-2026-49356, LOW).** The last two cycles treated this as a stale alert awaiting GitHub's rescan. That theory was wrong. Verified this cycle:

- Vulnerable range: `<= 7.29.0`; first patched version: `7.29.6`.
- `develop` lockfile and local installed tree: `7.29.7` — patched since 2026-07-01.
- `origin/main` lockfile: `7.29.0` — still inside the vulnerable range.
- Dependabot computes alerts from the **default branch** (`main`). The alert is therefore accurate for the production manifest and will never auto-close from activity on `develop`.

The alert is NOT exploitable on either branch: @babel/core is a transitive build-time dependency (the advisory concerns inefficient RegExp complexity in code-generation paths) and the only transpilation input is Paisaxe's own trusted source — there is no attacker-influenced input path. Do NOT dismiss the alert: it is factually correct about `main` and will resolve itself the next time a release PR merges `develop` into `main`. No off-cycle release is warranted for a non-exploitable LOW; it simply rides along with the next normal release.

The stale-local-node_modules item from the Jul 8 report is closed: the installed tree now matches the post-#717/#718 lockfile (also independently confirmed by the Performance Agent on Jul 8). `npm outdated` is down from 29 entries to 17, all patch/minor drift with zero attached advisories.

License compliance is fully clean: every flagged package is either a documented exception, a dual-license with a permissive branch elected, a scanner false positive, or the project's own UNLICENSED root package.

Tooling note (carried from Jul 8): the metrics script's outdated-count extraction still emits a stray "0" line after the count ("OUTDATED PACKAGES: 17" followed by "0"). The count itself was correct this cycle, so this is cosmetic — but the extraction logic in `scripts/security-agent.sh` remains worth a cleanup pass.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|-----------------------|---------------|---------|-----------------|
| — | — | None found | — | — | `npm audit` returned 0 vulnerabilities across the full tree |
| Low (open GitHub alert, default-branch only) | @babel/core 7.29.0 (on `main`) | GHSA-4x5r-pxfx-6jf8 / CVE-2026-49356 | Inefficient RegExp complexity in code-generation paths; requires attacker-influenced transpilation input, which does not exist here (build-time transpilation of our own source only) | Fixed on `develop` (7.29.7); `main` resolves on next release | NOT EXPLOITABLE on either branch. Alert #73 stays open until a develop -> main release PR merges — this is expected and correct behavior, not a stale alert |

## 4. Detailed Exploitability Analysis

Not applicable this cycle — no open advisories in `npm audit`.

Residual item, GitHub alert #73 (@babel/core, LOW): the vulnerability is a regular-expression complexity issue exercised during Babel's code generation. Exploitation requires the attacker to control the source being transpiled. In this project @babel/core is a transitive dev/build-chain dependency; the only inputs it ever processes are Paisaxe's own committed source files at build time, on CI or Vercel build machines. No user-supplied content reaches a Babel transform at any point. Not exploitable in development, CI, or the production build pipeline. The only reason the alert is open is that the default branch (`main`) has not received the patched lockfile yet — a release-cadence artifact, not a security gap.

For historical reference, the last real advisories (7 undici advisories) were cleared 2026-06-24 via Dependabot PR #707.

## 5. Prioritized Remediation Steps

1. **No security-critical remediation required.** There are no vulnerabilities to fix.
2. **Alert #73 closes with the next production release.** No dedicated action needed; when the user next requests a develop -> main release, the patched lockfile lands on the default branch and GitHub auto-resolves the alert. Do not dismiss it manually — it is accurate for `main` — and do not create a release for it (non-exploitable LOW does not justify an off-cycle production deploy).
3. Optional freshness (zero CVEs, all patch/minor, batchable in Dependabot's next weekly PR): posthog-js 1.396.7 -> 1.399.0, @sentry/core + @sentry/nextjs 10.63.0 -> 10.64.0, @supabase/supabase-js 2.110.0 -> 2.110.1, @elevenlabs/react 1.9.0 -> 1.9.1, plus 9 other one-step bumps. No urgency.
4. **Cosmetic**: fix the stray "0" line in the outdated-count extraction in `scripts/security-agent.sh` (count was otherwise correct this cycle).

## 6. License Compliance

**No copyleft violations.** Production scan: false. Dev/build scan: false. No open license items — the @sentry/cli FSL-1.1-MIT exception was recorded as Exception 4 on 2026-07-08.

Flagged packages — production tree:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` / `@1.3.2` | LGPL-3.0-or-later | Approved — Exception 1 in `license-exceptions.md` (covers platform variants; 1.3.1 -> 1.3.2 version drift is immaterial). Pre-built native binary, dynamically linked via `sharp`, unmodified; SaaS deployment carries no LGPL distribution obligation |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | Dual-licensed, Apache-2.0 branch elected. Documented in the "Dual-licensed dependencies" section of `license-exceptions.md` |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed, MIT branch elected. Build-time only (`canvas` -> `prebuild-install`); documented |
| `paisaxe@1.6.0` | UNLICENSED | The project's own `package.json` — expected, not a third-party dependency |
| `@babel/template@7.29.7`, `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT | Appear in the flagged raw output but their declared license is MIT — scanner false positives, no action |

Additional flagged packages — dev/build tree only:

| Package | License | Status |
|---------|---------|--------|
| `lightningcss@1.32.0` / `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Approved — Exception 3. Tailwind CSS v4 / Vite build tooling, never bundled into shipped client code |
| `@sentry/cli` / `@sentry/cli-darwin` | FSL-1.1-MIT | Approved — Exception 4 (recorded 2026-07-08). Build-time source-map upload tool; not flagged in this cycle's MPL/LGPL/GPL/UNLICENSED filter but noted for completeness |
| `BlueOak-1.0.0` (5 packages), `CC-BY-4.0` (1), `Unlicense` (1), `MIT-0` (1), `0BSD` (1), `FSL-1.1-MIT` (2) | Permissive / source-available | All permissive, public-domain-equivalent, or covered by Exception 4; compliant with policy |

## 7. Security Headers Status

All headers verified in the live header scan (identical values across both probed routes, no drift) and previously confirmed in source (`next.config.ts` for static headers, `src/proxy.ts` + `src/lib/proxy/csp.ts` for CSP, guarded by `src/lib/security-headers.test.ts`).

| Header | Value | Status |
|--------|-------|--------|
| `content-security-policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass — deliberately avoids `'strict-dynamic'` and nonce-only patterns per the PPR/`cacheComponents` incompatibility documented in CLAUDE.md; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` all locked down; connect-src scoped to Supabase, ElevenLabs, Stripe, and Vercel telemetry only |
| `strict-transport-security` | `max-age=63072000; includeSubDomains; preload` | Pass — 2-year max-age, subdomains covered, preload-eligible |
| `x-frame-options` | `DENY` | Pass — belt-and-suspenders with `frame-ancestors 'none'` |
| `x-content-type-options` | `nosniff` | Pass |
| `referrer-policy` | `strict-origin-when-cross-origin` | Pass |
| `permissions-policy` | `camera=(), geolocation=(), microphone=(self)` | Pass — camera/geolocation fully disabled, microphone scoped to same-origin only (required for Pelayo voice) |

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | Weekly npm + GitHub Actions updates, pinned to `develop`, grouped production vs dev-and-types. PRs #717/#718 (26 packages) merged and locally synced. `voyageai` pinned below 0.2.0 (documented ESM/Turbopack incompatibility) |
| Gitleaks | Active | `.github/workflows/security.yml` — secret scanning on push/PR to `develop`/`main` plus daily scheduled run |
| npm audit in CI | Active | `npm audit --omit=dev --audit-level=moderate` gates production deps; informational full-tree step reports dev advisories without blocking |
| License check | Active | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on production deps, warns non-blocking on weak copyleft and dev deps, matching the documented exception policy |
| Renovate | Not configured | Intentional — Dependabot fills this role; no gap |
| GitHub native code/secret scanning | Unavailable | Requires GitHub Advanced Security add-on on this private repo — owner cost decision, not code-actionable. Gitleaks provides equivalent secret-scanning coverage |

No CI/CD security automation gaps this cycle.

**Process finding worth institutionalizing**: Dependabot alerts key off the default branch (`main`). Because this project develops on `develop` and releases to `main` on a slower cadence, every vulnerability fixed on `develop` will keep its GitHub alert open until the next production release. Future cycles should verify the fix in the `develop` lockfile (authoritative for remediation status) and treat lingering open alerts whose `develop` lockfile is patched as release-cadence artifacts, not failures.

## 9. Outdated Packages with Security Implications

`npm outdated` lists 17 packages. **Zero attached CVEs or security advisories on any entry.** The Jul 8 stale-node_modules condition is resolved — installed versions now match the lockfile, so every entry below is genuine upstream drift, all one patch or minor step.

| Package | Current | Latest | Scope | Notes |
|---------|---------|--------|-------|-------|
| `posthog-js` | 1.396.7 | 1.399.0 | Production | Minor; analytics, deferred chunk; no advisories |
| `@sentry/core` / `@sentry/nextjs` | 10.63.0 | 10.64.0 | Production | Patch-level; error tracking |
| `@supabase/supabase-js` | 2.110.0 | 2.110.1 | Production | One patch |
| `@elevenlabs/react` | 1.9.0 | 1.9.1 | Production | One patch; chunk fully deferred (click-to-mount) |
| `@radix-ui/react-dialog` / `-select` / `-tooltip` | 1.1.18 / 2.3.2 / 1.2.11 | 1.1.19 / 2.3.3 / 1.2.12 | Production | One patch each |
| `resend` | 6.17.1 | 6.17.2 | Production | One patch |
| `postcss` | 8.5.15 | 8.5.16 | Build | One patch |
| `@types/node`, `@typescript-eslint/eslint-plugin`, `@vitest/eslint-plugin`, `knip` | various | one step | Dev-only | No production exposure |
| `typescript` | 6.0.3 | 7.0.2 | Dev-only | New major available; deliberate dev-tooling upgrade item, not a security one |
| `jsdom` (29.1.1) / `vitest` (4.1.10) | ahead of `latest` tag | 27.0.1 / 3.2.7 | Dev-only | Installed versions are AHEAD of the registry `latest` dist-tag (next-major channel) — expected, not a gap |

**Recommendation**: let Dependabot's next weekly grouped PR absorb the drift — nothing here justifies a manual bump. Keep `voyageai` pinned at 0.1.0 per the documented incompatibility.

---
