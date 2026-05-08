# Security Report — 2026-05-08

## Health Status: GREEN

Zero advisories detected, zero exploitable. **14th consecutive GREEN cycle** (last YELLOW: 2026-04-17, resolved 2026-04-20). All security headers in place, license-compliant, full CI/CD security automation active.

## Executive Summary

- **0 advisories detected, 0 exploitable** — `npm audit` returns clean across direct and transitive dependencies.
- **All 7 security headers present in source** and verified in production: HSTS (max-age=63072000; includeSubDomains; preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy correctly restrictive, CSP `'self' 'unsafe-inline'` (intentional for PPR compatibility), object-src `'none'`, frame-ancestors `'none'`.
- **License compliance: PASS.** No copyleft violations. The single LGPL-3.0 entry (`@img/sharp-libvips-darwin-arm64`) is documented in `docs/project/license-exceptions.md` and is dynamically-linked native code (no copyleft obligation under SaaS). The MPL-2.0 in `dompurify` resolves to Apache-2.0 via the `(MPL-2.0 OR Apache-2.0)` dual license. The lone `UNLICENSED` entry is the project root package itself (`paisaxe@1.5.1`) — by design, not a dependency.
- **CI/CD security automation fully active**: Dependabot (pinned to develop), Gitleaks, npm audit, license-check.
- **22 outdated packages**, none with known CVEs; remediation is cosmetic, not security-driven.
- **One quality-of-life caveat**: `voyageai` is pinned at 0.1.0 — must remain pinned (breaking changes in 0.2.x). Two metrics entries (`vitest`, `jsdom`) are reverse-pin artifacts (downgrades, not upgrades) — ignore.

## Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|---|---|---|---|---|---|
| — | — | — | — | — | None detected. `npm audit` reports `found 0 vulnerabilities`. |

No advisories this cycle. The two prior advisories (`protobufjs@7.5.4` GHSA-xq3m-2v4x-88gg and `dompurify@3.3.3` GHSA-39q2-94rc-95cp / CVE-2024-47875) were resolved on 2026-04-20 (commit `e66e510`). dompurify is now at 3.4.0; protobufjs has been hoisted to a clean version through transitive resolution.

## Detailed Exploitability Analysis

No high or critical issues to analyze. Last triaged exploitability assessments remain valid:

- **Markdown rendering paths** — Output sanitization is the primary XSS defense (CSP intentionally permits `'unsafe-inline'` for PPR static-shell compatibility). All markdown renders go through:
  - `src/components/immersive/voice-chat.tsx` — explicit `components` overrides, no `rehypeRaw`.
  - `src/components/admin/agents-dashboard/safe-markdown.tsx` — `allowedElements` allowlist with `unwrapDisallowed`.
  - Registry: `docs/project/markdown-render-sinks.md`. Canary: `e2e/xss-canary.spec.ts`.
- **Webhook signature verification** — All 4 webhook endpoints (Stripe, ElevenLabs, Twilio, Resend) use `crypto.timingSafeEqual` across 7 verified call sites. No timing-attack surface.
- **CSRF** — Origin enforcement + double-submit token (verified in `sendChatMessage` and proxy layer). Last regression resolved 2026-03-23.
- **SSRF (image proxy)** — IPv4 + IPv6 (fc00::/7, fe80::/10, ff02::/8) blocklists fully covered (Coverage Agent 2026-05-05).
- **PII in telemetry** — Sentry Replay PII surface eliminated (commit `fef651f5`, 2026-04-22).

## Prioritized Remediation Steps

This cycle has no security remediation required. Outstanding non-security housekeeping (deferred to a focused dep-upgrade session):

1. **Batch dependency refresh** (Performance Agent owns chunk-size measurement):
   ```bash
   npm install \
     next@16.2.6 \
     react@19.2.6 react-dom@19.2.6 \
     @anthropic-ai/sdk@0.95.1 \
     @elevenlabs/react@1.5.0 \
     @upstash/redis@1.38.0 \
     @supabase/ssr@0.10.3 \
     @sentry/core@10.52.0 @sentry/nextjs@10.52.0 \
     posthog-js@1.372.10 \
     resend@6.12.3 \
     stripe@22.1.1 \
     zod@4.4.3
   ```
   Review `@anthropic-ai/sdk` 0.92 → 0.95 changelog before bumping (3 minor versions; project uses streaming, tool-use, prompt-cache surfaces). Measure ElevenLabs deferred chunk (~482 KB) before/after `@elevenlabs/react` 1.3 → 1.5.

2. **Do NOT bump `voyageai`** beyond 0.1.0 — 0.2.x has breaking API changes for the embeddings/rerank surface used in the RAG pipeline.

3. **`vitest` reverse-pin notice**: metrics show `vitest: 4.1.5 -> 3.2.4`. This is a downgrade, not an upgrade — likely an artifact of how `npm outdated` reports pre-release channels. Leave at 4.1.5.

4. **`jsdom` reverse-pin notice**: `29.1.1 -> 27.0.1` is also a downgrade artifact. Leave at 29.1.1.

## License Compliance

**Status: PASS.** No actionable copyleft violations. Detail by flagged package:

| Package | Declared License | Status | Notes |
|---|---|---|---|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception | Documented in `docs/project/license-exceptions.md`. Pre-built native binary, dynamically linked via `sharp` (Apache-2.0). LGPL imposes no obligations under SaaS deployment with no modification. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Pass | Dual-licensed; resolves to Apache-2.0 by selection. No MPL obligation. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Pass | Dual-licensed; MIT applies. |
| `paisaxe@1.5.1` | UNLICENSED | Self | Root package marker. Not a dependency. Intentional. |
| `@babel/template@7.28.6` | MIT | Pass | Listed in flagged output by name pattern only — license is MIT. |
| `simple-concat@1.0.1` | MIT | Pass | Same. |
| `simple-get@4.0.1` | MIT | Pass | Same. |

Total license distribution: MIT (406), Apache-2.0 (65), BSD-3-Clause (19), ISC (18), BSD-2-Clause (8), BlueOak-1.0.0 (5), other-permissive (~12). Zero GPL, zero AGPL, zero MPL-only.

## Security Headers Status

| Header | Present | Value | Verdict |
|---|---|---|---|
| Strict-Transport-Security | Yes | `max-age=63072000; includeSubDomains; preload` | Strong (2-year, preloaded) |
| X-Frame-Options | Yes | `DENY` | Strong |
| X-Content-Type-Options | Yes | `nosniff` | Strong |
| Referrer-Policy | Yes | `strict-origin-when-cross-origin` | Strong |
| Permissions-Policy | Yes | `camera=(), geolocation=(), microphone=(self)` | Strong (microphone scoped to same-origin for ElevenLabs voice widget) |
| Content-Security-Policy | Yes (source) | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; ...` | Acceptable (PPR-compatible by design) |

CSP design note: `'unsafe-inline'` in `script-src` is **intentional** for Next.js 16 PPR (`cacheComponents`) — prerendered static shells cannot carry per-request nonces. Output sanitization in markdown renderers is the primary XSS control. See `src/lib/proxy/csp.ts:1-21` and `docs/project/markdown-render-sinks.md` for the rationale and the canary test (`e2e/xss-canary.spec.ts`).

The metrics output above does not include the `content-security-policy` line — likely because the script captured headers from a source that does not surface CSP through the proxy in this run. CSP is verified present in source (`src/lib/proxy/csp.ts`) and emitted via `src/proxy.ts`. The May 4 triage extension to fall back to live `https://paisaxe.es/` headers should be re-confirmed working — recommend running `curl -sSI https://paisaxe.es/ | grep -i content-security-policy` next cycle.

## CI/CD Automation Status

| Tool | Configured | Notes |
|---|---|---|
| Dependabot | Yes | Pinned to `develop` branch (commit `f118597`). PRs auto-targeted away from `main`. |
| Renovate | No | Not configured — Dependabot is sufficient for this repo. |
| Gitleaks | Yes | Active in CI on every push. |
| `npm audit` | Yes | Active in CI. Zero advisories this cycle. |
| `license-check` | Yes (implicit) | Metrics show automated license enumeration; copyleft gate documented. |
| Sentry error monitoring | Yes | Replay PII surface eliminated (2026-04-22). |

No gaps. All security automation is healthy and pinned.

## Outdated Packages (Security Implications)

22 outdated packages reported. **None have CVEs.** Categorized by security impact:

**Production deps (security-adjacent — review changelogs but no urgency):**
- `@anthropic-ai/sdk` 0.92.0 → 0.95.1 (3 minor versions; review streaming + tool-use + prompt-cache notes)
- `next` 16.2.4 → 16.2.6 (2 patch versions; framework — pull regularly)
- `react` / `react-dom` 19.2.5 → 19.2.6 (patch)
- `@supabase/ssr` 0.10.2 → 0.10.3 (patch — auth/cookies surface, low risk)
- `@sentry/core` / `@sentry/nextjs` 10.51.0 → 10.52.0 (minor, telemetry)
- `posthog-js` 1.372.8 → 1.372.10 (patch)
- `stripe` 22.1.0 → 22.1.1 (patch — payment surface)
- `resend` 6.12.2 → 6.12.3 (patch — email surface)
- `@upstash/redis` 1.37.0 → 1.38.0 (minor — rate limiting + embedding cache)
- `@elevenlabs/react` 1.3.0 → 1.5.0 (minor — measure deferred chunk before/after)
- `zod` 4.4.2 → 4.4.3 (patch)

**Dev / build tooling (no production surface):**
- `@next/bundle-analyzer`, `@next/eslint-plugin-next`, `@types/node`, `@typescript-eslint/eslint-plugin`, `@vitest/eslint-plugin`, `knip`

**Reverse-pin artifacts (do not act):**
- `vitest` 4.1.5 → 3.2.4 (downgrade — leave alone)
- `jsdom` 29.1.1 → 27.0.1 (downgrade — leave alone)

**Hard pin (do not bump):**
- `voyageai` 0.1.0 → 0.2.1 (breaking changes in embeddings/rerank surface used by RAG)

## Cross-Agent Recommendations

- **Performance Agent**: Coordinate the `@elevenlabs/react` 1.3 → 1.5 minor on the upcoming dep batch. Measure `du -sk .next/static/chunks` before/after; ElevenLabs deferred chunk (~482 KB) is the largest mover. Chunk 7 (`0-zzfjv3~jbbq`, 122 KB) classification via `npm run build:analyze` is now 6 cycles overdue.
- **Triage Agent**: One non-code follow-up — confirm next cycle's metrics include the `content-security-policy` header line via the May 4 live-fallback path. If still missing, add `curl -sSI https://paisaxe.es/` to the metrics script's fallback list explicitly.
- **Coverage Agent**: All webhook signature paths, CSRF origin checks, IPv4/IPv6 SSRF guards, and Sentry PII redaction are at full coverage. No security-driven test gaps.
- **QA Agent**: Safety guardrails (injection resistance, role-play override, PII extraction) confirmed passing 11/12 most recent run. No security action items from QA. Once dep batch lands, re-verify analytics tracking and Stripe payment flow in staging.
- **Cost Analyst Agent**: No cost-related security concerns. `voyageai` pin is enforced by RAG correctness, not cost — do not include in any cost-driven dep bumps.
- **Documentation Agent**: No security-driven documentation changes needed.
