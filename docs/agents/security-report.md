# Security Report

> Auto-generated on 2026-03-30

## Health Status: YELLOW

**Executive Summary:** 1 moderate advisory detected (next@16.1.6 — 5 sub-advisories), **1 exploitable** (PPR buffering DoS). next@16.1.6 remains a **deliberate trade-off** (commit `934fe4a`) — next@16.2.1 has a Vercel runtime bug that breaks the production site. `npm audit fix` would "fix" the advisory but **break the deployment**. The fix is blocked until next@16.2.2+ resolves both the security advisories and the Vercel runtime bug. Day 4 of conscious trade-off — next@16.2.2 has not been released yet (canaries up to 16.2.1-canary.13). No source code changes since Mar 28. All other security controls remain intact. 29 outdated packages (unchanged count). No new advisories or CVEs affecting any dependency.

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| Moderate | next@16.1.6 | GHSA-ggv3-7p47-pfv8 | — | HTTP request smuggling via rewrites | Blocked* | Yes (PostHog rewrites) | **Low** — Static rewrites to trusted PostHog CDN only |
| Moderate | next@16.1.6 | GHSA-3x4c-7xq6-9pq8 | — | Unbounded next/image disk cache growth | Blocked* | Yes | **Low** — `remotePatterns` allowlists only Supabase + Unsplash |
| Moderate | next@16.1.6 | GHSA-h27x-g6w4-24gq | — | Unbounded postponed resume buffering (DoS) | Blocked* | Yes (`cacheComponents: true`) | **Medium** — PPR enabled, attacker can trigger memory exhaustion |
| Moderate | next@16.1.6 | GHSA-mq59-m269-xvcx | — | null origin bypasses Server Actions CSRF | Blocked* | No Server Actions used | **None** — No `'use server'` directives + explicit null-origin rejection in proxy.ts |
| Moderate | next@16.1.6 | GHSA-jcc7-9wpm-mj36 | — | null origin bypasses dev HMR websocket CSRF | Blocked* | No (dev-only) | **None** — Development environment only |

*\*Blocked: `npm audit fix` upgrades to next@16.2.1, which has a Vercel runtime bug. Must wait for next@16.2.2+.*

### Exploitability Analysis

**GHSA-h27x-g6w4-24gq (PPR Buffering DoS) — EXPLOITABLE:**
- `next.config.ts:14` has `cacheComponents: true` (PPR enabled)
- React suspense boundaries with `use()` can buffer data without limits
- An attacker crafting many simultaneous requests that trigger deep suspense chains can exhaust server memory
- **Mitigating factor**: Vercel's infrastructure provides inherent protection (serverless function limits, automatic restarts, request timeout)
- **Fix**: Blocked — next@16.2.1 fixes the advisory but breaks Vercel runtime (`934fe4a`). Waiting for next@16.2.2+

**GHSA-ggv3-7p47-pfv8 (HTTP Smuggling) — LOW RISK:**
- `next.config.ts:40-48` configures 2 rewrites, both to PostHog CDN (`eu-assets.i.posthog.com`, `eu.i.posthog.com`)
- All HTTPS destinations — no HTTP-based smuggling vector
- No dynamic URLs or user-controlled rewrite destinations

**GHSA-3x4c-7xq6-9pq8 (Image Cache DoS) — LOW RISK:**
- `next.config.ts:81-90` restricts `remotePatterns` to `*.supabase.co` and `images.unsplash.com`
- All image sources are database-backed or hardcoded, not user-controllable
- `minimumCacheTTL: 2592000` (30 days) — long but bounded by allowlist

**GHSA-mq59-m269-xvcx (CSRF Bypass) — NOT EXPLOITABLE:**
- Zero `'use server'` directives in codebase (confirmed — no Server Actions)
- `src/proxy.ts:38-41`: `if (!origin) return false` explicitly rejects null-origin requests
- `src/lib/csrf.ts:21`: `sameSite: 'strict'` prevents cross-site cookie inclusion

**GHSA-jcc7-9wpm-mj36 (Dev HMR CSRF) — NOT EXPLOITABLE:**
- Dev-only; production at paisaxe.es/paisaxe.com is unaffected

### Regression History & Current State

The next@16.1.6 advisory has a complex history:

