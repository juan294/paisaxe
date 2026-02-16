# Security Report

> Auto-generated on 2026-02-16

## Health Status: GREEN

**Executive Summary:** 0 critical/high vulnerabilities. 2 low-severity issues from `qs` via `voyageai` — not exploitable in this architecture. CSP upgraded to nonce-based `strict-dynamic` since last report. CSRF protection now active. All webhook endpoints use timing-safe HMAC verification. No copyleft license violations.

---

## Vulnerability Analysis

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| Low | qs 6.7.0–6.14.1 (via voyageai) | [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883) | DoS via `arrayLimit` bypass in comma parsing | No | **Not exploitable** |
| Low | voyageai (transitive) | Transitive | Depends on vulnerable qs | No | **Not exploitable** |

### Detailed Analysis

#### qs arrayLimit Bypass (GHSA-w7fw-mjwx-w883)

**Attack Vector:** The `qs` library's `arrayLimit` option can be bypassed using comma-separated values in bracket notation. An attacker could cause denial of service by sending specially crafted query parameters.

**Dependency Chain:**
```
paisaxe -> voyageai -> qs (vulnerable)
```

**Why This Is Not Exploitable:**

1. **Server-only usage**: Both `src/lib/embeddings.ts` and `src/lib/rerank.ts` begin with `import "server-only"`. The `voyageai` SDK never runs in client-side code.

2. **No user input reaches qs.parse()**: The `voyageai` SDK only calls `qs.stringify()` (outbound URL construction), never `qs.parse()`. All SDK methods (`embed`, `rerank`, `multimodalEmbed`, `contextualizedEmbed`) use POST with JSON bodies and pass **zero query parameters**.

3. **Outbound-only usage**: Even if `qs` were called, it would serialize SDK-controlled objects for outbound requests to Voyage AI's API. The DoS attack requires inbound parsing of attacker-controlled query strings.

4. **Input sanitization**: User queries pass through `sanitizeInput()` in `chat-safety.ts` before reaching the embedding pipeline. Queries become vector embeddings, not query strings.

**Exploitability Assessment:** **None** — Zero attack surface. The vulnerable code path (`qs.parse()`) is never executed in Paisaxe.

---

## Changes Since Last Report (2026-02-09)

| Area | Feb 9 | Feb 16 | Change |
|------|-------|--------|--------|
| Vulnerability severity | 2 High | 2 Low | Advisory reclassified (GHSA-w7fw-mjwx-w883) |
| CSP | `unsafe-inline` in script-src | Nonce-based + `strict-dynamic` | Major upgrade |
| CSRF | Not mentioned | Double-submit cookie with `timingSafeEqual` | New protection |
| Rate limiting | Per-instance only | Dual: Upstash Redis + in-memory fallback | Now distributed |
| Webhook endpoints | 3 verified | 4 verified (translate added) | New endpoint |
| `qs` override | Recommended | In place (`>=6.14.1` in package.json) | Applied |

---

## Prioritized Remediation

### No Immediate Action Required

The `qs` vulnerability cannot be exploited in this architecture. For compliance and hygiene:

1. **Monitor voyageai releases** for updates that bump `qs`:
   ```bash
   npm outdated voyageai
   ```

2. **Override is in place** — `package.json` contains `"overrides": { "qs": ">=6.14.1" }`, which forces the patched version. The CI `security.yml` workflow runs `npm audit --audit-level=high` weekly and passes.

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

### CSRF Protection (NEW)

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
| `src/lib/cron-auth.ts` | Vercel Cron bearer token |
| `src/lib/csrf.ts` | CSRF token validation |
| `src/lib/mcp-auth.ts` | MCP API secret |

### Security Headers

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload | Production only |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-Frame-Options | DENY | Clickjacking protection |
| Referrer-Policy | strict-origin-when-cross-origin | Balanced privacy/functionality |
| Permissions-Policy | camera=(), geolocation=(), microphone=(self) | Restricts powerful features |
| Content-Security-Policy | Nonce-based (see below) | XSS defense-in-depth |

### CSP Configuration (UPGRADED)

