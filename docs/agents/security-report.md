# Security Report — 2026-07-07

## 1. Health Status: GREEN

Zero vulnerability advisories, zero exploitable issues, zero copyleft license violations in the production tree, all security headers configured, CI/CD security automation fully active. GREEN streak continues (unbroken since 2026-04-25's YELLOW was resolved; last advisories cleared via PR #707 on 2026-06-24).

## 2. Executive Summary

**0 advisories detected, 0 exploitable.** `npm audit` reports zero vulnerabilities across the full dependency tree (production and dev). There is nothing to triage, nothing to fix, and no exploitability analysis required this cycle.

License compliance is clean: `COPYLEFT LICENSES FOUND` is false for both production and dev/build trees. All flagged packages are either documented exceptions (`@img/sharp-libvips-*` LGPL, `lightningcss` MPL-2.0), dual-licensed with a permissive branch elected (`dompurify`, `expand-template`), the project's own UNLICENSED `package.json`, or scanner false positives (three MIT packages). The only open license item remains the `@sentry/cli` FSL-1.1-MIT entry (dev-only), pending owner sign-off in `license-exceptions.md` — a policy acknowledgment, not a violation.

28 packages are outdated. 27 are minor/patch bumps with no attached CVEs. One is new this cycle: `eslint` now has a major available (9.39.4 -> 10.6.0, dev-only, no advisory) — a deliberate-upgrade item, not a security one.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|-----------------------|---------------|---------|-----------------|
| — | — | None found | — | — | `npm audit` returned 0 vulnerabilities (Critical: 0, High: 0, Moderate: 0, Low: 0) |

## 4. Detailed Exploitability Analysis

Not applicable this cycle — no advisories of any severity are open. For historical reference, the last open advisories (7 undici advisories including GHSA-vxpw-j846-p89q, GHSA-vmh5-mc38-953g, GHSA-hm92-r4w5-c3mj) were cleared 2026-06-24 via Dependabot PR #707 (undici 7.28.0), and @babel/core GHSA-4x5r-pxfx-6jf8 was confirmed resolved in the lockfile (7.29.7 >= patched 7.29.6) on 2026-07-01.

## 5. Prioritized Remediation Steps

1. **No security-critical remediation required this cycle.** There are no vulnerabilities to fix.
2. Optional freshness maintenance (batchable via Dependabot's weekly grouped PR, zero CVEs involved):
   - `npm install @anthropic-ai/sdk@latest posthog-js@latest @supabase/supabase-js@latest` — closes the three largest production gaps (0.106.0 -> 0.110.0, 1.395.0 -> 1.398.0, 2.108.2 -> 2.110.0).
   - `npm update` covers the remaining wanted-range bumps (Next.js 16.2.10 patch, sharp 0.35.3, resend 6.17.1, Stripe/Sentry/Radix/Tailwind patches, Vitest/knip/tsx dev tooling).
3. `eslint` 10 major upgrade (dev-only): defer to a deliberate dev-tooling upgrade cycle alongside the other pending dev majors. No security urgency.
4. Record the `@sentry/cli` / `@sentry/cli-darwin` (both 2.58.5, FSL-1.1-MIT, dev-only) exception in `docs/project/license-exceptions.md`, or explicitly decline. Open since 2026-07-03; requires owner sign-off per the exceptions-file policy. Not a blocker.

## 6. License Compliance

**No copyleft violations.** Production scan: false. Dev/build scan: false.

Flagged packages — production tree:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` / `@1.3.1` | LGPL-3.0-or-later | Approved — `license-exceptions.md` Exception 1. Pre-built native binary, dynamically linked via `sharp`, unmodified; SaaS deployment carries no LGPL distribution obligation |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | Dual-licensed, Apache-2.0 branch elected. Documented in `license-exceptions.md` "Dual-licensed dependencies" section |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed, MIT branch elected. Documented in `license-exceptions.md`; build-time only (`canvas` -> `prebuild-install`) |
| `paisaxe@1.6.0` | UNLICENSED | The project's own `package.json` — expected, not a third-party dependency |
| `@babel/template@7.29.7`, `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT | Appear in the flagged raw output but their declared license is MIT — scanner false positives, no action |

Additional flagged packages — dev/build tree only:

| Package | License | Status |
|---------|---------|--------|
| `lightningcss@1.32.0` / `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Approved — `license-exceptions.md` Exception 3. Tailwind CSS v4 / Vite build tooling, never bundled into shipped client code |

Outstanding: `@sentry/cli@2.58.5` and `@sentry/cli-darwin@2.58.5` (FSL-1.1-MIT, dev-only — these are the two FSL-1.1-MIT entries in the license summary) are not yet recorded in `license-exceptions.md`. FSL-1.1-MIT converts to MIT two years after each release and applies restrictions only to offering the software itself as a competing service, which Paisaxe does not do. Recording it is an owner license-policy acceptance, not a compliance failure.

## 7. Security Headers Status

All headers verified in the live header scan; values identical across both probed routes (no drift).

| Header | Value | Status |
|--------|-------|--------|
| `content-security-policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass — deliberately avoids `'strict-dynamic'` and nonce-only patterns per the PPR/`cacheComponents` incompatibility documented in CLAUDE.md; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` all correctly locked down |
| `strict-transport-security` | `max-age=63072000; includeSubDomains; preload` | Pass — 2-year max-age, subdomains covered, preload-eligible |
| `x-frame-options` | `DENY` | Pass — belt-and-suspenders with `frame-ancestors 'none'` |
| `x-content-type-options` | `nosniff` | Pass |
| `referrer-policy` | `strict-origin-when-cross-origin` | Pass |
| `permissions-policy` | `camera=(), geolocation=(), microphone=(self)` | Pass — camera/geolocation fully disabled, microphone scoped to same-origin only (required for Pelayo voice) |

## 8. CI/CD Security Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — weekly npm + GitHub Actions updates, pinned to `develop`, grouped production vs dev-and-types, `voyageai` pinned below 0.2.0 (documented ESM/Turbopack incompatibility) |
| Gitleaks | Active | `.github/workflows/security.yml` — secret scanning on push/PR to `develop`/`main` plus daily scheduled run |
| npm audit in CI | Active | Same workflow — `npm audit --omit=dev --audit-level=moderate` gates production deps; informational full-tree step reports dev advisories without blocking |
| License check | Active | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/SSPL) on production deps, warns non-blocking on weak copyleft (LGPL/MPL) and dev deps, matching the documented exception policy |
| Renovate | Not configured | Intentional — Dependabot fills this role; no gap |
| GitHub native code/secret scanning | Unavailable | Requires GitHub Advanced Security add-on on this private repo — owner cost decision, not code-actionable. Gitleaks provides equivalent secret-scanning coverage |

No CI/CD security automation gaps this cycle.

## 9. Outdated Packages with Security Implications

28 outdated packages, **zero attached CVEs or security advisories**. All installed versions are on current majors except `eslint` (new major available, dev-only).

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@anthropic-ai/sdk` | 0.106.0 | 0.110.0 | Production, largest gap; no advisories |
| `posthog-js` | 1.395.0 | 1.398.0 | Production; prior advisory chains (protobufjs, dompurify) resolved in earlier cycles |
| `@supabase/supabase-js` | 2.108.2 | 2.110.0 | Production |
| `next` | 16.2.9 | 16.2.10 | Production framework patch |
| `sharp` | 0.35.2 | 0.35.3 | Production (image processing) |
| `resend` | 6.16.0 | 6.17.1 | Production (email) |
| `@stripe/react-stripe-js` / `@stripe/stripe-js` | 6.6.0 / 9.8.0 | 6.7.0 / 9.9.0 | Production payment SDKs, minor/patch |
| `@sentry/core` / `@sentry/nextjs` | 10.62.0 | 10.63.0 | Production error tracking, patch |
| `@radix-ui/react-dialog`, `-label`, `-select`, `-tooltip` | various | +1–2 patch each | Production UI components |
| `lucide-react` | 1.22.0 | 1.23.0 | Production icon library |
| `postcss`, `tailwindcss`, `@tailwindcss/postcss` | 8.5.15 / 4.3.1 / 4.3.1 | 8.5.16 / 4.3.2 / 4.3.2 | CSS pipeline, patch |
| `eslint` | 9.39.4 | 10.6.0 | **Dev-only major** — new this cycle; no advisory; defer to deliberate dev-tooling upgrade |
| Dev tooling: `knip`, `tsx`, `vitest`, `@vitest/coverage-v8`, `@vitest/eslint-plugin`, `@typescript-eslint/eslint-plugin`, `@types/node`, `@next/bundle-analyzer`, `@next/eslint-plugin-next` | various | +1 patch/minor each | Dev-only, no production exposure |

**Recommendation**: Route the production bumps through Dependabot's existing weekly grouped PR (routine freshness, not vulnerability remediation). Hold `eslint` 10 for a planned dev-tooling major batch alongside the other pending dev majors. Keep `voyageai` pinned at 0.1.0 per the documented incompatibility.

---
