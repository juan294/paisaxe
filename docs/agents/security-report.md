# Security Report — Paisaxe

Date: 2026-06-16
Agent: Security Agent
Package version: paisaxe@1.5.1

## 1. Health Status: YELLOW

9 advisories detected, 0 exploitable in this codebase.

Rationale: Every flagged advisory is either a development-only dependency, a build-time-only path, or a transitive runtime dependency whose vulnerable code path is never reached with attacker-controlled input. No advisory is exploitable against the live site. However, consistent with this agent's convention (GREEN is reserved for a fully clean `npm audit`), the presence of 9 open advisories — including one production-tree HIGH (`form-data`) — keeps the status at YELLOW until `npm audit fix` is run. This ends the GREEN streak that held since Apr 20.

All 9 advisories are fixable with a single `npm audit fix` (no breaking major bumps required).

## 2. Executive Summary

- 9 advisories detected (3 high, 5 moderate, 1 low). 0 exploitable.
- All 9 are fixable via `npm audit fix` — no manual intervention, no major version bumps.
- 6 of 9 advisories are in dev-only / build-only dependency trees (vite, ws, @babel/core, js-yaml) — they never ship to production or run against user traffic.
- 1 production-runtime advisory: `@opentelemetry/core` (moderate, via Sentry) — unbounded memory in W3C Baggage propagation. Not exploitable: Sentry's tracing does not extract attacker-controlled `baggage` headers into unbounded allocation on our request path, and request body/header size is bounded by Vercel's platform limits.
- 1 production-tree HIGH: `form-data` (via `voyageai`) — CRLF injection via multipart field names. Not exploitable: the Voyage SDK uses fixed, SDK-controlled field names; no user input flows into multipart field names or filenames. Worth fixing regardless because it is the only HIGH in the production tree.
- 1 transitive runtime advisory: `dompurify` (moderate, via `posthog-js`) — IN_PLACE sanitization bypass. Not exploitable: `grep` confirms zero direct DOMPurify calls in `src/`; the in-house `basic-markdown.tsx` renderer replaced react-markdown (Jun 12) and does not use DOMPurify. PostHog uses it internally with no attacker-controlled DOM object path.
- License compliance: Pass. No strong copyleft (GPL/AGPL/SSPL). The two weak-copyleft / dual-license packages are documented or self-resolving.
- Security headers: All present and correctly configured (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- CI/CD security automation: Dependabot, Gitleaks, and npm audit all active. Renovate not used (Dependabot covers the same role).

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA / CVE) | Tree | Attack Vector | Fixable | Risk Assessment |
|----------|---------|------------------------|------|---------------|---------|-----------------|
| High | form-data 4.0.5 | GHSA-hmw2-7cc7-3qxx / CVE-2026-12143 | Production (voyageai 0.1.0) | CRLF injection via unescaped multipart field names/filenames | Yes -> 4.0.6 | NOT exploitable — Voyage SDK uses fixed field names; no user input reaches field names/filenames. Only HIGH in prod tree; fix anyway. |
| High | vite 8.0.8 | GHSA-fx2h-pf6j-xcff / CVE-2026-53571 | Dev only (vitest, @vitejs/plugin-react) | `server.fs.deny` bypass on Windows alternate paths | Yes -> 8.0.16 | NOT exploitable — Windows-only; dev server never runs in prod; CI/dev are macOS/Linux. |
| High | vite 8.0.8 | GHSA-v6wh-96g9-6wx3 (launch-editor) | Dev only | NTLMv2 hash disclosure via UNC path on Windows | Yes -> 8.0.16 | NOT exploitable — Windows-only, dev-only. |
| High | ws 7.5.10 | GHSA-96hv-2xvq-fx4p / CVE-2026-48779 | Dev only (@next/bundle-analyzer -> webpack-bundle-analyzer) | Memory-exhaustion DoS from tiny fragments | Yes -> 7.5.11 | NOT exploitable — ws server only runs locally during `npm run build:analyze`; never internet-exposed. |
| Moderate | @opentelemetry/core 2.7.1 | GHSA-8988-4f7v-96qf / CVE-2026-54285 | Production (Sentry) | Unbounded memory in W3C Baggage propagation | Yes -> 2.8.0 | NOT exploitable — Sentry tracing does not extract attacker-controlled inbound `baggage` into unbounded allocation on our paths; platform request limits bound input. |
| Moderate | @opentelemetry/resources 2.7.1 | (depends on @opentelemetry/core) | Production (Sentry) | Transitive of the above | Yes | NOT exploitable — same as core. |
| Moderate | @opentelemetry/sdk-trace-base 2.7.1 | (depends on @opentelemetry/core) | Production (Sentry) | Transitive of the above | Yes | NOT exploitable — same as core. |
| Moderate | dompurify 3.4.0 | GHSA-x4vx-rjvf-j5p4 (+6 related: GHSA-76mc-f452-cxcm, GHSA-hpcv-96wg-7vj8, GHSA-r47g-fvhr-h676, GHSA-vxr8-fq34-vvx9, GHSA-gvmj-g25r-r7wr, GHSA-rp9w-3fw7-7cwq) | Production (posthog-js) | IN_PLACE / cross-realm sanitization bypass -> XSS | Yes (npm audit fix bumps it) | NOT exploitable — 0 direct DOMPurify calls in `src/`; basic-markdown.tsx replaced react-markdown; PostHog usage has no attacker-controlled DOM-object path. |
| Moderate | js-yaml 4.1.1 | GHSA-h67p-54hq-rp68 / CVE-2026-53550 | Dev only (eslint -> @eslint/eslintrc) | Quadratic-complexity DoS in merge-key aliases | Yes -> 4.2.0 | NOT exploitable — only parses our own trusted eslint config; no untrusted YAML at runtime. |
| Low | @babel/core 7.29.0 | GHSA-4x5r-pxfx-6jf8 / CVE-2026-49356 | Build-time (Sentry bundler, eslint-plugin-react-hooks) | Arbitrary file read via `sourceMappingURL` comment when compiling untrusted code | Yes -> 7.29.6 | NOT exploitable — we only compile our own trusted source; advisory explicitly excludes trusted-code compilation. |

