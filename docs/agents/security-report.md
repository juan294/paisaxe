# Security Agent Report — 2026-05-14

## Health Status: YELLOW

2 advisories detected, 0 exploitable. Both stem from a single transitive dependency chain (`protobufjs` via `@opentelemetry/otlp-transformer` via `posthog-js`). Fixable via `npm audit fix` (lockfile-only, no breaking changes).

## Executive Summary

- **2 advisories detected, 0 exploitable** in production attack surface.
- Both advisories collapse to one root package: **protobufjs <=7.5.5** (high) and its bundled **@protobufjs/utf8** sub-package (moderate).
- All vulnerable code paths are reached only via OpenTelemetry telemetry serialization inside `posthog-js`. No user-controlled input flows into protobuf decoding in Paisaxe.
- `npm audit fix` resolves both with a lockfile-only update.
- 0 copyleft violations. All flagged license packages remain documented in `docs/project/license-exceptions.md`.
- All five core security headers present and correctly configured.
- CI/CD security automation: Dependabot, Gitleaks, npm audit all active; Renovate intentionally absent.

## Vulnerability Table

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| High | protobufjs <=7.5.5 | GHSA-q6x5-8v7m-xcrf (overlong UTF-8), GHSA-2pr8-phx7-x9h3 (DoS via field names), GHSA-66ff-xgx4-vchm (code injection via bytes defaults), GHSA-fx83-v9x8-x52w (prototype injection), GHSA-75px-5xx7-5xc7 (codegen gadget post-prototype-pollution), GHSA-jvwf-75h9-cwgg (process-wide DoS via option paths), GHSA-685m-2w69-288q (unbounded recursion DoS) | Requires attacker-controlled `.proto` schemas or untrusted protobuf wire input | Yes (`npm audit fix`) | NOT EXPLOITABLE — protobufjs is only used by `@opentelemetry/otlp-transformer` to serialize internal PostHog telemetry. No user input reaches the decoder. |
| Moderate | @protobufjs/utf8 <=1.1.0 | GHSA-q6x5-8v7m-xcrf | Same as above (sub-dep of protobufjs) | Yes (`npm audit fix`) | NOT EXPLOITABLE — same chain, no user input path. |

## Exploitability Analysis (High Advisories)

### protobufjs (GHSA-q6x5-8v7m-xcrf and 6 others)

**Dependency chain**: `posthog-js → @opentelemetry/otlp-transformer → protobufjs`

**What protobufjs does in this codebase**: PostHog's OpenTelemetry integration uses protobufjs to encode telemetry events when sending to its OTLP endpoint. The decoding side of protobufjs (which is where every CVE in this batch lives — overlong UTF-8, prototype injection, unbounded recursion) is never invoked by application code.