| Date | Event | Cause |
|------|-------|-------|
| Mar 23 | Fixed | Triage ran `npm audit fix` (16.1.6 → 16.2.1) |
| Mar 25 | Regressed | `d3a4dd6` — cc-rpi blueprint v1.12.0 sync reset package.json |
| Mar 26 (AM) | Fixed | Triage ran `npm audit fix` again |
| Mar 26 (PM) | Regressed | `d667010` — cc-rpi blueprint v1.13.0 sync reset package.json |
| Mar 27 | **Intentional** | `934fe4a` — **deliberate revert** to 16.1.6 because next@16.2.1 has a Vercel runtime bug |
| **Mar 30** | **Unchanged** | Still on 16.1.6 — next@16.2.2 not yet released (canaries up to 16.2.1-canary.13) |

**Current state:** This is a conscious trade-off, now in its fourth day. The Vercel runtime bug in 16.2.1 breaks the production site, which is worse than the moderate advisory. The accepted risk is the PPR buffering DoS, which is partially mitigated by serverless function limits.

**Resolution path:** Monitor for next@16.2.2+ stable which should fix both the security advisories AND the Vercel runtime bug. When available, upgrade immediately. Canary releases have progressed to 16.2.1-canary.13 (up from canary.12 yesterday) — stable 16.2.2 not yet in sight.

### Previously Resolved (still resolved)

| Advisory | Resolution | When |
|----------|-----------|------|
| flatted <=3.4.1 — Unbounded recursion DoS + Prototype Pollution (GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh) | Resolved via `npm audit fix` (upgraded to >=3.4.2) | Mar 23 |
| undici 7.0.0–7.23.0 — WebSocket overflow, HTTP smuggling, CRLF injection, memory DoS (GHSA-f269-vfmq-vjvj + 5 others) | Resolved via `npm audit fix` (upgraded to >=7.24.0) | Mar 23 |
| brace-expansion — ReDoS | Override `brace-expansion >= 5.0.5` in package.json | Mar 27 |
| minimatch 10.2.2 ReDoS (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | Override `minimatch >= 10.2.1` in package.json | Mar 7–8 |
| dompurify 3.3.1 XSS (GHSA-v2wj-7wpq-c8vv) | Resolved via dependency update | Mar 7–8 |
| qs arrayLimit bypass (GHSA-w7fw-mjwx-p883) | Override `qs >= 6.14.2` | Earlier |
| Next.js Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f) | Fixed in next@16.1.6 | Earlier |
| Next.js PPR Memory DoS (GHSA-5f7q-jpqc-wp7h) | Fixed in next@16.1.6 | Earlier |
| Next.js RSC Deserialization DoS (GHSA-h25m-26qc-wcjf) | Fixed in next@16.1.6 | Earlier |

---

## Changes Since Last Report (2026-03-29)

| Area | Mar 29 | Mar 30 | Change |
|------|--------|--------|--------|
| Vulnerability count | 1 moderate | **1 moderate** | Same |
| Exploitable vulns | 1 (PPR DoS) | **1** (PPR DoS) | Same |
| Fix status | Blocked (Vercel runtime bug) | **Blocked** | Same — next@16.2.2 still not released |
| Next.js canaries | 16.2.1-canary.12 | **16.2.1-canary.13** | +1 canary — stable release still pending |
| CSP | `'self' 'unsafe-inline'` | `'self' 'unsafe-inline'` | Unchanged |
| dangerouslySetInnerHTML | 7 instances | 7 instances | Unchanged — all safe |
| Code changes to `src/` | 0 | **0** | No source code changes since Mar 28 |
| Outdated packages | 29 | **29** | Same count; some "latest" version bumps |
| Health status | YELLOW | **YELLOW** | Same — accepted risk |

**Key observations:**
- **No code changes** since the last report — security posture is identical.
- **next@16.2.1-canary.13** published (up from canary.12) — canary track active, stable 16.2.2 not yet released.
- **No new advisories or CVEs** affecting any dependency.
- **Outdated package latest versions bumped**: pdfjs-dist (5.5.207 → 5.6.205), postcss (8.5.7 → 8.5.8). No security implications in either update.

---

## Security Posture

### Webhook Signature Verification

All external webhook endpoints use proper cryptographic verification:

| Endpoint | Method | Timing-Safe | Replay Protection |
|----------|--------|-------------|-------------------|
| `/api/webhooks/supabase` | Shared secret + `timingSafeEqual` | Yes | N/A |
| `/api/webhooks/elevenlabs` | HMAC-SHA256 + `timingSafeEqual` | Yes | Yes (30-min window) |
| `/api/webhooks/stripe` | Stripe SDK `constructEvent()` | Yes (SDK) | Yes (SDK) |
| `/api/webhooks/translate` | Shared secret + `timingSafeEqual` | Yes | N/A |

### CSRF Protection

- **Method**: Double-submit cookie pattern
- **Token**: 32-byte `crypto.randomBytes`, hex-encoded
- **Cookie**: `httpOnly=false`, `sameSite='strict'`
- **Validation**: `timingSafeEqual` comparison
- **Scope**: POST, PUT, PATCH, DELETE requests
- **Exempt**: Webhooks (signature-verified), MCP (secret-verified), Cron (auth-verified), Health
- **Null origin**: Explicitly rejected in `src/proxy.ts:38-41` — `if (!origin) return false`

### Timing-Safe Comparison Coverage

All security-critical comparisons use `timingSafeEqual`:

| Location | Purpose |
|----------|---------|
| `src/app/api/webhooks/supabase/route.ts` | Webhook secret |
| `src/app/api/webhooks/elevenlabs/route.ts` | HMAC signature |
| `src/app/api/webhooks/translate/route.ts` | Webhook secret |
| `src/lib/cron-auth.ts` (x2) | Vercel Cron bearer token + webhook secret |
| `src/lib/csrf.ts` | CSRF token validation |
| `src/lib/mcp-auth.ts` | MCP API secret |

### Security Headers

Configured in `next.config.ts` (static headers) and `src/proxy.ts` (dynamic CSP):

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload | Production only |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-Frame-Options | DENY | Clickjacking protection |
| Referrer-Policy | strict-origin-when-cross-origin | Balanced privacy/functionality |
| Permissions-Policy | camera=(), geolocation=(), microphone=(self) | Restricts powerful features |
| Content-Security-Policy | PPR-compatible (see below) | XSS defense-in-depth |

### CSP Configuration

```
default-src 'self';
script-src 'self' 'unsafe-inline' blob: https://js.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com;
media-src 'self' blob:;
worker-src 'self' blob:;
frame-src https://js.stripe.com;
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

**CSP design rationale (src/proxy.ts:219-231):**
- **No `'strict-dynamic'`** — PPR (`cacheComponents`) prerenders HTML at build time without nonces. `'strict-dynamic'` would override `'self'` per CSP Level 3, blocking ALL scripts.
- **No nonce in directives** — The `buildCspHeader()` function accepts a `_nonce` parameter (underscore = unused). Nonces would require `headers()` call in root layout, making it dynamic and incompatible with PPR static shell.
- **`'unsafe-inline'` for scripts** — Required for Next.js hydration inline scripts. Combined with `'self'` (same-origin external scripts) and explicit allowlist (`https://js.stripe.com`).
- **`blob:` in script-src** — Required for ElevenLabs AudioWorklet processor.
- **`style-src 'unsafe-inline'`** — Required by Tailwind CSS / Next.js CSS-in-JS. Lower risk than script injection. Industry-standard trade-off.
- **E2E canary** — `e2e/smoke.spec.ts` verifies JavaScript executes under CSP. If CSP blocks scripts, this test fails immediately.

### Rate Limiting

| Feature | Value |
|---------|-------|
| Backend | Upstash Redis (primary) + in-memory (fallback) |
| Algorithm | Sliding window |
| MCP Places | 20 req/min per IP |
| MCP Weather | 30 req/min per IP |
| Chat streaming | 10 req/60s per IP |
| In-memory cap | 10,000 entries with automatic pruning |
| Response | 429 with `Retry-After` header |

### Input Validation & Sanitization

| Layer | Implementation | Coverage |
|-------|----------------|----------|
| Chat safety | `sanitizeInput()` — 15+ injection patterns, XML tag removal, 2000 char limit | All chat queries |
| Validation | Control character removal, zero-width char stripping, whitespace collapsing | All user inputs |
| MCP booking | Spanish phone regex, E.164 normalization, required field checks | Booking endpoint |
| MCP places | Type whitelist (VALID_TYPES array), query validation | Places endpoint |
| Admin auth | Supabase session + `user_profiles.role = 'admin'` check | All admin routes |

