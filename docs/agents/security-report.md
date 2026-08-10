# Security Report — Paisaxe

**Date:** 2026-08-06
**Agent:** Security Agent
**Health status:** YELLOW

## Executive Summary

**4 advisories detected (8 underlying GHSA/CVE IDs), 0 exploitable in the running application.** All three affected packages — `brace-expansion`, `fast-uri`, `undici` — are reachable only through dev-only or build-time-only dependency chains (`eslint-plugin-react`, `@sentry/webpack-plugin`, `jsdom`), never through code that executes while serving a real user request. That said, this is not a routine "nothing to see" cycle: the daily `Security Scan` GitHub Action **is currently failing** (run `30991007551`, 2026-08-05 08:55 UTC, `npm audit` job) because two of these four — `brace-expansion` and `fast-uri` — sit in the *production* dependency graph as npm classifies it (see Exploitability Analysis) and trip the CI gate's `--audit-level=moderate` threshold. This YELLOW is about a broken CI gate blocking clean merges/releases, not about user-facing risk.

All four are fixable with a small, verified change: `npm audit fix` correctly resolves all three packages (dry-run confirmed below), and the `undici` fix requires deleting a now-counterproductive `package.json` override rather than adding one.

License compliance is unchanged and clean — no copyleft violations, all 7 flagged packages remain documented exceptions or false positives. Security headers are unchanged and correct in source. CI/CD security automation is fully active except for the currently-failing audit gate described above. 27 packages are outdated (up sharply from 10 in the last cycle), all minor/patch except `typescript` (6.0.3 -> 7.0.2, already excluded from Dependabot batching per the Jul 15 semver-gating fix).

## Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|----------------|---------|------------------|
| High | `brace-expansion@5.0.8` | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) / CVE-2026-69152 | ReDoS-adjacent DoS via unbounded intermediate arrays during brace-pattern expansion; bypasses the earlier CVE-2026-14257 mitigation | Yes — `npm audit fix` (bumps override `>=5.0.8` -> `>=5.0.9`) | **Not exploitable here.** Only reachable via `eslint-plugin-react` -> `minimatch` (ESLint's glob matching), a devDependency invoked only during local/CI linting on developer-authored glob patterns, never on user input |
| High | `fast-uri@3.1.4` | [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) / CVE-2026-18446 | Host confusion via backslash authority introducer in URI parsing (used by AJV schema validation) | Yes — `npm audit fix` (adds override `fast-uri` `>=3.1.5`) | **Not exploitable here.** Reached only via `@sentry/nextjs` -> `@sentry/webpack-plugin` -> `webpack` -> `schema-utils` -> `ajv`/`ajv-formats`. `@sentry/webpack-plugin` runs exclusively as a webpack plugin during `next build` (source-map upload to Sentry); it never executes in the deployed runtime, even though `@sentry/nextjs` itself is a `dependencies` (not `devDependencies`) entry |
| High / Moderate | `undici@7.28.0` | 5 advisories bundled — [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272) / CVE-2026-13697 (High, cross-user info disclosure + parse crash via degenerate cache directives); [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) / CVE-2026-16728 (Moderate, response desync via retry interceptor); [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) / CVE-2026-15157 (Moderate, CRLF injection via blob `type`); [GHSA-jr45-8vmc-qm54](https://github.com/advisories/GHSA-jr45-8vmc-qm54) / CVE-2026-14643 (Moderate, cache-control whitespace disclosure); [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) / CVE-2026-16729 (Moderate, cookie attribute injection) | Various HTTP client-layer request/response smuggling and cache-poisoning primitives in undici's fetch implementation | Yes — `npm audit fix` (**removes** the `undici: "7.28.0"` override entirely) | **Not exploitable here.** Only dependency is `jsdom@30.0.0` (a devDependency used solely as the vitest DOM test environment); `undici` never ships or runs in production. It never makes real network requests to attacker-influenced hosts during tests |
| Moderate | `jsdom@30.0.0` | Derivative — "Depends on vulnerable versions of undici" | N/A (transitive rollup, not a distinct advisory) | Yes — resolves automatically once `undici` is fixed | Same as `undici` above — test-only, no runtime exposure |

## Detailed Exploitability Analysis

**Why npm classifies `brace-expansion` and `fast-uri` as "production" despite being build/lint tooling:** `npm audit --omit=dev` filters based on whether every path to a package passes exclusively through `devDependencies` edges in the resolved graph. `@sentry/nextjs` is declared under `dependencies` in `package.json:76` (it is imported at runtime for error tracking, so that classification is correct for the package itself), and its own `@sentry/webpack-plugin` sub-dependency — used only for the build-time source-map upload step — is not marked `dev` by npm's resolver even though it never executes past `next build`. This is why `npm audit --omit=dev --audit-level=moderate` (the CI gate in `.github/workflows/security.yml`) currently fails on `fast-uri`, and independently on `brace-expansion` — confirmed by reproducing the exact gate command locally: it reports the same 2 high-severity findings. This is an **npm dependency-graph classification quirk, not evidence of runtime reachability** — `@sentry/webpack-plugin`'s code path that pulls in `ajv`/`fast-uri` for JSON-schema validation of webpack's own config never runs inside a deployed Vercel function.

`brace-expansion`'s only path is through `eslint-plugin-react` (line 121, `devDependencies`) — its inclusion in the prod-only audit output is because npm's classification tracks the *resolved* dependency, and in this lockfile the sole resolution path happens to also get pulled in transitively in a way npm's classifier doesn't mark purely-dev (verified via `npm ls brace-expansion`, single path: `eslint-plugin-react -> minimatch@10.2.4 -> brace-expansion@5.0.8`). Regardless of classification nuance, `eslint-plugin-react` only runs during `npm run lint` against source file paths under this repo's control — no attacker-controlled glob input reaches it.

`undici` is the clearest case: its only consumer is `jsdom`, itself only imported by the vitest test environment config, and it never executes in a Vercel serverless function or the Next.js server runtime.

**Net assessment:** 0 of 4 advisories have a path to production request handling. All are legitimately fixable and should be fixed promptly regardless — mainly to restore the CI gate to green, not because of live risk.

## Prioritized Remediation Steps

1. **Fix all three (P1 — restores the currently-failing CI gate).** Verified via `npm audit fix --dry-run`:
   ```
   remove undici 7.28.0
   change fast-uri 3.1.4 => 3.1.5
   change brace-expansion 5.0.8 => 5.0.9
   ```
   Run `npm audit fix` and commit the resulting `package.json` / `package-lock.json` diff. Specifically:
   - `package.json` `overrides.brace-expansion`: bump `">=5.0.8"` -> `">=5.0.9"` (the new advisory's fixed floor; the existing `>=5.0.8` override technically still permits the vulnerable 5.0.8 the lockfile had resolved to).
   - `package.json` `overrides`: add `"fast-uri": ">=3.1.5"` (no override currently pins this package at all).
   - `package.json` `overrides.undici`: **delete** the `"undici": "7.28.0"` entry. It was pinning `jsdom`'s dependency *down* to a now-vulnerable exact version; `jsdom@30.0.0` actually declares `undici: "^8.7.0"` (verified via `npm view jsdom@30.0.0 dependencies.undici`), so removing the override lets npm resolve the already-patched 8.x line naturally instead of forcing an old 7.x pin.
   - After applying, re-run `npm audit --omit=dev --audit-level=moderate` locally to confirm the CI gate would pass before pushing.
2. **No other action needed.** All three fixes are non-breaking dependency bumps confined to build/lint/test tooling — no application code changes required.

## License Compliance

No copyleft violations, production or dev. Same 7 flagged packages as the prior cycle, all documented exceptions or false positives — no new entries:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.3.2` | LGPL-3.0-or-later | Documented Exception 1 (`license-exceptions.md:5`) — dynamically-linked native binary, SaaS deployment, no copyleft obligation triggered |
| `dompurify@3.4.12` | `(MPL-2.0 OR Apache-2.0)` | Documented (`license-exceptions.md:157`) — dual-licensed, Apache-2.0 branch selected; no direct `src/` usage, reachable only via `posthog-js`'s internal analytics code |
| `lightningcss@1.32.0` / `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Documented Exception 3 (`license-exceptions.md:84`) — devDependency, file-level weak copyleft, build-time only (Tailwind v4 / Vite CSS transform) |
| `expand-template@2.0.3` | `(MIT OR WTFPL)` | Documented (`license-exceptions.md:158`) — dual-licensed, MIT branch selected; build-time only via `canvas` -> `prebuild-install` |
| `@babel/template@7.29.7` | MIT | Clean — plain MIT, scanner pattern-match false positive |
| `simple-concat@1.0.1` / `simple-get@4.0.1` | MIT | Clean — plain MIT, scanner pattern-match false positive |
| `paisaxe@1.6.0` | UNLICENSED | Expected — this project's own `package.json`, not a third-party dependency |

No strong copyleft (GPL/AGPL/SSPL) anywhere in the tree, production or dev.

## Security Headers

All headers confirmed present in source (`next.config.ts:65-70` for HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy; `src/proxy.ts:71` calling `buildCspHeader()` for CSP):

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Configured. `'unsafe-inline'` in `script-src` is the deliberate, documented PPR-compatibility tradeoff (CLAUDE.md CSP/PPR section) — `'strict-dynamic'` and nonce-only CSP are both avoided since PPR prerenders HTML without nonces |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Configured, 2-year max-age with preload, prod-only |
| X-Frame-Options | `DENY` | Configured |
| X-Content-Type-Options | `nosniff` | Configured |
| Referrer-Policy | `strict-origin-when-cross-origin` | Configured |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Configured |

No changes since prior cycles. No action needed.

## CI/CD Security Automation

| Control | Status |
|---------|--------|
| Dependabot | Active — `.github/dependabot.yml`, weekly (Monday), targets `develop`, semver-gated groups (minor/patch only per group) |
| Gitleaks | Active — `.github/workflows/security.yml`, runs on push/PR to `develop`/`main`, plus daily cron. Passing (confirmed in the same 2026-08-05 08:55 UTC run that failed on `npm audit`) |
| npm audit in CI | Active but **currently failing** — same workflow, `npm audit --omit=dev --audit-level=moderate` job. Last run (`30991007551`, main, 2026-08-05 08:55 UTC): FAILURE, due to `brace-expansion` and `fast-uri` (see Exploitability Analysis for why these count as "production" under npm's classification). This will also fail on the next `develop` push until the fixes in Prioritized Remediation Steps land — reproduced locally against the current `develop` tree |
| Renovate | Not configured — Dependabot covers this role; no gap |
| GitHub code scanning / secret scanning (GHAS) | Not available (private repo, not enabled) — known, owner-cost gap, not newly actionable. Gitleaks in CI covers the secret-scanning surface |
| License check | Active — `.github/workflows/license-check.yml`, blocks strong copyleft (GPL/AGPL/SSPL) |

**Gap this cycle:** the `npm audit` CI job is red. It is not a false positive from stale Dependabot alert tracking (unlike the `main`-vs-`develop` staleness pattern noted in past cycles) — reproducing the exact CI command (`npm audit --omit=dev --audit-level=moderate`) against the current `develop` tree independently confirms the same 2 high-severity findings. Anyone opening a PR to `develop` right now will see this job fail.

## Outdated Packages

27 outdated packages (up from 10 last cycle), all minor/patch except `typescript`:

| Package | Current -> Latest | Type |
|---------|-------------------|------|
| `@elevenlabs/react` | 1.11.0 -> 1.12.0 | minor |
| `@next/bundle-analyzer` | 16.2.12 -> 16.3.0 | minor |
| `@next/eslint-plugin-next` | 16.2.12 -> 16.3.0 | minor |
| `@playwright/test` | 1.62.0 -> 1.62.1 | patch |
| `@sentry/core` | 10.68.0 -> 10.69.0 | patch |
| `@sentry/nextjs` | 10.68.0 -> 10.69.0 | patch |
| `@stripe/stripe-js` | 9.12.1 -> 9.13.0 | minor |
| `@supabase/ssr` | 0.12.3 -> 0.12.4 | patch |
| `@supabase/supabase-js` | 2.110.9 -> 2.112.1 | minor |
| `@testing-library/user-event` | 14.6.1 -> 14.6.3 | patch |
| `@types/react` | 19.2.17 -> 19.2.18 | patch |
| `@types/react-dom` | 19.2.3 -> 19.2.4 | patch |
| `@typescript-eslint/eslint-plugin` | 8.65.0 -> 8.66.0 | minor |
| `@upstash/redis` | 1.38.0 -> 1.38.2 | patch |
| `@vitejs/plugin-react` | 6.0.4 -> 6.0.5 | patch |
| `@vitest/eslint-plugin` | 1.6.24 -> 1.6.26 | patch |
| `knip` | 6.29.0 -> 6.32.0 | minor |
| `lucide-react` | 1.27.0 -> 1.28.0 | minor |
| `next` | 16.2.12 -> 16.3.0 | minor |
| `pdfjs-dist` | 6.1.200 -> 6.2.108 | minor |
| `postcss` | 8.5.23 -> 8.5.25 | patch |
| `posthog-js` | 1.407.3 -> 1.413.2 | minor |
| `resend` | 6.18.0 -> 6.18.1 | patch |
| `stripe` | 22.3.2 -> 22.4.0 | minor |
| `tsx` | 4.23.1 -> 4.23.9 | patch |
| `twitter-api-v2` | 1.29.0 -> 1.29.1 | patch |
| `typescript` | 6.0.3 -> 7.0.2 | **major** — excluded from Dependabot batching per Jul 15 fix, no CVE, low urgency |

None of the 27 outdated packages have open advisories beyond the 3 already covered above (`brace-expansion`, `fast-uri`, `undici` are transitive, not in this direct-dependency outdated list). `postcss` 8.5.23 is already past the vulnerable `<= 8.5.17` range from the stale `main`-branch Dependabot alert `GHSA-r28c-9q8g-f849` — no action needed there, `develop` is already clean.

---

## Cross-Agent Context Review

Reviewed shared context from Cost Analyst (2026-08-06) and Coverage Agent (2026-08-06).

- **Anthropic credit exhaustion (#734)** — Cost Analyst's 2026-08-06 entry marks this "CRITICAL", now day 17 unresolved. This remains a billing/availability incident outside this agent's remediation scope (no code fix exists). Per QA's last confirmation (Jul 22), the pre-LLM injection filter continues functioning correctly under the outage; LLM-layer safety guardrails remain unverifiable until credits are restored. No new security action item — flagging only so it isn't mistaken for a security-agent gap.
- **Coverage Agent (2026-08-06)** added tests for fetch-timeout and database-error paths in `elevenlabs-signed-session.ts` and `voice-session/route.ts` — confirms the `AbortSignal.timeout` handling in that code is exercised correctly. No security concern; noted as a positive signal on error-handling robustness in a security-adjacent code path.
- **ElevenLabs character-utilization acceleration** (Cost Analyst, 2026-08-06) is a cost/capacity signal, not a security finding — no action needed from this agent.
