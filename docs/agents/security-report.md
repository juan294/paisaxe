# Security Report — 2026-07-08

## 1. Health Status: GREEN

Zero vulnerability advisories, zero exploitable issues, zero copyleft license violations in either the production or dev/build trees, all security headers verified live and in source, CI/CD security automation fully active. The one open GitHub Dependabot alert (#73, @babel/core, LOW) is already patched in both the lockfile and the installed tree — it is a stale alert awaiting GitHub's rescan, not an actionable vulnerability.

## 2. Executive Summary

**0 advisories detected, 0 exploitable.** `npm audit` reports zero vulnerabilities across the full dependency tree (Critical: 0, High: 0, Moderate: 0, Low: 0). Nothing to triage, nothing to fix, no exploitability analysis required this cycle.

Two items of note, neither a vulnerability:

1. **GitHub Dependabot alert #73 remains open but is already resolved.** GHSA-4x5r-pxfx-6jf8 / CVE-2026-49356 (@babel/core, LOW, runtime scope) is patched at >=7.29.6; both the lockfile and the installed node_modules hold 7.29.7. The alert was expected to auto-close after PRs #717/#718 merged and triggered a rescan — the rescan has not happened yet. No action needed; verify closure next cycle.
2. **Local node_modules is stale relative to the lockfile.** Dependabot PRs #717 (22 production updates) and #718 (4 dev-and-types updates) merged and updated `package-lock.json` (e.g. @anthropic-ai/sdk 0.110.0, next 16.2.10, posthog-js 1.396.7), but node_modules still holds the pre-batch versions (0.106.0, 16.2.9, 1.395.0). This inflates `npm outdated` to 29 entries, most of which are already resolved on paper. One `npm install` syncs the local tree. `npm audit` runs against the lockfile, so the 0-advisory result reflects the post-batch (correct) state.

License compliance is fully clean this cycle: the previously outstanding `@sentry/cli` FSL-1.1-MIT item was recorded as Exception 4 in `license-exceptions.md` (added 2026-07-08 by triage). There are no open license items.

Tooling note: the metrics script reported "OUTDATED PACKAGES: 1" followed by "0" — the actual count from `npm outdated` is 29. The extraction logic in `scripts/security-agent.sh` miscounts, similar to the QA metrics-parser bug fixed recently. Low priority, but worth fixing so future reports don't depend on the agent re-running the command.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|-----------------------|---------------|---------|-----------------|
| — | — | None found | — | — | `npm audit` returned 0 vulnerabilities across the full tree |
| Low (stale alert) | @babel/core | GHSA-4x5r-pxfx-6jf8 / CVE-2026-49356 | Inefficient RegExp complexity in generated code paths; requires attacker-influenced transpilation input, which does not exist here (build-time transpilation of our own source only) | Already fixed | Lockfile and installed tree both at 7.29.7 (>= patched 7.29.6). GitHub alert #73 open pending rescan. NOT EXPLOITABLE and already remediated |

## 4. Detailed Exploitability Analysis

Not applicable this cycle — no open advisories in `npm audit`. The only residual item is GitHub alert #73 (@babel/core), analyzed above: it is a build-time dependency processing only our own trusted source code, the patched version is installed, and the alert persists solely because GitHub has not rescanned the manifest since the fix landed (first confirmed patched 2026-07-01).

For historical reference, the last real advisories (7 undici advisories) were cleared 2026-06-24 via Dependabot PR #707.

## 5. Prioritized Remediation Steps

1. **No security-critical remediation required.** There are no vulnerabilities to fix.
2. **Sync local node_modules with the merged lockfile** (hygiene, not security): `npm install` in the project root. This clears roughly 26 of the 29 `npm outdated` entries, which are already resolved in `package-lock.json` by PRs #717/#718. Until this runs, any local build/test uses pre-batch dependency versions.
3. **Verify Dependabot alert #73 auto-closes** after GitHub's next dependency-graph rescan (lockfile is already patched). If it is still open in the next cycle, force a rescan by pushing any lockfile-touching commit, or dismiss the alert with reason "fixed" via `gh api -X PATCH repos/{owner}/{repo}/dependabot/alerts/73 -f state=dismissed -f dismissed_reason=fix_started`.
4. Optional freshness (zero CVEs, batchable in Dependabot's next weekly PR): posthog-js 1.396.7 -> 1.398.2, @supabase/supabase-js 2.110.0 -> 2.110.1, @sentry/core + @sentry/nextjs 10.63.x -> 10.64.0 — small drift accumulated since PRs #717/#718 were opened.
5. **Fix the metrics-script outdated-count extraction** in `scripts/security-agent.sh` (reported 1/0 vs actual 29). Batch with the QA metrics-parser fix pattern.

## 6. License Compliance

**No copyleft violations.** Production scan: false. Dev/build scan: false. All previously outstanding items are now closed — `license-exceptions.md` gained Exception 4 (@sentry/cli) on 2026-07-08.

Flagged packages — production tree:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` / `@1.3.1` | LGPL-3.0-or-later | Approved — Exception 1 in `license-exceptions.md`. Pre-built native binary, dynamically linked via `sharp`, unmodified; SaaS deployment carries no LGPL distribution obligation |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | Dual-licensed, Apache-2.0 branch elected. Documented in the "Dual-licensed dependencies" section |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed, MIT branch elected. Build-time only (`canvas` -> `prebuild-install`); documented |
| `paisaxe@1.6.0` | UNLICENSED | The project's own `package.json` — expected, not a third-party dependency |
| `@babel/template@7.29.7`, `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT | Appear in the flagged raw output but their declared license is MIT — scanner false positives, no action |

Additional flagged packages — dev/build tree only:

| Package | License | Status |
|---------|---------|--------|
| `lightningcss@1.32.0` / `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Approved — Exception 3. Tailwind CSS v4 / Vite build tooling, never bundled into shipped client code |
| `@sentry/cli@2.58.5` / `@sentry/cli-darwin@2.58.5` | FSL-1.1-MIT | Approved — Exception 4, recorded 2026-07-08. Build-time source-map upload tool; FSL restriction (no competing service) does not apply; converts to MIT two years post-release. **Previously outstanding item, now closed** |
| `BlueOak-1.0.0` (5 packages), `CC-BY-4.0` (1), `Unlicense` (1), `MIT-0` (1), `0BSD` (1) | Permissive | All permissive or public-domain-equivalent; compliant with policy, no exception needed |

## 7. Security Headers Status

All headers verified in the live header scan (identical values across both probed routes, no drift) and confirmed present in source (`next.config.ts:65-68` for static headers, `src/proxy.ts:71` + `src/lib/proxy/csp.ts` for CSP, with `src/lib/security-headers.test.ts` guarding the configuration).

| Header | Value | Status |
|--------|-------|--------|
| `content-security-policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass — deliberately avoids `'strict-dynamic'` and nonce-only patterns per the PPR/`cacheComponents` incompatibility documented in CLAUDE.md; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` all locked down; connect-src scoped to Supabase, ElevenLabs, Stripe, and Vercel telemetry only |
| `strict-transport-security` | `max-age=63072000; includeSubDomains; preload` | Pass — 2-year max-age, subdomains covered, preload-eligible; production-only per source |
| `x-frame-options` | `DENY` | Pass — belt-and-suspenders with `frame-ancestors 'none'` |
| `x-content-type-options` | `nosniff` | Pass |
| `referrer-policy` | `strict-origin-when-cross-origin` | Pass |
| `permissions-policy` | `camera=(), geolocation=(), microphone=(self)` | Pass — camera/geolocation fully disabled, microphone scoped to same-origin only (required for Pelayo voice) |

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | Weekly npm + GitHub Actions updates, pinned to `develop`, grouped production vs dev-and-types. PRs #717/#718 merged this week (26 packages total). `voyageai` pinned below 0.2.0 (documented ESM/Turbopack incompatibility) |
| Gitleaks | Active | `.github/workflows/security.yml` — secret scanning on push/PR to `develop`/`main` plus daily scheduled run |
| npm audit in CI | Active | `npm audit --omit=dev --audit-level=moderate` gates production deps; informational full-tree step reports dev advisories without blocking |
| License check | Active | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on production deps, warns non-blocking on weak copyleft and dev deps, matching the documented exception policy |
| Renovate | Not configured | Intentional — Dependabot fills this role; no gap |
| GitHub native code/secret scanning | Unavailable | Requires GitHub Advanced Security add-on on this private repo — owner cost decision, not code-actionable. Gitleaks provides equivalent secret-scanning coverage |

No CI/CD security automation gaps this cycle.

## 9. Outdated Packages with Security Implications

`npm outdated` lists 29 packages, but this overstates the real gap: **node_modules is stale relative to the post-#717/#718 lockfile.** The lockfile already resolves most entries (verified directly: @anthropic-ai/sdk 0.110.0, posthog-js 1.396.7, next 16.2.10, @supabase/supabase-js 2.110.0). **Zero attached CVEs or security advisories** on any entry.

| Package | Installed | Lockfile | Latest | Notes |
|---------|-----------|----------|--------|-------|
| `@anthropic-ai/sdk` | 0.106.0 | 0.110.0 | 0.110.0 | Resolved by #717; needs local `npm install` only |
| `next` | 16.2.9 | 16.2.10 | 16.2.10 | Resolved by #717; needs local `npm install` only |
| `posthog-js` | 1.395.0 | 1.396.7 | 1.398.2 | Mostly resolved by #717; small drift since PR opened |
| `@supabase/supabase-js` | 2.108.2 | 2.110.0 | 2.110.1 | Mostly resolved by #717; one patch of drift |
| `@sentry/core` / `@sentry/nextjs` | 10.62.0 | 10.63.x | 10.64.0 | Patch drift since batch |
| `sharp`, `resend`, Stripe SDKs, Radix UI x4, `lucide-react`, `@elevenlabs/react`, `postcss`, `tailwindcss` | various | resolved/near | patch-level | Production, all patch/minor, no advisories |
| Dev tooling: `@types/node`, `@typescript-eslint/eslint-plugin`, `@vitest/*`, `knip`, `tsx`, `vitest`, `@next/*` dev plugins | various | resolved/near | patch/minor | Dev-only, no production exposure |
| `jsdom` (29.1.1) / `vitest` (4.1.9) | ahead of latest tag | — | 27.0.1 / 3.2.7 | Installed versions are AHEAD of the registry `latest` dist-tag (next-major channel) — expected, not a gap |
| `eslint` | 9.39.4 | 9.39.4 | — | No longer flagged by `npm outdated` this cycle (was 10.6.0 major last cycle). The v10 major remains a deliberate dev-tooling upgrade item, not a security one |

**Recommendation**: `npm install` to sync the local tree (step 2 above); let Dependabot's next weekly grouped PR absorb the small post-batch drift. Keep `voyageai` pinned at 0.1.0 per the documented incompatibility.

---
