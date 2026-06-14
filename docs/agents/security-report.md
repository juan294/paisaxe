# Security Report — Paisaxe

Date: 2026-06-13
Agent: Security Agent

## 1. Health Status: GREEN

1 advisory detected, 0 exploitable.

The single open advisory (esbuild, High by CVSS) is a build/test-time-only
dependency that is not present in the deployed application and whose two attack
vectors both require conditions this project does not meet (Deno runtime,
Windows dev server). Health is based on exploitable risk, not raw advisory
count.

## 2. Executive Summary

- 1 advisory detected, 0 exploitable.
- The advisory is `esbuild` (a transitive build/test dependency). It is reachable
  only at build and test time, never in the production runtime that serves
  paisaxe.es / paisaxe.com.
- Both esbuild advisories are non-exploitable here: one requires the Deno module
  plus an attacker-controlled `NPM_CONFIG_REGISTRY`; the other requires running
  esbuild's own dev server on Windows. This project runs on Node.js, develops on
  macOS, builds/deploys on Linux (Vercel), and uses the Next.js/Turbopack dev
  server — not esbuild's `serve()`.
- The advisory is fixable with a single `npm audit fix` (bumps esbuild to 0.28.1,
  a lockfile-only change in dev dependencies).
- License compliance: Pass. No strong copyleft (GPL/AGPL/SSPL). The one weak
  copyleft package (`@img/sharp-libvips-darwin-arm64`, LGPL-3.0-or-later) is
  documented in `license-exceptions.md`. The MPL-2.0 surface (`dompurify`) is
  dual-licensed and electable as Apache-2.0.
- Security headers: all present and correct (CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- CI/CD security automation: Gitleaks, npm audit, and Dependabot all active.
  Renovate not configured (redundant with Dependabot — no gap).

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|---------------|---------|-----------------|
| High (CVSS 8.1) | esbuild 0.28.0 (dev/build, transitive) | GHSA-gv7w-rqvm-qjhr / no CVE assigned | RCE via missing binary integrity verification in the **Deno** esbuild module when `NPM_CONFIG_REGISTRY` is attacker-controlled | Yes — `npm audit fix` (to 0.28.1) | NOT EXPLOITABLE. Project runs on Node.js, not Deno; the Deno install path is never used. esbuild is pulled in by `vite`/`tsx` for build/test only. No production exposure. |
| Low (CVSS 2.5) | esbuild 0.28.0 (dev/build, transitive) | GHSA-g7r4-m6w7-qqqr / no CVE assigned | Arbitrary file read via path traversal when running esbuild's **dev server on Windows** | Yes — `npm audit fix` (to 0.28.1) | NOT EXPLOITABLE. Dev happens on macOS, CI/deploy on Linux. The Next.js/Turbopack dev server is used, not esbuild `serve()`. Even on Windows the esbuild dev server is never started. |

npm's summary collapses both advisories into a single "1 high severity
vulnerability" line because they share the same `esbuild 0.17.0 - 0.28.0` range.
Neither advisory has a CVE assigned at the time of this report. Both are patched
in esbuild 0.28.1.

## 4. Detailed Exploitability Analysis

### esbuild (the only open advisory) — build/test dependency, not shipped

Dependency chain (confirmed via `npm ls esbuild`):

```
paisaxe@1.5.1
├─ @vitejs/plugin-react@6.0.2  (devDependency)
│  └─ vite@8.0.8
│     └─ esbuild@0.28.0
└─ tsx@4.22.4                  (devDependency)
   └─ esbuild@0.28.0
```

Both parents (`@vitejs/plugin-react`, `tsx`) are `devDependencies`. esbuild is
invoked only during local builds, Vitest runs, and TypeScript execution. It is
not bundled into the Next.js production output and never runs in the Vercel
serverless/edge runtime that serves users.

Defense-in-depth note: CI's gating audit step runs
`npm audit --omit=dev --audit-level=moderate` (see `security.yml`), so this
dev-only advisory does **not** fail the production audit gate. It surfaces only
in the informational `npm audit || true` step. This is the intended design — dev
vulns are reported but do not block.

**GHSA-gv7w-rqvm-qjhr (High, RCE).** The vulnerability lives in esbuild's Deno
module: when installing the native binary via Deno, esbuild does not verify
binary integrity, so an attacker who controls `NPM_CONFIG_REGISTRY` can serve a
malicious binary. This project does not use Deno anywhere — esbuild's binary is
resolved through the standard npm/Node.js path, and `NPM_CONFIG_REGISTRY` is not
attacker-influenced in CI or local dev. The exploit precondition cannot occur
here.

**GHSA-g7r4-m6w7-qqqr (Low, arbitrary file read).** Path traversal in esbuild's
built-in dev server (`esbuild serve`) on Windows, using backslash sequences to
escape the served directory. This project never starts esbuild's dev server (it
uses `next dev` / Turbopack), and all dev/CI environments are macOS/Linux. Two
independent reasons the vector does not apply.

**Remediation:** `npm audit fix` upgrades esbuild to 0.28.1 cleanly (dev
dependency, lockfile-only, zero production bundle impact). Low urgency given
non-exploitability, but the fix is free and recommended to clear the advisory.

## 5. Prioritized Remediation Steps

1. **Clear the esbuild advisory (low urgency, zero risk).**
   ```bash
   npm audit fix
   npm run typecheck && npm run lint && npm run test
   ```
   Verify the lockfile bumps esbuild to >= 0.28.1 and that nothing else moves.

