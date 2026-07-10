# Security Report — 2026-07-10

## 1. Health Status: GREEN

0 advisories detected, 0 exploitable. Clean `npm audit` (production + dev tree). All license findings resolved (documented exception, false positive, or elected permissive branch). All five security headers verified in source. CI/CD security automation fully active. This continues the GREEN posture with no exploitable regressions. One GitHub Dependabot alert (#73, `@babel/core`, LOW) remains open on `main` only — not exploitable, already patched in the `develop` lockfile, self-resolves on the next production release (see section 3).

## 2. Executive Summary

- **Vulnerabilities: 0 advisories detected, 0 exploitable.** `npm audit` reports `found 0 vulnerabilities` across the full dependency tree. Nothing to triage, nothing to fix this cycle. This is a materially better position than the Apr 25 cycle (8 moderate, 0 exploitable) — the postcss and uuid chains open then are fully cleared.
- **Licenses: compliant.** No copyleft violation in production deps. The eight production-tree packages the scanner flagged reduce to: 3 false positives (declared MIT), 2 dual-licensed with a permissive branch elected, 2 documented weak-copyleft exceptions, and the project's own `UNLICENSED` root package (intentional — proprietary, not published). The dev+prod tree adds only `lightningcss` (MPL-2.0), a documented build-time exception.
- **Security headers: all present.** HSTS (prod-gated), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, and a per-request CSP with `frame-ancestors 'none'` / `object-src 'none'` — all confirmed in source.
- **CI/CD security: no gaps in code-actionable controls.** Dependabot, Gitleaks, and npm audit all active in CI. Renovate intentionally not used (Dependabot covers the role). GitHub Advanced Security (code + secret scanning) remains an owner cost decision, not an agent action.
- **Outdated deps: 17, all minor/patch (plus one dev-only major).** Zero carry a CVE. No security-driven upgrade is required this cycle; all are routine hygiene.

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------------------|---------------|---------|-----------------|
| Low | `@babel/core` (transitive) | GHSA-4x5r-pxfx-6jf8 (no CVE assigned) | Inefficient RegExp complexity in `@babel/helpers`-generated code — requires attacker-controlled malicious source passed through Babel at build time. Paisaxe compiles only its own source; Babel is not exposed to untrusted input at runtime. | Yes — already patched in `develop` lockfile (7.29.7 >= patched 7.29.6) | **Not exploitable.** GitHub-side alert only; open because Dependabot computes alerts from the default branch (`main`), whose lockfile predates the fix. Closes on next `develop -> main` release. No npm-audit finding. |

`npm audit` itself returns **0 vulnerabilities** across production and dev dependencies. The single row above is the GitHub Dependabot alert (#73), which is branch-computed against `main`, not a live tree finding — included for continuity and CVE cross-reference completeness. No other GHSA/CVE identifiers were surfaced this cycle.

## 4. Exploitability Analysis (High / Critical)

None. There are no high or critical advisories in the current dependency tree, so there is no exploitable attack surface introduced by dependencies this cycle. The one open item (`@babel/core`, LOW) is a build-time RegExp-complexity issue that requires attacker-controlled source through the compiler — not reachable in this project, and already patched on `develop`.

For continuity, the two chains that dominated recent cycles are both confirmed closed:

- **protobufjs (GHSA-xq3m-2v4x-88gg, Critical)** — resolved 2026-04-20 (transitive upgraded to >=7.5.5). Was never exploitable here: it served internal OpenTelemetry telemetry, not user-controlled input.
- **postcss / uuid chains (Apr 25, 8 moderate)** — no longer present in the tree. postcss is at 8.5.15 (a further 8.5.16 patch is available but not security-driven; see section 9).

Application-layer defenses remain the primary control surface and are unchanged and intact:
- **CSP `unsafe-inline` trade-off is compensated** (`src/lib/proxy/csp.ts:26-63`). Primary XSS defense is output sanitization in the markdown render sinks (`chat-markdown.tsx`, `safe-markdown.tsx` — no `dangerouslySetInnerHTML`, allowlisted safe-link renderers), backed by the `e2e/xss-canary.spec.ts` CI gate and the render-sink registry. `unsafe-inline` is a deliberate PPR-compatibility choice, not an oversight.
- **CSP hardening flags present**: `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` (`csp.ts:58-61`).

## 5. Prioritized Remediation Steps

1. **No security-critical action required.** Zero exploitable findings. Do not open CI/deploy cycles purely for security this week.
2. **Let alert #73 self-resolve.** `@babel/core` is already patched in the `develop` lockfile; the GitHub alert closes automatically on the next `develop -> main` production release. No code action.
3. **(Optional, hygiene) Batch the 17 outdated packages** into the next routine dependency batch — none is a security fix, so there is no urgency:
   ```bash
   npm update && npm audit && npm run test
   ```
   Note `typescript 6.0.3 -> 7.0.2` is a **major** (dev-only); hold it out of an automated `npm update` and land it deliberately with a typecheck pass.
4. **(Owner decision, not code-actionable) GitHub Advanced Security** — code scanning and secret scanning remain disabled on this private repo (GHAS add-on required). Gitleaks in CI covers the secret-scanning surface; this is a cost decision for the owner, not an agent fix.

## 6. License Compliance

Policy: permissive-only (MIT, Apache-2.0, BSD, ISC), with recorded exceptions in `docs/project/license-exceptions.md`. Copyleft-in-production check: **false** (no violations). Named breakdown of every flagged package:

### Production tree (scanner-flagged)

| Package | Declared License | Verdict |
|---------|------------------|---------|
| `@babel/template@7.29.7` | MIT | False positive — declared MIT, permissive. |
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Documented Exception 1 — pre-built native binary, dynamically linked via `sharp` (Apache-2.0), no modification, SaaS deploy. No copyleft obligation. |
| `@img/sharp-libvips-darwin-arm64@1.3.2` | LGPL-3.0-or-later | Same as above (platform variant, version bump). Covered by Exception 1. |
| `dompurify@3.4.11` | (MPL-2.0 OR Apache-2.0) | Dual-licensed — **Apache-2.0 branch elected**. Recorded under "Dual-licensed dependencies." Transitive of `posthog-js`; no app code calls DOMPurify directly. |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Dual-licensed — **MIT branch elected**. Build-time only (`canvas` -> `prebuild-install`). Recorded under "Dual-licensed dependencies." |
| `simple-concat@1.0.1` | MIT | False positive — declared MIT, permissive. |
| `simple-get@4.0.1` | MIT | False positive — declared MIT, permissive. |
| `paisaxe@1.6.0` | UNLICENSED | The project's own root package. `UNLICENSED` is intentional (proprietary, never published to npm). Not a third-party dependency; no action. |

### Dev + prod full tree (additional flags)

| Package | Declared License | Verdict |
|---------|------------------|---------|
| `lightningcss@1.32.0` | MPL-2.0 | Documented Exception 3 — file-level weak copyleft, devDependency, build-time only (Tailwind v4 / Vite), never bundled to clients. No obligation. |
| `lightningcss-darwin-arm64@1.32.0` | MPL-2.0 | Platform binary of the above. Covered by Exception 3. |

All other flagged entries repeat from the production list. No new copyleft dependency entered the tree this cycle. `@sentry/cli` (FSL-1.1-MIT, Exception 4, recorded 2026-07-08) did not surface in this cycle's MPL/LGPL/GPL/UNLICENSED filter — expected, as FSL is outside that filter — and remains documented.

**Conclusion: license-compliant.** Every flag maps to a false positive, an elected permissive branch, a documented exception, or the project's own private package.

## 7. Security Headers Status

All verified in source, matching the live header capture.

| Header | Value | Source | Status |
|--------|-------|--------|--------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | `src/lib/proxy/csp.ts` (per-request) | Present |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | `next.config.ts:65` (production-gated) | Present (prod) |
| X-Content-Type-Options | `nosniff` | `next.config.ts:67` | Present |
| X-Frame-Options | `DENY` | `next.config.ts:68` | Present |
| Referrer-Policy | `strict-origin-when-cross-origin` | `next.config.ts:69` | Present |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | `next.config.ts:70` | Present |

Notes:
- HSTS is intentionally emitted only in production (`NODE_ENV === "production"`, `next.config.ts:64-66`) to avoid pinning `http://localhost` during dev. The live capture shows it present, confirming the production path.
- CSP is deliberately set per-request in `proxy.ts` rather than in `next.config.ts` headers, because it is PPR-sensitive. The `unsafe-inline` in `script-src` is a documented, compensated trade-off (see section 4). No `'strict-dynamic'` and no nonce-only policy — consistent with the project's PPR/CSP guardrail.
- `microphone=(self)` is intentional — required for the ElevenLabs voice widget (Pelayo).

## 8. CI/CD Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Configured, pinned to `develop` (per prior cycles). Serves the dependency-update role. |
| Renovate | Not configured | Intentional — Dependabot covers this; not a gap. |
| Gitleaks (secret scan in CI) | Active | Covers the secret-scanning surface in lieu of GHAS secret scanning. |
| npm audit (in CI) | Active | 0 findings this cycle. |
| License check (`license-check.yml`) | Active | Blocks strong copyleft (GPL/AGPL/SSPL/EUPL/BSL/CPAL/OSL/CPOL) on prod deps; reports (non-blocking) on dev deps. |
| GitHub code scanning / secret scanning | Unavailable | Requires GHAS add-on on this private repo. Owner cost decision. Gitleaks compensates for secrets. Not code-actionable. |

No code-actionable CI/CD security gaps this cycle.

## 9. Outdated Packages (Security Implications)

17 outdated packages. **None carries a CVE; none is a security fix.** All are routine minor/patch bumps except one dev-only major. Security-relevant observations:

- **Production, patch/minor (no CVE, upgrade for hygiene):** `@supabase/supabase-js` 2.110.0 -> 2.110.2, `stripe` 22.3.0 -> 22.3.1, `@sentry/core` + `@sentry/nextjs` 10.63.0 -> 10.64.0, `posthog-js` 1.396.7 -> 1.399.1, `resend` 6.17.1 -> 6.17.2, `@elevenlabs/react` 1.9.0 -> 1.9.1, `lucide-react` 1.23.0 -> 1.24.0, `postcss` 8.5.15 -> 8.5.16, plus the Radix UI patches. `posthog-js` is the package that historically pulled in the protobufjs/dompurify advisories — it is currently clean at 1.396.7, so this is not an advisory-driven bump.
- **Dev/tooling (no security impact on shipped code):** `@types/node`, `@typescript-eslint/eslint-plugin` 8.62.1 -> 8.63.0, `@vitest/eslint-plugin`, `knip`.
- **Dev-only major — do NOT auto-update:** `typescript` 6.0.3 -> 7.0.2. Land deliberately with a full typecheck; keep it out of any batched `npm update`.

Recommendation: fold these into the next routine dependency batch. There is no security reason to run a dedicated CI/deploy cycle for them.

## Cross-References to Other Agents

- **Cost Analyst (Jul 10):** 0 advisories carry forward — confirmed, no cost-related security concerns. The 147-day revenue / 143-day voice drought has no security contribution.
- **Performance Agent (Jul 9):** Confirmed dep-batch pattern — posthog-js/supabase-js bumps land in deferred chunks only (single-digit KB). `core-js@3.48.0` is a known transitive of posthog-js if it ever surfaces in an advisory. No bundle-side security action.
- **QA Agent (Jul 10):** 3/3 LLM safety tests pass — no safety-guardrail signal lost. The `/api/health/db` empty-error probe failure is a QA-harness/env false negative (RAG tests pass, Supabase healthy), not a security issue.
- **Triage (Jul 10):** The `security-agent.sh` "stray 0" cosmetic bug was fixed — this cycle's `OUTDATED PACKAGES: 17` line is a single clean count, confirming the fix. `.security-metrics.tmp` is the script's working file (untracked in git status); it is gitignored scratch, not a leak.
