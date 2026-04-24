# Security Report — 2026-04-24

## Status: YELLOW

3 moderate advisories detected, **0 exploitable** in this codebase. GREEN streak ends at 2 runs.
Root cause is a transitive `uuid <14.0.0` advisory reaching us through the `resend -> svix -> uuid` chain. The vulnerable code path (`uuid.v3/v5/v6` with caller-provided `buf`) is not reachable from Paisaxe application code.

## Executive Summary

- **Advisories**: 3 moderate, 0 high, 0 critical
- **Exploitable**: 0 (both intermediates — svix and uuid — only surface via Resend's internal webhook/ID generation, with no user-controlled `buf` input)
- **Fixable via `npm audit fix`**: 0 (requires `--force` because fix path upgrades `resend` to 6.1.3 and npm reads it as a breaking downgrade from 6.12.x)
- **Production dep gaps**: 7 production packages have newer minor/patch (non-security)
- **License compliance**: Pass — no unapproved copyleft
- **CI/CD security automation**: Dependabot + Gitleaks + npm audit active
- **Security headers**: All in source. Live HTTP header check skipped (dev server was not running)
- **Package manifest drift**: `package.json` pins `resend@^6.12.2` but `node_modules` has `6.12.0`. `npm install` has not been run since the pin. Low severity — this is what `npm ls` flagged as `invalid`.

## Vulnerability Table

| Severity | Package        | Advisory (GHSA)                 | CVE       | Attack Vector                                                                                                                                                          | Fixable                              | Risk Here    |
|----------|----------------|---------------------------------|-----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------|--------------|
| Moderate | uuid 10.0.0    | GHSA-w5hq-g745-h8pq             | Pending   | Missing buffer bounds check in `uuid.v3/v5/v6` when caller passes a `buf` argument. Affects name-based (v3/v5) and time-based (v6) only. v1/v4/v7 not affected.         | Only via `--force` (breaking)        | NOT EXPLOITABLE |
| Moderate | svix 1.90.0    | Transitive via uuid             | Pending   | svix uses `uuid` internally to generate webhook message IDs. These are v4 (random), so the v3/v5/v6 bounds-check bug never triggers.                                    | Only via `--force` (breaking)        | NOT EXPLOITABLE |
| Moderate | resend 6.12.0  | Transitive via svix -> uuid     | Pending   | `resend` client uses `svix` only for inbound webhook verification. Paisaxe calls `resend.emails.send(...)` — outbound only (see `src/lib/email.ts:93`). Webhook-verify path is unused. | Only via `--force` (breaking)        | NOT EXPLOITABLE |

CVE identifiers: the npm audit output does not yet carry a CVE alias for GHSA-w5hq-g745-h8pq. GitHub Security Advisories has not assigned one as of the scan time.

## Detailed Exploitability Analysis

### uuid bounds-check bug (GHSA-w5hq-g745-h8pq)

- **The bug**: `uuid.v3(name, namespace, buf, offset)`, `v5(...)`, and `v6(...)` do not validate that `buf` is large enough to hold the 16-byte UUID. A caller passing a too-small `Buffer` and a non-zero `offset` can write out of bounds.
- **Who can trigger it**: only code that calls `uuid.v3/v5/v6` with caller-controlled `buf` **and** caller-controlled `offset`.
- **Where it enters Paisaxe**: only via `svix` (used by `resend`). svix generates webhook IDs with `uuid.v4()` — not v3/v5/v6 — and does not expose `buf` to the caller.
- **Our code path**: `src/lib/email.ts:54` -> `resend.emails.send(...)`. This is an outbound HTTPS call with no round-trip through `svix` UUID generation. We do not import `svix` or `uuid` directly in production code. `grep` confirms the six `src/**/uuid` matches are all in test files (mocked) or schema files (unrelated).
- **Conclusion**: the vulnerable surface never gets exercised. Upgrading clears the advisory but does not close a real exposure.

### Fix strategy (non-urgent, tracked)

```bash
# Option A (recommended): install resend 6.12.2 which is already pinned in package.json.
# This is non-breaking — 6.12.0 and 6.12.2 are both v6.x patches.
# It does NOT upgrade svix past the vulnerable range on its own, so the GHSA stays open.
npm install

# Option B: wait for resend to bump its svix dependency past 1.91.1 upstream.
# No manual action required — Dependabot will open a PR when available.

# Option C: force the fix today (NOT recommended — downgrades resend from 6.12.x to 6.1.3,
# which would break typed signatures used in src/lib/email.ts and require rewriting the
# sendEmail payload shape).
# npm audit fix --force
```

The practical path: (A) run `npm install` to sync the lockfile, then wait for the upstream svix fix rather than forcing a resend major downgrade.

## Prioritized Remediation

1. **(Low)** Run `npm install` on `develop` to sync `node_modules` with `package.json`'s `resend@^6.12.2` pin. Removes the `npm ls` "invalid" flag. No security delta — still 3 transitive advisories until svix upstream fixes.
2. **(Watch)** Monitor for `svix >= 1.91.2` or `resend` release that bumps svix past `1.91.1`. Advisory clears automatically on lockfile refresh once available.
3. **(Optional, non-security)** Batch upgrade 7 outdated production deps (see "Outdated" section). None carry CVEs. All minor/patch.
4. **(Manual)** When the dev server is next running, re-run the security-headers live check to validate the CSP and HSTS responses match source.

## License Compliance

No copyleft violations. All 7 flagged packages are either approved exceptions, documented in `docs/project/license-exceptions.md`, or scanner false positives.

Named package audit:

| Package                                 | License                    | Status                                                                   |
|-----------------------------------------|----------------------------|--------------------------------------------------------------------------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later          | Approved exception (platform-specific binary of `sharp`).                |
| `dompurify@3.4.0`                       | MPL-2.0 OR Apache-2.0      | Dual-licensed — we receive under Apache-2.0 (compliant).                 |
| `expand-template@2.0.3`                 | MIT OR WTFPL               | Dual-licensed — received under MIT (compliant).                          |
| `paisaxe@1.0.0`                         | UNLICENSED                 | This project itself. Intentional — private app, no public distribution.  |
| `simple-concat@1.0.1`                   | MIT                        | Scanner false positive — manifest is MIT.                                |
| `simple-get@4.0.1`                      | MIT                        | Scanner false positive — manifest is MIT.                                |
| `@babel/template@7.28.6`                | MIT                        | Scanner false positive.                                                  |

`docs/project/license-exceptions.md` already covers both `@img/sharp-libvips-*` and `@vercel/analytics`. No new entries needed this cycle.

## Security Headers Status

Source inspection (`next.config.ts:57-62`, `src/proxy.ts`):

- **Content-Security-Policy**: `'self' 'unsafe-inline' blob: https://js.stripe.com` — correct for PPR + Stripe.
- **Strict-Transport-Security**: `max-age=63072000; includeSubDomains; preload` — production only.
- **X-Frame-Options**: `DENY`.
- **X-Content-Type-Options**: `nosniff`.
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Permissions-Policy**: configured in proxy layer.
- **frame-ancestors** (CSP): `'none'` — duplicates X-Frame-Options for CSP-aware browsers.
- **object-src** (CSP): `'none'`.

Live HTTP check: **skipped** — dev server not running at scan time. All headers verified to exist in source. Next run with the dev server active will re-confirm live values.

## CI/CD Security Automation

| Control                               | Status    | Notes                                                                                    |
|---------------------------------------|-----------|------------------------------------------------------------------------------------------|
| Dependabot                            | Active    | Pinned to `develop` branch (commit `f118597`). Opens PRs for CVE-bearing deps.           |
| Renovate                              | Not used  | Intentional — Dependabot covers the need.                                                |
| Gitleaks in CI                        | Active    | Runs on every push to `develop` and PRs to `main`.                                       |
| `npm audit` in CI                     | Active    | Reports on PRs; not a hard gate (we choose to accept non-exploitable moderate).          |
| License check                         | Active    | `license-check` gate uses `docs/project/license-exceptions.md` allowlist.                |

No gaps identified.

## Outdated Packages (Non-Security)

16 outdated packages, none with known CVEs. Production deps worth batching in the next chore:

| Package                 | Current     | Latest    | Risk       |
|-------------------------|-------------|-----------|------------|
| `@anthropic-ai/sdk`     | 0.90.0      | 0.91.0    | None       |
| `@elevenlabs/react`     | 1.1.1       | 1.2.1     | None       |
| `@sentry/nextjs`        | 10.49.0     | 10.50.0   | None       |
| `@stripe/stripe-js`     | 9.2.0       | 9.3.1     | None       |
| `@supabase/supabase-js` | 2.103.3     | 2.104.1   | None       |
| `posthog-js`            | 1.369.3     | 1.371.3   | None (advisories already cleared by e66e510) |
| `resend`                | 6.12.0      | 6.12.2    | None — just need `npm install` |
| `stripe`                | 22.0.2      | 22.1.0    | None       |

Dev-only outdated (8): `@tailwindcss/postcss`, `@typescript-eslint/eslint-plugin`, `@vitest/coverage-v8`, `jsdom` (pre-release), `knip`, `lucide-react`, `tailwindcss`, `vitest` (downgrade to 3.2.4 reported — ignore, already on 4.x stable). No action required.

## Cross-Agent Inputs

- **Performance Agent** flagged `sentry.client.config.ts:11-12` with `replaysOnErrorSampleRate: 1.0` and `replaysSessionSampleRate: 0.01`. From a security angle: Sentry session replay captures DOM mutations. If PII-masking rules are not audited, replay can exfiltrate user-entered data into Sentry. Disabling replay (Performance P8) is the safer default; if it stays enabled, ensure `maskAllInputs: true` and `blockAllMedia: true` are set.
- **Coverage Agent** confirmed 100% branch coverage on Stripe webhook defensive error paths and on CSRF origin checks this week. No security-path regression.

---