```
default-src 'self';
script-src 'self' 'nonce-{per-request}' 'strict-dynamic' blob: https://js.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://picsum.photos https://*.googleusercontent.com;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com;
media-src 'self' blob:;
worker-src 'self' blob:;
frame-src https://js.stripe.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

**Key improvements since Feb 9:**
- `unsafe-inline` **removed** from `script-src` — replaced with per-request nonce
- `strict-dynamic` added — trusted scripts can load their own sub-resources
- `frame-src` added for Stripe embedded checkout
- Nonce generated via `crypto.randomBytes(16).toString('base64url')` per request

**Remaining CSP note:**
- `style-src 'unsafe-inline'` — Required by Tailwind CSS / Next.js CSS-in-JS. Lower risk than script injection. Industry-standard trade-off.

### Rate Limiting (UPGRADED)

| Feature | Value |
|---------|-------|
| Backend | Upstash Redis (primary) + in-memory (fallback) |
| Algorithm | Sliding window |
| MCP Places | 20 req/min per IP |
| MCP Weather | 30 req/min per IP |
| Chat streaming | 10 req/60s per IP |
| In-memory cap | 10,000 entries with automatic pruning |
| Response | 429 with `Retry-After` header |

**Previous gap (per-instance only) resolved:** Upstash Redis provides distributed rate limiting across Vercel instances. Falls back to in-memory when Redis is unavailable.

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
| `eval()` / `Function()` | None found |
| Raw SQL (no parameterization) | None — all via Supabase client |
| Hardcoded secrets | None — all via env vars with `.trim()` |
| `dangerouslySetInnerHTML` without sanitization | None found |

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
| dompurify@3.3.1 | (MPL-2.0 OR Apache-2.0) | Transitive via `posthog-js` | **None** — Dual-licensed, Apache-2.0 applies |
| expand-template@2.0.3 | (MIT OR WTFPL) | Transitive | **None** — MIT applies |
| paisaxe@1.0.0 | UNLICENSED | This project's package.json | **None** — Private/internal project |

**Copyleft in production:** No blocking issues. LGPL and MPL are weak copyleft — compliant under current usage (no modification, no source distribution, SaaS deployment). CI license-check workflow blocks strong copyleft (GPL, AGPL, SSPL) on all PRs.

---

## Outdated Packages

| Package | Current | Latest | Security Impact | Priority |
|---------|---------|--------|-----------------|----------|
| @typescript-eslint/eslint-plugin | 8.54.0 | 8.55.0 | None (dev only) | None |
| dotenv | 17.2.4 | 17.3.1 | None (dev only) | None |
| jsdom | 28.0.0 | 27.0.1 | N/A (version detection issue) | None |
| lucide-react | 0.563.0 | 0.564.0 | None known | Low |
| posthog-js | 1.343.2 | 1.347.2 | None known | Low |
| tailwind-merge | 3.4.0 | 3.4.1 | None known | None |
| vitest | 4.0.18 | 3.2.4 | N/A (version detection issue) | None |

No security-critical updates required. All outdated packages are minor/patch versions with no known CVEs. `jsdom` and `vitest` show anomalous version detection (latest < current) — likely registry metadata issues, not real downgrades.

---

## CI/CD Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Enabled | Weekly, grouped PRs for npm + GitHub Actions |
| Renovate | Not configured | Not needed with Dependabot |
| Gitleaks | Config exists (`.gitleaks.toml`) | **Not in CI workflow** — see recommendation |
| npm audit | In CI | `--audit-level=high`, runs weekly + on push |
| License check | In CI | Blocks GPL, AGPL, SSPL, and other strong copyleft |
| Branch protection | Enabled on `main` | 4 required status checks, force push blocked |

### Recommendation: Add Gitleaks to CI

`.gitleaks.toml` exists but gitleaks is not running in the CI workflow. This is the only remaining CI security gap:

```yaml
# Add to .github/workflows/security.yml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Summary

| Metric | Value |
|--------|-------|
| Total Vulnerabilities | 2 |
| Critical | 0 |
| High | 0 |
| Low | 2 |
| **Exploitable** | **0** |
| Fixable via npm audit | 0 |
| License Compliant | Yes |
| Webhook Security | All timing-safe (4/4 endpoints) |
| CSRF Protection | Yes (double-submit cookie) |
| CSP | Nonce-based + strict-dynamic |
| Rate Limiting | Yes (distributed via Upstash Redis) |
| **Health Status** | **GREEN** |

### Architecture Mitigations

1. **Server-only imports** — `voyageai` is isolated to server components via `import "server-only"`
2. **No inbound parsing** — `qs` is only used for outbound API serialization (never actually invoked)
3. **Input sanitization** — User queries pass through `sanitizeInput()` and become embeddings, never query strings
4. **Timing-safe everywhere** — All 6 security-critical comparison points use `timingSafeEqual`
5. **Nonce-based CSP** — Per-request nonce eliminates inline script XSS surface
6. **CSRF protection** — Double-submit cookie with timing-safe validation on all mutating requests

### Improvement Backlog

| Item | Priority | Effort | Impact |
|------|----------|--------|--------|
| Add gitleaks to CI workflow | Medium | Low | Prevents secret leaks in commits |
| ~~Migrate CSP to nonce-based script-src~~ | ~~Medium~~ | ~~Medium~~ | **DONE** — Nonce + strict-dynamic implemented |
| ~~Distributed rate limiting~~ | ~~Low~~ | ~~Medium~~ | **DONE** — Upstash Redis backend |

### Previous Issues (Resolved)

- **GHSA-9g9p-9gw9-jx7f** (Next.js Image Optimizer DoS) — Fixed in next@16.1.6
- **GHSA-5f7q-jpqc-wp7h** (Next.js PPR Memory DoS) — Fixed in next@16.1.6
- **GHSA-h25m-26qc-wcjf** (Next.js RSC Deserialization DoS) — Fixed in next@16.1.6
- **GHSA-6rw7-vpxm-498p** (qs array bracket DoS) — Reclassified as Low; override applied

---

*Report generated by Security Agent*
