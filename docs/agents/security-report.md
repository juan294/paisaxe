# Security Report

> Auto-generated on 2026-03-24

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, **0 exploitable**. Clean `npm audit` for 2nd consecutive day. All CI/CD security automation active. CSP description corrected this cycle — previous reports inaccurately stated `nonce + strict-dynamic`; actual implementation is `'self' 'unsafe-inline'` (PPR-compatible). 27 outdated packages (+2: `typescript@6.0.2` and `lucide-react@1.0.1` — both major versions), none with known exploitable vulnerabilities.

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| — | — | — | — | — | — | — | **No active advisories** |

### Previously Resolved

| Advisory | Resolution | When |
|----------|-----------|------|
| flatted <=3.4.1 — Unbounded recursion DoS + Prototype Pollution (GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh) | Resolved via `npm audit fix` (upgraded to >=3.4.2) | Mar 23 |
| undici 7.0.0–7.23.0 — WebSocket overflow, HTTP smuggling, CRLF injection, memory DoS (GHSA-f269-vfmq-vjvj + 5 others) | Resolved via `npm audit fix` (upgraded to >=7.24.0) | Mar 23 |
| next 16.0.0-beta.0–16.1.6 — CSRF bypass, HTTP smuggling, image cache DoS, buffering DoS (GHSA-mq59-m269-xvcx + 4 others) | Resolved via `npm audit fix` (upgraded to 16.2.1) | Mar 23 |
| minimatch 10.2.2 ReDoS (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | Override updated to `>=10.2.3` in `package.json` | Mar 7–8 |
| dompurify 3.3.1 XSS (GHSA-v2wj-7wpq-c8vv) | Resolved via dependency update | Mar 7–8 |
| qs arrayLimit bypass (GHSA-w7fw-mjwx-p883) | Override `qs >= 6.14.2` | Earlier |
| Next.js Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f) | Fixed in next@16.1.6 | Earlier |
| Next.js PPR Memory DoS (GHSA-5f7q-jpqc-wp7h) | Fixed in next@16.1.6 | Earlier |
| Next.js RSC Deserialization DoS (GHSA-h25m-26qc-wcjf) | Fixed in next@16.1.6 | Earlier |

---

## Changes Since Last Report (2026-03-23)

| Area | Mar 23 | Mar 24 | Change |
|------|--------|--------|--------|
| Vulnerability count | 0 | 0 | Unchanged |
| Exploitable vulns | 0 | 0 | Unchanged |
| CSP (actual code) | `'self' 'unsafe-inline'` | `'self' 'unsafe-inline'` | **Report corrected** — was incorrectly stated as `nonce + strict-dynamic` |
| dangerouslySetInnerHTML | 7 instances | 7 instances | Unchanged — all safe |
| Outdated packages | 25 | 27 | +2 (`typescript@6.0.2`, `lucide-react@1.0.1` — both major) |

**Key changes:**
- **CSP report corrected**: Previous reports stated `nonce-based + strict-dynamic` which was inaccurate. The actual `buildCspHeader()` in `src/proxy.ts:232-248` uses `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com` — the nonce parameter is explicitly unused (`_nonce`). `strict-dynamic` is intentionally omitted for PPR compatibility. This is the correct design per CLAUDE.md, but the report was misdescribing it.
- **New major versions available**: `typescript@6.0.2` (from 5.9.3) and `lucide-react@1.0.1` (from 0.575.0) appeared in outdated list. Neither has known vulnerabilities.
- **Minor version bumps**: `@supabase/supabase-js` 2.99.3→2.100.0, `@typescript-eslint/eslint-plugin` 8.57.1→8.57.2, `posthog-js` 1.363.1→1.363.3, `@vitest/coverage-v8` 4.1.0→4.1.1, `knip` 6.0.2→6.0.4.

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
| @anthropic-ai/sdk | 0.78.0 | 0.80.0 | prod | None known (minor) | Low |
| @elevenlabs/react | 0.14.1 | 0.14.3 | prod | None known (patch) | Low |
| @next/bundle-analyzer | 16.1.6 | 16.2.1 | dev | None (build tooling) | Low |
| @next/eslint-plugin-next | 16.1.6 | 16.2.1 | dev | None (lint tooling) | Low |
| @stripe/stripe-js | 8.9.0 | 8.11.0 | prod | Payment library — review changelog | Medium |
| @supabase/ssr | 0.8.0 | 0.9.0 | prod | Auth library — minor version | Medium |
| @supabase/supabase-js | 2.98.0 | 2.100.0 | prod | Core client — minor version | Medium |
| @tailwindcss/postcss | 4.2.1 | 4.2.2 | dev | None (styling tooling) | Low |
| @types/node | 25.3.5 | 25.5.0 | dev | None (type definitions) | Low |
| @typescript-eslint/eslint-plugin | 8.56.1 | 8.57.2 | dev | None (lint tooling) | Low |
| @upstash/redis | 1.36.3 | 1.37.0 | prod | Rate limiting backend — minor | Low |
| @vercel/analytics | 1.6.1 | 2.0.1 | prod | **Major version** — review changelog + license | Medium |
| @vercel/speed-insights | 1.3.1 | 2.0.0 | prod | **Major version** — review changelog | Medium |
| @vitejs/plugin-react | 5.1.4 | 6.0.1 | dev | **Major version** — dev tooling only | Low |
| @vitest/coverage-v8 | 4.0.18 | 4.1.1 | dev | None (dev tooling) | Low |
| canvas | 3.2.1 | 3.2.2 | dev | PDF test rendering — patch | Low |
| jsdom | 28.1.0 | 27.0.1 | dev | Version mismatch (current is ahead) | None |
| knip | 5.85.0 | 6.0.4 | dev | **Major version** — dead code detection tooling | Low |
| lucide-react | 0.575.0 | 1.0.1 | prod | **Major version (0.x → 1.0)** — icon library, review breaking changes | Medium |
| pdfjs-dist | 5.4.624 | 5.5.207 | prod | PDF parsing — monitor | Medium |
| posthog-js | 1.359.1 | 1.363.3 | prod | None known | Low |
| resend | 6.9.3 | 6.9.4 | prod | Email service — patch | Low |
| tailwindcss | 4.2.1 | 4.2.2 | dev | None (styling tooling) | Low |
| typescript | 5.9.3 | 6.0.2 | dev | **Major version** — TypeScript 6.0 | Medium |
| vitest | 4.0.18 | 3.2.4 | dev | Version mismatch (current is ahead) | None |
| voyageai | 0.1.0 | 0.2.1 | prod | None known | Low |

