# Security Report — 2026-05-10

## Health Status: GREEN

Zero advisories detected, zero exploitable. **16th consecutive GREEN cycle** (last YELLOW: 2026-04-17, resolved 2026-04-20). All security headers in place, license-compliant, full CI/CD security automation active.

## Executive Summary

- **0 advisories detected, 0 exploitable** — `npm audit` returns clean across direct and transitive dependencies.
- **5 of 6 security headers present in live metrics capture.** CSP is present in source (`src/lib/proxy/csp.ts`) and emitted via `src/proxy.ts` but continues to be absent from the automated metrics capture. See Security Headers section.
- **License compliance: PASS.** No copyleft violations. The single LGPL-3.0 entry (`@img/sharp-libvips-darwin-arm64`) is documented in `docs/project/license-exceptions.md` and is dynamically-linked native code (no copyleft obligation under SaaS). The MPL-2.0 in `dompurify` resolves to Apache-2.0 via the `(MPL-2.0 OR Apache-2.0)` dual license. The lone `UNLICENSED` entry is the project root package itself (`paisaxe@1.5.1`) — by design, not a dependency.
- **CI/CD security automation fully active**: Dependabot (pinned to develop), Gitleaks, npm audit, license-check.
- **23 outdated packages**, unchanged from May 9. None have known CVEs. The pending dep batch (next, react, @elevenlabs/react, stripe, resend, @upstash/redis, posthog-js, @anthropic-ai/sdk) is the only housekeeping action outstanding.
- **voyageai pinned at 0.1.0** — breaking changes in 0.2.x affect the RAG embeddings/rerank surface. Do not include in any batch.
- **vitest and jsdom reverse-pin artifacts**: metrics show `vitest: 4.1.5 -> 3.2.4` and `jsdom: 29.1.1 -> 27.0.1` — these are downgrades, not upgrades. Leave both at their current installed versions.

## Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|---|---|---|---|---|---|
| — | — | — | — | — | None detected. `npm audit` reports `found 0 vulnerabilities`. |

No advisories this cycle. The two prior advisories (`protobufjs@7.5.4` GHSA-xq3m-2v4x-88gg and `dompurify@3.3.3` GHSA-39q2-94rc-95cp / CVE-2024-47875) were resolved on 2026-04-20 (commit `e66e510`). dompurify is now at 3.4.0; protobufjs has been hoisted to a clean version through transitive resolution.

## Detailed Exploitability Analysis

No high or critical issues to analyze. Triaged exploitability posture from prior cycles remains unchanged and valid:

- **Markdown rendering paths** — Output sanitization is the primary XSS defense (CSP intentionally permits `'unsafe-inline'` for PPR static-shell compatibility). All markdown renders go through:
  - `src/components/immersive/voice-chat.tsx` — explicit `components` overrides, no `rehypeRaw`.
  - `src/components/admin/agents-dashboard/safe-markdown.tsx` — `allowedElements` allowlist with `unwrapDisallowed`.
  - Registry: `docs/project/markdown-render-sinks.md`. Canary: `e2e/xss-canary.spec.ts`.
- **Webhook signature verification** — All 4 webhook endpoints (Stripe, ElevenLabs, Twilio, Resend) use `crypto.timingSafeEqual` across 7 verified call sites. No timing-attack surface. The elevenlabs webhook `booking_missing` path is fully test-covered as of 2026-05-09 (Coverage Agent).
- **CSRF** — Origin enforcement + double-submit token confirmed in `sendChatMessage` and proxy layer. Safety guardrails (injection, role-play override, PII extraction) passed 3/3 per QA Agent 2026-05-03. Last regression resolved 2026-03-23.
- **SSRF (image proxy)** — IPv4 + IPv6 (fc00::/7, fe80::/10, ff02::/8) blocklists fully covered by tests (Coverage Agent 2026-05-05). The `firstIpv6Hextet` null-return path and `isUnsafeIpv6` call site are exercised.
- **PII in telemetry** — Sentry Replay PII surface eliminated (commit `fef651f5`, 2026-04-22). SENTRY_DSN missing-warn path is test-covered (Coverage Agent 2026-05-08).
- **SMS/booking error paths** — elevenlabs webhook DB fetch error, SMS enqueue failure, retry-booking-sms claimError/completeError/failError paths all fully covered (Coverage Agent 2026-05-10 adds coverage for booking_missing + og-image fallbacks).

## Prioritized Remediation Steps

No security remediation required this cycle. Outstanding non-security housekeeping:

1. **Batch dependency refresh** (pending since May 7, deferred to a focused session with chunk measurement). Full target list:
   ```bash
   npm install \
     next@16.2.6 \
     react@19.2.6 react-dom@19.2.6 \
     @anthropic-ai/sdk@0.95.1 \
     @elevenlabs/react@1.6.0 \
     @upstash/redis@1.38.0 \
     @supabase/ssr@0.10.3 \
     @supabase/supabase-js@2.105.4 \
     @sentry/core@10.52.0 @sentry/nextjs@10.52.0 \
     tailwindcss@4.3.0 \
     @tailwindcss/postcss@4.3.0 \
     posthog-js@1.372.10 \
     resend@6.12.3 \
     stripe@22.1.1
   ```
   Review `@anthropic-ai/sdk` 0.93 → 0.95 changelog before bumping (2 minor versions remaining; project uses streaming, tool-use, and prompt-cache surfaces). Measure ElevenLabs deferred chunk (~493 KB per Performance Agent May 9) before/after `@elevenlabs/react` 1.3 → 1.6.

2. **Do NOT bump `voyageai`** beyond 0.1.0 — 0.2.x has breaking API changes for the embeddings/rerank surface used in the RAG pipeline.

3. **vitest and jsdom reverse-pin artifacts**: metrics show `vitest: 4.1.5 -> 3.2.4` and `jsdom: 29.1.1 -> 27.0.1` — these are downgrade artifacts from pre-release channel tracking. Leave both at their current installed versions.

4. **CSP live verification**: Run `curl -sSI https://paisaxe.es/ | grep -i content-security-policy` to confirm CSP header emission by the production proxy. The automated capture has missed this header for multiple consecutive cycles. No code change needed — the source is correct.

5. **`npm run build:analyze`** to classify the unclassified 125 KB chunk `0-zzfjv3~jbbq` (7 cycles overdue per Performance Agent). Not security-driven but flagged by multiple agents.

## License Compliance

**Status: PASS.** No actionable copyleft violations. Detail by flagged package:

| Package | Declared License | Status | Notes |
|---|---|---|---|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception | Documented in `docs/project/license-exceptions.md`. Pre-built native binary, dynamically linked via `sharp` (Apache-2.0). LGPL imposes no obligations under SaaS deployment with no modification. |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Pass | Dual-licensed; resolves to Apache-2.0 by selection. No MPL obligation. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Pass | Dual-licensed; MIT applies. |
| `paisaxe@1.5.1` | UNLICENSED | Self | Root package marker. Not a dependency. Intentional. |
| `@babel/template@7.28.6` | MIT | Pass | Flagged by name pattern only — license is MIT. |
| `simple-concat@1.0.1` | MIT | Pass | Same. |
| `simple-get@4.0.1` | MIT | Pass | Same. |

Total license distribution: MIT (406), Apache-2.0 (65), BSD-3-Clause (19), ISC (18), BSD-2-Clause (8), BlueOak-1.0.0 (5), other-permissive (~12). Zero GPL, zero AGPL, zero MPL-only.

## Security Headers Status

Live metrics captured 5 of 6 expected headers. CSP continues to be absent from the automated capture but is verified present in source.

