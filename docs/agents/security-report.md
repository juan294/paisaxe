# Security Report — 2026-04-25

## Status: YELLOW

8 advisories detected, **0 exploitable** in this codebase.

Two independent vulnerability chains are active this cycle: a new postcss XSS advisory surfacing through Next.js's internal postcss bundle (GHSA-qx2v-qp2m-jg93, 5 packages in chain), and the carried-forward uuid bounds-check advisory surfacing through the resend->svix->uuid chain (GHSA-w5hq-g745-h8pq, 3 packages in chain). Neither chain reaches user-controlled input in production. The postcss issue is a build-time tool with no runtime user-input surface; the uuid issue uses only v4 UUIDs internally, never the vulnerable v3/v5/v6 code path.

## Executive Summary

- **Advisories**: 8 moderate, 0 high, 0 critical
- **Exploitable**: 0
- **Fixable via `npm audit fix`**: 0 (both chains require `--force` with breaking downstream version changes)
- **New this cycle**: GHSA-qx2v-qp2m-jg93 (postcss XSS, 5-package chain via Next.js internal dep)
- **Carried forward**: GHSA-w5hq-g745-h8pq (uuid bounds-check, 3-package chain via resend)
- **License compliance**: Pass — no unapproved copyleft
- **Security headers**: 4 of 6 expected headers confirmed live (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy). CSP confirmed in source. HSTS is production-only — not checked in dev.
- **CI/CD security automation**: Dependabot, Gitleaks, npm audit, license-check all active

## Vulnerability Table

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|-----------------|
| Moderate | postcss 8.4.31 (in next/node_modules) | GHSA-qx2v-qp2m-jg93 | Not assigned | XSS via unescaped `</style>` in CSS stringify. Triggered by build-time CSS processing, not runtime user input. | `--force` would downgrade Next.js to 9.3.3 — not viable. npm override viable (see Remediation). | NOT EXPLOITABLE |
| Moderate | next >=9.3.4-canary.0 | Transitive via postcss | — | Depends on vulnerable postcss for internal CSS compilation. No runtime user-input path through postcss. | Same — requires next@9.3.3 via `--force`. | NOT EXPLOITABLE |
| Moderate | @sentry/nextjs >=6.3.6 | Transitive via next -> postcss | — | Depends on next which depends on postcss. No CSS processing in Sentry instrumentation layer. | Indirect — resolves when next's internal postcss is updated. | NOT EXPLOITABLE |
| Moderate | @vercel/analytics >=1.2.0-beta.1 | Transitive via next -> postcss | — | Same transitive path as @sentry/nextjs. | Indirect. | NOT EXPLOITABLE |
| Moderate | @vercel/speed-insights >=1.0.5-beta.1 | Transitive via next -> postcss | — | Same transitive path. | Indirect. | NOT EXPLOITABLE |
| Moderate | uuid <14.0.0 | GHSA-w5hq-g745-h8pq | Not assigned | Missing buffer bounds check in uuid.v3/v5/v6 when caller passes `buf`. Caller must also control `offset`. svix uses only uuid.v4() — the vulnerable path never executes. | `--force` would downgrade resend from 6.12.x to 6.1.3 — not viable. Wait for svix >=1.91.2. | NOT EXPLOITABLE |
| Moderate | svix 1.68.0–1.91.1 | Transitive via uuid | — | Uses uuid internally for webhook message ID generation via v4() only. | Indirect — resolves when svix releases >=1.91.2. | NOT EXPLOITABLE |
| Moderate | resend >=6.2.0-canary.0 | Transitive via svix -> uuid | — | Paisaxe calls resend for outbound email only (`src/lib/email.ts`). The svix webhook-verification path in resend is never invoked. | Indirect. | NOT EXPLOITABLE |

## Detailed Exploitability Analysis

### PostCSS XSS (GHSA-qx2v-qp2m-jg93)