**Note:** `jsdom` and `vitest` show version format mismatches in `npm outdated` output — these are at or ahead of the latest published version. No security implications. `@upstash/ratelimit` shows `v2.0.8 -> 2.0.8` — display artifact, same version.

**New major versions this cycle:**
- **`typescript@6.0.2`** — TypeScript 6.0. Dev-only. Review breaking changes before upgrading. No security impact.
- **`lucide-react@1.0.1`** — First stable release (0.x → 1.0). Production dependency. Review migration guide for renamed/removed icons.
- `@vercel/analytics` (v2.0.1), `@vercel/speed-insights` (v2.0.0), `@vitejs/plugin-react` (v6.0.1), `knip` (v6.0.4) — unchanged from last report.

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
| Claude Code Review | In CI | Runs on PRs, uses `claude-sonnet-4-5-20250929` |
| Pre-commit hooks | Active | Typecheck + lint + test via Husky |
| npm overrides | Active | `qs >= 6.14.2`, `minimatch >= 10.2.3` |

**All CI/CD security automation gaps are closed.** No outstanding gaps.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Advisories | **0** |
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 0 |
| **Exploitable** | **0** |
| Fixable via npm audit | 0 (none outstanding) |
| License Compliant | Yes |
| Webhook Security | All timing-safe (4/4 endpoints) |
| CSRF Protection | Yes (double-submit cookie + null-origin rejection) |
| CSP | PPR-compatible (`'self' 'unsafe-inline'`, no `strict-dynamic`) |
| Rate Limiting | Yes (distributed via Upstash Redis) |
| CI Secret Scanning | Yes (Gitleaks in workflow) |
| **Health Status** | **GREEN** |

### Architecture Mitigations

1. **Clean npm audit** — Zero advisories across all severity levels, 2nd consecutive clean day
2. **PPR-compatible CSP** — `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com` + E2E canary test
3. **CSRF protection** — Double-submit cookie with timing-safe validation on all mutating requests
4. **Timing-safe everywhere** — All 7 security-critical comparison points use `timingSafeEqual`
5. **Input sanitization** — `sanitizeInput()` + `escapeHtml()` cover all user-facing input paths
6. **HTML escaping** — All `dangerouslySetInnerHTML` instances pre-escape content via `escapeHtml()` or `JSON.stringify()`
7. **No command injection** — All exec/spawn calls use whitelisted literals with admin auth + dev-only gates
8. **Full CI/CD security** — Dependabot + Gitleaks + npm audit + license check + Knip + branch protection

### Improvement Backlog

| Item | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Evaluate lucide-react v1.0.1 (major) | Medium | Medium | Icon library, check migration guide | New |
| Evaluate typescript v6.0.2 (major) | Medium | Medium | Dev tooling, check breaking changes | New |
| Update @stripe/stripe-js to 8.11.0 | Low | Low | Payment library patch | Open |
| Update @supabase/ssr to 0.9.0 | Low | Low | Auth library update | Open |
| Update @supabase/supabase-js to 2.100.0 | Low | Low | Core client update | Open |
| Update pdfjs-dist to 5.5.207 | Low | Medium | PDF parsing update, may have fixes | Open |
| Evaluate @vercel/analytics v2.0.1 | Low | Medium | Major version — check changelog + license | Open |
| Evaluate @vercel/speed-insights v2.0.0 | Low | Medium | Major version — check changelog | Open |
| Evaluate knip v6.0.4 | Low | Medium | Major version — check breaking changes | Open |

---

*Report generated by Security Agent*