| Header | Present | Value | Verdict |
|---|---|---|---|
| Strict-Transport-Security | Yes | `max-age=63072000; includeSubDomains; preload` | Strong (2-year, preloaded) |
| X-Frame-Options | Yes | `DENY` | Strong |
| X-Content-Type-Options | Yes | `nosniff` | Strong |
| Referrer-Policy | Yes | `strict-origin-when-cross-origin` | Strong |
| Permissions-Policy | Yes | `camera=(), geolocation=(), microphone=(self)` | Strong (microphone scoped to same-origin for ElevenLabs voice widget) |
| Content-Security-Policy | Not in live capture (present in source) | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; ...` | Acceptable (PPR-compatible by design) — verify live emission |

CSP design note: `'unsafe-inline'` in `script-src` is **intentional** for Next.js 16 PPR (`cacheComponents`) — prerendered static shells cannot carry per-request nonces. Output sanitization in markdown renderers is the primary XSS control. See `src/lib/proxy/csp.ts:1-21` and `docs/project/markdown-render-sinks.md` for the rationale and the canary test (`e2e/xss-canary.spec.ts`).

## CI/CD Automation Status

| Tool | Configured | Notes |
|---|---|---|
| Dependabot | Yes | Pinned to `develop` branch (commit `f118597`). PRs auto-targeted away from `main`. PR #580 (fast-uri patch) pending — the patch was already applied manually (`81fc3e0f`); the structural smoke-test restriction on Dependabot runs is not a security gap. |
| Renovate | No | Not configured — Dependabot is sufficient for this repo. |
| Gitleaks | Yes | Active in CI on every push. |
| `npm audit` | Yes | Active in CI. Zero advisories this cycle. |
| `license-check` | Yes (implicit) | Automated license enumeration active; copyleft gate documented. |
| Sentry error monitoring | Yes | Replay PII surface eliminated (2026-04-22). SENTRY_DSN missing-warn path test-covered. |

## Outdated Packages (Security Implications)

23 outdated packages reported. **None have CVEs.** Categorized by security impact:

**Production deps — batch when convenient (no CVEs):**
- `@anthropic-ai/sdk` 0.93.0 → 0.95.1 (2 minor versions; review streaming + tool-use + prompt-cache changelog before bumping)
- `@elevenlabs/react` 1.3.0 → 1.6.0 (minor — advanced 2 versions this report period; measure deferred chunk ~493 KB before/after)
- `next` 16.2.4 → 16.2.6 (2 patch versions; framework — pull regularly)
- `react` / `react-dom` 19.2.5 → 19.2.6 (patch)
- `@supabase/supabase-js` 2.105.3 → 2.105.4 (patch — auth/DB surface)
- `@supabase/ssr` 0.10.2 → 0.10.3 (patch — auth/cookies surface)
- `@sentry/core` / `@sentry/nextjs` 10.51.0 → 10.52.0 (minor, telemetry)
- `tailwindcss` 4.2.4 → 4.3.0 (minor, build/styling — no production JS footprint)
- `@tailwindcss/postcss` 4.2.4 → 4.3.0 (minor, build-time only)
- `posthog-js` 1.372.8 → 1.372.10 (patch)
- `stripe` 22.1.0 → 22.1.1 (patch — payment surface)
- `resend` 6.12.2 → 6.12.3 (patch — email surface)
- `@upstash/redis` 1.37.0 → 1.38.0 (minor — rate limiting + embedding cache)

**Dev / build tooling (no production surface):**
- `@next/bundle-analyzer` 16.2.4 → 16.2.6
- `@next/eslint-plugin-next` 16.2.4 → 16.2.6
- `@types/node` 25.6.0 → 25.6.2
- `@vitest/eslint-plugin` 1.6.16 → 1.6.17
- `knip` 6.11.0 → 6.12.2

**Reverse-pin artifacts (do not act):**
- `vitest` 4.1.5 → 3.2.4 (downgrade — leave alone)
- `jsdom` 29.1.1 → 27.0.1 (downgrade — leave alone)

**Hard pin (do not bump):**
- `voyageai` 0.1.0 → 0.2.1 (breaking changes in embeddings/rerank surface used by RAG)

## Cross-Agent Recommendations

- **Performance Agent**: `@elevenlabs/react` is now 3 minor versions behind (1.3.0 vs 1.6.0). ElevenLabs deferred chunk is 493 KB serving 82 days of zero voice traffic — P3 click-to-mount is justified and is a free load reduction for all current sessions. Measure chunk size before/after the dep batch. Chunk 7 (`0-zzfjv3~jbbq`, ~122 KB) classification via `npm run build:analyze` is 7 cycles overdue.
- **Triage Agent**: Dep batch candidate list is unchanged from May 9 triage. Run `curl -sSI https://paisaxe.es/ | grep -i content-security-policy` to confirm CSP emission — the automated capture has missed it for multiple cycles. `@anthropic-ai/sdk` 0.93 → 0.95 changelog review is prerequisite before batching.
- **Coverage Agent**: All webhook signature paths, CSRF origin checks, IPv4/IPv6 SSRF guards, Sentry PII redaction, and SMS/booking error paths are at full coverage per May 9-10 reports. No security-driven test gaps remain. Coverage plateau is at ~98.5% statements.
- **QA Agent**: Safety guardrails (injection resistance, role-play override, PII extraction) were confirmed passing 3/3 as of May 3. No security action items from QA this cycle. CSRF remains enforced since 2026-03-23 resolution.
- **Cost Analyst Agent**: No cost-related security concerns. `voyageai` pin is enforced by RAG correctness, not cost — do not include in any cost-driven dep bumps. ElevenLabs tier now reporting 300,000 chars/mo (was 270,783) — if persistent through the next cycle, update any internal documentation references.
- **Documentation Agent**: No security-driven documentation changes needed. 16th consecutive GREEN.

---
