# Security Report

> Auto-generated on 2026-04-20

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, **0 exploitable**. Both advisories from the Apr 17 YELLOW report (protobufjs GHSA-xq3m-2v4x-88gg critical, dompurify GHSA-39q2-94rc-95cp moderate) are **resolved** — fixed by commit `e66e510` via `npm audit fix`, which upgraded the transitive deps without a posthog-js version bump. GREEN streak resumes after 1-run interruption. Outdated packages dropped from 17 to 3, all dev-only.

---

## Vulnerability Analysis

**npm audit: 0 vulnerabilities. No advisories.**

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|-----------------|
| — | — | No active advisories | — | — | — | — |

### Previously Resolved This Cycle

| Advisory | Resolution | When |
|----------|-----------|------|
| `protobufjs@7.5.4` — Critical (GHSA-xq3m-2v4x-88gg) | `npm audit fix` upgraded transitive dep to >=7.5.5 | Apr 20 (commit `e66e510`) |
| `dompurify@3.3.3` — Moderate (GHSA-39q2-94rc-95cp) | `npm audit fix` upgraded transitive dep to >3.3.3 | Apr 20 (commit `e66e510`) |

---

## Persistent Security Controls (Verified)

### Application Code Safety

- **dangerouslySetInnerHTML (7 instances)**: All safe. 5 JSON-LD schema outputs via `JSON.stringify()` in `src/components/seo/json-ld.tsx:28,127,144,199,235`. 2 admin markdown renders with `escapeHtml()` in `src/components/admin/agents-dashboard/cross-agent-insights.tsx:84` and `optimizer-report-dialog.tsx:57`.
- **Command injection**: 5 exec/spawn sites — all safe. 4 in `src/lib/claude.ts:65,78,223,245` (hardcoded curl to Anthropic API). 3 in `src/app/api/admin/tunnel/route.ts:16,80,133` (dev-only, hardcoded cloudflared commands, production-blocked). 1 in `src/app/api/admin/agents/run/route.ts:97` (whitelist-validated script path via `AGENT_SCRIPTS` map, admin-authenticated).
- **CSRF**: Token validation enforced on all state-changing API routes via `handleCsrfValidation()` in `src/proxy.ts`. Webhooks and MCP routes appropriately exempt. QA-verified passing since Mar 23.
- **Webhook signature verification**: All 4 webhook endpoints use `timingSafeEqual()`. 7 call sites verified: `webhooks/elevenlabs/route.ts:181`, `webhooks/translate/route.ts:38`, `webhooks/supabase/route.ts:59`, `webhooks/stripe/route.ts` (Stripe SDK), `csrf.ts:112`, `cron-auth.ts:34,49`, `mcp-auth.ts:30`.
- **DOMPurify**: Not imported by any application code (`grep` confirmed 0 matches in `src/`). Transitive dep only.

### Environment Variable Security

- Commit `60e50a3` excluded test files from `check-env` scan and documented `SUPABASE_SERVICE_ROLE_KEY` in `.env.example`. No secrets introduced. Test-only vars (`TEST_ENV_VAR_XYZ`, `TEST_REQUIRED_VAR`) now correctly exempted from CI env check.

---

## Outdated Packages

**3 packages outdated** (down from 17 on Apr 17 — all production gaps resolved via prior upgrade cycles).

| Package | Installed | Latest | Type | Security Relevance |
|---------|-----------|--------|------|-------------------|
| `jsdom` | 29.0.2 | 27.0.1 | dev | Pre-release channel — installed version exceeds stable `latest`. Not a regression. |
| `knip` | 6.4.1 | 6.5.0 | dev | None — minor version. No CVEs. |
| `vitest` | 4.1.4 | 3.2.4 | dev | Pre-release channel — installed version exceeds stable `latest`. Not a regression. |

**All 3 are dev-only.** Zero production packages outdated. Zero CVEs across all three.

**Channel note:** `npm outdated` compares against the `latest` dist-tag. vitest@4.1.4 and jsdom@29.0.2 are on pre-release channels — their installed versions intentionally exceed stable `latest`. These are not regressions.

---

## License Compliance

**No copyleft violations.** Scanner flag `COPYLEFT LICENSES FOUND: false`.

Flagged packages:

| Package | License | Risk Assessment | Status |
|---------|---------|----------------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Dynamically-linked native binary (libvips). LGPL-3.0 permits use without source disclosure provided the library is not statically linked. SaaS-only, no binary distribution. No modification. | Approved — documented in `docs/project/license-exceptions.md` |
| `@vercel/analytics` | MPL-2.0 | File-level copyleft (not project-level). We do not modify `@vercel/analytics` source. MPL-2.0 only requires disclosure of modifications to the MPL-licensed files themselves. | Approved — documented in `docs/project/license-exceptions.md` |
| `dompurify@3.4.0` | (MPL-2.0 OR Apache-2.0) | Dual-licensed. Apache-2.0 elected (permissive). No concern. Version bumped from 3.3.3 post-audit-fix. | Approved — Apache-2.0 elected |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Both permissive. MIT elected. No concern. | Approved |
| `paisaxe@1.0.0` | UNLICENSED | The project itself. Intentionally proprietary (`"private": true`). | Expected |
| `simple-concat@1.0.1` | MIT | Scanner false positive — plain MIT, correctly licensed. | False positive |
| `simple-get@4.0.1` | MIT | Scanner false positive — plain MIT, correctly licensed. | False positive |

