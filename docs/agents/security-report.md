# Security Report

> Auto-generated on 2026-02-02

## Health Status: 🟢 GREEN

**Executive Summary:** 2 high-severity vulnerabilities detected, both stemming from the same `qs` dependency via `voyageai`. These are **not exploitable** in the current server-only architecture and require no immediate action.

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
paisaxe → voyageai@0.1.0 → qs@<6.14.1
```

**Why This Is Not Exploitable:**

1. **Server-only usage**: Both `src/lib/embeddings.ts:1` and `src/lib/rerank.ts:1` begin with `import "server-only"`. The `voyageai` SDK never runs in client-side code.

2. **No user input reaches qs.parse()**: The vulnerable function is `qs.parse()` which parses incoming query strings. In this codebase:
   - `embeddings.ts` sends text to `voyageClient.embed()` and `voyageClient.contextualizedEmbed()`
   - `rerank.ts` sends query strings and document arrays to `voyageClient.rerank()`
   - User queries become embedding vectors, they're not serialized through `qs`

3. **Outbound-only usage**: The `voyageai` SDK uses `qs.stringify()` for outbound API requests to Voyage AI's servers. The DoS attack requires inbound parsing, not outbound stringification.

**Exploitability Assessment:** **None** — The attack requires a malicious client to send crafted query strings to an endpoint that parses them with `qs`. In Paisaxe, `qs` is only used for outbound HTTP requests to Voyage AI.

---

## Prioritized Remediation

### No Immediate Action Required

The `qs` vulnerability cannot be exploited in this architecture. However, for compliance and hygiene:

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

## License Compliance

| License | Count | Status |
|---------|-------|--------|
| MIT | 231 | ✅ Permissive |
| Apache-2.0 | 33 | ✅ Permissive |
| BSD-3-Clause | 16 | ✅ Permissive |
| ISC | 6 | ✅ Permissive |
| MIT* | 2 | ✅ Permissive |
| BSD-2-Clause | 2 | ✅ Permissive |
| (Apache-2.0 AND BSD-3-Clause) | 1 | ✅ Permissive |
| CC-BY-4.0 | 1 | ✅ Permissive (data) |
| 0BSD | 1 | ✅ Permissive |
| (MPL-2.0 OR Apache-2.0) | 1 | ✅ Dual-licensed, use Apache-2.0 |
| MPL-2.0 | 1 | ⚠️ Weak copyleft |
| LGPL-3.0-or-later | 1 | ⚠️ Weak copyleft |
| UNLICENSED | 1 | ⚠️ Review needed |

### License Notes

- **MPL-2.0 / LGPL-3.0-or-later**: Weak copyleft licenses require sharing modifications to *those specific files* only. They don't infect proprietary code unless you directly modify those packages. Acceptable for SaaS deployments.

- **UNLICENSED**: Likely a package with missing metadata or the project's own internal package. Should be investigated if it appears in the production bundle.

**Status:** ✅ No blocking license issues for production deployment.

---

## Outdated Packages

| Package | Current | Latest | Security Impact | Priority |
|---------|---------|--------|-----------------|----------|
| @anthropic-ai/sdk | 0.71.2 | 0.72.1 | None known | Low |
| @playwright/test | 1.58.0 | 1.58.1 | None (dev only) | None |
| @supabase/supabase-js | 2.91.1 | 2.93.3 | None known | Medium |
| @types/node | 25.0.10 | 25.2.0 | None (dev only) | None |
| @types/react | 19.2.9 | 19.2.10 | None (dev only) | None |
| framer-motion | 12.29.0 | 12.29.2 | None known | Low |
| pdfjs-dist | 5.4.530 | 5.4.624 | None known | Low |
| posthog-js | 1.335.5 | 1.336.4 | None known | Low |
| react | 19.2.3 | 19.2.4 | None known | Low |
| react-dom | 19.2.3 | 19.2.4 | None known | Low |
| vitest | 4.0.18 | 3.2.4 | N/A (version detection issue) | None |

### Recommended Updates

No security-critical updates required. For general hygiene:

```bash
# Production dependencies (optional, no security issues)
npm install @supabase/supabase-js@latest react@latest react-dom@latest

# Other optional updates
npm install @anthropic-ai/sdk@latest framer-motion@latest posthog-js@latest pdfjs-dist@latest
```

**Note:** The `vitest` "outdated" report shows 3.2.4 as "latest" but you're on 4.0.18 — this is a npm registry version detection issue, not a downgrade recommendation.

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
| **Health Status** | **GREEN** |

### Architecture Mitigations

The following architectural decisions protect against the detected vulnerabilities:

1. **Server-only imports** — `voyageai` is isolated to server components via `import "server-only"`
2. **No inbound parsing** — `qs` is only used for outbound API serialization
3. **Input sanitization** — User queries are converted to embeddings, never passed through `qs.parse()`

### Previous Issues (Resolved)

The following vulnerabilities were fixed in previous updates:

- **GHSA-9g9p-9gw9-jx7f** (Next.js Image Optimizer DoS) — Fixed in next@16.1.6
- **GHSA-5f7q-jpqc-wp7h** (Next.js PPR Memory DoS) — Fixed in next@16.1.6
- **GHSA-h25m-26qc-wcjf** (Next.js RSC Deserialization DoS) — Fixed in next@16.1.6

---

*Report generated by Security Agent*
