# Security Report — Paisaxe

**Date:** 2026-07-17
**Agent:** Security Agent
**Health status:** GREEN

## 1. Health Status: GREEN

Zero advisories, zero exploitable. No security action items this cycle.

## 2. Executive Summary

**0 advisories detected, 0 exploitable.** `npm audit` returns "found 0 vulnerabilities" across the full dependency tree (production and dev). There is no vulnerability table to populate this cycle and no remediation to prioritize.

The two independent advisory chains tracked earlier in the year (the postcss XSS chain, GHSA-qx2v-qp2m-jg93, and the uuid bounds-check chain, GHSA-w5hq-g745-h8pq) are both fully cleared. The `protobufjs` (GHSA-xq3m-2v4x-88gg, Critical) and `dompurify` (GHSA-39q2-94rc-95cp, Moderate) advisories resolved in April remain cleared: `dompurify` now resolves to 3.4.11 via `posthog-js@1.400.1`, well past the 3.3.3 fix boundary.

Two security-relevant changes landed since the last cycle, both verified at source:

- **`5956d953`** moved `createAdminClient()` in the translate webhook to *after* the `x-webhook-secret` check. Confirmed by reading `src/app/api/webhooks/translate/route.ts` — the admin client is now constructed following the 401 return, matching the pattern the stripe and elevenlabs webhooks already used. This was a fail-mode correctness fix (unauthenticated requests returned 500 instead of 401 when `SUPABASE_SERVICE_ROLE_KEY` was unset), not a privilege-escalation fix — the service-role client was never *used* before the auth check, only constructed. No secret was exposed by the old ordering. Still the right change: an unauthenticated caller should never trigger service-role client construction, and the 500-vs-401 difference is a small information-disclosure signal about env configuration.
- **`.github/dependabot.yml`** now gates both dependency groups to `update-types: ["minor", "patch"]`. Read at source and confirmed. This is a genuine supply-chain-hygiene improvement: a major version bump can no longer ride silently into a batch PR alongside safe updates. The comment in the file correctly notes this is semver-based rather than a per-package allowlist, so it holds for the next major in any package.

## 3. Vulnerability Table

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|---|---|---|---|---|---|
| — | — | — | — | — | No advisories detected |

`npm audit` output, verbatim: `found 0 vulnerabilities`.

## 4. Exploitability Analysis

No high or critical issues exist to analyze. Recording the standing exploitability posture for the two chains most recently cleared, so a future regression can be assessed quickly without re-deriving the analysis:

**`dompurify` (transitive, via `posthog-js` only).** `npm ls dompurify` confirms exactly one path: `paisaxe@1.6.0 -> posthog-js@1.400.1 -> dompurify@3.4.11`. A grep for `DOMPurify|dompurify` across `src/` returns zero matches — no application code calls DOMPurify directly. Any future DOMPurify sanitizer-bypass advisory would therefore only be reachable through PostHog's internal analytics path, not through a user-input sanitization path in this codebase. That materially lowers the exploitability of any such advisory here, though it does not reduce it to zero (PostHog processes DOM content).

**`protobufjs` (transitive, via the OpenTelemetry chain).** Used to serialize internal telemetry, not user input. Exploitation requires control of the OpenTelemetry pipeline data, which no untrusted party has.

## 5. Prioritized Remediation Steps

Nothing security-driven. The only dependency action available is routine hygiene:

```bash
# Safe minor/patch batch — 11 of the 12 outdated packages
npm update
npm run test && npm run typecheck && npm run lint
```

Do **not** include `typescript` in that batch (see Section 9).

## 6. License Compliance

**Pass.** No copyleft violations in production or dev. The scan's own summary confirms: `COPYLEFT LICENSES FOUND (production deps): false` and the same for dev/build deps.

Every flagged package, named explicitly:

| Package | License | Scope | Status |
|---|---|---|---|
| `@img/sharp-libvips-darwin-arm64@1.2.4`, `@img/sharp-libvips-darwin-arm64@1.3.2` | LGPL-3.0-or-later | Production (via `sharp@^0.35.3`, Apache-2.0) | Approved — Exception 1 in `docs/project/license-exceptions.md`. Weak copyleft; pre-built native binary, dynamically linked, SaaS deployment. No obligations. |
| `lightningcss@1.32.0`, `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Dev/build only (Tailwind v4 + Vite) | Approved — Exception 3. File-level weak copyleft, build-time only, never bundled into client output. |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | Production (via `posthog-js`) | Not a violation — dual-licensed; the Apache-2.0 arm is selectable, so no MPL obligation attaches at all. |
| `paisaxe@1.6.0` | UNLICENSED | This repo | Expected. Private, unpublished project. Not a third-party risk. |
| `@sentry/cli@2.58.5`, `@sentry/cli-darwin@2.58.5` | FSL-1.1-MIT | Dev/build only | Acceptable. Functional Source License converts to MIT after two years; the only restriction is on building a competing product, which does not apply. Recorded previously (Jul 8). |
| `caniuse-lite@1.0.30001774` | CC-BY-4.0 | Dev/build | Acceptable — data, attribution-only. |
| `fast-sha256@1.3.0` | Unlicense | Production | Acceptable — public domain dedication. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Production | Acceptable — MIT arm selectable. |
| `@babel/template@7.29.7`, `simple-concat@1.0.1`, `simple-get@4.0.1` | MIT | Production | Scanner false positives — these are MIT and should not be in the flagged list. An artifact of the metrics script's matching, not a license concern. |

Two of the LGPL entries are the same package at two versions (`@img/sharp-libvips-darwin-arm64` at 1.2.4 and 1.3.2), meaning the tree carries a duplicate. Not a security or license issue — a minor dedup opportunity only.

CI enforcement verified at source (`.github/workflows/license-check.yml:31`): the blocking step runs `npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0;EUPL-1.1;EUPL-1.2;SSPL-1.0;BSL-1.1;CPAL-1.0;OSL-3.0;CPOL-1.02"`. Strong copyleft blocks on every PR; weak copyleft (LGPL/MPL) warns but does not block, consistent with the documented exception policy.

## 7. Security Headers

All headers present and correct. Verified against source, not only the live probe.

| Header | Value | Assessment |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ... object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Correct. No `'strict-dynamic'`, no nonce-gating — required for PPR compatibility per CLAUDE.md. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` all present. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Correct, 2-year max-age with preload. Production-gated at `next.config.ts:65` — deliberately not sent on localhost to avoid poisoning Chrome's HSTS cache. |
| `X-Frame-Options` | `DENY` | Correct (`next.config.ts:68`). |
| `X-Content-Type-Options` | `nosniff` | Correct. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Correct. |
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` | Correct. `microphone=(self)` is required for the ElevenLabs voice widget. |

**On the apparent CSP inconsistency in the raw metrics:** the probe output shows two header blocks, the second missing `Content-Security-Policy`. This is expected, not a gap. CSP is set per-request by `src/proxy.ts:71` (`response.headers.set("Content-Security-Policy", buildCspHeader())`) rather than statically in `next.config.ts`, and `src/proxy.test.ts:1118` and `:1644` assert that CSP is deliberately **not** set on API routes such as `GET /api/feature-flags`. A CSP on a JSON API response has no meaning — there is no document context to constrain. The second block is an API-route probe. Behavior is intentional and test-enforced.

## 8. CI/CD Security Automation

No gaps. All four controls active and verified at source.

| Control | Status | Evidence |
|---|---|---|
| Dependabot | Active | `.github/dependabot.yml` — npm ecosystem, weekly, pinned to `target-branch: develop`. Both groups now gated to minor/patch. `voyageai >= 0.2.0` correctly ignored (broken ESM build, Turbopack cannot resolve). |
| Gitleaks | Active | `.github/workflows/security.yml:34` — `./gitleaks detect --source . --verbose`. |
| npm audit | Active | `.github/workflows/security.yml:57` — `npm audit --omit=dev --audit-level=moderate` (blocking on production deps), plus a non-blocking full-tree pass at `:61`. |
| License check | Active | `.github/workflows/license-check.yml:31` — blocking on strong copyleft. |
| Renovate | Not configured | Not a gap. Dependabot covers the same ground; running both would produce duplicate PRs. No action recommended. |