### Dangerous Pattern Check

| Pattern | Status |
|---------|--------|
| `eval()` / `Function()` | None found in `src/` |
| Raw SQL (no parameterization) | None — all via Supabase client |
| Hardcoded secrets | None — all via env vars with `.trim()` |
| Command injection | None — all command execution uses whitelist + hardcoded literals + admin auth + dev-only gates |
| `dangerouslySetInnerHTML` | 7 instances — all safe (see below) |
| Server Actions (`'use server'`) | None found — uses API routes exclusively |

**`dangerouslySetInnerHTML` audit:**

| File | Usage | Safe? | Why |
|------|-------|-------|-----|
| `src/components/seo/json-ld.tsx` (x5) | `JSON.stringify(data)` on config objects | Yes | Server-controlled data, no user input |
| `src/components/admin/agents-dashboard/cross-agent-insights.tsx` | `renderMarkdown(entry.content)` | Yes | Input HTML-escaped via `escapeHtml()` before rendering; admin-only content |
| `src/components/admin/agents-dashboard/optimizer-report-dialog.tsx` | `renderMarkdown(reportMarkdown)` | Yes | Input HTML-escaped via `escapeHtml()` before rendering; admin-only content |

**Command execution audit:**

| File | Usage | Safe? | Why |
|------|-------|-------|-----|
| `src/app/api/admin/agents/run/route.ts` | `spawn("bash", [scriptPath])` | Yes | Script path from whitelisted `AGENT_SCRIPTS` object (7 entries), admin auth required |
| `src/lib/claude.ts` | `spawn("curl", [...])` | Yes | Dev-only (`NODE_ENV !== "production"`), env var source trusted |
| `src/app/api/admin/tunnel/route.ts` | `spawn("cloudflared", [...])` / `execAsync(...)` | Yes | Hardcoded values, dev-only restriction |

**Note:** `regex.exec()` calls in `agents-summary/route.ts` and `chat-action-detection.ts` are RegExp methods, not shell execution — no injection risk.

---

## License Compliance

| License | Count | Status |
|---------|-------|--------|
| MIT | 268 | Permissive |
| Apache-2.0 | 30 | Permissive |
| BSD-3-Clause | 16 | Permissive |
| ISC | 11 | Permissive |
| MIT* | 2 | Permissive |
| BSD-2-Clause | 1 | Permissive |
| MIT-0 | 1 | Permissive |
| 0BSD | 1 | Permissive |
| (Apache-2.0 AND BSD-3-Clause) | 1 | Permissive |
| (BSD-2-Clause OR MIT OR Apache-2.0) | 1 | Permissive |
| CC-BY-4.0 | 1 | Permissive (data) |
| Unlicense | 1 | Permissive |
| (MIT OR WTFPL) | 1 | Permissive (MIT applies) |
| (MPL-2.0 OR Apache-2.0) | 1 | Dual-licensed, use Apache-2.0 |
| MPL-2.0 | 1 | Weak copyleft (see notes) |
| LGPL-3.0-or-later | 1 | Weak copyleft (see notes) |
| UNLICENSED | 1 | This project (internal) |

### Flagged License Packages

| Package | License | Usage | Risk |
|---------|---------|-------|------|
| @img/sharp-libvips-darwin-arm64@1.2.4 | LGPL-3.0-or-later | Native binary dep of `sharp` (production, transitive) | **Low** — Dynamic linking, SaaS deployment, no source distribution. Approved in `docs/project/license-exceptions.md` |
| @vercel/analytics@1.6.1 | MPL-2.0 | Direct production dependency | **Low** — Used as-is, no modifications to MPL files. Note: v2.0.1 available — verify license unchanged before upgrading |
| dompurify@3.3.3 | (MPL-2.0 OR Apache-2.0) | Transitive via `posthog-js` (production) | **None** — Dual-licensed, Apache-2.0 applies |
| expand-template@2.0.3 | (MIT OR WTFPL) | Transitive via `canvas` → `prebuild-install` (optional dep) | **None** — MIT applies, and canvas is optional |
| paisaxe@1.0.0 | UNLICENSED | This project's package.json (`"private": true`) | **None** — Private/internal project |