**Why these CVEs do not apply here**:
1. **GHSA-q6x5-8v7m-xcrf / GHSA-685m-2w69-288q (decoder DoS)**: We only call the encoder. The decoder runs on the receiving service (PostHog's cloud OTLP endpoint), not in this process.
2. **GHSA-66ff-xgx4-vchm / GHSA-fx83-v9x8-x52w / GHSA-75px-5xx7-5xc7 (code injection via generated code)**: These require attacker-controlled `.proto` schema files. All `.proto` schemas in our build come from the pinned `@opentelemetry/otlp-transformer` package; no user-supplied schemas are loaded at runtime.
3. **GHSA-jvwf-75h9-cwgg (option path DoS)**: Requires programmatic access to protobufjs's options API. We have zero `protobufjs` imports in `src/`.

**Fix**: `npm audit fix` performs a transitive bump (lockfile-only). Pattern matches the prior `dompurify`/`protobufjs` cycle resolved cleanly in April.

## Prioritized Remediation Steps

1. **Run `npm audit fix`** (lockfile-only, no breaking changes). Verify with `npm audit` afterward — expect 0 advisories.
2. **Batch with low-risk patch upgrades carried over from prior cycles**:
   - `@anthropic-ai/sdk` 0.93.0 → 0.96.0
   - `tailwind-merge` 3.5.0 → 3.6.0
   - `next` 16.2.4 → 16.2.6 (patch)
   - `@sentry/nextjs` 10.51.0 → 10.53.1
   - `posthog-js` 1.372.8 → 1.373.4 (pulls newer telemetry transitives)
3. **Skip**: `jsdom` 29.1.1 → 27.0.1 (channel artifact — downgrade target), `vitest` 4.1.5 → 3.2.4 (likewise), `voyageai` 0.1.0 → 0.2.1 (hard-pinned, known breaking).
4. **No manual code changes required.** All advisories resolve via dependency bumps.

## License Compliance

**Copyleft detected: false.** No GPL, AGPL, or unapproved copyleft. All flagged packages are pre-approved exceptions documented in `docs/project/license-exceptions.md`.

Flagged packages by name:

| Package | License | Status |
|---------|---------|--------|
| @img/sharp-libvips-darwin-arm64@1.2.4 | LGPL-3.0-or-later | Approved — native binary, dynamic load only |
| dompurify@3.4.0 | (MPL-2.0 OR Apache-2.0) | Approved — dual-licensed, we use under Apache-2.0 |
| expand-template@2.0.3 | (MIT OR WTFPL) | Approved — we use under MIT |
| paisaxe@1.5.1 | UNLICENSED | Self (our own package — expected) |
| simple-concat@1.0.1 | MIT | Standard MIT — no action |
| simple-get@4.0.1 | MIT | Standard MIT — no action |
| @babel/template@7.28.6 | MIT | Standard MIT — no action |

## Security Headers

All five core headers present:

| Header | Value | Status |
|--------|-------|--------|
| strict-transport-security | max-age=63072000; includeSubDomains; preload | Pass |
| x-content-type-options | nosniff | Pass |
| x-frame-options | DENY | Pass |
| referrer-policy | strict-origin-when-cross-origin | Pass |
| permissions-policy | camera=(), geolocation=(), microphone=(self) | Pass |
| content-security-policy | Verified present in source; live capture requires `curl -L` to follow 308 redirect to 200 response | Pass |

CSP source policy: `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com` — correct for PPR compatibility per CLAUDE.md (no `'strict-dynamic'`, no nonce-only).

## CI/CD Security Automation

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Pinned to develop branch |
| Renovate | Not configured | Intentional — Dependabot handles dep updates |
| Gitleaks | Active in CI | Scans every PR + git history |
| npm audit | Active in CI | Runs on every PR |
| license-check | Active in CI | Enforces approved license list |

No gaps. CSRF double-submit token enforcement (SE-M2) confirmed working in production since 2026-03-23.

## Outdated Packages — Security Implications

28 outdated packages reported. None have known CVEs beyond the protobufjs chain already addressed above.

**Production deps worth prioritizing**:
- `posthog-js` 1.372.8 → 1.373.4 (pulls newer transitives — recommended alongside `npm audit fix`)
- `@anthropic-ai/sdk` 0.93.0 → 0.96.0
- `next` 16.2.4 → 16.2.6 (framework patch)
- `@sentry/nextjs` 10.51.0 → 10.53.1
- `@stripe/stripe-js` 9.4.0 → 9.5.0
- `@supabase/supabase-js` 2.105.3 → 2.105.4 (patch)
- `react` / `react-dom` 19.2.5 → 19.2.6 (patch)
- `resend` 6.12.2 → 6.12.3
- `stripe` 22.1.0 → 22.1.1

**Dev-tooling — lower urgency, no CVEs**: `@playwright/test`, `@typescript-eslint/eslint-plugin`, `knip`, `@vitest/coverage-v8`, `@types/node`, `@tailwindcss/postcss`, `tailwindcss`, `@next/bundle-analyzer`, `@next/eslint-plugin-next`, `@upstash/redis`, `@supabase/ssr`.

**Skip**: `jsdom`, `vitest` (channel artifacts), `voyageai` (hard-pinned at 0.1.0 — do not upgrade).
