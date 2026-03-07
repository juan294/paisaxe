# Security Report

> Auto-generated on 2026-03-07

## Health Status: GREEN

**Executive Summary:** 2 advisories detected, 0 exploitable in production. One high-severity `minimatch` ReDoS — dev-only (eslint), not deployed. One moderate `dompurify` XSS — transitive via `posthog-js`, not directly used by application code. Both fixable via `npm audit fix`. CSP remains nonce-based with `strict-dynamic`. All 4 webhook endpoints timing-safe. No copyleft license violations. Gitleaks still not running in CI (open gap since Feb 9 — 5th consecutive report flagging this).

---

## Vulnerability Analysis

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | In Production | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|---------------|-----------------|
| High | minimatch 10.2.2 | [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | — | ReDoS via GLOBSTAR segments | Yes | **No** (dev-only) | **Not exploitable** |
| High | minimatch 10.2.2 | [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | — | ReDoS via nested extglobs | Yes | **No** (dev-only) | **Not exploitable** |
| Moderate | dompurify 3.3.1 | [GHSA-v2wj-7wpq-c8vv](https://github.com/advisories/GHSA-v2wj-7wpq-c8vv) | — | XSS via crafted HTML | Yes | **Yes** (transitive) | **Not exploitable** |

### Detailed Exploitability Analysis

#### minimatch ReDoS (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) — HIGH severity, NOT exploitable

**Dependency Chain:**
```
paisaxe -> eslint -> @eslint/config-array -> minimatch (vulnerable)
paisaxe -> eslint -> @eslint/eslintrc -> minimatch (vulnerable)
paisaxe -> eslint-plugin-react -> minimatch (vulnerable)
paisaxe -> @typescript-eslint/eslint-plugin -> ... -> minimatch (vulnerable)
```

**Why This Is Not Exploitable:**

1. **Dev-only dependency**: All consumers are ESLint and its plugins — development tooling only. `npm audit --omit=dev` does not flag this.
2. **Not in deployed application**: minimatch is never bundled into the Next.js build. It runs only during linting in local dev or CI.
3. **No user input**: ESLint processes file paths from the local filesystem against static config patterns. No user-supplied input ever reaches minimatch.
4. **Override insufficient**: Current `package.json` override `"minimatch": ">=10.2.1"` does not fix this (10.2.2 is still in the vulnerable range). Update override or run `npm audit fix`.

**Production impact: None.** This is a developer-tooling issue only. Worst case: ESLint hangs on a pathological glob pattern in developer's local environment.

#### dompurify XSS (GHSA-v2wj-7wpq-c8vv) — MODERATE severity, NOT exploitable

**Dependency Chain:**
```
paisaxe -> posthog-js -> dompurify (vulnerable)
```

**Why This Is Not Exploitable:**

1. **Not directly imported**: Zero imports of `dompurify` exist in `src/`. Paisaxe code never calls DOMPurify directly.
2. **Internal PostHog usage**: PostHog uses DOMPurify internally to sanitize DOM elements captured during session replay and autocapture. The vulnerable code path requires processing attacker-crafted HTML through DOMPurify's sanitize function.
3. **Limited attack surface**: An attacker would need to inject crafted HTML into the DOM *and* have PostHog capture that specific element *and* have DOMPurify process it in a way that triggers the bypass. PostHog captures metadata, not re-renders sanitized HTML to users.
4. **Admin-only context**: PostHog analytics data is only viewed in the PostHog dashboard (external service), not rendered in the Paisaxe application.

**Production impact: Negligible.** The XSS would only affect PostHog's internal processing of captured DOM elements, not Paisaxe's rendered output.

---

## Changes Since Last Report (2026-03-06)

| Area | Mar 6 | Mar 7 | Change |
|------|-------|-------|--------|
| Vulnerability count | 1 High + 1 Moderate | 1 High + 1 Moderate | Unchanged |
| Exploitable vulns | 0 | 0 | Unchanged |
| minimatch | 10.2.2 (dev-only) | 10.2.2 (dev-only) | Unchanged — override still at `>=10.2.1` |
| dompurify | 3.3.1 (via posthog-js) | 3.3.1 (via posthog-js) | Unchanged — posthog-js still at 1.353.0 |
| CSP | Nonce + strict-dynamic | Nonce + strict-dynamic | Unchanged |
| Gitleaks in CI | Not in workflow | Not in workflow | **Still open** — 5th consecutive report flagging this |

**No new vulnerabilities or regressions since yesterday's report.** The same two advisories remain, both non-exploitable.

---

## Prioritized Remediation

### Priority 1: Run `npm audit fix` (Low effort, resolves both advisories)

Both vulnerabilities have fixes available:

```bash
npm audit fix
```

This should update `dompurify` to a patched version (via posthog-js update) and `minimatch` to a patched version.

### Priority 2: Update minimatch override

The current override `"minimatch": ">=10.2.1"` in `package.json` does not protect against the advisory (10.2.2 is still vulnerable). Update to:

```json
"overrides": {
  "qs": ">=6.14.2",
  "minimatch": ">=10.2.3"
}
```

Or remove the minimatch override entirely after `npm audit fix` resolves it.

### Priority 3: Add Gitleaks to CI (5th consecutive report flagging this)

`.gitleaks.toml` exists but gitleaks is not running in CI. This has been flagged in every security report since Feb 9:

```yaml
# Add to .github/workflows/security.yml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

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
| `src/lib/cron-auth.ts` | Vercel Cron bearer token |
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
| dompurify@3.3.1 | (MPL-2.0 OR Apache-2.0) | Transitive via `posthog-js` | **None** — Dual-licensed, Apache-2.0 applies |
| expand-template@2.0.3 | (MIT OR WTFPL) | Transitive | **None** — MIT applies |
| paisaxe@1.0.0 | UNLICENSED | This project's package.json | **None** — Private/internal project |

**Copyleft in production:** No blocking issues. LGPL and MPL are weak copyleft — compliant under current usage (no modification, no source distribution, SaaS deployment). CI license-check workflow blocks strong copyleft (GPL, AGPL, SSPL) on all PRs.

---

## Outdated Packages with Security Implications

| Package | Current | Latest | Dep Type | Security Impact | Priority |
|---------|---------|--------|----------|-----------------|----------|
| @stripe/react-stripe-js | 5.6.0 | 5.6.1 | prod | None known | Low |
| @stripe/stripe-js | 8.8.0 | 8.9.0 | prod | None known | Low |
| @supabase/ssr | 0.8.0 | 0.9.0 | prod | Minor — auth library | Medium |
| @supabase/supabase-js | 2.97.0 | 2.98.0 | prod | Minor — database client | Medium |
| @types/node | 25.3.0 | 25.3.5 | dev | None (types only) | None |
| @upstash/ratelimit | 2.0.8 | 2.0.8 | prod | Up to date (version format) | None |
| @upstash/redis | 1.36.2 | 1.36.3 | prod | None known | Low |
| eslint | 9.39.3 | 9.39.4 | dev | Build tool — low risk | Low |
| lucide-react | 0.575.0 | 0.577.0 | prod | None known | None |
| pdfjs-dist | 5.4.624 | 5.5.207 | prod | PDF parsing — monitor | Medium |
| postcss | 8.5.6 | 8.5.8 | dev | Build tool — low risk | Low |
| posthog-js | 1.353.0 | 1.359.1 | prod | **May fix dompurify vuln** | **High** |
| resend | 6.9.2 | 6.9.3 | prod | None known | Low |
| stripe | 20.3.1 | 20.4.1 | prod | Payments — monitor | Medium |
| voyageai | 0.1.0 | 0.2.1 | prod | None known (qs already fixed) | Low |

**Key update:** `posthog-js` 1.353.0 -> 1.359.1 may bundle a patched `dompurify` — updating PostHog is the recommended path to resolve GHSA-v2wj-7wpq-c8vv.

---

## CI/CD Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Enabled | Weekly, grouped PRs for npm + GitHub Actions |
| Renovate | Not configured | Not needed with Dependabot |
| Gitleaks | Config exists (`.gitleaks.toml`) | **Not in CI workflow** — 5th consecutive report flagging this |
| npm audit | In CI | `--omit=dev --audit-level=high`, runs on push + weekly |
| License check | In CI | Blocks GPL, AGPL, SSPL, and other strong copyleft |
| Branch protection | Enabled on `main` | 4 required status checks, force push blocked |
| Claude Code Review | In CI | Runs on PRs, uses `claude-sonnet-4-5-20250929` |

### CI npm audit configuration note

The security workflow (`security.yml`) runs `npm audit --omit=dev --audit-level=high`. This is correct — it only flags production dependencies at high severity. The minimatch ReDoS (dev-only) won't block CI. The dompurify moderate won't block CI either (below high threshold). Both are tracked here for visibility but neither is a CI-blocking issue.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Advisories | 2 (3 advisory IDs across 2 packages) |
| Critical | 0 |
| High | 1 (dev-only) |
| Moderate | 1 (transitive, not directly used) |
| Low | 0 |
| **Exploitable** | **0** |
| Fixable via npm audit | 2 |
| License Compliant | Yes |
| Webhook Security | All timing-safe (4/4 endpoints) |
| CSRF Protection | Yes (double-submit cookie) |
| CSP | Nonce-based + strict-dynamic |
| Rate Limiting | Yes (distributed via Upstash Redis) |
| **Health Status** | **GREEN** |

### Architecture Mitigations

1. **Dev-only isolation** — minimatch is only in eslint/TypeScript tooling, never bundled for production
2. **No direct DOMPurify usage** — Paisaxe code has zero imports of `dompurify`; PostHog uses it internally
3. **Nonce-based CSP** — Per-request nonce + `strict-dynamic` eliminates inline script XSS surface
4. **CSRF protection** — Double-submit cookie with timing-safe validation on all mutating requests
5. **Timing-safe everywhere** — All 6 security-critical comparison points use `timingSafeEqual`
6. **Input sanitization** — `sanitizeInput()` + `escapeHtml()` cover all user-facing input paths
7. **HTML escaping** — All `dangerouslySetInnerHTML` instances pre-escape content via `escapeHtml()` or `JSON.stringify()`

### Improvement Backlog

| Item | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Run `npm audit fix` | High | Low | Resolves both current advisories | Open |
| Update minimatch override to `>=10.2.3` | Medium | Low | Ensures override matches patched version | Open |
| Add gitleaks to CI workflow | Medium | Low | Prevents secret leaks in commits | Open (5th report) |
| Update posthog-js to latest | Medium | Low | Likely resolves dompurify vuln | Open |
| ~~Migrate CSP to nonce-based~~ | — | — | — | **DONE** (Feb 16) |
| ~~Distributed rate limiting~~ | — | — | — | **DONE** (Feb 16) |
| ~~CSRF protection~~ | — | — | — | **DONE** (Feb 16) |

### Previous Issues (Resolved)

- **GHSA-w7fw-mjwx-w883** (qs arrayLimit bypass) — Fixed via override `qs >= 6.14.2`
- **GHSA-9g9p-9gw9-jx7f** (Next.js Image Optimizer DoS) — Fixed in next@16.1.6
- **GHSA-5f7q-jpqc-wp7h** (Next.js PPR Memory DoS) — Fixed in next@16.1.6
- **GHSA-h25m-26qc-wcjf** (Next.js RSC Deserialization DoS) — Fixed in next@16.1.6

---

*Report generated by Security Agent*
