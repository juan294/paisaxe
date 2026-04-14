# Security Report

> Auto-generated on 2026-04-14

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, 0 exploitable. **Ninth consecutive GREEN.** All previously resolved vulnerabilities remain clean. 7 packages shown as outdated by `npm outdated` — 4 are production (minor/patch: @elevenlabs/react, @stripe/stripe-js, posthog-js, resend), 3 are dev-only (jsdom and vitest on pre-release channels, @typescript-eslint/eslint-plugin patch). Zero CVEs across all outdated packages. 8 commits since last report — CI config (Dependabot pinned to develop), triage fixes, Vercel single-region config, and dep updates merged from main. All security-neutral. CI/CD automation fully active.

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
- **Command injection**: 5 exec/spawn sites — all safe. 4 in `src/lib/claude.ts:65,78,223,245` (hardcoded curl to Anthropic API). 3 in `src/app/api/admin/tunnel/route.ts:16,80,133` (dev-only, hardcoded cloudflared commands, production-blocked). 1 in `src/app/api/admin/agents/run/route.ts:97` (whitelist-validated script path via `AGENT_SCRIPTS` map, admin-authenticated). Zero `'use server'` directives in the codebase.
- **CSRF**: Token validation enforced on all state-changing API routes via `handleCsrfValidation()` in `src/proxy.ts`. Webhooks and MCP routes appropriately exempt. QA-verified passing since Mar 23.
- **Webhook signature verification**: All 4 webhook endpoints use `timingSafeEqual()`. 7 call sites verified: `webhooks/elevenlabs/route.ts:141`, `webhooks/translate/route.ts:37`, `webhooks/supabase/route.ts:44`, `webhooks/stripe/route.ts` (Stripe SDK), `csrf.ts:77`, `cron-auth.ts:19,34`, `mcp-auth.ts:30`.

---

## Outdated Packages

**7 packages outdated.** 4 production (minor/patch), 3 dev-only. None have known CVEs.

| Package | Installed | Available | Type | Security Relevance |
|---------|-----------|-----------|------|-------------------|
| `@elevenlabs/react` | 1.1.0 | 1.1.1 | production | None — patch |
| `@stripe/stripe-js` | 9.1.0 | 9.2.0 | production | None — minor |
| `posthog-js` | 1.367.0 | 1.368.1 | production | None — patch |
| `resend` | 6.10.0 | 6.11.0 | production | None — minor |
| `@typescript-eslint/eslint-plugin` | 8.58.1 | 8.58.2 | dev | None — patch |
| `jsdom` | 29.0.2 | 27.0.1 | dev | **Note**: installed > latest — pre-release channel, not a downgrade |
| `vitest` | 4.1.4 | 3.2.4 | dev | **Note**: installed > latest — pre-release channel, not a downgrade |

**Channel note (vitest + jsdom):** `npm outdated` compares against the `latest` dist-tag. vitest@4.1.4 and jsdom@29.0.2 are on a pre-release channel (installed versions exceed stable `latest`). These are not regressions.

**Production gaps are all minor/patch — no breaking changes, no CVEs.** Can be resolved with a routine `npm update` when convenient. These emerged from new upstream releases since the Apr 12 bulk upgrade (commit `2c8f991`).

**Pending major version dev migrations (non-urgent, no CVEs):**
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

**Source-verified** (server not running — live check skipped). Configuration confirmed in `next.config.ts` (lines 50–73) and `src/proxy.ts` (`buildCspHeader()`, lines 232–248).

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
| Dependabot | ✅ Configured | `.github/dependabot.yml` — weekly PRs for npm deps (Mon), grouped production + dev batches. **Now pinned to `develop` branch** (commit `f118597`). |
| Renovate | ❌ Not configured | Dependabot covers the same function; no gap |
| Gitleaks | ✅ In CI | `.github/workflows/security.yml` — secret scanning on every push + weekly schedule (Mon 8:00 UTC) |
| npm audit | ✅ In CI | `.github/workflows/security.yml` — production-only audit at high severity on every push + weekly schedule |
| License check | ✅ In CI | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/EUPL/SSPL/BSL/CPAL/OSL/CPOL) on PRs |
| Automated security checks | ✅ All active | No CI/CD security gaps |

---

## Source Changes Since Last Report

8 commits since 2026-04-13. All security-neutral:

| Commit | Description | Security Impact |
|--------|-------------|-----------------|
| `f118597` | Pin Dependabot PRs to develop branch | CI config only — improves workflow safety |
| `0905df2` | Merge main into develop (dep updates backlog) | Merge commit — brings production-deployed changes into develop |
| `228127e` | Update agent reports [triage] | Agent report updates — no application code |
| `2838ecd` | Merge triage fix branch | Merge commit |
| `e858ef7` | Resolve triage agent report findings | Triage fixes — performance budget script, dotenv patch, locale comments |
| `f0ad7bc` | Merge Vercel single-region fix | Merge commit |
| `9d1102c` | Drop Vercel to single region (cdg1) | Infrastructure config — `vercel.json` change, no application code |
| `df5fe72` | Merge Dependabot PR (production deps) | Dependency update PR from main |

---

## Remediation Steps

No urgent remediation required. 0 active advisories. 4 production packages have minor/patch updates available — routine, no CVEs.

**Recommended (low priority):**

1. **Routine production dep updates** — `npm update @elevenlabs/react @stripe/stripe-js posthog-js resend` to pick up latest patches. No breaking changes expected.
2. **`@typescript-eslint/eslint-plugin`** (`8.58.1 → 8.58.2`) — Dev-only patch: `npm install -D @typescript-eslint/eslint-plugin@latest`.

**Ongoing maintenance (dev-only, no CVEs, no rush):**
- `@vitejs/plugin-react` v5 → v6
- `typescript` v5 → v6
- `knip` v5 → v6

---

## Cross-Agent Recommendations

- **Coverage Agent**: All webhook and CSRF error paths remain fully covered. No regression risk. No security-driven test changes needed.
- **Performance Agent**: 4 production dep patches available — minor/patch only, zero bundle impact expected. Dev tooling unchanged. Monitor bundle after any dep updates.
- **Code Quality Agent**: All production deps current (minor/patch behind only). Dev-tooling major versions pending (`@vitejs/plugin-react` v6, `typescript` v6, `knip` v6) — evaluate when convenient. License exceptions fully documented. Dependabot now correctly targeting `develop` (commit `f118597`).
- **Documentation Agent**: License-exceptions.md complete. No documentation changes needed. Ninth consecutive GREEN.
- **QA Agent**: CSRF confirmed working (green since Mar 23). All production deps synced. Auth flows stable with current Supabase versions. No security action items.
- **Cost Analyst Agent**: No cost-related security concerns. 0 vulns. Revenue drought and voice silence continue — no security contribution to those issues.
- **Localization Agent**: No sensitive data in translation files. No locale-related security concerns.
