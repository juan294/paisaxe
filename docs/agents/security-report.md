# Security Report — 2026-09-10

## 1. Health Status: YELLOW

6 advisories detected, **0 exploitable in this codebase**. All 6 trace to transitive dev-tooling dependencies (ESLint's internal file-system helper, Sentry's webpack plugin chain, PostHog's bundled compressor) — none sit on a path that receives attacker-controlled input in this application. This is the same pattern as the Apr 17 and Apr 25 YELLOW cycles: real advisories, no live attack surface. All 6 are cleanly fixable via `npm audit fix` with no breaking changes (no major version bumps required for the top-level resolution).

## 2. Executive Summary

6 advisories detected (3 high, 3 moderate, 0 critical), **0 exploitable**. Every flagged package is a transitive dependency of build/lint tooling (`eslint`, `@sentry/nextjs`'s bundled `@sentry/webpack-plugin`) or of `posthog-js`'s internal gzip/zip codec (`fflate`) — none are direct production dependencies, and none process attacker-supplied data in a way this app exposes externally. `npm audit fix` resolves all 6 with no major-version jumps at the top level (`js-yaml` and `fflate` do jump to new majors as transitive deps, but neither is a direct dependency, so no application code changes are needed). License compliance: no new copyleft violations — the 7 previously-approved flagged packages are unchanged. Security headers, CSP, and CI/CD security automation are all unchanged and correctly configured.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA) | Attack Vector | Fixable | Risk Assessment |
|---|---|---|---|---|---|
| High | `browserslist` (<=4.28.6, resolved 4.28.1) | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) (unbounded memory growth, no cache eviction) | Attacker would need to feed the process a large number of distinct browserslist queries at runtime to exhaust memory | Yes — `npm audit fix` → 4.28.7+ | **Not exploitable.** Only reached via `@sentry/webpack-plugin` -> `webpack` at build time. No runtime path; queries are fixed, not attacker-supplied. |
| High | `browserslist` (same version) | [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) (crash/prototype write via untrusted `browserslist-stats.json`) | Requires a malicious custom `browserslist-stats.json` consumed by the app | Yes — same fix | **Not exploitable.** This repo has no `browserslist-stats.json`; the vector requires deliberately opting into custom stats, which we don't. |
| High | `fast-uri` (4.0.0–4.1.2, resolved 4.1.2) | [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8), [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc), [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf), [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) (host confusion / SSRF via malformed URI normalization) | Requires passing an attacker-controlled URI through `fast-uri`'s parse/normalize functions, which then feeds an outbound request or auth decision | Yes — `npm audit fix` → 4.1.3+ (the existing `overrides.fast-uri: ">=3.1.5"` is too permissive — it's satisfied by the vulnerable 4.1.2) | **Not exploitable.** Only reached via `ajv`/`ajv-formats` inside `@sentry/webpack-plugin` -> `webpack`'s `schema-utils`, validating webpack config schemas at build time — no user input reaches it. |
| Moderate | `js-yaml` (4.0.0–4.3.1, resolved 4.3.1) | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) (`maxTotalMergeKeys` doesn't limit CPU on empty merge sources) | Requires parsing attacker-controlled YAML with crafted merge keys | Yes — `npm audit fix` (top-level fix lands at 4.3.2, a patch; npm's resolver may also offer 5.x since `eslint`'s dependency range is unpinned above 4.3.1) | **Not exploitable.** Only reached via `eslint` -> `@eslint/eslintrc`, parsing the repo's own `.eslintrc`-style config at lint time — not reachable from any runtime/user-facing path. |
| Moderate | `fflate` (0.4.5–0.4.8, resolved 0.4.8) | [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98) (`unzipSync` infinite loop on malformed ZIP64) | Requires passing a malformed ZIP64 archive to `fflate.unzipSync` | Yes — `npm audit fix` → 0.7.x (transitive major bump, no direct dependency) | **Not exploitable.** `fflate` is bundled inside `posthog-js` for its own session-recording/network-payload compression; grep confirms no application code in `src/` calls `fflate` directly or accepts arbitrary ZIP uploads. |
| Moderate | `@humanfs/node` (<0.16.8, resolved 0.16.7) | [GHSA-p498-v437-472g](https://github.com/advisories/GHSA-p498-v437-472g) (recursive copy follows symlinks, copies data outside source tree) | Requires calling `humanfs`'s recursive-copy API on an attacker-controlled directory tree containing symlinks | Yes — `npm audit fix` → 0.16.8 | **Not exploitable.** Only reached via `eslint`'s internal file-system abstraction at lint time on this repo's own source tree — no untrusted directory tree is ever copied. |

CVE cross-reference: none of these 6 GHSA advisories have a published CVE ID as of this scan (checked each advisory page — all show "GHSA only, no CVE assigned" or CVE pending). This is common for advisories affecting build-tooling-only packages, which OSV/NVD deprioritize.

## 4. Detailed Exploitability Analysis (High/Critical)

No critical advisories this cycle. For the 3 high-severity advisories:

- **browserslist (GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g):** Dependency chain confirmed via `npm ls browserslist`: `@sentry/nextjs` -> `@sentry/webpack-plugin` -> `webpack` -> `browserslist`, and separately `eslint-plugin-react-hooks` -> `@babel/core` -> `@babel/helper-compilation-targets` -> `browserslist`. Both paths are build-time only (webpack bundling, Babel transform target resolution during lint/build). Browserslist never runs in the deployed Vercel runtime or in any API route.
- **fast-uri (GHSA-5jgf-p345-68v8 and 3 related):** Chain confirmed: `@sentry/nextjs` -> `@sentry/webpack-plugin` -> `webpack` -> `schema-utils` -> `ajv`/`ajv-formats` -> `fast-uri`. This validates webpack's own configuration schema against JSON Schema at build time. The project's existing `overrides.fast-uri: ">=3.1.5"` in `package.json:152` was intended to pin a safe floor but is satisfied by the vulnerable 4.1.2 — the override needs tightening to `>=4.1.3` (see remediation).
- **js-yaml (GHSA-2883-xcg3-v3hh):** Chain confirmed: `eslint` -> `@eslint/eslintrc` -> `js-yaml`. Parses only this repository's own lint config files during `npm run lint` / CI. No externally-supplied YAML is ever parsed by this dependency in the deployed app.

## 5. Prioritized Remediation Steps

1. **Tighten the `fast-uri` override** — the current `">=3.1.5"` floor in `package.json:152` does not exclude the vulnerable 4.0.0–4.1.2 range. Update to:
   ```json
   "fast-uri": ">=4.1.3"
   ```
   then run `npm install` to re-resolve.
2. **Run the standard fix for the rest:**
   ```bash
   npm audit fix
   ```
   This should resolve `browserslist` (->4.28.7+), `baseline-browser-mapping` (->2.11.x), `fflate` (->0.7.x, transitive major bump inside `posthog-js`'s own `package.json` range — no code change needed), `js-yaml` (->4.3.2 or newer, transitive to `eslint`), and `@humanfs/node` (->0.16.8).
3. **Verify no regressions:** run `npm run typecheck && npm run lint && npm run test` and a fresh `npm run build` after the fix, since Sentry's webpack-plugin chain and ESLint's config-loading chain are both touched (build- and lint-time only, so risk is low, but this project's Apr 17/Aug 30 triage history shows build-tooling bumps have occasionally broken vitest — verify before merging).
4. **Re-run `npm audit`** to confirm 0 remaining advisories, then commit the `package.json`/`package-lock.json` diff as a single dependency-hygiene commit.

None of these require code changes in `src/` — this is a pure lockfile/override update.

## 6. License Compliance

**No new copyleft violations.** Copyleft license scan for production dependencies: **false** (no GPL/AGPL found). All previously-flagged and approved packages are unchanged from the last cycle:

| Package | License | Scope | Status |
|---|---|---|---|
| `@img/sharp-libvips-darwin-arm64@1.3.3` | LGPL-3.0-or-later | Production (native binary, dynamically linked) | Approved — see `docs/project/license-exceptions.md` |
| `dompurify@3.4.13` | (MPL-2.0 OR Apache-2.0) | Production (dual-licensed, Apache-2.0 option applies) | Approved |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Production (dual-licensed, MIT option applies) | Not a real flag — MIT is available |
| `simple-concat@1.0.1` / `simple-get@4.0.1` | MIT | Production | Not a real flag — scanner false-positive, both are plain MIT |
| `@babel/template@7.29.7` | MIT | Production | Not a real flag — plain MIT |
| `paisaxe@1.6.0` | UNLICENSED | This repo itself | Expected — private application, not published |
| `lightningcss@1.32.0` / `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Dev/build only (Tailwind CSS toolchain) | Approved, non-blocking (dev-only) |

No action needed — this list is identical in substance to the Apr 20/25 cycles.

## 7. Security Headers Status

All headers confirmed present and correctly configured:

| Header | Value | Status |
|---|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com https://checkout.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass — correctly avoids `'strict-dynamic'` and nonce-only policies per this project's PPR/`cacheComponents` constraint (documented in CLAUDE.md) |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — microphone scoped to same-origin only, consistent with the Pelayo voice-agent use case |

No gaps. Headers are duplicated identically across both header-emitting paths in the scan output, consistent with `next.config.ts` + `src/proxy.ts` both setting them (expected, not a misconfiguration).

## 8. CI/CD Security Automation Status

| Control | Status |
|---|---|
| Dependabot | Configured (pinned to `develop`, per prior triage) |
| Renovate | Not configured (Dependabot covers this; no gap) |
| Gitleaks (secret scanning in CI) | Configured |
| `npm audit` in CI | Configured |
| GitHub Advanced Security (CodeQL / native secret scanning) | Disabled (403/404 on API) — carried finding, a billing decision for the user, not re-flagged as new this cycle |

No new CI/CD gaps. The GHAS/CodeQL gap remains open as a standing owner decision per the Aug 18/24 triage notes — not re-escalating without new information.

## 9. Outdated Packages With Security Implications

Of the 29 outdated packages, none currently carry an open advisory — all are routine minor/patch drift:

- **Priority (touch security-relevant surfaces):** `@sentry/core`/`@sentry/nextjs` (10.71.0 -> 10.74.0, error-reporting pipeline), `@supabase/supabase-js`/`@supabase/ssr` (auth/session handling), `stripe`/`@stripe/react-stripe-js` (payments). All are patch/minor bumps with no CVEs.
- **Caution:** `@sentry/core`/`@sentry/nextjs` — the Aug 30 triage found a *different* Sentry minor bump (10.70->10.72) broke 17 vitest tests via a new `@sentry/server-utils` orchestrion bundler path (`ERR_INVALID_URL_SCHEME`). Bisect this specific bump in isolation before batching it with the other 27 packages.
- **No action required for:** `typescript` 6.0.3 -> 7.0.2 is a major version jump — defer to a dedicated dependency-upgrade cycle (per `/upgrade-deps`), not this security pass.
- All other outdated packages (`zod`, `react`, `next`, `knip`, `posthog-js`, etc.) are minor/patch with no known vulnerabilities.

---
