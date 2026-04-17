# Security Report

> Auto-generated on 2026-04-17

## Health Status: YELLOW

**Executive Summary:** 2 advisories detected, **0 exploitable** in this codebase. Both are transitive dependencies of `posthog-js` with no user-controlled input path. Status is YELLOW because fixable advisories are present (not because of real exploitability risk). Both can be resolved with `npm audit fix` or upgrading posthog-js to 1.369.2. This breaks a **9-consecutive-GREEN streak** but does not represent a meaningful change in application security posture.

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| Critical | `protobufjs@7.5.4` | [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) | Pending CVE assignment | Parsing attacker-controlled `.proto` schemas / deserialization | ✅ `npm audit fix` | Yes (transitive) | **NOT EXPLOITABLE** — used internally by OpenTelemetry serializer (see below) |
| Moderate | `dompurify@3.3.3` | [GHSA-39q2-94rc-95cp](https://github.com/advisories/GHSA-39q2-94rc-95cp) | Pending CVE assignment | `ADD_TAGS` + `FORBID_TAGS` used simultaneously → bypass | ✅ `npm audit fix` | Yes (transitive) | **NOT EXPLOITABLE** — used internally by PostHog analytics; no application code calls DOMPurify |

**npm audit: 2 vulnerabilities (1 critical, 1 moderate). Both fixable.**

### Dependency Chains

```
posthog-js@1.367.0
├── dompurify@3.3.3                             ← GHSA-39q2-94rc-95cp
└── @opentelemetry/exporter-logs-otlp-http@0.208.0
    └── @opentelemetry/otlp-transformer@0.208.0
        └── protobufjs@7.5.4                    ← GHSA-xq3m-2v4x-88gg
```

Both vulnerabilities enter through **posthog-js** (analytics SDK, `production` dep). Neither package is imported or called directly by application code — confirmed by `grep -r dompurify src/` (0 results) and tracing the protobufjs import chain.

---

## Exploitability Analysis

### protobufjs — Critical (GHSA-xq3m-2v4x-88gg): NOT EXPLOITABLE

**Advisory:** Arbitrary code execution in protobufjs < 7.5.5 via prototype pollution during deserialization of malicious input.

**Attack vector:** An attacker must control input passed to `protobufjs.parse()` or protobuf deserialization routines.

**In this codebase:** protobufjs is used exclusively by `@opentelemetry/otlp-transformer` to **serialize** OpenTelemetry telemetry data for OTLP export. The data flowing through protobufjs is internally generated application metrics — not user input. There is no code path where user-supplied data reaches protobufjs deserialization. An attacker would need to compromise the internal OpenTelemetry pipeline, which is not accessible from outside the process.

**Verdict:** Critical severity, zero exploitability here. Upgrade for hygiene.

### dompurify — Moderate (GHSA-39q2-94rc-95cp): NOT EXPLOITABLE

**Advisory:** When `ADD_TAGS` and `FORBID_TAGS` options are used simultaneously, a short-circuit evaluation bug allows `ADD_TAGS` entries that are also in `FORBID_TAGS` to pass through unsanitized.

**Attack vector:** Application code must call `DOMPurify.sanitize()` with both `ADD_TAGS` and `FORBID_TAGS` options simultaneously, and the attacker must control the HTML input.

**In this codebase:** DOMPurify is not imported by any application code (`grep` confirms 0 matches in `src/`). It is used internally by PostHog for analytics event property sanitization. PostHog's internal use of DOMPurify does not use the `ADD_TAGS` + `FORBID_TAGS` combination in any way that would affect this application's security surface.

**Verdict:** Moderate severity, zero exploitability here. Upgrade for hygiene.

### Previously Confirmed Safe (persistent audit items)

- **dangerouslySetInnerHTML (7 instances)**: All safe — 5 JSON-LD schema outputs via `JSON.stringify()` in `src/components/seo/json-ld.tsx:28,127,144,199,235`, and 2 admin markdown renders with `escapeHtml()` in `src/components/admin/agents-dashboard/cross-agent-insights.tsx:84` and `optimizer-report-dialog.tsx:57`.
- **Command injection**: 5 exec/spawn sites — all safe. 4 in `src/lib/claude.ts:65,78,223,245` (hardcoded curl to Anthropic API). 3 in `src/app/api/admin/tunnel/route.ts:16,80,133` (dev-only, hardcoded cloudflared commands, production-blocked). 1 in `src/app/api/admin/agents/run/route.ts:97` (whitelist-validated script path via `AGENT_SCRIPTS` map, admin-authenticated). Zero `'use server'` directives in the codebase.
- **CSRF**: Token validation enforced on all state-changing API routes via `handleCsrfValidation()` in `src/proxy.ts`. Webhooks and MCP routes appropriately exempt. QA-verified passing since Mar 23.
- **Webhook signature verification**: All 4 webhook endpoints use `timingSafeEqual()`. 7 call sites verified: `webhooks/elevenlabs/route.ts:141`, `webhooks/translate/route.ts:37`, `webhooks/supabase/route.ts:44`, `webhooks/stripe/route.ts` (Stripe SDK), `csrf.ts:77`, `cron-auth.ts:19,34`, `mcp-auth.ts:30`.

---

## Prioritized Remediation

### Priority 1 — Upgrade posthog-js (fixes both advisories, ~5 minutes)

```bash
npm install posthog-js@latest
# Verify
npm audit
npm run test && npm run typecheck
```

Alternatively, use the blanket fix (may also upgrade other transitive deps):

```bash
npm audit fix
```

Upgrading from `1.367.0 → 1.369.2` will pull in `dompurify >3.3.3` and `protobufjs >=7.5.5`, resolving both advisories. PostHog is already in the outdated packages list — this is the same upgrade.

### Priority 2 — Routine production dep patches (no CVEs)

```bash
npm install @anthropic-ai/sdk@latest @supabase/supabase-js@latest @elevenlabs/react@latest @stripe/react-stripe-js@latest @stripe/stripe-js@latest posthog-js@latest resend@latest
```

### Priority 3 — Dev tooling (no CVEs, low urgency)

```bash
npm install -D @typescript-eslint/eslint-plugin@latest @next/eslint-plugin-next@latest eslint-plugin-react-hooks@latest
```

---

## Outdated Packages

**17 packages outdated** (up from 7 on Apr 14). New upstream releases since the Apr 12 bulk upgrade.

| Package | Installed | Available | Type | Security Relevance |
|---------|-----------|-----------|------|-------------------|
| `@anthropic-ai/sdk` | 0.88.0 | 0.90.0 | production | None — 2 minor versions |
| `@elevenlabs/react` | 1.1.0 | 1.1.1 | production | None — patch |
| `@next/bundle-analyzer` | 16.2.3 | 16.2.4 | dev | None — patch |
| `@next/eslint-plugin-next` | 16.2.3 | 16.2.4 | dev | None — patch |
| `@stripe/react-stripe-js` | 6.1.0 | 6.2.0 | production | None — minor |
| `@stripe/stripe-js` | 9.1.0 | 9.2.0 | production | None — minor |
| `@supabase/supabase-js` | 2.103.0 | 2.103.3 | production | None — 3 patches |
| `@typescript-eslint/eslint-plugin` | 8.58.1 | 8.58.2 | dev | None — patch |
| `eslint-plugin-react-hooks` | 7.0.1 | 7.1.0 | dev | None — minor |
| `jsdom` | 29.0.2 | 27.0.1 | dev | **Pre-release channel** — installed > latest, not a downgrade |
| `next` | 16.2.3 | 16.2.4 | production | None — patch |
| `postcss` | 8.5.9 | 8.5.10 | production | None — patch |
| `posthog-js` | 1.367.0 | 1.369.2 | production | **⚠️ Fixes both advisories** — upgrade this first |
| `resend` | 6.10.0 | 6.12.0 | production | None — 2 minor versions |
| `stripe` | 22.0.1 | 22.0.2 | production | None — patch |
| `typescript` | 6.0.2 | 6.0.3 | dev | None — patch |
| `vitest` | 4.1.4 | 3.2.4 | dev | **Pre-release channel** — installed > latest, not a downgrade |

**Channel note (vitest + jsdom):** `npm outdated` compares against the `latest` dist-tag. vitest@4.1.4 and jsdom@29.0.2 are on a pre-release channel — installed versions exceed stable `latest`. These are not regressions.

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
| Dependabot | ✅ Configured | `.github/dependabot.yml` — weekly PRs for npm deps (Mon), grouped production + dev batches. Pinned to `develop` branch (commit `f118597`). |
| Renovate | ❌ Not configured | Dependabot covers the same function; no gap |
| Gitleaks | ✅ In CI | `.github/workflows/security.yml` — secret scanning on every push + weekly schedule (Mon 8:00 UTC) |
| npm audit | ✅ In CI | `.github/workflows/security.yml` — production-only audit at high severity on every push + weekly schedule |
| License check | ✅ In CI | `.github/workflows/license-check.yml` — blocks strong copyleft (GPL/AGPL/EUPL/SSPL/BSL/CPAL/OSL/CPOL) on PRs |
| Automated security checks | ✅ All active | No CI/CD security gaps |

---

## Previously Resolved (full history)

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

---

## Cross-Agent Recommendations

- **Coverage Agent**: All webhook and CSRF error paths remain fully covered. No regression risk. No security-driven test changes needed.
- **Performance Agent**: Upgrading posthog-js to 1.369.2 will also pull in updated OpenTelemetry/DOMPurify transitive deps — monitor bundle size delta after upgrade (posthog-js chunk is already deferred at 179 KB; minor change expected).
- **Code Quality Agent**: posthog-js upgrade from 1.367.0 → 1.369.2 is the highest-priority dep action. All other production deps are minor/patch behind only. Dev-tooling major versions pending (`@vitejs/plugin-react` v6, `typescript` v6, `knip` v6) — evaluate when convenient.
- **Documentation Agent**: No documentation changes needed. Security headers and license exceptions unchanged.
- **QA Agent**: CSRF confirmed working. After posthog-js upgrade, re-verify analytics event tracking in staging. Auth flows stable. No other security action items.
- **Cost Analyst Agent**: No cost-related security concerns. Revenue drought at 63 days — no security contribution to that issue.
- **Localization Agent**: No sensitive data in translation files. No locale-related security concerns.