## 4. Detailed Exploitability Analysis (High/Critical)

There are no Critical advisories. The three High advisories are analyzed below.

### 4.1 form-data 4.0.5 — CVE-2026-12143 (HIGH, production tree)

Chain: `paisaxe@1.5.1 -> voyageai@0.1.0 -> form-data@4.0.5`

Attack vector: CRLF injection into the `Content-Disposition` header when untrusted data is used as a multipart field NAME or FILENAME (not the field value). An attacker controlling a field name could inject `\r\n` to forge additional multipart parts or headers.

Why it is NOT exploitable here:
- `form-data` is reached only through the Voyage AI SDK (`voyageai@0.1.0`), used for embeddings (voyage-3.5) and reranking (rerank-2.5).
- The Voyage SDK constructs requests with hard-coded, SDK-controlled field names. User-supplied text (chat queries, document content) is passed as field VALUES / JSON payloads, never as field names or filenames.
- The vulnerable surface (attacker-controlled field names/filenames) is therefore never reached.

Recommendation: Fix anyway. It is the only HIGH in the production dependency tree, the fix is a clean patch bump (4.0.5 -> 4.0.6), and it removes the single production-tree HIGH from the board. Note: `voyageai` itself is pinned at 0.1.0 (do NOT bump voyageai) — `npm audit fix` updates the transitive `form-data` within voyageai's `^4.0.0` range without touching voyageai.

### 4.2 vite 8.0.8 — CVE-2026-53571 + GHSA-v6wh-96g9-6wx3 (HIGH, dev only)

Chain: `vitest@4.1.8` and `@vitejs/plugin-react@6.0.2 -> vite@8.0.8`

Attack vector: `server.fs.deny` bypass on Windows alternate path forms, and NTLMv2 hash disclosure via UNC paths on Windows (launch-editor).

