# Security Report

> Auto-generated on 2026-02-09

## Health Status: GREEN

**Executive Summary:** 2 high-severity vulnerabilities detected, both from `qs` via `voyageai`. These are **not exploitable** in the current server-only architecture — `qs.parse()` is never called on user input. No critical vulnerabilities, no copyleft license violations, and all webhook endpoints use timing-safe HMAC verification.

---

## Vulnerability Analysis

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| High | qs <6.14.1 (via voyageai) | [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p) | Memory DoS via array bracket parsing | No | **Not exploitable** |
| High | voyageai@0.1.0 | Transitive | Depends on vulnerable qs | No | **Not exploitable** |

### Detailed Analysis

#### qs Array Bracket Memory DoS (GHSA-6rw7-vpxm-498p)

**Attack Vector:** The `qs` library's `arrayLimit` option can be bypassed using bracket notation (e.g., `a[0][1][2]...[999]=x`). An attacker could exhaust server memory by sending specially crafted query parameters with deeply nested arrays.

**Dependency Chain:**
```
paisaxe -> voyageai@0.1.0 -> qs@6.11.2 (vulnerable: <6.14.1)
```

**Why This Is Not Exploitable:**

1. **Server-only usage**: Both `src/lib/embeddings.ts` and `src/lib/rerank.ts` begin with `import "server-only"`. The `voyageai` SDK never runs in client-side code.

2. **No user input reaches qs.parse()**: The `voyageai` SDK only calls `qs.stringify()` (outbound URL construction), never `qs.parse()`. Furthermore, all 4 SDK methods (`embed`, `rerank`, `multimodalEmbed`, `contextualizedEmbed`) use POST with JSON bodies and pass **zero query parameters** — so `qs.stringify()` is never actually invoked.

3. **Outbound-only usage**: Even if `qs` were called, it would serialize SDK-controlled objects for outbound requests to Voyage AI's API. The DoS attack requires inbound parsing of attacker-controlled query strings.

4. **Input sanitization**: User queries pass through `sanitizeInput()` in `chat-safety.ts` before reaching the embedding pipeline. Queries become vector embeddings, not query strings.

**Exploitability Assessment:** **None** — Zero attack surface. The vulnerable code path (`qs.parse()`) is never executed in Paisaxe.

---

## Prioritized Remediation

### No Immediate Action Required

The `qs` vulnerability cannot be exploited in this architecture. For compliance and hygiene:

1. **Monitor voyageai releases** for updates that bump `qs`:
   ```bash
   npm outdated voyageai
   ```

