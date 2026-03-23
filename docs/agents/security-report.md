# Security Report

> Auto-generated on 2026-03-22

## Health Status: GREEN

**Executive Summary:** 3 advisories detected (2 high, 1 moderate), **0 exploitable**. No changes to vulnerability landscape since Mar 21 — same 3 advisories, same 0 exploitability. flatted + undici at day 9 (dev-only). next@16.1.6 at day 5 (5 sub-advisories, all non-exploitable). All 3 fixable via `npm audit fix`. Gitleaks still not in CI (**19th consecutive report**). Outdated packages up to 27 — `canvas@3.2.2` now available.

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| High | flatted <=3.4.1 | [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f), [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | Pending | Unbounded recursion DoS + Prototype Pollution in `parse()` | Yes | **No** (dev-only) | **Not exploitable** |
| High | undici 7.0.0–7.23.0 | [GHSA-f269-vfmq-vjvj](https://github.com/advisories/GHSA-f269-vfmq-vjvj) + 5 others | Multiple | WebSocket overflow, HTTP smuggling, CRLF injection, memory DoS | Yes | **No** (dev-only) | **Not exploitable** |
| Moderate | next 16.0.0-beta.0–16.1.6 | [GHSA-mq59-m269-xvcx](https://github.com/advisories/GHSA-mq59-m269-xvcx) + 4 others | Multiple | CSRF bypass, HTTP smuggling, image cache DoS, buffering DoS | Yes | **Yes** (prod) | **Not exploitable** (see analysis) |

### Exploitability Analysis

#### flatted@3.3.3 — NOT EXPLOITABLE

- **Dependency chain:** `eslint@9.39.4` → `file-entry-cache@8.0.0` → `flat-cache@4.0.1` → `flatted@3.3.3`
- **Dev-only:** Yes — only used by ESLint's cache system during lint checks
- **User input path:** None — ESLint cache files are developer-controlled `.eslintcache` files
- **Advisory 1 (GHSA-25h7-pfq9-p65f):** Unbounded recursion DoS in `parse()`. Not exploitable — flatted is never imported in application code (`src/`). Zero direct usage. Not bundled, not deployed.
- **Advisory 2 (GHSA-rf6f-7fwh-wjgh):** Prototype Pollution via `parse()`. Same non-exploitability reasoning — user-supplied data (chat messages, API requests, webhook payloads) cannot reach `flatted.parse()`.
- **Why not exploitable:** flatted is never imported in application code (`src/`). Zero direct usage. Not bundled, not deployed.

#### undici@7.22.0 — NOT EXPLOITABLE

- **Dependency chain:** `jsdom@28.1.0` → `undici@7.22.0`
- **Dev-only:** Yes — used by jsdom for Vitest test environments
- **6 advisories assessed:**

| Advisory | Component | Reachable in Production |
|----------|-----------|------------------------|
| GHSA-f269-vfmq-vjvj | WebSocket 64-bit length overflow | No — WebSockets use ElevenLabs SDK and Supabase SDK, not undici |
| GHSA-2mjp-6q6p-2qxm | HTTP Request/Response Smuggling | No — dev-only HTTP client |
| GHSA-vrm6-8vpv-qv8q | WebSocket permessage-deflate memory | No — no undici WebSocket usage |
| GHSA-v9p9-hfj2-hcw8 | WebSocket server_max_window_bits | No — no undici WebSocket usage |
| GHSA-4992-7rv2-5pvq | CRLF Injection via `upgrade` option | No — grep confirms zero `upgrade` option usage in codebase |
| GHSA-phc3-fgpg-7m6h | DeduplicationHandler memory DoS | No — dev-only HTTP deduplication |

- **Why not exploitable:** undici is only installed as a transitive dev dependency of jsdom (test environment). Application HTTP uses Node.js native `fetch()`, Supabase SDK, Anthropic SDK, and Stripe SDK — none route through this undici instance. No user input reaches undici's parsing layers.

#### next@16.1.6 — NOT EXPLOITABLE

- **Dependency:** Direct production dependency
- **5 advisories assessed:**

| Advisory | Issue | Exploitable? | Why |
|----------|-------|-------------|-----|
| [GHSA-mq59-m269-xvcx](https://github.com/advisories/GHSA-mq59-m269-xvcx) | Null origin can bypass Server Actions CSRF | **No** | Zero `"use server"` directives in codebase — Server Actions not used. App uses traditional API routes exclusively. Additionally, `src/proxy.ts:38-41` explicitly rejects null origins: `if (!origin) return false` |
| [GHSA-jcc7-9wpm-mj36](https://github.com/advisories/GHSA-jcc7-9wpm-mj36) | Null origin bypass dev HMR WebSocket CSRF | **No** | Dev-only — HMR disabled in production. Does not affect paisaxe.es / paisaxe.com |
| [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) | HTTP request smuggling in rewrites | **No** | Rewrites in `next.config.ts:40-48` are two safe external HTTPS redirects to PostHog (`eu.i.posthog.com`). No internal rewrites, no complex regex patterns |
| [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) | Unbounded next/image disk cache growth | **No** | Image config in `next.config.ts:74-93` sets `minimumCacheTTL: 2592000` (30 days) and restricts remote patterns to Supabase + Unsplash only. Cache growth is bounded |
| [GHSA-h27x-g6w4-24gq](https://github.com/advisories/GHSA-h27x-g6w4-24gq) | Unbounded postponed resume buffering DoS | **No** | PPR (Partial Pre-rendering) not enabled — no `experimentalPPR` in next.config.ts, no `postpone()` calls found in codebase |

- **Why not exploitable:** The 5 advisories target features this codebase doesn't use (Server Actions, PPR) or has properly mitigated (null origin rejection, bounded image cache, safe rewrites). The `src/proxy.ts` CORS implementation provides defense-in-depth by explicitly rejecting null origins.
- **Recommendation:** Update to `next@16.2.1` via `npm audit fix` to eliminate the advisory. This is a minor version bump.

### Remediation

```bash
npm audit fix
```

This will upgrade flatted to >=3.4.2, undici to >=7.24.0, and next to 16.2.1. No breaking changes expected for flatted/undici (patch-level updates within dev dependency tree). The `next` upgrade is a minor version bump — review the [16.2.1 changelog](https://github.com/vercel/next.js/releases) before applying.

### Previously Resolved

| Advisory | Resolution | When |
|----------|-----------|------|
| minimatch 10.2.2 ReDoS (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | Override updated to `>=10.2.3` in `package.json` | Mar 7–8 |
| dompurify 3.3.1 XSS (GHSA-v2wj-7wpq-c8vv) | Resolved via dependency update | Mar 7–8 |
| qs arrayLimit bypass (GHSA-w7fw-mjwx-p883) | Override `qs >= 6.14.2` | Earlier |
| Next.js Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f) | Fixed in next@16.1.6 | Earlier |
| Next.js PPR Memory DoS (GHSA-5f7q-jpqc-wp7h) | Fixed in next@16.1.6 | Earlier |
| Next.js RSC Deserialization DoS (GHSA-h25m-26qc-wcjf) | Fixed in next@16.1.6 | Earlier |

---

## Changes Since Last Report (2026-03-21)

| Area | Mar 21 | Mar 22 | Change |
|------|--------|--------|--------|
| Vulnerability count | 3 | 3 | Unchanged |
| Exploitable vulns | 0 | 0 | Unchanged |
| CSP | Nonce + strict-dynamic | Nonce + strict-dynamic | Unchanged |
| Gitleaks in CI | Not in workflow | Not in workflow | **Still open** — 19th consecutive report |
| dangerouslySetInnerHTML | 7 instances | 7 instances | Unchanged — all safe |
| Outdated packages | 26 | 27 | +1 (`canvas@3.2.2` now available) |

**Outdated package version changes since Mar 21:** `canvas` latest bumped to **3.2.2** (new patch — was at 3.2.1). All other versions unchanged.

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
| Content-Security-Policy | Nonce-based (see below) | XSS defense-in-depth |

### CSP Configuration

```
default-src 'self';
script-src 'self' 'nonce-{per-request}' 'strict-dynamic' blob: https://js.stripe.com;
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

**CSP notes:**
- `style-src 'unsafe-inline'` — Required by Tailwind CSS / Next.js CSS-in-JS. Lower risk than script injection. Industry-standard trade-off.
- `blob:` in script-src and media-src — Required for ElevenLabs AudioWorklet processor.

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

**`dangerouslySetInnerHTML` audit:**

| File | Usage | Safe? | Why |
|------|-------|-------|-----|
| `src/components/seo/json-ld.tsx` (x5) | `JSON.stringify(data)` on config objects | Yes | Server-controlled data, no user input |
| `src/components/admin/agents-dashboard/cross-agent-insights.tsx` | `renderMarkdown(entry.content)` | Yes | Input HTML-escaped via `escapeHtml()` before rendering; admin-only content |
| `src/components/admin/agents-dashboard/optimizer-report-dialog.tsx` | `renderMarkdown(reportMarkdown)` | Yes | Input HTML-escaped via `escapeHtml()` before rendering; admin-only content |

**Command execution audit:**

| File | Usage | Safe? | Why |
|------|-------|-------|-----|
| `src/app/api/admin/agents/run/route.ts` | `spawn("bash", [scriptPath])` | Yes | Script path from whitelisted `AGENT_SCRIPTS` object, admin auth required |
| `src/lib/claude.ts` | `spawn("curl", [...])` | Yes | Dev-only (`NODE_ENV !== "production"`), env var source trusted |
| `src/app/api/admin/tunnel/route.ts` | `spawn("cloudflared", [...])` | Yes | Hardcoded values, dev-only restriction |

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
| @img/sharp-libvips-darwin-arm64@1.2.4 | LGPL-3.0-or-later | Native binary dep of `sharp` (production) | **Low** — Dynamic linking, SaaS deployment, no source distribution. Approved in `docs/project/license-exceptions.md` |
| @vercel/analytics@1.6.1 | MPL-2.0 | Direct production dependency | **Low** — Used as-is, no modifications to MPL files. Note: v2.0.1 available — verify license unchanged before upgrading |
| dompurify@3.3.2 | (MPL-2.0 OR Apache-2.0) | Transitive via `posthog-js` (production) | **None** — Dual-licensed, Apache-2.0 applies |
| expand-template@2.0.3 | (MIT OR WTFPL) | Transitive via `canvas` → `prebuild-install` | **None** — MIT applies |
| paisaxe@1.0.0 | UNLICENSED | This project's package.json (`"private": true`) | **None** — Private/internal project |

**Copyleft in production:** No blocking issues. LGPL and MPL are weak copyleft — compliant under current usage (no modification, no source distribution, SaaS deployment). CI license-check workflow blocks strong copyleft (GPL, AGPL, SSPL) on all PRs. LGPL exception formally documented in `docs/project/license-exceptions.md`.

---

## Outdated Packages with Security Implications

| Package | Current | Latest | Dep Type | Security Impact | Priority |
|---------|---------|--------|----------|-----------------|----------|
| next | 16.1.6 | 16.2.1 | prod | **Fixes 5 advisories** (moderate) — update recommended | **High** |
| @anthropic-ai/sdk | 0.78.0 | 0.80.0 | prod | None known (minor) | Low |
| @elevenlabs/react | 0.14.1 | 0.14.3 | prod | None known (patch) | Low |
| @next/bundle-analyzer | 16.1.6 | 16.2.1 | dev | Mirrors Next.js version | Low |
| @next/eslint-plugin-next | 16.1.6 | 16.2.1 | dev | Mirrors Next.js version | Low |
| @stripe/stripe-js | 8.9.0 | 8.11.0 | prod | Payment library — review changelog | Medium |
| @supabase/ssr | 0.8.0 | 0.9.0 | prod | Auth library — minor version | Medium |
| @supabase/supabase-js | 2.98.0 | 2.99.3 | prod | Core client — minor version | Medium |
| @tailwindcss/postcss | 4.2.1 | 4.2.2 | dev | None (styling tooling) | Low |
| @types/node | 25.3.5 | 25.5.0 | dev | None (type definitions) | Low |
| @typescript-eslint/eslint-plugin | 8.56.1 | 8.57.1 | dev | None (lint tooling) | Low |
| @upstash/ratelimit | 2.0.8 | 2.0.8 | prod | Current (version format mismatch) | None |
| @upstash/redis | 1.36.3 | 1.37.0 | prod | Rate limiting backend — minor | Low |
| @vercel/analytics | 1.6.1 | 2.0.1 | prod | **Major version** — review changelog + license | Medium |
| @vercel/speed-insights | 1.3.1 | 2.0.0 | prod | **Major version** — review changelog | Medium |
| @vitejs/plugin-react | 5.1.4 | 6.0.1 | dev | **Major version** — dev tooling only | Low |
| @vitest/coverage-v8 | 4.0.18 | 4.1.0 | dev | None (dev tooling) | Low |
| canvas | 3.2.1 | 3.2.2 | dev | PDF test rendering — patch | Low |
| knip | 5.85.0 | 6.0.1 | dev | **Major version** — dead code detection tooling | Low |
| lucide-react | 0.575.0 | 0.577.0 | prod | None known | Low |
| pdfjs-dist | 5.4.624 | 5.5.207 | prod | PDF parsing — monitor | Medium |
| posthog-js | 1.359.1 | 1.363.1 | prod | None known | Low |
| resend | 6.9.3 | 6.9.4 | prod | Email service — patch | Low |
| tailwindcss | 4.2.1 | 4.2.2 | dev | None (styling tooling) | Low |
| vitest | 4.0.18 | 4.1.0 | dev | None (dev tooling) | Low |
| voyageai | 0.1.0 | 0.2.1 | prod | None known | Low |

**Note:** `@upstash/ratelimit`, `jsdom`, and `vitest` show version format mismatches in `npm outdated` output — these are at or ahead of the latest published version. No security implications.

**Major version updates:** `@vercel/analytics` (v2.0.1), `@vercel/speed-insights` (v2.0.0), `@vitejs/plugin-react` (v6.0.1), and `knip` (v6.0.1) have major versions available. For `@vercel/analytics`, verify license remains MPL-2.0 or changes to more permissive. Dev-only major bumps (`@vitejs/plugin-react`, `knip`) are lower risk.

**Priority update: `next@16.2.1`** resolves the moderate advisory. While the 5 sub-advisories are not exploitable in this codebase, updating eliminates the advisory and is a standard minor version bump. Consider bundling with `@next/bundle-analyzer` and `@next/eslint-plugin-next` (all go to 16.2.1).

---

## CI/CD Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Enabled | Weekly (Mon), grouped PRs for npm + GitHub Actions |
| Renovate | Not configured | Not needed with Dependabot |
| Gitleaks | Config exists (`.gitleaks.toml`) | **Not in CI workflow** — 19th consecutive report flagging this |
| npm audit | In CI | `--omit=dev --audit-level=high`, runs on push + weekly |
| License check | In CI | Blocks GPL, AGPL, SSPL, and other strong copyleft |
| Knip (dead code) | In CI | Blocks unused exports on PRs |
| Branch protection | Enabled on `main` | 4 required status checks, force push blocked |
| Claude Code Review | In CI | Runs on PRs, uses `claude-sonnet-4-5-20250929` |
| Pre-commit hooks | Active | Typecheck + lint + test via Husky |
| npm overrides | Active | `qs >= 6.14.2`, `minimatch >= 10.2.3` |

### CI npm audit configuration note

The security workflow (`security.yml`) runs `npm audit --omit=dev --audit-level=high`. The flatted and undici advisories are **dev-only** — they will NOT trigger CI failures. The `next` advisory is **moderate** severity — it will NOT trigger CI failures either (audit level is set to `high`). This is correct behavior: CI audits production dependencies at high+ severity only. The advisories are still worth fixing to maintain a clean `npm audit` for local development.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Advisories | **3** |
| Critical | 0 |
| High | 2 (dev-only) |
| Moderate | 1 (prod, not exploitable) |
| Low | 0 |
| **Exploitable** | **0** |
| Fixable via npm audit | 3 (all via `npm audit fix`) |
| License Compliant | Yes |
| Webhook Security | All timing-safe (4/4 endpoints) |
| CSRF Protection | Yes (double-submit cookie + null-origin rejection) |
| CSP | Nonce-based + strict-dynamic |
| Rate Limiting | Yes (distributed via Upstash Redis) |
| **Health Status** | **GREEN** |

### Architecture Mitigations

1. **Dev-only vulnerabilities** — Both high advisories (flatted, undici) are transitive dev dependencies; not deployed to production
2. **Next.js advisories mitigated** — No Server Actions, no PPR, safe rewrites, bounded image cache, explicit null-origin rejection
3. **Nonce-based CSP** — Per-request nonce + `strict-dynamic` eliminates inline script XSS surface
4. **CSRF protection** — Double-submit cookie with timing-safe validation on all mutating requests
5. **Timing-safe everywhere** — All 7 security-critical comparison points use `timingSafeEqual`
6. **Input sanitization** — `sanitizeInput()` + `escapeHtml()` cover all user-facing input paths
7. **HTML escaping** — All `dangerouslySetInnerHTML` instances pre-escape content via `escapeHtml()` or `JSON.stringify()`
8. **No command injection** — All exec/spawn calls use whitelisted literals with admin auth + dev-only gates

### Improvement Backlog

| Item | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Run `npm audit fix` (flatted + undici + next) | **Medium** | Low | Resolves all 3 advisories; next@16.2.1 is minor bump | Open (9th day for flatted/undici, 5th for next) |
| Add gitleaks to CI workflow | Medium | Low | Prevents secret leaks in commits | Open (19th report) |
| Update @stripe/stripe-js to 8.11.0 | Low | Low | Payment library patch | Open |
| Update @supabase/ssr to 0.9.0 | Low | Low | Auth library update | Open |
| Update @supabase/supabase-js to 2.99.3 | Low | Low | Core client update | Open |
| Update pdfjs-dist to 5.5.207 | Low | Medium | PDF parsing update, may have fixes | Open |
| Evaluate @vercel/analytics v2.0.1 | Low | Medium | Major version — check changelog + license | Open |
| Evaluate @vercel/speed-insights v2.0.0 | Low | Medium | Major version — check changelog | Open |
| Evaluate knip v6.0.1 | Low | Medium | Major version — check breaking changes | Open |

---

*Report generated by Security Agent*