Why it is NOT exploitable here:
- Both advisories are explicitly Windows-only. Development and CI run on macOS/Linux.
- The Vite dev server is a development/test tool only — it never runs in production. The production site is a Next.js build served from Vercel; Vite is not in the runtime path.

Recommendation: Patch via `npm audit fix` (8.0.8 -> 8.0.16) for hygiene; no real risk.

### 4.3 ws 7.5.10 — CVE-2026-48779 (HIGH, dev only)

Chain: `@next/bundle-analyzer@16.2.9 -> webpack-bundle-analyzer@4.10.1 -> ws@7.5.10`

Attack vector: Memory-exhaustion DoS from tiny WebSocket fragments/data chunks against a `ws` server.

Why it is NOT exploitable here:
- The `ws` server only runs when a developer runs `npm run build:analyze` locally to inspect the bundle. It is never deployed, never internet-exposed, and binds to localhost only.
- No production code imports `ws`.

Recommendation: Patch via `npm audit fix` (7.5.10 -> 7.5.11). Zero production impact.

## 5. Prioritized Remediation Steps

1. Run the single clean fix (resolves all 9 advisories, no breaking changes):
   ```bash
   npm audit fix
   ```
   This bumps: form-data 4.0.5 -> 4.0.6, vite 8.0.8 -> 8.0.16, ws 7.5.10 -> 7.5.11, @babel/core 7.29.0 -> 7.29.6, @opentelemetry/core 2.7.1 -> 2.8.0 (and the two dependent OTel packages), js-yaml 4.1.1 -> 4.2.0, dompurify -> patched. Do NOT bump `voyageai` (pinned at 0.1.0) — only its transitive `form-data` moves.

2. Verify zero advisories and a clean production tree:
   ```bash
   npm audit
   npm audit --omit=dev   # confirm production tree is clean
   ```

3. Confirm the OTel bump does not break Sentry tracing — `@opentelemetry/core 2.8.0` is a minor bump but Sentry pins specific OTel versions. If `npm audit fix` cannot satisfy Sentry's range, leave the OTel advisories (moderate, not exploitable) and wait for the next `@sentry/nextjs` release rather than forcing it.

4. Re-run the suite before committing (TDD/CI gate):
   ```bash
   npm run typecheck 2>&1; npm run lint 2>&1; npm run test 2>&1
   ```

5. Optional hardening (carried recommendation from Performance Agent, Jun 14): relocate the `esbuild` and `protobufjs` audit pins from `dependencies` to `overrides` (alongside the existing qs / minimatch / brace-expansion / postcss / uuid overrides) so they stop counting as production deps. Confirm `npm audit --omit=dev` still passes afterward.

## 6. License Compliance

Scan result: Pass. No strong copyleft (GPL/AGPL/SSPL). `COPYLEFT LICENSES FOUND: false`.

Flagged packages (named explicitly):

