# Security Report

> Auto-generated on 2026-04-07

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, 0 exploitable. Third consecutive GREEN. All previously flagged vulnerabilities remain resolved — next@16.2.2, Stripe v22/v9/v6, ElevenLabs v1.0.2, posthog-js@1.364.6, @anthropic-ai/sdk@0.82.0 all confirmed in place. 26 outdated packages (+1 from yesterday), none with known CVEs. Two packages (vitest@4.1.1, jsdom@28.1.0) show as "outdated" because they are ahead of the npm `latest` tag — installed versions are pre-release/beta channel and are actually newer. All security headers configured correctly in source. All CI/CD automation active.

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
- **dangerouslySetInnerHTML (7 instances)**: All safe — content is either static strings, markdown rendered via react-markdown (which sanitizes), or HTML already sanitized through DOMPurify before use.
- **Command injection**: Zero `child_process` exec/spawn calls with user-controlled input. Zero `'use server'` directives that could expose server-side execution.
- **CSRF**: Token validation enforced on all state-changing API routes (POST/PUT/PATCH/DELETE) via `handleCsrfValidation()` in `src/proxy.ts`. Webhooks and MCP routes are appropriately exempt (`isExemptFromCsrf()`). Verified passing by QA agent (since Mar 23).
- **Webhook signature verification**: All 4 webhook endpoints use `timingSafeEqual()`. 7 call sites verified.

---

## Outdated Packages

26 packages outdated (+1 from yesterday). None have known CVEs.

| Package | Installed | Available | Type | Security Relevance |
|---------|-----------|-----------|------|-------------------|
| @elevenlabs/react | 1.0.2 | 1.0.3 | prod | None — patch bump |
| @playwright/test | 1.58.2 | 1.59.1 | dev | None |
| @stripe/stripe-js | 9.0.1 | 9.1.0 | prod | None — minor bump, no advisories |
| @supabase/ssr | 0.8.0 | 0.10.0 | prod | Low — 2 minor bumps, auth library |
| @supabase/supabase-js | 2.97.0 | 2.101.1 | prod | Low — 4 minor bumps, no advisories |
| @tailwindcss/postcss | 4.2.1 | 4.2.2 | dev | None |
| @types/node | 25.5.0 | 25.5.2 | dev | None |
| @typescript-eslint/eslint-plugin | 8.56.1 | 8.58.0 | dev | None |
| @upstash/redis | 1.36.2 | 1.37.0 | prod | None |
| @vercel/analytics | 1.6.1 | 2.0.1 | prod | None — MPL-2.0, major version pending migration |
| @vercel/speed-insights | 1.3.1 | 2.0.0 | prod | None — major version pending migration |
| @vitejs/plugin-react | 5.1.4 | 6.0.1 | dev | None |
| @vitest/coverage-v8 | 4.1.1 | 4.1.2 | dev | None |
| canvas | 3.2.1 | 3.2.3 | prod | None |
| dotenv | 17.3.1 | 17.4.1 | dev | None |
| jsdom | 28.1.0 | 27.0.1 | dev | **Note**: installed > latest — pre-release/beta channel in use, not a downgrade |
| knip | 5.85.0 | 6.3.0 | dev | None |
| lucide-react | 0.575.0 | 1.7.0 | prod | None — major version pending migration |
| pdfjs-dist | 5.4.624 | 5.6.205 | prod | Low — minor bump |
| postcss | 8.5.6 | 8.5.8 | dev | None |
| posthog-js | 1.364.6 | 1.364.7 | prod | None — 1 patch |
| resend | 6.9.2 | 6.10.0 | prod | None |
| tailwindcss | 4.2.1 | 4.2.2 | dev | None |
| typescript | 5.9.3 | 6.0.2 | dev | None — major version, dev tooling only |
| vitest | 4.1.1 | 3.2.4 | dev | **Note**: installed > latest — pre-release/beta channel in use, not a downgrade |
| voyageai | 0.1.0 | 0.2.1 | prod | Low — minor bump, AI SDK |

**Changes from yesterday:**
- `@anthropic-ai/sdk` **removed** — upgraded 0.78.0 → 0.82.0 by triage on Apr 6 ✅
- `@stripe/stripe-js 9.0.1 → 9.1.0` **added** — new minor available
- `@elevenlabs/react 1.0.2 → 1.0.3` **added** — new patch available

