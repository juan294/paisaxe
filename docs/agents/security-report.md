# Security Report

> Auto-generated on 2026-03-08

## Health Status: GREEN

**Executive Summary:** 0 advisories detected, 0 exploitable. Clean `npm audit` — both previous advisories (minimatch ReDoS, dompurify XSS) are resolved. The minimatch override was corrected to `>=10.2.3`. All 4 webhook endpoints remain timing-safe. No copyleft license violations. CSP is nonce-based with `strict-dynamic`. Gitleaks still not running in CI (open gap since Feb 9 — **6th consecutive report** flagging this).

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| — | — | — | — | — | — | — | **No active advisories** |

**`npm audit` returns 0 vulnerabilities.** Both previous advisories have been resolved:

### Previously Resolved (This Cycle)

| Advisory | Resolution | When |
|----------|-----------|------|
| minimatch 10.2.2 ReDoS (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | Override updated to `>=10.2.3` in `package.json` | Between Mar 7–8 |
| dompurify 3.3.1 XSS (GHSA-v2wj-7wpq-c8vv) | Resolved via dependency update | Between Mar 7–8 |

### Previously Resolved (Earlier)

- **GHSA-w7fw-mjwx-w883** (qs arrayLimit bypass) — Fixed via override `qs >= 6.14.2`
- **GHSA-9g9p-9gw9-jx7f** (Next.js Image Optimizer DoS) — Fixed in next@16.1.6
- **GHSA-5f7q-jpqc-wp7h** (Next.js PPR Memory DoS) — Fixed in next@16.1.6
- **GHSA-h25m-26qc-wcjf** (Next.js RSC Deserialization DoS) — Fixed in next@16.1.6

---

## Changes Since Last Report (2026-03-07)

| Area | Mar 7 | Mar 8 | Change |
|------|-------|-------|--------|
| Vulnerability count | 1 High + 1 Moderate | **0** | **Resolved** |
| Exploitable vulns | 0 | 0 | Unchanged |
| minimatch override | `>=10.2.1` (stale) | `>=10.2.3` (correct) | **Fixed** |
| dompurify | 3.3.1 (via posthog-js) | Not flagged | **Resolved** |
| CSP | Nonce + strict-dynamic | Nonce + strict-dynamic | Unchanged |
| Gitleaks in CI | Not in workflow | Not in workflow | **Still open** — 6th consecutive report |

**Both advisories from the previous 5 reports are now resolved.** Clean vulnerability slate.

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
| `dangerouslySetInnerHTML` | 8 instances — all safe (see below) |

**`dangerouslySetInnerHTML` audit:**

| File | Usage | Safe? | Why |
|------|-------|-------|-----|
| `src/components/seo/json-ld.tsx` (x4) | `JSON.stringify(data)` on config objects | Yes | Server-controlled data, no user input |
| `src/components/admin/agents-dashboard/markdown.ts` | `renderMarkdown()` with `escapeHtml()` | Yes | Input HTML-escaped before rendering |
| `src/components/admin/agents-dashboard/cross-agent-insights.tsx` | `renderMarkdown(entry.content)` | Yes | Escaped; admin-only content |
| `src/components/admin/agents-dashboard/optimizer-report-dialog.tsx` | `renderMarkdown()` | Yes | Escaped; admin-only content |

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
| @img/sharp-libvips-darwin-arm64@1.2.4 | LGPL-3.0-or-later | Native binary dep of `sharp` (production) | **Low** — Dynamic linking, SaaS deployment, no source distribution |
| @vercel/analytics@1.6.1 | MPL-2.0 | Direct production dependency | **Low** — Used as-is, no modifications to MPL files |
| dompurify@3.3.2 | (MPL-2.0 OR Apache-2.0) | Transitive via `posthog-js` | **None** — Dual-licensed, Apache-2.0 applies |
| expand-template@2.0.3 | (MIT OR WTFPL) | Transitive | **None** — MIT applies |
| paisaxe@1.0.0 | UNLICENSED | This project's package.json | **None** — Private/internal project |

**Copyleft in production:** No blocking issues. LGPL and MPL are weak copyleft — compliant under current usage (no modification, no source distribution, SaaS deployment). CI license-check workflow blocks strong copyleft (GPL, AGPL, SSPL) on all PRs.

---

## Outdated Packages with Security Implications

| Package | Current | Latest | Dep Type | Security Impact | Priority |
|---------|---------|--------|----------|-----------------|----------|
| @supabase/ssr | 0.8.0 | 0.9.0 | prod | Minor — auth library | Medium |
| knip | 5.85.0 | 5.86.0 | dev | None (dev tooling) | Low |
| lucide-react | 0.575.0 | 0.577.0 | prod | None known | None |
| pdfjs-dist | 5.4.624 | 5.5.207 | prod | PDF parsing — monitor | Medium |
| voyageai | 0.1.0 | 0.2.1 | prod | None known | Low |

**Note:** `@upstash/ratelimit`, `@upstash/redis`, `jsdom`, and `vitest` show version format mismatches in `npm outdated` output (e.g., `v2.0.8` vs `2.0.8`) — these are likely at the latest version. No security implications.

---

## CI/CD Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Enabled | Weekly, grouped PRs for npm + GitHub Actions |
| Renovate | Not configured | Not needed with Dependabot |
| Gitleaks | Config exists (`.gitleaks.toml`) | **Not in CI workflow** — 6th consecutive report flagging this |
| npm audit | In CI | `--omit=dev --audit-level=high`, runs on push + weekly |
| License check | In CI | Blocks GPL, AGPL, SSPL, and other strong copyleft |
| Knip (dead code) | In CI | Blocks unused exports on PRs |
| Branch protection | Enabled on `main` | 4 required status checks, force push blocked |
| Claude Code Review | In CI | Runs on PRs, uses `claude-sonnet-4-5-20250929` |
| Pre-commit hooks | Active | Typecheck + lint + test via Husky |
| npm overrides | Active | `qs >= 6.14.2`, `minimatch >= 10.2.3` |

### CI npm audit configuration note

The security workflow (`security.yml`) runs `npm audit --omit=dev --audit-level=high`. This is correct — it only flags production dependencies at high severity. With 0 advisories currently, the workflow passes cleanly.

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
| Fixable via npm audit | 0 (none needed) |
| License Compliant | Yes |
| Webhook Security | All timing-safe (4/4 endpoints) |
| CSRF Protection | Yes (double-submit cookie) |
| CSP | Nonce-based + strict-dynamic |
| Rate Limiting | Yes (distributed via Upstash Redis) |
| **Health Status** | **GREEN** |

### Architecture Mitigations

1. **Clean dependency tree** — No active advisories; npm overrides proactively patch transitive vulnerabilities
2. **No direct DOMPurify usage** — Paisaxe code has zero imports of `dompurify`; PostHog uses it internally
3. **Nonce-based CSP** — Per-request nonce + `strict-dynamic` eliminates inline script XSS surface
4. **CSRF protection** — Double-submit cookie with timing-safe validation on all mutating requests
5. **Timing-safe everywhere** — All 7 security-critical comparison points use `timingSafeEqual`
6. **Input sanitization** — `sanitizeInput()` + `escapeHtml()` cover all user-facing input paths
7. **HTML escaping** — All `dangerouslySetInnerHTML` instances pre-escape content via `escapeHtml()` or `JSON.stringify()`

### Improvement Backlog

| Item | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Add gitleaks to CI workflow | Medium | Low | Prevents secret leaks in commits | Open (6th report) |
| Update @supabase/ssr to 0.9.0 | Low | Low | Auth library update | Open |
| Update pdfjs-dist to 5.5.207 | Low | Medium | PDF parsing update, may have fixes | Open |
| ~~Run `npm audit fix`~~ | — | — | — | **DONE** (resolved both advisories) |
| ~~Update minimatch override to `>=10.2.3`~~ | — | — | — | **DONE** |
| ~~Migrate CSP to nonce-based~~ | — | — | — | **DONE** (Feb 16) |
| ~~Distributed rate limiting~~ | — | — | — | **DONE** (Feb 16) |
| ~~CSRF protection~~ | — | — | — | **DONE** (Feb 16) |

---

*Report generated by Security Agent*