**Copyleft in production:** No blocking issues. LGPL and MPL are weak copyleft — compliant under current usage (no modification, no source distribution, SaaS deployment). CI license-check workflow blocks strong copyleft (GPL, AGPL, SSPL) on all PRs. LGPL exception formally documented in `docs/project/license-exceptions.md`.

---

## Outdated Packages with Security Implications

| Package | Current | Latest | Dep Type | Security Impact | Priority |
|---------|---------|--------|----------|-----------------|----------|
| **next** | **16.1.6** | **16.2.1** | **prod** | **5 sub-advisories (1 exploitable) — BLOCKED by Vercel runtime bug** | **HIGH — waiting for 16.2.2+** |
| @anthropic-ai/sdk | 0.78.0 | 0.80.0 | prod | None known (minor) | Low |
| **@elevenlabs/react** | **0.14.1** | **1.0.0** | **prod** | **Major version (0.x → 1.0)** — voice UI library, review migration guide | **Medium** |
| @next/bundle-analyzer | 16.1.6 | 16.2.1 | dev | None (build tooling) | Low |
| @next/eslint-plugin-next | 16.1.6 | 16.2.1 | dev | None (lint tooling) | Low |
| **@stripe/react-stripe-js** | **5.6.0** | **6.0.0** | **prod** | **Major version** — payment UI library, review breaking changes | **Medium** |
| **@stripe/stripe-js** | **8.8.0** | **9.0.0** | **prod** | **Major version** — payment library, review breaking changes | **Medium** |
| @supabase/ssr | 0.8.0 | 0.9.0 | prod | Auth library — minor version | Medium |
| @supabase/supabase-js | 2.97.0 | 2.100.1 | prod | Core client — minor version | Medium |
| @tailwindcss/postcss | 4.2.1 | 4.2.2 | dev | None (styling tooling) | Low |
| @typescript-eslint/eslint-plugin | 8.56.1 | 8.57.2 | dev | None (lint tooling) | Low |
| @upstash/redis | 1.36.2 | 1.37.0 | prod | Rate limiting backend — minor | Low |
| @vercel/analytics | 1.6.1 | 2.0.1 | prod | **Major version** — review changelog + license | Medium |
| @vercel/speed-insights | 1.3.1 | 2.0.0 | prod | **Major version** — review changelog | Medium |
| @vitejs/plugin-react | 5.1.4 | 6.0.1 | dev | **Major version** — dev tooling only | Low |
| @vitest/coverage-v8 | 4.1.1 | 4.1.2 | dev | Patch — coverage tooling | Low |
| canvas | 3.2.1 | 3.2.2 | dev | PDF test rendering — patch | Low |
| jsdom | 28.1.0 | 27.0.1 | dev | Version mismatch (current is ahead) | None |
| knip | 5.85.0 | 6.1.0 | dev | **Major version** — dead code detection tooling | Low |
| lucide-react | 0.575.0 | 1.7.0 | prod | **Major version (0.x → 1.x)** — icon library, review breaking changes | Medium |
| pdfjs-dist | 5.4.624 | 5.6.205 | prod | PDF parsing — minor version bump | Medium |
| postcss | 8.5.6 | 8.5.8 | dev | None (CSS tooling) | Low |
| posthog-js | 1.353.0 | 1.364.1 | prod | None known | Low |
| resend | 6.9.2 | 6.9.4 | prod | Email service — patch | Low |
| **stripe** | **20.3.1** | **21.0.1** | **prod** | **Major version** — payment server SDK, review breaking changes | **Medium** |
| tailwindcss | 4.2.1 | 4.2.2 | dev | None (styling tooling) | Low |
| typescript | 5.9.3 | 6.0.2 | dev | **Major version** — TypeScript 6.0 | Medium |
| vitest | 4.1.1 | 3.2.4 | dev | Version mismatch (current is ahead) | None |
| voyageai | 0.1.0 | 0.2.1 | prod | None known | Low |

**Note:** `jsdom` and `vitest` show version format mismatches in `npm outdated` output — these are at or ahead of the latest published version. No security implications.

**Changes from Mar 29:** pdfjs-dist latest bumped 5.5.207 → 5.6.205, postcss latest bumped → 8.5.8. All else identical. No new security advisories for any package.

---