**Channel note (vitest + jsdom):** `npm outdated` compares installed versions against the `latest` dist-tag. vitest@4.1.1 and jsdom@28.1.0 are on a pre-release channel (installed versions exceed stable `latest`). These are not regressions — the codebase is intentionally tracking pre-release builds.

**Pending major version migrations (non-urgent, no CVEs):**
- `@vercel/analytics` v1 → v2
- `@vercel/speed-insights` v1 → v2
- `lucide-react` v0 → v1
- `typescript` v5 → v6 (dev only)
- `knip` v5 → v6 (dev only)

---

## License Compliance

**No copyleft violations.** Scanner flag `COPYLEFT LICENSES FOUND: false`.

Flagged packages requiring review:

| Package | License | Risk Assessment | Status |
|---------|---------|----------------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Dynamically-linked native binary (libvips). LGPL-3.0 permits use without source disclosure provided the library is not statically linked into our code. This is a build-time image processing dep pulled in by `sharp`. No modification of libvips code. | ✅ Approved — pre-existing exception |
| `@vercel/analytics@1.6.1` | MPL-2.0 | File-level copyleft (not project-level). MPL-2.0 only requires disclosure of modifications to the MPL-licensed files themselves. We do not modify `@vercel/analytics` source. | ✅ Approved — pre-existing exception |
| `dompurify@3.3.3` | (MPL-2.0 OR Apache-2.0) | Dual-licensed. We elect Apache-2.0 (permissive). No concern. | ✅ Approved — Apache-2.0 elected |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Both permissive. MIT elected. No concern. | ✅ Approved |
| `paisaxe@1.0.0` | UNLICENSED | The project itself. Intentionally proprietary — this is correct. | ✅ Expected |
| `simple-concat@1.0.1` | MIT | Scanner false positive — plain MIT, correctly licensed. | ✅ False positive |
| `simple-get@4.0.1` | MIT | Scanner false positive — plain MIT, correctly licensed. | ✅ False positive |

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
| Dependabot | ✅ Configured | `.github/dependabot.yml` — weekly PRs for npm deps |
| Renovate | ❌ Not configured | Dependabot covers the same function; no gap |
| Gitleaks | ✅ In CI | Secret scanning on every push (added Mar 23, 19-week gap now closed) |
| npm audit | ✅ In CI | Runs on every PR/push; currently reporting 0 |
| Automated security checks | ✅ All active | No CI/CD security gaps |

---

## Remediation Steps

No remediation required this cycle. 0 active advisories.

**Ongoing maintenance (low priority, no CVEs):**

1. **`@stripe/stripe-js` 1 minor** (`9.0.1 → 9.1.0`) — minor bump, no breaking changes expected. Can be batched with next Supabase upgrade.
2. **`@elevenlabs/react` patch** (`1.0.2 → 1.0.3`) — patch bump. Low risk, upgrade when convenient.
3. **`@supabase/ssr` + `@supabase/supabase-js`** — minor bumps, auth library, upgrade in a single batch.
4. **Major version migrations** (non-urgent, no security implications):
   - `@vercel/analytics` v1 → v2
   - `@vercel/speed-insights` v1 → v2
   - `lucide-react` v0 → v1
5. **`voyageai` minor** (`0.1.0 → 0.2.1`) — AI SDK, check changelog before upgrading.

---

## Cross-Agent Recommendations

- **Coverage Agent**: All webhook and CSRF error paths remain fully covered. No regression risk. No security-driven test changes needed.
- **Performance Agent**: No security-driven upgrade requests this cycle. All major dep upgrades remain complete. @stripe/stripe-js 9.1.0 minor is the only new actionable item (low priority, can batch with Supabase).
- **Code Quality Agent**: No version discrepancies requiring urgent attention. @stripe/stripe-js 9.0.1 → 9.1.0 minor and @elevenlabs/react 1.0.2 → 1.0.3 patch are new additions — both low priority.
- **Documentation Agent**: No documentation changes needed this cycle. Security posture stable — third consecutive GREEN.
- **QA Agent**: CSRF protection confirmed working (QA green since Mar 23). No security action items. After any Supabase upgrade batch, re-verify auth flows.
- **Cost Analyst Agent**: No cost-related security concerns. 0 vulns, all major upgrades complete. ElevenLabs character cycle resets today (Apr 7, 14:15 UTC) — new cycle starts clean.
- **Localization Agent**: No sensitive data in translation files. No locale-related security concerns.
