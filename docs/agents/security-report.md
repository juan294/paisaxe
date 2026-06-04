# Security Report — 2026-06-04

## 1. Health Status: GREEN

**0 advisories detected, 0 exploitable.** `npm audit` returns a clean tree across all
severity levels (critical/high/moderate/low all zero), independently re-verified this
cycle (`npm audit --json` → `{critical:0, high:0, moderate:0, low:0, total:0}`). No
copyleft violations. All security headers present in source. All webhook and auth
controls intact. This continues the clean run that resumed after the late-April
postcss/uuid YELLOW cycles (resolved via overrides + `npm install`).

## 2. Executive Summary

The dependency surface is clean: **0 advisories, 0 exploitable**. There is nothing to
patch this cycle from a vulnerability standpoint. The two advisory chains that produced
YELLOW status in April (protobufjs Critical + dompurify Moderate via posthog-js; later
postcss XSS + uuid bounds-check) are all cleared — the current `posthog-js@1.376.4` and
hoisted transitive versions carry no open advisories.

License compliance passes: the only non-permissive licenses in the tree are the two
already documented and approved (`@img/sharp-libvips-*` LGPL-3.0, `@vercel/analytics`
MPL-2.0), plus dual-licensed packages where a permissive option is available. No
GPL/AGPL/SSPL anywhere.

Security headers are fully configured and verified in source (`src/proxy.ts`,
`src/lib/proxy/csp.ts`): CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff,
Referrer-Policy, Permissions-Policy. CI/CD security automation is complete — Gitleaks,
npm audit (now daily), Dependabot (pinned to develop), and license-check all active.

The only standing item is routine dependency hygiene: 20 outdated packages, **none with
known CVEs**, suitable for the next batched dependency update. The one cross-agent flag
worth noting is Performance's Jun 3 finding of a JS bundle-size budget breach
(3,398 KB / 3,100 KB) — that is a size/cost concern, **not a security issue**; no new
client-side dependencies entered the graph.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|---------------|---------|-----------------|
| — | — | — | — | — | **No advisories. `npm audit` reports 0 vulnerabilities.** |

There are no open advisories to cross-reference to CVE this cycle. For historical
context, the most recently resolved advisories were:

| Resolved | Package | GHSA / CVE | Status |
|----------|---------|------------|--------|
| Apr 20 | protobufjs | GHSA-xq3m-2v4x-88gg (Critical) | Cleared — transitive bumped >=7.5.5 |
| Apr 20 | dompurify | GHSA-39q2-94rc-95cp (Moderate) | Cleared — now at 3.4.0 |
| ~May 26 | postcss / qs chain | GHSA-qx2v-qp2m-jg93 + qs override | Cleared via overrides |

## 4. Detailed Exploitability Analysis (High / Critical)

No high or critical advisories are present. Nothing requires exploitability analysis this
cycle.

For continued assurance, the previously-analyzed exploitability conclusions remain valid:

- **DOMPurify**: confirmed **0 direct call sites** in `src/` (grep returns no matches).
  DOMPurify is present only transitively (PostHog analytics). No application code passes
  user input through it, so any future DOMPurify sanitizer-bypass advisory would remain
  non-exploitable in this codebase. The current version is 3.4.0 (no open advisory).
- **Webhook signature verification**: 13 `timingSafeEqual` call sites across 6 production
  modules (`mcp-auth.ts`, `csrf.ts`, `cron-auth.ts`, and the supabase / elevenlabs /
  translate webhook routes). All signature comparisons are constant-time — no timing
  side-channel on any webhook or CSRF path.

## 5. Prioritized Remediation Steps

1. **No security patching required** — `npm audit` is clean. Do not run `npm audit fix`;
   there is nothing to fix.
2. **Routine dependency batch (low priority, no CVEs)** — fold the 20 outdated packages
   into the next Dependabot/triage batch. All are minor/patch except the three intentional
   holds (see Section 9). Suggested command for the safe minor/patch set:
   ```bash
   npm update next @next/bundle-analyzer @next/eslint-plugin-next \
     @sentry/core @sentry/nextjs @stripe/react-stripe-js @supabase/supabase-js \
     react react-dom posthog-js knip tsx
   npm audit            # confirm still 0
   npm run typecheck && npm run lint && npm run test
   ```
3. **Do not upgrade `voyageai`** — stays pinned at 0.1.0 (v0.2.x has a broken ESM build
   Turbopack cannot resolve; Dependabot already ignores `>=0.2.0`).
4. **Defer `jsdom` (29 → 27) and `vitest` major** — these are dev-only and the "latest"
   for jsdom/vitest is a lower-numbered release line; verify intent before bumping.

## 6. License Compliance — Named Packages

`COPYLEFT LICENSES FOUND: false`. License-check passes. Named breakdown of every flagged
or non-MIT-family license:

**Non-permissive (documented exceptions — compliant):**
- `@img/sharp-libvips-darwin-arm64@1.2.4` — **LGPL-3.0-or-later**. Weak copyleft, dynamically
  linked pre-built native binary under `sharp` (Apache-2.0), no modifications, SaaS
  deployment. Documented as Exception 1 in `docs/project/license-exceptions.md`.
- `@vercel/analytics` — **MPL-2.0**. File-level weak copyleft, unmodified, SaaS deployment.
  Documented as Exception 2. (Not surfaced as a standalone MPL entry in this cycle's scan,
  but the exception remains on record.)

**Dual-licensed (permissive option selected — compliant):**
- `dompurify@3.4.0` — **(MPL-2.0 OR Apache-2.0)** → take Apache-2.0. Fully permissive, no
  exception needed.
- `expand-template@2.0.3` — **(MIT OR WTFPL)** → take MIT. Compliant.

**Own package (intentional):**
- `paisaxe@1.5.1` — **UNLICENSED**. This is our own private application package; "UNLICENSED"
  is the correct/intentional marker for a proprietary, non-published project. Not a risk.

**False positives in the flagged list (actually MIT):**
- `@babel/template@7.28.6` — MIT
- `simple-concat@1.0.1` — MIT
- `simple-get@4.0.1` — MIT

  (These appear in the "flagged" output because they sit in a dependency chain alongside a
  flagged package, not because their own license is non-permissive.)

**No GPL-2.0/3.0, AGPL, SSPL, EUPL, BSL, CPAL, OSL anywhere in the production tree.** The
`license-check.yml` CI job fails the build on any of those.

## 7. Security Headers Status

All headers confirmed present in source (`src/proxy.ts` + `src/lib/proxy/csp.ts`) and in
the live header dump:

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'`; `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'` (+ scoped img/connect/font/media/worker/frame) | Pass |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` (2 years) | Pass |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass |

CSP notes (unchanged, correct):
- `'self' 'unsafe-inline'` for `script-src` is the **deliberate, correct** policy for this
  project's PPR/`cacheComponents` setup. Per CLAUDE.md, prerendered HTML ships without
  nonces, so `'strict-dynamic'` or nonce-only CSP would break all scripts. The E2E "CSP
  canary" test guards against regressions.
- `object-src 'none'` and `frame-ancestors 'none'` are set (clickjacking + plugin
  hardening). `frame-src` correctly scoped to `https://js.stripe.com` for Stripe Elements.
- `'unsafe-inline'` in `script-src` is the only residual soft spot, and it is a documented,
  framework-required trade-off — not a finding.

## 8. CI/CD Automation Status

| Control | Configured | Detail |
|---------|-----------|--------|
| Dependabot | Yes | `.github/dependabot.yml` — npm + github-actions, weekly, **target-branch: develop** (never main), grouped (production / dev-and-types), `voyageai >=0.2.0` ignored |
| Renovate | No | Not used; Dependabot covers the same role |
| Gitleaks | Yes | `security.yml` — runs on push + PR to develop/main and daily cron; full-history scan (`fetch-depth: 0`), v8.21.2 |
| npm audit | Yes | `security.yml` — `npm audit --omit=dev --audit-level=moderate` (blocking) + informational full audit; **now daily** (cron `0 8 * * *`), reducing CVE detection latency from ~6 days to <24h |
| License check | Yes | `license-check.yml` — `license-checker --production --failOn` GPL-2.0/3.0, AGPL, EUPL, SSPL, BSL, CPAL, OSL |
| Vercel env safety | Yes | `security.yml` — asserts legacy agent-runner override absent from Vercel env before deploy |

No CI/CD security gaps. The Gitleaks-in-CI gap that QA repeatedly flagged in earlier
cycles is closed and stable.

## 9. Outdated Packages with Security Implications

**20 outdated packages — none have known CVEs.** None is a security-driven upgrade.
Highlights:

- **Production minor/patch (safe to batch, no security risk):** `next` 16.2.6→16.2.7,
  `react`/`react-dom` 19.2.6→19.2.7, `@sentry/core`+`@sentry/nextjs` 10.55→10.56,
  `@supabase/supabase-js` 2.106.2→2.107.0, `@stripe/react-stripe-js` 6.4.0→6.6.0,
  `posthog-js` 1.376.4→1.379.2.
- **`pdfjs-dist` 5.7.284 → 6.0.227 (major):** PDF parsing libraries are a historically
  high-risk class, **but** `pdfjs-dist` is a `devDependency` here (build-time PDF
  ingestion only, never shipped to the client per the Performance agent's P5 finding), so
  even a future pdf.js advisory would be dev-only/low-risk. Treat the major bump as
  optional, test-gated.
- **Intentional holds:** `voyageai` 0.1.0 (broken ESM in 0.2.x — keep pinned),
  `jsdom` 29→27 and `vitest` 4.1.7 "latest" 3.2.6 (dev-only, lower-numbered release lines —
  verify before changing).

No outdated package currently maps to an open advisory.

---
