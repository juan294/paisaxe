# Security Report

> Auto-generated on 2026-04-13

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, 0 exploitable. **Eighth consecutive GREEN.** All previously resolved vulnerabilities remain clean. Outdated packages dropped from 33 to 6 — node_modules now fully synced with package.json (resolved after `npm install` + commit 2c8f991 bulk upgrade). Only 6 packages remain outdated, all dev-only or pre-release channel, with zero CVEs. 3 source changes since Apr 12 — all test-only, security-neutral. CI/CD automation fully active.

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| — | — | — | — | — | — | — | **No active advisories** |

**npm audit: 0 vulnerabilities found.**

### Previously Resolved (full history)

| Advisory | Resolution | When |
|----------|-----------|------|
| next@16.1.6 — PPR buffering DoS (GHSA-h27x-g6w4-24gq) | Upgraded to next@16.2.2 | Apr 4 (via Stripe ecosystem upgrade batch) |
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

### Regression History (closed)

The next@16.1.6 advisory had a complex lifecycle spanning 12 days:

| Date | Event | Cause |
|------|-------|-------|
| Mar 23 | Fixed | Triage ran `npm audit fix` (16.1.6 → 16.2.1) |
| Mar 25 | Regressed | `d3a4dd6` — cc-rpi blueprint v1.12.0 sync reset package.json |
| Mar 26 (AM) | Fixed | Triage ran `npm audit fix` again |
| Mar 26 (PM) | Regressed | `d667010` — cc-rpi blueprint v1.13.0 sync reset package.json |
| Mar 27 | Intentional | `934fe4a` — deliberate revert to 16.1.6 (next@16.2.1 Vercel runtime bug) |
| Apr 1 | Unblocked | next@16.2.2 released — Vercel runtime bug fixed |
| **Apr 4** | **RESOLVED** | **Upgraded to next@16.2.2 in coordinated dep upgrade** |

---

## Exploitability Analysis

No active advisories — no exploitability analysis required this cycle.

**Confirmed safe (persistent audit items):**
- **dangerouslySetInnerHTML (7 instances)**: All safe — 5 JSON-LD schema outputs via `JSON.stringify()` in `src/components/seo/json-ld.tsx:28,127,144,199,235`, and 2 admin markdown renders with `escapeHtml()` in `src/components/admin/agents-dashboard/cross-agent-insights.tsx:84` and `optimizer-report-dialog.tsx:57`.
- **Command injection**: 5 exec/spawn sites — all safe. 4 in `src/app/api/admin/tunnel/route.ts` (dev-only, hardcoded commands). 1 in `src/app/api/admin/agents/run/route.ts:97` (whitelist-validated script path via `AGENT_SCRIPTS` map). Zero `'use server'` directives.
- **CSRF**: Token validation enforced on all state-changing API routes via `handleCsrfValidation()` in `src/proxy.ts`. Webhooks and MCP routes appropriately exempt. QA-verified passing since Mar 23.
- **Webhook signature verification**: All 4 webhook endpoints use `timingSafeEqual()`. 7 call sites verified: `webhooks/elevenlabs/route.ts:141`, `webhooks/translate/route.ts:37`, `webhooks/supabase/route.ts:44`, `webhooks/stripe/route.ts` (Stripe SDK), `csrf.ts:77`, `cron-auth.ts:19,34`, `mcp-auth.ts:30`.

---

## Outdated Packages

**6 packages outdated** (down from 33 — node_modules fully synced). All are dev-only or pre-release channel. None have known CVEs.

| Package | Installed | Available | Type | Security Relevance |
|---------|-----------|-----------|------|-------------------|
| `@vitejs/plugin-react` | 5.2.0 | 6.0.1 | dev | None — major version, dev tooling only |
| `dotenv` | 17.4.1 | 17.4.2 | dev | None — patch |
| `jsdom` | 28.1.0 | 27.0.1 | dev | **Note**: installed > latest — pre-release channel, not a downgrade |
| `knip` | 5.88.1 | 6.4.1 | dev | None — major version, dev tooling only |
| `typescript` | 5.9.3 | 6.0.2 | dev | None — major version, dev tooling only |
| `vitest` | 4.1.4 | 3.2.4 | dev | **Note**: installed > latest — pre-release channel, not a downgrade |

**Channel note (vitest + jsdom):** `npm outdated` compares against the `latest` dist-tag. vitest@4.1.4 and jsdom@28.1.0 are on a pre-release channel (installed versions exceed stable `latest`). These are not regressions.

**Milestone: All production dependency gaps cleared.** Commit `2c8f991` (bulk upgrade) plus `npm install` resolved every previously tracked production dep gap. No production packages are outdated.

**Pending major version migrations (non-urgent, dev-only, no CVEs):**
- `@vitejs/plugin-react` v5 → v6
- `typescript` v5 → v6
- `knip` v5 → v6

---

## License Compliance

**No copyleft violations.** Scanner flag `COPYLEFT LICENSES FOUND: false`.

Flagged packages requiring review:

| Package | License | Risk Assessment | Status |
|---------|---------|----------------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Dynamically-linked native binary (libvips). LGPL-3.0 permits use without source disclosure provided the library is not statically linked. SaaS-only, no binary distribution. No modification. | ✅ Approved — documented in `docs/project/license-exceptions.md` |
| `@vercel/analytics` | MPL-2.0 | File-level copyleft (not project-level). We do not modify `@vercel/analytics` source. MPL-2.0 only requires disclosure of modifications to the MPL-licensed files themselves. | ✅ Approved — documented in `docs/project/license-exceptions.md` |
| `dompurify@3.3.3` | (MPL-2.0 OR Apache-2.0) | Dual-licensed. We elect Apache-2.0 (permissive). No concern. | ✅ Approved — Apache-2.0 elected |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Both permissive. MIT elected. No concern. | ✅ Approved |
| `paisaxe@1.0.0` | UNLICENSED | The project itself. Intentionally proprietary (`"private": true`). | ✅ Expected |
| `simple-concat@1.0.1` | MIT | Scanner false positive — plain MIT, correctly licensed. | ✅ False positive |
| `simple-get@4.0.1` | MIT | Scanner false positive — plain MIT, correctly licensed. | ✅ False positive |

**All license exceptions documented.** Both `@img/sharp-libvips-*` (LGPL) and `@vercel/analytics` (MPL-2.0) are formally documented in `docs/project/license-exceptions.md`. No documentation gaps remain.

---

## Security Headers

**Source-verified** (server not running — live check skipped). Configuration confirmed in `next.config.ts` (lines 50–73) and `src/proxy.ts` (`buildCspHeader()`, lines 219–247).

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co ...; connect-src 'self' wss://*.supabase.co wss://*.elevenlabs.io ...; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` | ✅ Per-request (proxy.ts) |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | ✅ Production only (avoids poisoning localhost HSTS cache) |
| X-Frame-Options | `DENY` | ✅ Configured |
| X-Content-Type-Options | `nosniff` | ✅ Configured |
| Referrer-Policy | `strict-origin-when-cross-origin` | ✅ Configured |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | ✅ Configured |
| Cache-Control (API) | `no-store, max-age=0` | ✅ All /api/* routes |

**CSP notes (unchanged):**
- `'unsafe-inline'` in `script-src` is required for Next.js hydration scripts with PPR (`cacheComponents: true`). Nonces cannot be used with PPR — prerendered HTML is built without nonces. This is the correct trade-off and is documented in CLAUDE.md.
- `'strict-dynamic'` is intentionally absent — it overrides `'self'` per CSP Level 3, blocking all scripts when prerendered pages lack nonces.
- E2E canary (`e2e/smoke.spec.ts`) verifies JavaScript executes correctly; will fail immediately if CSP breaks script execution.

---

## CI/CD Security Automation

| Check | Status | Notes |
|-------|--------|-------|
| Dependabot | ✅ Configured | `.github/dependabot.yml` — weekly PRs for npm deps (Mon), grouped production + dev batches |
| Renovate | ❌ Not configured | Dependabot covers the same function; no gap |
| Gitleaks | ✅ In CI | `.github/workflows/security.yml` — secret scanning on every push + weekly schedule (Mon 8:00 UTC) |
| npm audit | ✅ In CI | `.github/workflows/security.yml` — production-only audit at high severity on every push + weekly schedule |
| License check | ✅ In CI | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/EUPL/SSPL/BSL/CPAL/OSL/CPOL) on PRs |
| Automated security checks | ✅ All active | No CI/CD security gaps |

---

## Remediation Steps

No remediation required this cycle. 0 active advisories. 0 outdated production dependencies.

**Ongoing maintenance (all low priority, dev-only, no CVEs):**

1. **`dotenv`** (`17.4.1 → 17.4.2`) — Trivial patch: `npm install dotenv@latest`.
2. **Major version dev migrations** (no security implications):
   - `@vitejs/plugin-react` v5 → v6
   - `typescript` v5 → v6
   - `knip` v5 → v6

---

## Cross-Agent Recommendations

- **Coverage Agent**: All webhook and CSRF error paths remain fully covered. No regression risk. No security-driven test changes needed.
- **Performance Agent**: All production dep gaps cleared. Bundle should be stable. Only dev-tooling packages remain outdated — zero production impact.
- **Code Quality Agent**: All production deps current. Only dev-tooling major versions pending (`@vitejs/plugin-react` v6, `typescript` v6, `knip` v6) — evaluate when convenient. License exceptions fully documented.
- **Documentation Agent**: License-exceptions.md now complete — both `@img/sharp-libvips-*` and `@vercel/analytics` documented. No documentation changes needed. Eighth consecutive GREEN.
- **QA Agent**: CSRF confirmed working (green since Mar 23). All production deps synced. Auth flows should be stable with current Supabase versions. No security action items.
- **Cost Analyst Agent**: No cost-related security concerns. 0 vulns. Revenue drought and voice silence continue — no security contribution to those issues.
- **Localization Agent**: No sensitive data in translation files. No locale-related security concerns.