## CI/CD Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Enabled | Weekly (Mon), grouped PRs for npm + GitHub Actions |
| Renovate | Not configured | Not needed with Dependabot |
| Gitleaks | **In CI** | Runs on push/PR + weekly schedule (Mon 8:00 UTC) |
| npm audit | In CI | `--omit=dev --audit-level=high`, runs on push + weekly |
| License check | In CI | Blocks GPL, AGPL, SSPL, and other strong copyleft |
| Knip (dead code) | In CI | Blocks unused exports on PRs |
| Branch protection | Enabled on `main` | 4 required status checks, force push blocked |
| Claude Code Review | In CI | Runs on PRs |
| Pre-commit hooks | Active | Typecheck + lint + test via Husky |
| npm overrides | Active | `qs >= 6.14.2`, `minimatch >= 10.2.1`, `brace-expansion >= 5.0.5` |

**CI note on current advisory:** `npm audit --omit=dev --audit-level=high` in CI will NOT flag the next@16.1.6 advisory (it is classified as "moderate", below the "high" threshold). CI continues passing despite the advisory. This is by design — moderate advisories are informational in CI, tracked by this report.

**All CI/CD security automation gaps are closed.** No outstanding gaps.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Advisories | **1** (moderate) |
| Critical | 0 |
| High | 0 |
| Moderate | **1** (next@16.1.6 — 5 sub-advisories) |
| Low | 0 |
| **Exploitable** | **1** (PPR buffering DoS — GHSA-h27x-g6w4-24gq) |
| Fixable via npm audit | **0** (blocked by Vercel runtime bug) |
| License Compliant | Yes |
| Webhook Security | All timing-safe (4/4 endpoints) |
| CSRF Protection | Yes (double-submit cookie + null-origin rejection) |
| CSP | PPR-compatible (`'self' 'unsafe-inline'`, no `strict-dynamic`) |
| Rate Limiting | Yes (distributed via Upstash Redis) |
| CI Secret Scanning | Yes (Gitleaks in workflow) |
| **Health Status** | **YELLOW** |

### Architecture Mitigations

1. **PPR-compatible CSP** — `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com` + E2E canary test
2. **CSRF protection** — Double-submit cookie with timing-safe validation on all mutating requests + null-origin rejection
3. **Timing-safe everywhere** — All 7 security-critical comparison points use `timingSafeEqual`
4. **Input sanitization** — `sanitizeInput()` + `escapeHtml()` cover all user-facing input paths
5. **HTML escaping** — All `dangerouslySetInnerHTML` instances pre-escape content via `escapeHtml()` or `JSON.stringify()`
6. **No command injection** — All exec/spawn calls use whitelisted literals with admin auth + dev-only gates
7. **No SQL injection** — All database queries parameterized via Supabase client
8. **No Server Actions** — Zero `'use server'` directives, eliminating Server Action attack surface
9. **Full CI/CD security** — Dependabot + Gitleaks + npm audit + license check + Knip + branch protection

### Improvement Backlog

| Item | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| **Upgrade next to 16.2.2+** (when released) | **High** | Low | Closes 5 sub-advisories, 1 exploitable | **Blocked — waiting for upstream fix** |
| Evaluate @elevenlabs/react v1.0.0 (major) | Medium | Medium | Voice UI — review migration guide for breaking changes | Open |
| Evaluate Stripe ecosystem v21/v9/v6 (3 major versions) | Medium | High | Payment libraries — review migration guides together | Open |
| Evaluate lucide-react v1.7.0 (major) | Medium | Medium | Icon library, check migration guide | Open |
| Evaluate typescript v6.0.2 (major) | Medium | Medium | Dev tooling, check breaking changes | Open |
| Update @supabase/ssr to 0.9.0 | Low | Low | Auth library update | Open |
| Update @supabase/supabase-js to 2.100.1 | Low | Low | Core client update | Open |
| Update pdfjs-dist to 5.6.205 | Low | Medium | PDF parsing update, may have fixes | Open |
| Evaluate @vercel/analytics v2.0.1 | Low | Medium | Major version — check changelog + license | Open |
| Evaluate @vercel/speed-insights v2.0.0 | Low | Medium | Major version — check changelog | Open |
| Evaluate knip v6.1.0 | Low | Medium | Major version — check breaking changes | Open |

---

*Report generated by Security Agent*
