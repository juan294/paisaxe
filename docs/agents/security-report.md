# Security Report

> Auto-generated on 2026-02-01

## Health Status: 🟡 YELLOW

**Executive Summary:** 3 high-severity vulnerabilities detected. The Next.js vulnerabilities are fixable via update to 16.1.6. The `qs` vulnerability in `voyageai` has no fix available but is **low risk** in this codebase's server-only usage pattern.

---

## Vulnerability Analysis

| Severity | Package | CVE/Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|--------------|---------------|---------|-----------------|
| High | next@16.1.4 | [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) | DoS via Image Optimizer | ✅ Yes | **Medium** - remotePatterns uses wildcards |
| High | next@16.1.4 | [GHSA-5f7q-jpqc-wp7h](https://github.com/advisories/GHSA-5f7q-jpqc-wp7h) | Memory DoS via PPR Resume | ✅ Yes | **Low** - PPR not enabled |
| High | next@16.1.4 | [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) | DoS via RSC deserialization | ✅ Yes | **Medium** - uses RSC |
| High | qs@6.11.2 (via voyageai) | [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p) | Memory DoS via array bracket parsing | ❌ No | **Low** - server-only, no user input to qs |

### Detailed Analysis

#### 1. Next.js Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f)

**Attack Vector:** Self-hosted Next.js apps with `remotePatterns` using wildcards can be attacked via crafted image URLs causing resource exhaustion.

**Your Config (`next.config.ts:47-60`):**
```ts
remotePatterns: [
  { protocol: "https", hostname: "*.supabase.co" },  // Wildcard
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "picsum.photos" },
]
```

**Risk:** The `*.supabase.co` wildcard could be exploited, but the attack requires:
1. Self-hosted deployment (Vercel handles this)
2. Attacker-controlled subdomain matching the pattern

**Mitigation:** Update to Next.js 16.1.6 and consider tightening the wildcard pattern.

#### 2. Next.js PPR Memory DoS (GHSA-5f7q-jpqc-wp7h)

**Attack Vector:** Unbounded memory consumption via the PPR (Partial Prerendering) resume endpoint.

**Your Config:** PPR is **not enabled** (no `experimental.ppr` in next.config.ts).

**Risk:** **Not exploitable** in current configuration.

#### 3. Next.js RSC Deserialization DoS (GHSA-h25m-26qc-wcjf)

**Attack Vector:** Malicious clients can send crafted RSC payloads causing server-side DoS.

**Risk:** Your app uses React Server Components. This is exploitable but requires:
- Direct manipulation of RSC wire format
- Knowledge of internal RSC protocol

**Mitigation:** Update to Next.js 16.1.6.

#### 4. qs Array Bracket Memory DoS (GHSA-6rw7-vpxm-498p)

**Attack Vector:** The `qs` library can be DoS'd via deeply nested bracket notation in query strings.

**Dependency Chain:**
```
paisaxe → voyageai@0.1.0 → qs@6.11.2
```

**Your Usage (`src/lib/embeddings.ts`):**
- `voyageai` is used **server-side only** (`import "server-only"`)
- Used for embedding API calls, **not** for parsing user-provided query strings
- User input never reaches `qs` through your code paths

**Risk:** **Not exploitable** - the vulnerable code path is not exposed to attacker-controlled input.

**Mitigation:** None required. Monitor for voyageai update. Consider filing an issue with voyageai maintainers.

---

## Prioritized Remediation

### Immediate Actions

```bash
# 1. Update Next.js to fix all three Next.js vulnerabilities
npm install next@16.1.6

# 2. Verify the fix
npm audit
```

### Recommended Actions

1. **Tighten Image Optimizer wildcards** - Change `*.supabase.co` to your specific project hostname:
   ```ts
   { protocol: "https", hostname: "your-project.supabase.co" }
   ```

2. **Monitor voyageai** - Watch for updates that bump `qs` to >=6.14.1
   ```bash
   # Check for updates periodically
   npm outdated voyageai
   ```

### No Action Required

- PPR vulnerability - feature not in use
- qs vulnerability - not exploitable in current architecture

---

## License Compliance

| License | Count | Status |
|---------|-------|--------|
| MIT | 231 | ✅ Permissive |
| Apache-2.0 | 33 | ✅ Permissive |
| BSD-3-Clause | 16 | ✅ Permissive |
| ISC | 6 | ✅ Permissive |
| BSD-2-Clause | 2 | ✅ Permissive |
| 0BSD | 1 | ✅ Permissive |
| CC-BY-4.0 | 1 | ✅ Permissive (data only) |
| MPL-2.0 | 1 | ⚠️ Weak copyleft |
| LGPL-3.0-or-later | 1 | ⚠️ Weak copyleft |
| UNLICENSED | 1 | ⚠️ Review needed |
| (MPL-2.0 OR Apache-2.0) | 1 | ✅ Choose Apache-2.0 |

### License Notes

- **MPL-2.0 / LGPL-3.0-or-later**: Weak copyleft licenses. These require sharing modifications to *those specific files* but don't affect your proprietary code. Acceptable in most cases unless you're modifying those packages directly.

- **UNLICENSED**: This package needs investigation. It may be a private package or missing license metadata.

**Status:** ✅ No blocking license issues for production deployment.

---

## Outdated Packages with Security Implications

| Package | Current | Latest | Security Relevance |
|---------|---------|--------|-------------------|
| **next** | 16.1.4 | 16.1.6 | 🔴 **Critical** - fixes 3 high vulns |
| @anthropic-ai/sdk | 0.71.2 | 0.72.1 | Low - API client |
| @supabase/supabase-js | 2.91.1 | 2.93.3 | Medium - auth/db client |
| react / react-dom | 19.2.3 | 19.2.4 | Medium - framework |
| @playwright/test | 1.58.0 | 1.58.1 | None - dev only |
| @types/* | various | various | None - dev only |
| vitest | 4.0.18 | 3.2.4 | None - dev only (note: "latest" shows older major) |

### Recommended Updates

```bash
# Security-critical update
npm install next@16.1.6

# Recommended (production dependencies)
npm install @supabase/supabase-js@latest react@latest react-dom@latest

# Optional (dev dependencies, no security impact)
npm install -D @playwright/test@latest @types/node@latest @types/react@latest
```

---

## Summary

| Metric | Value |
|--------|-------|
| Total Vulnerabilities | 3 |
| Critical | 0 |
| High | 3 |
| Fixable | 1 (Next.js, fixes 3 advisories) |
| Unfixable (Low Risk) | 1 (qs via voyageai) |
| License Compliant | ✅ Yes |
| Recommended Action | Update Next.js to 16.1.6 |

---

*Report generated by Security Agent*
