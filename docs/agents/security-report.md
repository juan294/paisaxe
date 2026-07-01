# Security Report — Paisaxe

**Date**: 2026-07-01
**Branch**: develop @ `6a9c73cc`
**Package version**: 1.6.0

## 1. Health Status: GREEN

Zero advisories, zero exploitable vulnerabilities. Third consecutive GREEN cycle since the Apr 25 postcss/uuid batch was cleared. License compliance intact, all security headers confirmed in source, CI/CD security automation fully active.

## 2. Executive Summary

`npm audit` reports **0 advisories, 0 exploitable** across both production-only (`--omit=dev`) and full dependency trees — confirmed by independent re-run, not just the provided metrics snapshot. License compliance holds: no unapproved copyleft packages in production. All 6 security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are present in source and match the live scan. 13 outdated packages, all minor/patch, zero CVEs. CI/CD security automation (Dependabot, Gitleaks, npm audit) is fully wired and running daily.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA/CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------------------|---------------|---------|------------------|
| — | — | None found | — | — | Clean scan |

No entries. `npm audit` (production) and `npm audit` (full tree, informational) both return "found 0 vulnerabilities."

## 4. Detailed Exploitability Analysis

Not applicable this cycle — no high/critical advisories to analyze. For historical reference, the most recent resolved advisories were:
- **protobufjs GHSA-xq3m-2v4x-88gg** (Critical, transitive via `posthog-js` → `@opentelemetry/otlp-transformer`) — resolved 2026-04-20, was never exploitable here (serialized internal telemetry, not user input).
- **dompurify GHSA-39q2-94rc-95cp** (Moderate, transitive via `posthog-js`) — resolved 2026-04-20, was never exploitable here (no application code calls DOMPurify directly).
- **postcss GHSA-qx2v-qp2m-jg93** and **uuid GHSA-w5hq-g745-h8pq** chains — resolved 2026-04-25 via `overrides` pin and lockfile sync.

## 5. Prioritized Remediation Steps

No remediation required this cycle. Routine maintenance only:

1. **Optional**: `npm install @radix-ui/react-dialog@1.1.18 @radix-ui/react-label@2.1.11 @radix-ui/react-select@2.3.2 @radix-ui/react-tooltip@1.2.11 @tailwindcss/postcss@4.3.2 tailwindcss@4.3.2 postcss@8.5.16 @typescript-eslint/eslint-plugin@8.62.1 @supabase/supabase-js@2.110.0 posthog-js@1.396.3 @anthropic-ai/sdk@0.109.0` — all patch/minor bumps, zero CVEs, low risk. Can be batched via Dependabot's existing weekly PR groups rather than done manually.
2. No manual/breaking-change upgrades required (`jsdom` and `vitest` show "Latest" versions numerically lower than "Current" in `npm outdated` — this is an npm dist-tag artifact, not a downgrade opportunity; current installed versions are ahead of the `latest` dist-tag, likely pre-release/next-major channel noise. No action needed.)

## 6. License Compliance

**No copyleft violations.** All flagged packages are either approved exceptions (documented in `docs/project/license-exceptions.md`) or false positives from dual-licensing:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4`, `@1.3.1` | LGPL-3.0-or-later | **Approved** — Exception 1 in license-exceptions.md. Pre-built native binary, dynamically linked via `sharp`, no modifications, SaaS deployment (no distribution obligation). |
| `lightningcss@1.32.0` + `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | **Approved** — Exception 3. Dev/build-time only (Tailwind v4 / Vite tooling), never shipped to clients. |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | **Not a violation** — dual-licensed; the project can rely on the Apache-2.0 option. No modifications made to the package. Not yet listed in license-exceptions.md; recommend adding a one-line note since it recurs in every scan. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | **Not a violation** — dual-licensed; MIT option applies. Transitive dep of `node-gyp-build`/prebuild tooling (dev-only). |
| `paisaxe@1.6.0` | UNLICENSED | **Expected** — this is the project's own `package.json`, not a third-party dependency. |
| `@babel/template@7.29.7`, `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT | Scanner false-positive grouping — these are plain MIT, not actually flagged licenses. No action needed. |

**Recommendation**: Add `dompurify` and `expand-template` as brief entries in `docs/project/license-exceptions.md` documenting the dual-license rationale, so they stop needing re-justification every cycle (they've appeared in every scan since license tracking began but were never formally recorded, unlike sharp-libvips and lightningcss).

## 7. Security Headers Status

All headers confirmed **both in source and in the live scan** — configuration matches deployment:

| Header | Value | Source location |
|--------|-------|------------------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | `src/proxy.ts:71`, built by `src/lib/proxy/csp.ts` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` (prod only) | `next.config.ts:65` |
| X-Content-Type-Options | `nosniff` | `next.config.ts:67` |
| X-Frame-Options | `DENY` | `next.config.ts:68` |
| Referrer-Policy | `strict-origin-when-cross-origin` | `next.config.ts:69` |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | `next.config.ts:70` |