2. **Consider filing an issue** with the [voyageai-node](https://github.com/voyage-ai/voyageai-node) repository requesting they update `qs` to >=6.14.1.

### Optional: Override qs Version (For Compliance Only)

If organizational policy mandates zero high-severity vulnerabilities regardless of exploitability:

```json
// package.json
{
  "overrides": {
    "voyageai": {
      "qs": "6.14.1"
    }
  }
}
```

**Caution:** Test thoroughly after applying — this may break `voyageai` if it relies on `qs` v6.11.x behavior.

---

## Security Posture

### Webhook Signature Verification

All external webhook endpoints use proper cryptographic verification:

| Endpoint | Method | Timing-Safe | Replay Protection |
|----------|--------|-------------|-------------------|
| `/api/webhooks/supabase` | Shared secret + `timingSafeEqual` | Yes | N/A |
| `/api/webhooks/elevenlabs` | HMAC-SHA256 + `timingSafeEqual` | Yes | Yes (30-min window) |
| `/api/webhooks/stripe` | Stripe SDK `constructEvent()` | Yes (SDK) | Yes (SDK) |

**Status:** All webhook endpoints verified as timing-safe. Documentation Agent's recommendation to verify HMAC implementations has been addressed — all three are compliant.

### Security Headers

| Header | Value | Status |
|--------|-------|--------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload | Production only |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-Frame-Options | DENY | Clickjacking protection |
| Referrer-Policy | strict-origin-when-cross-origin | Balanced privacy/functionality |
| Permissions-Policy | camera=(), geolocation=(), microphone=(self) | Restricts powerful features |
| Content-Security-Policy | See below | XSS defense-in-depth |

### CSP Configuration

```
default-src 'self';
script-src 'self' 'unsafe-inline' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://picsum.photos https://*.googleusercontent.com;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com;
media-src 'self' blob:;
worker-src 'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

**Improvements since last report:**
- `unsafe-eval` removed from `script-src` (was present Feb 2, now gone)
- `worker-src 'self' blob:` added (explicit worker policy)
- `connect-src` expanded for Vercel analytics (`vitals.vercel-insights.com`, `va.vercel-scripts.com`)
- `img-src` expanded for Google OAuth avatars (`*.googleusercontent.com`)

**Remaining CSP gaps:**
- `script-src 'unsafe-inline'` — Allows inline scripts, weakens XSS protection. A TODO exists in `next.config.ts` for nonce-based migration.
- `style-src 'unsafe-inline'` — Required by Tailwind CSS. Lower risk than script injection.

### Rate Limiting

- In-memory sliding window rate limiter in `src/lib/rate-limit.ts`
- Default: 10 requests per 60 seconds per IP
- Memory-bounded: max 10,000 entries with automatic pruning
- Applied to chat streaming endpoints
- **Gap:** Per-instance only. No distributed rate limiting across Vercel Edge functions.

---

## License Compliance

| License | Count | Status |
|---------|-------|--------|
| MIT | 230 | Permissive |
| Apache-2.0 | 30 | Permissive |
| BSD-3-Clause | 16 | Permissive |
| ISC | 6 | Permissive |
| MIT* | 2 | Permissive |
| BSD-2-Clause | 1 | Permissive |
| (Apache-2.0 AND BSD-3-Clause) | 1 | Permissive |
| CC-BY-4.0 | 1 | Permissive (data) |
| 0BSD | 1 | Permissive |
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
| paisaxe@1.0.0 | UNLICENSED | This project's package.json | **None** — Private/internal project |

**Copyleft in production:** No blocking issues. LGPL and MPL are weak copyleft — compliant under current usage (no modification, no source distribution, SaaS deployment).

---

## Outdated Packages

| Package | Current | Latest | Security Impact | Priority |
|---------|---------|--------|-----------------|----------|
| @anthropic-ai/sdk | 0.73.0 | 0.74.0 | None known | Low |
| @playwright/test | 1.58.0 | 1.58.2 | None (dev only) | None |
| @types/node | 25.2.0 | 25.2.2 | None (dev only) | None |
| @types/react | 19.2.9 | 19.2.13 | None (dev only) | None |
| @vitejs/plugin-react | 5.1.2 | 5.1.3 | None (dev only) | None |
| knip | 5.82.1 | 5.83.1 | None (dev only) | None |
| react | 19.2.3 | 19.2.4 | None known | Low |
| react-dom | 19.2.3 | 19.2.4 | None known | Low |
| stripe | 20.3.0 | 20.3.1 | None known | Low |
| vitest | 4.0.18 | 3.2.4 | N/A (registry version detection issue) | None |

No security-critical updates required. All outdated packages are minor/patch versions with no known CVEs.

---

## CI/CD Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Enabled | Auto-creates PRs for vulnerable deps |
| Renovate | Not configured | Not needed with Dependabot |
| Gitleaks | Config exists (`.gitleaks.toml`) | **Not in CI workflow** — see recommendation |
| npm audit | In CI | Blocks builds with critical vulns |
| License check | In CI | Blocks copyleft licenses (GPL, AGPL, SSPL) |
| Branch protection | Enabled on `main` | 4 required status checks |

### Recommendation: Add Gitleaks to CI

A `.gitleaks.toml` config exists but gitleaks is not running in `.github/workflows/security.yml`. The security metrics report `Gitleaks in CI: false`. Add it:

```yaml
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
| High | 2 |
| **Exploitable** | **0** |
| Fixable via npm audit | 0 |
| License Compliant | Yes |
| Webhook Security | All timing-safe |
| CSP | Good (unsafe-inline pending nonce migration) |
| Rate Limiting | Yes (per-instance) |
| **Health Status** | **GREEN** |

### Architecture Mitigations

The following architectural decisions protect against the detected vulnerabilities:

1. **Server-only imports** — `voyageai` is isolated to server components via `import "server-only"`
2. **No inbound parsing** — `qs` is only used for outbound API serialization (and never actually invoked)
3. **Input sanitization** — User queries pass through `sanitizeInput()` and become embeddings, never query strings
4. **Timing-safe webhooks** — All 3 webhook endpoints use `timingSafeEqual` or SDK-equivalent

### Improvement Backlog

| Item | Priority | Effort | Impact |
|------|----------|--------|--------|
| Add gitleaks to CI workflow | Medium | Low | Prevents secret leaks in commits |
| Migrate CSP to nonce-based `script-src` | Medium | Medium | Eliminates `unsafe-inline` XSS surface |
| Distributed rate limiting | Low | Medium | Cross-instance protection at scale |

### Previous Issues (Resolved)

- **GHSA-9g9p-9gw9-jx7f** (Next.js Image Optimizer DoS) — Fixed in next@16.1.6
- **GHSA-5f7q-jpqc-wp7h** (Next.js PPR Memory DoS) — Fixed in next@16.1.6
- **GHSA-h25m-26qc-wcjf** (Next.js RSC Deserialization DoS) — Fixed in next@16.1.6

---

*Report generated by Security Agent*