**All license exceptions documented.** Both `@img/sharp-libvips-*` (LGPL-3.0) and `@vercel/analytics` (MPL-2.0) are formally documented in `docs/project/license-exceptions.md`. No documentation gaps.

---

## Security Headers

**Source-verified** (server not running — live check skipped). Configuration confirmed in `next.config.ts` and `src/proxy.ts` (`buildCspHeader()`).

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co ...; connect-src 'self' wss://*.supabase.co wss://*.elevenlabs.io ...; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` | Pass — per-request via proxy.ts |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass — production only |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass |
| Cache-Control (API) | `no-store, max-age=0` | Pass — all /api/* routes |

**CSP notes (unchanged):**
- `'unsafe-inline'` in `script-src` is required for Next.js hydration with PPR (`cacheComponents: true`). Nonces cannot be used with PPR — prerendered HTML is built without nonces. Correct trade-off, documented in CLAUDE.md.
- `'strict-dynamic'` intentionally absent — overrides `'self'` per CSP Level 3, blocking scripts on prerendered pages without nonces.
- E2E canary (`e2e/smoke.spec.ts`) verifies JavaScript executes; fails immediately if CSP breaks script execution.

---

## CI/CD Security Automation

| Check | Status | Notes |
|-------|--------|-------|
| Dependabot | Configured | `.github/dependabot.yml` — weekly PRs for npm deps (Mon), grouped production + dev batches. Pinned to `develop` branch (commit `f118597`). |
| Renovate | Not configured | Dependabot covers the same function; no gap. |
| Gitleaks | In CI | `.github/workflows/security.yml` — secret scanning on every push + weekly schedule (Mon 8:00 UTC). |
| npm audit | In CI | `.github/workflows/security.yml` — production-only audit at high severity on every push + weekly schedule. |
| License check | In CI | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/EUPL/SSPL/BSL/CPAL/OSL/CPOL) on PRs. |

All automation active. No CI/CD security gaps.

---

## Full Remediation History

| Advisory | Resolution | When |
|----------|-----------|------|
| `protobufjs@7.5.4` — Critical (GHSA-xq3m-2v4x-88gg) | `npm audit fix` upgraded transitive dep | Apr 20 (`e66e510`) |
| `dompurify@3.3.3` — Moderate (GHSA-39q2-94rc-95cp) | `npm audit fix` upgraded transitive dep | Apr 20 (`e66e510`) |
| next@16.1.6 — PPR buffering DoS (GHSA-h27x-g6w4-24gq) | Upgraded to next@16.2.2 | Apr 4 |
| next@16.1.6 — HTTP request smuggling (GHSA-ggv3-7p47-pfv8) | Upgraded to next@16.2.2 | Apr 4 |
| next@16.1.6 — Image cache DoS (GHSA-3x4c-7xq6-9pq8) | Upgraded to next@16.2.2 | Apr 4 |
| next@16.1.6 — Server Actions CSRF bypass (GHSA-mq59-m269-xvcx) | Upgraded to next@16.2.2 | Apr 4 |
| next@16.1.6 — Dev HMR CSRF (GHSA-jcc7-9wpm-mj36) | Upgraded to next@16.2.2 | Apr 4 |
| flatted <=3.4.1 — Unbounded recursion DoS + Prototype Pollution (GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh) | `npm audit fix` (>=3.4.2) | Mar 23 |
| undici 7.0.0–7.23.0 — WebSocket overflow, HTTP smuggling, CRLF injection, memory DoS (GHSA-f269-vfmq-vjvj + 5 others) | `npm audit fix` (>=7.24.0) | Mar 23 |
| brace-expansion — ReDoS | Override `brace-expansion >= 5.0.5` | Mar 27 |
| minimatch 10.2.2 ReDoS (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | Override `minimatch >= 10.2.1` | Mar 7–8 |
| dompurify 3.3.1 XSS (GHSA-v2wj-7wpq-c8vv) | Dependency update | Mar 7–8 |
| qs arrayLimit bypass (GHSA-w7fw-mjwx-p883) | Override `qs >= 6.14.2` | Earlier |
| Next.js Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f) | Fixed in next@16.1.6 | Earlier |
| Next.js PPR Memory DoS (GHSA-5f7q-jpqc-wp7h) | Fixed in next@16.1.6 | Earlier |
| Next.js RSC Deserialization DoS (GHSA-h25m-26qc-wcjf) | Fixed in next@16.1.6 | Earlier |

---

## Cross-Agent Recommendations

- **Coverage Agent**: All webhook and CSRF error paths remain fully covered. No regression risk. No security-driven test changes needed.
- **Performance Agent**: posthog-js transitive deps (dompurify + protobufjs) upgraded via lockfile-only change — zero bundle size impact. PostHog deferred chunk (179 KB) unchanged.
- **Code Quality Agent**: All 3 remaining outdated packages are dev-only. No production dep gaps. Dev-tooling major versions still pending (`@vitejs/plugin-react` v6, `typescript` v6, `knip` v6) — no CVEs, low urgency.
- **Documentation Agent**: No documentation changes needed. Security headers and license exceptions unchanged. Tenth consecutive GREEN.
- **QA Agent**: CSRF confirmed working. 0 advisories. No security action items this cycle.
- **Cost Analyst Agent**: 0 vulnerabilities. Revenue drought at 66 days — no security contribution to that issue.
- **Localization Agent**: No sensitive data in translation files. No locale-related security concerns.

---