Notes:
- CSP correctly avoids `'strict-dynamic'` and nonce-only policies, per the project's PPR compatibility constraint documented in CLAUDE.md — `'self' 'unsafe-inline'` is intentional, not an oversight.
- `object-src 'none'` and `frame-ancestors 'none'` are both set, closing common clickjacking and plugin-injection vectors.
- All 8 webhook/auth `timingSafeEqual` call sites verified present and unchanged: `translate/route.ts`, `webhooks/supabase/route.ts`, `cron-auth.ts` (x2), `csrf.ts`, `mcp-auth.ts`, `elevenlabs-webhook-service.ts`.

## 8. CI/CD Automation Status

| Control | Status | Detail |
|---------|--------|--------|
| Dependabot | **Active** | `.github/dependabot.yml` — weekly (Monday), npm + github-actions ecosystems, grouped PRs (production / dev-and-types), `voyageai` pinned <0.2.0 (broken ESM build workaround), target branch `develop` |
| Gitleaks | **Active** | `.github/workflows/security.yml` — `gitleaks detect --source . --verbose`, full history (`fetch-depth: 0`), runs on push/PR to develop+main and daily at 08:00 UTC |
| npm audit in CI | **Active** | Same workflow — `npm audit --omit=dev --audit-level=moderate` (blocking), plus a full-tree informational run (`always()`, non-blocking) |
| Renovate | Not configured | Dependabot covers this need; no gap. |
| Schedule | Daily (08:00 UTC) | Reduced from weekly — CVE detection latency down from ~6 days to <24h |
| Vercel env safety check | **Active** | Same workflow — asserts a legacy agent-runner override is absent from Vercel env (skips gracefully if `VERCEL_TOKEN`/project vars aren't set) |
| GitHub code/secret scanning (native) | **Unavailable** | Requires GitHub Advanced Security add-on on this private repo — an owner cost decision, not a code-actionable gap. Gitleaks in CI covers the secret-scanning function already. |

No gaps requiring code changes.

## 9. Outdated Packages

13 outdated packages, all production, all minor/patch bumps, **zero CVEs**:

| Package | Current | Wanted | Latest |
|---------|---------|--------|--------|
| `@anthropic-ai/sdk` | 0.106.0 | 0.106.0 | 0.109.0 |
| `@radix-ui/react-dialog` | 1.1.17 | 1.1.18 | 1.1.18 |
| `@radix-ui/react-label` | 2.1.10 | 2.1.11 | 2.1.11 |
| `@radix-ui/react-select` | 2.3.1 | 2.3.2 | 2.3.2 |
| `@radix-ui/react-tooltip` | 1.2.10 | 1.2.11 | 1.2.11 |
| `@supabase/supabase-js` | 2.108.2 | 2.110.0 | 2.110.0 |
| `@tailwindcss/postcss` | 4.3.1 | 4.3.2 | 4.3.2 |
| `@typescript-eslint/eslint-plugin` | 8.62.0 | 8.62.1 | 8.62.1 |
| `postcss` | 8.5.15 | 8.5.16 | 8.5.16 |
| `posthog-js` | 1.395.0 | 1.396.3 | 1.396.3 |
| `tailwindcss` | 4.3.1 | 4.3.2 | 4.3.2 |
| `jsdom` | 29.1.1 | 29.1.1 | 27.0.1* |
| `vitest` | 4.1.9 | 4.1.9 | 3.2.6* |

\* `jsdom`/`vitest` "Latest" columns are lower than "Current" — an npm dist-tag artifact (installed versions are ahead of the public `latest` tag), not an actual downgrade path. No action needed; flagged for transparency only.

None of these 13 carry security implications; this is routine dependency drift, safe to batch through the existing Dependabot weekly PR groups.

## Cross-Agent Context Reviewed

- Confirmed Triage's 2026-06-25 note that `@babel/core` GHSA-4x5r-pxfx-6jf8 (LOW) self-resolved — `@babel/template@7.29.7` in the current scan is plain MIT with no advisory.
- Confirmed Performance Agent's Jun 28-30 note that dead-code removal candidates (`chat/route.ts:93`, `stream/route.ts:94`, `use-stories.ts:264-270`, `agents/run/route.ts:212,221`) are safe from a security perspective — reviewed again, no security-relevant logic in any of the four sites (all are unreachable defensive/redundant guards).
- No new findings from Coverage Agent's Jun 30 report affect security posture — `String(err)` branch coverage additions don't change catch-block behavior.

---