- **The bug**: PostCSS's CSS stringify output does not escape `</style>` sequences inside CSS values. If the resulting CSS is embedded in an HTML `<style>` tag, a crafted value like `content: "</style><script>..."` can break out of the style block and execute JavaScript.
- **Affected installation**: `node_modules/next/node_modules/postcss@8.4.31` — this is Next.js's own bundled copy, isolated from our top-level `postcss@^8.5.10` (which is already on the patched version per our `package.json` pin).
- **Runtime vs. build-time**: PostCSS processes CSS exclusively at **build time** (`npm run build`). It never processes user-submitted CSS at runtime. There is no API route, component, or runtime call path that invokes postcss with user input.
- **What an attacker would need**: write access to the CSS source files, Tailwind config, or build pipeline before `npm run build` executes. An attacker with that access already has arbitrary code execution and would not need a CSS-based XSS vector.
- **Our top-level postcss**: already patched. The advisory only applies to the nested copy inside `next/`.
- **Conclusion**: NOT EXPLOITABLE in production. The attack surface is a build pipeline compromise, not a live application path.

### UUID bounds-check (GHSA-w5hq-g745-h8pq) — Carry-forward, unchanged

- **The bug**: `uuid.v3(name, namespace, buf, offset)`, `uuid.v5(...)`, and `uuid.v6(...)` do not validate that `buf` is large enough at `offset`. A caller supplying a too-small buffer can write 16 bytes past its end.
- **Our code path**: `resend.emails.send(...)` in `src/lib/email.ts:54` is an outbound HTTPS call. `svix` within `resend` generates webhook message IDs using `uuid.v4()` — not v3/v5/v6 — and never exposes `buf` to callers. Paisaxe does not import `uuid` or `svix` directly in production code.
- **Conclusion**: NOT EXPLOITABLE. Upgrading clears the advisory but closes no real exposure.

### Fix strategy

**PostCSS chain (recommended approach — npm override)**

Next.js's internal postcss is isolated in `node_modules/next/node_modules/postcss`, so our top-level `package.json` pin of `^8.5.10` does not propagate. An npm override can force it:

```bash
# In package.json overrides section, add:
"postcss": ">=8.5.10"

# Then run:
npm install

# Verify the advisory clears:
npm audit
```

This approach forces npm to hoist a single postcss@>=8.5.10 across the entire tree, including the nested next copy. Risk: minor API differences between postcss 8.4 and 8.5 could theoretically affect Next.js's internal CSS compilation — but postcss follows semver strictly and 8.4->8.5 is backward-compatible. This is the same strategy used successfully for `brace-expansion` and `minimatch` overrides already in place.

The `--force` path (`npm audit fix --force`) is **not viable** — it would downgrade Next.js to 9.3.3.

**UUID chain (wait for upstream)**

```bash
# Option A (run now — syncs package.json pin, does not fix advisory):
npm install  # Syncs resend@6.12.0 -> 6.12.2 per existing ^6.12.2 pin

# Option B (when available — waits for svix >=1.91.2):
# Dependabot will open a PR automatically once resend bumps its svix dependency.

# Option C (not recommended):
# npm audit fix --force  # Downgrades resend to 6.1.3 — breaks src/lib/email.ts type signatures
```

## Prioritized Remediation

1. **(Medium — new this cycle)** Add `"postcss": ">=8.5.10"` to the `overrides` section in `package.json`, then run `npm install`. This clears all 5 advisories in the postcss chain cleanly, with no breaking changes expected. Same pattern as the existing brace-expansion override.
2. **(Low — carry-forward)** Run `npm install` to sync `node_modules` with the `resend@^6.12.2` pin in `package.json`. Does not clear the uuid advisory but removes the `npm ls` drift. Should be batched with step 1 above.
3. **(Watch)** Monitor for `svix >= 1.91.2` upstream — Dependabot will open a PR automatically once the dep tree clears.
4. **(Non-security)** Batch upgrade 7–8 outdated production deps in the next chore cycle (see Outdated section). None carry CVEs.

## License Compliance

Pass. No copyleft violations. All 7 flagged packages are either approved exceptions, documented in `docs/project/license-exceptions.md`, or scanner false positives. Unchanged from previous cycle.

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception — dynamically linked platform binary, no LGPL obligations under SaaS deployment. Documented in license-exceptions.md. |
| `dompurify@3.4.0` | MPL-2.0 OR Apache-2.0 | Dual-licensed — received under Apache-2.0. Compliant. |
| `expand-template@2.0.3` | MIT OR WTFPL | Dual-licensed — received under MIT. Compliant. |
| `paisaxe@1.0.0` | UNLICENSED | This project itself. Intentional — private app, no public distribution. |
| `simple-concat@1.0.1` | MIT | Scanner false positive — manifest is plain MIT. |
| `simple-get@4.0.1` | MIT | Scanner false positive — manifest is plain MIT. |
| `@babel/template@7.28.6` | MIT | Scanner false positive. |