**Standing gap (unchanged, owner decision):** GitHub code scanning and secret scanning remain unavailable — both require the GHAS add-on on this private repo. Gitleaks covers the secret-scanning surface in CI. This is a cost decision, not code-actionable.

## 9. Outdated Packages with Security Implications

12 outdated packages, **zero with CVEs**. Eleven are minor/patch and safe to batch. One requires isolation:

| Package | Current | Latest | Note |
|---|---|---|---|
| `typescript` | 6.0.3 | 7.0.2 | **Major — exclude from any batch.** This is the exact package that broke every CI check in Dependabot PR #726 by riding along in the "production" group. The `.github/dependabot.yml` fix means it will now arrive as its own standalone PR. Dev-only, zero CVEs, no urgency. Treat as a deliberate migration, not a batch item. |
| `@anthropic-ai/sdk` | 0.111.0 | 0.112.1 | Minor, production. |
| `@sentry/core`, `@sentry/nextjs` | 10.65.0 | 10.66.0 | Minor, production. Keep in lockstep. |
| `@supabase/supabase-js` | 2.110.5 | 2.110.7 | Patch, production. |
| `stripe` | 22.3.1 | 22.3.2 | Patch, production. Payment-path dep — worth taking. |
| `@stripe/react-stripe-js` | 6.7.0 | 6.8.0 | Minor, production. |
| `posthog-js` | 1.400.1 | 1.404.0 | Minor, production. Carries the `dompurify` transitive — keeping current is the cheapest way to stay ahead of sanitizer advisories. |
| `@elevenlabs/react` | 1.10.0 | 1.10.1 | Patch, production. Deferred chunk. |
| `@tailwindcss/postcss`, `tailwindcss` | 4.3.2 | 4.3.3 | Patch, build-time. Move together. |
| `knip` | 6.26.0 | 6.27.0 | Minor, dev-only. |

Per Performance Agent (Jul 15/16), the `posthog-js`, `supabase-js`, and `@elevenlabs/react` updates land in deferred or admin-only chunks and cannot touch first paint. Bundle impact is pre-cleared.

## 10. Other Controls Verified

- **Webhook signature verification:** `timingSafeEqual` confirmed present across all call sites — `src/app/api/webhooks/translate/route.ts`, `src/app/api/webhooks/supabase/route.ts`, `src/lib/services/elevenlabs-webhook-service.ts`, `src/lib/cron-auth.ts`, `src/lib/csrf.ts`, `src/lib/mcp-auth.ts`. No timing-unsafe string comparison in any auth path.
- **E2E signature-rejection coverage:** `e2e/webhooks.spec.ts` (landed Jul 15) covers all four webhook routes. This closes the ask carried in prior reports.
- **LLM safety guardrails:** Verified passing by QA this cycle (Jul 17) — prompt injection, role-play override, and authority impersonation all pass, plus all three boundary tests. QA's YELLOW is a latency/harness issue, not a safety regression. No blind cycle.

## 11. Cross-Agent Note: Harness Trust

Three agents (QA Jul 17, Performance Jul 15/16, Security Jul 8-10) have now independently reported the same class of defect: a probe fails silently and the harness reports a plausible-looking zero rather than an error. This agent's own `security-agent.sh` had exactly this bug (the `npm outdated --json` exit-1 fallback concatenating a second `{}`), fixed by Triage on Jul 10 and confirmed clean — this cycle's metrics show a single clean `OUTDATED PACKAGES: 12` line.

Worth stating plainly for the security posture: **a security scanner that fails open is a security problem, not just an ops annoyance.** An `npm audit` step that silently produced "0 vulnerabilities" on a crashed run would read exactly like this cycle's genuine GREEN. The CI `npm audit` at `security.yml:57` is safe here — it is blocking and unguarded, so a crash fails the job. But the same cannot be assumed for every probe in every agent script. The shared hardening pass across agent scripts that QA, Performance, and Coverage have each requested should be treated as security-relevant work, not only reliability work.

---
