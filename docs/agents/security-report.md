# Security Report

> Auto-generated on 2026-02-01

## Health Status: 🟢 GREEN

**Executive Summary:** 2 high-severity vulnerabilities detected, both stemming from the same `qs` dependency via `voyageai`. These are **not exploitable** in the current server-only architecture and require no immediate action.

---

## Vulnerability Analysis

| Severity | Package | Advisory | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|---------------|---------|-----------------|
| High | qs@6.11.2 (via voyageai) | [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p) | Memory DoS via array bracket parsing | No | **Not exploitable** |
| High | voyageai@0.1.0 | Transitive | Depends on vulnerable qs | No | **Not exploitable** |

### Detailed Analysis

#### qs Array Bracket Memory DoS (GHSA-6rw7-vpxm-498p)

**Attack Vector:** The `qs` library can be DoS'd via deeply nested bracket notation in query strings (e.g., `a[0][1][2]...[999]=x`). An attacker can exhaust server memory by sending specially crafted query parameters.

**Dependency Chain:**
```
paisaxe → voyageai@0.1.0 → qs@6.11.2
```

**Why This Is Not Exploitable:**

1. **Server-only usage**: The `voyageai` SDK is imported in `src/lib/embeddings.ts` which has `import "server-only"` at the top. It never runs in client-side code.

2. **No user input reaches qs**: The `voyageai` SDK uses `qs` internally for serializing API requests to Voyage AI's servers. Your code sends embeddings data to Voyage AI — user input (search queries) is converted to embedding vectors, not passed through `qs.parse()`.

3. **Outbound-only usage**: The vulnerable function is `qs.parse()` which parses incoming query strings. The SDK uses `qs.stringify()` for outbound requests, which is not affected.

**Exploitability Assessment:** **None** — The attack requires sending malicious query strings to a server endpoint that parses them with `qs`. In this codebase, `qs` is only used for outbound API calls to Voyage AI.

---

## Prioritized Remediation

### No Immediate Action Required

The `qs` vulnerability is **not exploitable** in the current architecture. However:

1. **Monitor voyageai releases** for updates that bump `qs`:
   ```bash
   npm outdated voyageai
   ```

2. **Consider filing an issue** with the [voyageai-node](https://github.com/voyage-ai/voyageai-node) repository requesting they update `qs` to >=6.14.1.

### Optional: Override qs Version

If organizational policy requires zero high-severity vulnerabilities regardless of exploitability, you can add an npm override:

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

**Caution:** This may break `voyageai` if it depends on qs v6.11.x behavior. Test thoroughly.

---

## License Compliance

| License | Count | Status |
|---------|-------|--------|
| MIT | 231 | Permissive |
| Apache-2.0 | 33 | Permissive |
| BSD-3-Clause | 16 | Permissive |
| ISC | 6 | Permissive |
| MIT* | 2 | Permissive |
| BSD-2-Clause | 2 | Permissive |
| (Apache-2.0 AND BSD-3-Clause) | 1 | Permissive |
| CC-BY-4.0 | 1 | Permissive (data) |
| 0BSD | 1 | Permissive |
| (MPL-2.0 OR Apache-2.0) | 1 | Dual-licensed, use Apache-2.0 |
| MPL-2.0 | 1 | Weak copyleft |
| LGPL-3.0-or-later | 1 | Weak copyleft |
| UNLICENSED | 1 | Review needed |

### License Notes

- **MPL-2.0 / LGPL-3.0-or-later**: Weak copyleft licenses require sharing modifications to *those specific files* only. They don't infect your proprietary code unless you directly modify those packages. Acceptable for most deployments.

- **UNLICENSED**: Likely a package with missing metadata or a private package. Should be investigated if appearing in production bundle.

**Status:** No blocking license issues for production deployment.

---

## Outdated Packages

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| @anthropic-ai/sdk | 0.71.2 | 0.72.1 | Low |
| @playwright/test | 1.58.0 | 1.58.1 | None (dev) |
| @supabase/supabase-js | 2.91.1 | 2.93.3 | Medium |
| @types/node | 25.0.10 | 25.1.0 | None (dev) |
| @types/react | 19.2.9 | 19.2.10 | None (dev) |
| framer-motion | 12.29.0 | 12.29.2 | Low |
| posthog-js | 1.335.5 | 1.336.4 | Low |
| react | 19.2.3 | 19.2.4 | Low |
| react-dom | 19.2.3 | 19.2.4 | Low |
| vitest | 4.0.18 | 3.2.4 | None (dev, version mismatch) |

### Recommended Updates

```bash
# Production dependencies (no security issues, but good hygiene)
npm install @supabase/supabase-js@latest react@latest react-dom@latest

# Optional
npm install @anthropic-ai/sdk@latest framer-motion@latest posthog-js@latest
```

Note: The `vitest` "outdated" report shows 3.2.4 as "latest" but you're on 4.0.18 — this is a version detection issue, not a downgrade recommendation.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Vulnerabilities | 2 |
| Critical | 0 |
| High | 2 |
| Exploitable | 0 |
| Fixable via npm audit | 0 |
| License Compliant | Yes |
| Health Status | GREEN |

### Previous Issues (Resolved)

The following vulnerabilities were fixed in a previous update:

- **GHSA-9g9p-9gw9-jx7f** (Next.js Image Optimizer DoS) — Fixed in next@16.1.6
- **GHSA-5f7q-jpqc-wp7h** (Next.js PPR Memory DoS) — Fixed in next@16.1.6
- **GHSA-h25m-26qc-wcjf** (Next.js RSC Deserialization DoS) — Fixed in next@16.1.6

---

*Report generated by Security Agent*