`docs/project/license-exceptions.md` covers both `@img/sharp-libvips-*` (LGPL) and `@vercel/analytics` (MPL-2.0). No new entries needed.

## Security Headers Status

Live HTTP check confirms 4 of 6 expected headers. CSP and HSTS verified in source:

| Header | Live Check | Source | Notes |
|--------|------------|--------|-------|
| X-Content-Type-Options | `nosniff` — Pass | `next.config.ts` | Confirmed live. |
| X-Frame-Options | `DENY` — Pass | `next.config.ts` | Confirmed live. |
| Referrer-Policy | `strict-origin-when-cross-origin` — Pass | `next.config.ts` | Confirmed live. |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` — Pass | `src/proxy.ts` | Confirmed live. |
| Content-Security-Policy | Not in live check | `src/lib/proxy/csp.ts` | Per-request via proxy. CSP source verified: `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. `'unsafe-inline'` is intentional for PPR compatibility (documented in csp.ts). Recommend re-running live check with prod or a request that traverses the proxy layer. |
| Strict-Transport-Security | Not in live check | `next.config.ts:59` | Production-only by design — suppressed on localhost to avoid poisoning Chrome's HSTS cache. Not expected in dev check. |

## CI/CD Security Automation

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Pinned to `develop` branch (commit `f118597`). Opens PRs for CVE-bearing deps. |
| Renovate | Not used | Intentional — Dependabot covers the need. |
| Gitleaks in CI | Active | Runs on every push to `develop` and PRs to `main`. Scans git history for secrets. |
| npm audit in CI | Active | Reports on PRs. Not a hard gate — non-exploitable moderates are accepted per policy. |
| License check | Active | `license-check.yml` blocks strong copyleft (GPL/AGPL/SSPL). Weak copyleft (LGPL/MPL) raises warning per policy. |

No gaps.

## Outdated Packages

17 packages outdated. None carry known CVEs. Notes on apparent "downgrades": `jsdom` (29.0.2 -> 27.0.1) and `vitest` (4.1.4 -> 3.2.4) are npm tag artifacts — we're on a newer pre-release track; npm `latest` points to the older stable channel. These should not be downgraded.

Production deps worth batching in next chore cycle:

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| `posthog-js` | 1.369.3 | 1.372.1 | Low — no CVEs, advisories cleared by e66e510 |
| `@anthropic-ai/sdk` | 0.90.0 | 0.91.1 | Low — minor patch |
| `@supabase/supabase-js` | 2.103.3 | 2.104.1 | Low — patch |
| `@sentry/nextjs` | 10.49.0 | 10.50.0 | Low — minor |
| `@sentry/core` | 10.49.0 | 10.50.0 | Low — minor |
| `@elevenlabs/react` | 1.1.1 | 1.2.1 | Low — minor |
| `@stripe/stripe-js` | 9.2.0 | 9.3.1 | Low — minor |
| `stripe` | 22.0.2 | 22.1.0 | Low — minor |
| `resend` | 6.12.0 | 6.12.2 | Low — sync pending `npm install` |

Dev-only outdated (8): `@tailwindcss/postcss`, `@typescript-eslint/eslint-plugin`, `@vitest/coverage-v8`, `jsdom` (do not downgrade), `knip`, `lucide-react`, `tailwindcss`, `vitest` (do not downgrade). No action required.

## Cross-Agent Inputs

- **QA Agent (Apr 25)** flagged a chat API 500 regression — `/api/chat` returning 500 for all non-safety tests, fast failure (124–321ms) suggesting an import or initialization error from wave 1 remediation commits (`77359718` logger edge runtime isolation). This is not a security vulnerability, but a 500 on the primary user-facing API endpoint could mask errors that a security agent would otherwise observe. Recommend investigating `77359718` before the next security scan.
- **Coverage Agent (Apr 23)** confirmed Stripe webhook and chat stream are now at 100% branch coverage on all defensive error paths. No regression risk on security-critical payment and CSRF paths.
- **Performance Agent (Apr 24)** confirmed Sentry Replay disabled (`fef651f5`). This eliminates the Replay PII exfiltration surface noted in the Apr 24 report. No further action needed on that item.
- **Cost Analyst** notes `resend` pin drift (6.12.0 installed vs ^6.12.2 pinned) — this will be resolved when `npm install` is run as part of Remediation step 2 above.

---