2. **Routine outdated-dependency hygiene (no CVEs, batch via Dependabot).**
   Security-adjacent packages worth keeping current — `stripe` 22.2.0 -> 22.2.1
   (payments), `sharp` 0.34.5 -> 0.35.1 (image decoding — a common parser-attack
   surface), `posthog-js` 1.384.0 -> 1.386.6. None carry known advisories; let
   the weekly Dependabot production batch carry them.

3. **No other action required.** All security headers, webhook signature checks,
   and license policy are in good standing.

## 6. License Compliance

Copyleft licenses found: none that violate policy. CI `license-check` blocks only
strong copyleft (GPL/AGPL/SSPL); none are present.

Flagged packages, named explicitly:

| Package | License | Assessment |
|---------|---------|------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Weak copyleft. Documented in `docs/project/license-exceptions.md` (Exception 1). Pre-built native binary, dynamically linked via `sharp`, unmodified, SaaS deployment — no copyleft obligation. Approved. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Dual-licensed; Paisaxe can elect Apache-2.0 (permissive), so MPL obligations do not attach. Also note: `dompurify` is currently only reached transitively via analytics tooling — application code does not call it directly. No violation. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed; elect MIT (permissive). No violation. |
| `paisaxe@1.5.1` | UNLICENSED | This is the project's own root package. `UNLICENSED` is intentional and correct — it marks the proprietary app and prevents accidental `npm publish`. Not a third-party license concern. |
| `@babel/template@7.28.6` | MIT | Permissive. Appears in the flagged-export list but is plain MIT — no concern. |
| `simple-concat@1.0.1` | MIT | Permissive. No concern. |
| `simple-get@4.0.1` | MIT | Permissive. No concern. |

Note: `@vercel/analytics` is no longer an active license exception — upstream now
ships under MIT (Exception 2 in `license-exceptions.md` marked resolved
2026-06-11).

## 7. Security Headers Status

All headers present and correctly configured (live values confirmed; CSP source
verified in `src/lib/proxy/csp.ts`).

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'`; `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'` (+ scoped img/connect/font/media/worker/frame) | Pass |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass |

CSP design is deliberate and documented: `'unsafe-inline'` in `script-src` is
required for PPR/`cacheComponents` (prerendered HTML has no nonces);
`'strict-dynamic'` and nonce-only are intentionally avoided per the CSP/PPR notes
in CLAUDE.md. `'unsafe-eval'` is added only in development. Primary XSS defense is
output sanitization in the markdown render sinks
(`src/components/immersive/voice-chat/chat-markdown.tsx`,
`src/components/admin/agents-dashboard/safe-markdown.tsx`), guarded by
`e2e/xss-canary.spec.ts`. `frame-ancestors 'none'` + `X-Frame-Options DENY` give
redundant clickjacking protection; `object-src 'none'` blocks plugin vectors.

## 8. CI/CD Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | Active | `.github/dependabot.yml` — weekly npm + GitHub Actions updates, targets `develop`, grouped (production / dev-and-types), `voyageai >= 0.2.0` ignored (broken ESM). |
| Renovate | Not configured | No gap — redundant with Dependabot. |
| Gitleaks | Active | `security.yml` job runs `gitleaks detect` with full history (`fetch-depth: 0`) on push/PR to develop+main and daily at 08:00 UTC. |
| npm audit | Active | `security.yml` gating step `npm audit --omit=dev --audit-level=moderate` (production deps block at moderate+); informational full audit runs separately. Daily schedule reduces CVE detection latency to < 24h. |
| License check | Active | `license-check.yml` blocks strong copyleft on all PRs. |
| Vercel env safety | Active | `security.yml` asserts the legacy agent-runner override env var is absent from the Vercel project before deploy. |

No automation gaps. The gating audit's `--omit=dev` scope is the correct reason
today's esbuild advisory does not block — it is a dev-only finding.

## 9. Outdated Packages With Security Implications

11 outdated packages reported. None carry a known advisory or CVE. Security-relevant entries:

- `stripe` 22.2.0 -> 22.2.1 (patch) — payment SDK; keep current as routine hygiene.
- `sharp` 0.34.5 -> 0.35.1 (minor) — image decoding is a recurring parser-attack
  surface; worth tracking, no current advisory.
- `posthog-js` 1.384.0 -> 1.386.6 (minor) — recently churned on advisories
  upstream (resolved Apr 2026); no open advisory now.
- `@elevenlabs/react`, `lucide-react`, `tailwindcss`, `@tailwindcss/postcss`,
  `@types/node` — minor/patch, no security implication.

Installed-ahead-of-latest artifacts to ignore (not real downgrades): `vitest`
(installed 4.1.8, registry "latest" 3.2.6) and `jsdom` (installed 29.1.1, latest
27.0.1) — both on pre-release/ahead channels, flagged by prior triage. `voyageai`
remains intentionally pinned at 0.1.0 (0.2.x has a broken ESM build).

## Cross-Agent Notes

- Performance Agent: `npm audit fix` for esbuild is a dev-dependency lockfile bump
  — zero production bundle impact. `sharp` 0.35.1 and `@elevenlabs/react` 1.6.7
  are bundle-relevant if upgraded; measure on a fresh `build:analyze` (per-chunk
  headroom is thin at ~44 KB on the ElevenLabs chunk).
- Coverage Agent: webhook signature paths and CSRF/origin enforcement remain the
  security-critical branches — keep them at full coverage; no regressions.
- QA Agent: no new safety-guardrail concerns from the dependency surface this
  cycle.