- `@img/sharp-libvips-darwin-arm64@1.2.4` — LGPL-3.0-or-later. APPROVED EXCEPTION. Documented in `docs/project/license-exceptions.md` (Exception 1). Weak copyleft; pre-built native binary, dynamically linked at runtime via `sharp`'s Apache-2.0 public API; no modification; SaaS deployment (no binary distribution). No copyleft obligation on Paisaxe code.
- `dompurify@3.4.0` — (MPL-2.0 OR Apache-2.0). COMPLIANT, no exception needed. Dual-licensed; Paisaxe takes the Apache-2.0 option (permissive). Transitive via `posthog-js`.
- `expand-template@2.0.3` — (MIT OR WTFPL). COMPLIANT. Dual-licensed; take the MIT option. Transitive (build tooling).
- `paisaxe@1.5.1` — UNLICENSED. This is our own private package (intentionally unpublished/proprietary). Not a third-party concern.
- `@babel/template@7.28.6`, `simple-concat@1.0.1`, `simple-get@4.0.1` — all MIT. These appear in the flagged-package list but are permissive false positives (caught by the scanner's parent-package grouping, not by license).

Note: `@vercel/analytics` (formerly MPL-2.0) is no longer an active exception — it now ships under MIT (resolved 2026-06-11, documented as Resolved Exception 2).

CI enforcement: `license-check.yml` blocks GPL/AGPL/SSPL on every PR; weak copyleft (LGPL/MPL) warns but does not block, consistent with the documented policy.

## 7. Security Headers Status

All required headers present and correctly configured (verified from live header capture):

| Header | Value | Status |
|--------|-------|--------|
| content-security-policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com; ...; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Correct |
| strict-transport-security | `max-age=63072000; includeSubDomains; preload` | Correct (2-year, preload) |
| x-frame-options | `DENY` | Correct |
| x-content-type-options | `nosniff` | Correct |
| referrer-policy | `strict-origin-when-cross-origin` | Correct |
| permissions-policy | `camera=(), geolocation=(), microphone=(self)` | Correct |

CSP notes:
- No `'strict-dynamic'` and no nonce-only policy — correct for PPR (`cacheComponents`) compatibility, per CLAUDE.md. Prerendered HTML has no nonces, so `'self' 'unsafe-inline'` is the deliberate, correct choice.
- `object-src 'none'`, `frame-ancestors 'none'`, and `base-uri 'self'` are all locked down.
- `microphone=(self)` is intentional (ElevenLabs Pelayo voice agent needs mic access on first-party origin); camera and geolocation fully disabled.
- E2E "CSP canary" (`e2e/smoke.spec.ts`) guards against CSP regressions that would block JS execution.

## 8. CI/CD Security Automation Status

| Control | Status | Notes |
|---------|--------|-------|
| Dependabot | Active | Configured, pinned to `develop`. Recent auto-merges of dev/types and production batches (PRs #595-#597) confirm the pipeline is healthy. |
| Renovate | Not used | Intentional — Dependabot fills the same role. Not a gap. |
| Gitleaks | Active | Secret scanning in CI; scans git history. |
| npm audit | Active | Runs in CI pipeline. |
| License check | Active | `license-check.yml` blocks strong copyleft on every PR. |

No CI/CD security gaps this cycle. The long-standing "Gitleaks CI gap" referenced in older QA cross-notes was closed earlier and remains closed.

## 9. Outdated Packages with Security Implications

Raw outdated count from metrics is unreliable this cycle (the metric printed `26` then `0`; treat as approximate). From the dependency trees inspected, the security-relevant outdated items are exactly the 9 advisory packages above, all resolved by `npm audit fix`. Beyond those:

- `voyageai@0.1.0` — intentionally pinned (do not bump). Its only security-relevant transitive (`form-data`) is patched independently by `npm audit fix`. No CVE in voyageai itself.
- `@sentry/nextjs@10.57.0` — current; carries the OTel moderate advisories transitively. Watch for a release that bumps `@opentelemetry/core` to >=2.8.0 so the fix lands cleanly without forcing.
- `posthog-js@^1.384.0` — current (resolved Jun 11/12). Carries the `dompurify` moderate advisories transitively; not exploitable. A future posthog-js minor will likely pull a patched dompurify.
- Dev-tooling majors noted in prior cycles (typescript v6, knip v6) — no CVEs, low urgency, out of scope for security.

No production package is on an outdated version with an exploitable CVE.

## Cross-Cycle Notes

- GREEN streak (held since Apr 20) ends this cycle at YELLOW due to 9 open advisories (0 exploitable). A single `npm audit fix` returns the tree to clean and restores GREEN.
- The in-house `basic-markdown.tsx` renderer (replaced react-markdown Jun 12, now at 100% test coverage including XSS link-safety branches per Coverage Agent Jun 16) means the dompurify advisories have no application-level XSS surface — PostHog's internal usage is the only consumer.
- Webhook/CSRF security controls remain intact. QA's "blind cycles" (#635) are a harness port-mismatch, not a security regression; CSRF/origin handling is unaffected.
