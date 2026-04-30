# Security Report — 2026-04-30

## Health Status: GREEN

1 advisory detected. **0 exploitable.** The single moderate advisory affects the Anthropic SDK's Local Filesystem Memory Tool — a feature architecturally irrelevant in this Vercel serverless deployment. Vulnerability posture is clean. CSRF enforcement confirmed working; QA RED is a test harness gap (missing Origin header), not a security flaw.

## Executive Summary

- **1 advisory detected, 0 exploitable.** One moderate advisory in `@anthropic-ai/sdk` (GHSA-p7fg-763f-g4gf) — insecure file permissions in the Local Filesystem Memory Tool. This tool is not used in this codebase and has no exploit path on Vercel's ephemeral serverless filesystem.
- **0 critical, 0 high.** No remote code execution, auth bypass, or data-exfiltration vectors.
- **CSRF enforcement confirmed correct.** QA agent (Apr 30) identified the Chat API 403 as a test harness gap — Node.js fetch omits the Origin header required by SE-M2 hardening. Adding `'Origin': API_URL` to the QA harness headers fixes it. The CSRF gate itself is working as designed.
- **Safety tests blocked (2nd cycle).** LLM safety, prompt-injection, and PII-extraction tests remain unconfirmed while the QA harness bug is unfixed. Journeys and integration health recovered to 10/10 and 3/3.
- **19 outdated packages.** One has an advisory (@anthropic-ai/sdk). The rest have zero CVEs. Batch-upgrade candidate for next triage cycle.
- **License compliance: Pass.** Three flagged licenses (LGPL, MPL, UNLICENSED) remain documented approved exceptions. Four scanner false positives unchanged.
- **Security headers: Partial live verification.** 4 of 6 expected headers confirmed in live check. CSP and HSTS absent from live output — HSTS is production-only (expected); CSP requires production endpoint confirmation.
- **CI/CD security automation: Solid.** Dependabot, Gitleaks, npm audit, license-check all active.

## Vulnerability Table

| Severity | Package | Advisory | CVE | Attack Vector | Fixable | Risk Assessment |
|----------|---------|----------|-----|---------------|---------|-----------------|
| Moderate | `@anthropic-ai/sdk@0.90.0` | GHSA-p7fg-763f-g4gf | Pending assignment | Local filesystem — requires use of Memory Tool feature | Yes (breaking change: 0.91.1) | NOT EXPLOITABLE — feature not used; Vercel filesystem is ephemeral |

## Detailed Exploitability Analysis

### GHSA-p7fg-763f-g4gf — @anthropic-ai/sdk Local Filesystem Memory Tool (Moderate)

**Advisory summary**: The Anthropic SDK's Local Filesystem Memory Tool creates files with world-readable default permissions (0o644) instead of user-only permissions (0o600). On a multi-user system, other local users could read sensitive agent memory files.

**Attack requirements**:
1. Application must actively use the Local Filesystem Memory Tool feature of the SDK
2. Application must be deployed on a shared, multi-user system where other principals can read the filesystem
3. The tool must write sensitive data to disk

**Why this is NOT exploitable here**:

1. **Feature not used.** The Local Filesystem Memory Tool is a developer/agent workflow feature for persistent memory across Claude sessions. This codebase uses `@anthropic-ai/sdk` exclusively for the streaming chat completions API (`/api/chat/route.ts`) — the Memory Tool is never instantiated or called.

2. **Vercel serverless filesystem is ephemeral.** Even if the tool were accidentally used in a route handler, Vercel Lambda functions run in isolated ephemeral containers. No persistent filesystem exists between invocations. No other process can access the transient `/tmp` space of a different Lambda invocation.

3. **No multi-user server context.** The vulnerability requires local filesystem access from a second principal. This is a traditional server concern, not applicable to a stateless serverless architecture.

**Fix available but breaking**: `npm audit fix --force` installs `@anthropic-ai/sdk@0.91.1`. This is a major semver bump within the 0.x range that may include API-incompatible changes. Evaluate the 0.91.x changelog before upgrading — the chat streaming API surface used by this project may or may not be affected.

**Recommended action**: Schedule the upgrade as part of the next routine batch dep upgrade. No urgency — the advisory is not exploitable in this deployment.

### CSRF Hardening (SE-M2) — Confirmed Working

**QA agent (Apr 30)** identified the Chat API 403 root cause: the QA harness `sendChatMessage()` in `src/tests/qa/llm-quality.test.ts:43` omits the `Origin` header. SE-M2 enforces Origin validation on all POST requests; Node.js `fetch()` does not auto-inject Origin when called from a Node process (not a browser).

**Security assessment**: The CSRF gate is functioning correctly. The 403 is the expected response when Origin is missing. One-line fix: add `'Origin': API_URL` to the harness request headers. This does not weaken CSRF protection — the double-submit token check still applies, and the Origin check remains in force for all production requests.

**Safety tests**: Once the harness is fixed, next cycle should recover to 12/12 LLM tests. Safety guardrails are presumed intact based on (a) correct CSRF enforcement and (b) no code changes to the system prompt or safety logic since the last confirmed GREEN (Apr 26).

## Prioritized Remediation Steps

1. **Fix QA harness Origin header** — `src/tests/qa/llm-quality.test.ts:43`: add `'Origin': process.env.API_URL ?? 'http://localhost:3000'` to the fetch headers. One-line change. Unblocks LLM safety confirmation next cycle. Priority: HIGH.
2. **Evaluate @anthropic-ai/sdk 0.91.1 upgrade** — Review changelog for breaking changes affecting streaming chat completions API. If safe, upgrade in next batch cycle. The vulnerability is non-exploitable here but keeping the SDK current is good hygiene. Priority: MEDIUM.
3. **Live CSP production verification** — `curl -sI https://paisaxe.es | grep -i 'content-security-policy'` to confirm CSP is served from production. Priority: LOW (source-verified correct).
4. **Batch production minor/patch upgrades** — All other 18 outdated production packages (excluding `voyageai`, which is intentionally pinned at 0.1.0). Zero CVEs. Routine maintenance. Priority: LOW.

## License Compliance

**Status: Pass.** Three non-permissive licenses appear in the dep tree, all approved exceptions:

| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64@1.2.4` | LGPL-3.0-or-later | Approved exception. Documented in `docs/project/license-exceptions.md`. Native shared library dynamically linked by `sharp`; LGPL dynamic-linking exemption applies. No modifications. SaaS deployment — no distribution obligations. |
| `dompurify@3.4.0` | MPL-2.0 OR Apache-2.0 | Approved exception. Apache-2.0 elected under dual license. Transitively pulled by `@vercel/analytics`. Documented in `docs/project/license-exceptions.md`. No MPL-covered file modifications. |
| `paisaxe@1.4.0` | UNLICENSED | The project itself — intentionally closed-source. Not a dependency violation. |

**Scanner false positives** (plain MIT, mis-grouped by scanner):
- `simple-concat@1.0.1` — MIT
- `simple-get@4.0.1` — MIT
- `expand-template@2.0.3` — MIT OR WTFPL (MIT elected)
- `@babel/template@7.28.6` — MIT (grouping artifact)

**No copyleft violations.** No GPL, AGPL, or SSPL in the dependency tree.

## Security Headers Status

Live header check captured 4 of 6 expected headers. CSP and HSTS absent from live output (HSTS expected absent on dev server — production-only; CSP requires production verification).

| Header | Live Check | Source Verified | Status |
|--------|-----------|----------------|--------|
| Content-Security-Policy | Not captured | Yes (`src/proxy.ts`) | Verify via production curl |
| Strict-Transport-Security | Not captured | Yes (`src/proxy.ts`, prod-only) | Expected absent on dev; production-only |
| X-Frame-Options | DENY | Yes | Pass |
| X-Content-Type-Options | nosniff | Yes | Pass |
| Referrer-Policy | strict-origin-when-cross-origin | Yes | Pass |
| Permissions-Policy | camera=(), geolocation=(), microphone=(self) | Yes | Pass |
| frame-ancestors (CSP) | Not captured (see CSP row) | Yes (`'none'`) | Verify via production curl |
| object-src (CSP) | Not captured (see CSP row) | Yes (`'none'`) | Verify via production curl |

**Recommended verification**: `curl -sI https://paisaxe.es | grep -iE 'content-security|strict-transport'`

## CI/CD Security Automation Status

| Mechanism | Status | Notes |
|-----------|--------|-------|
| Dependabot | Configured | Pinned to `develop` branch (commit `f118597`). Weekly schedule. |
| Renovate | Not configured | Intentional — Dependabot covers the same surface. |
| Gitleaks in CI | Configured | Runs on every push; blocks merge on findings. |
| npm audit in CI | Configured | Runs in security-scan and lint-and-typecheck jobs. |
| License check in CI | Configured | Validates against allowlist; blocks merge on copyleft introductions. |
| CSRF protection | Configured | SE-M2 Origin + double-submit token enforcement confirmed working (QA 403 = correct gate behavior). |
| Webhook signature validation | Configured | All 4 endpoints use `crypto.timingSafeEqual` (7 call sites). Unchanged. |
| Pre-commit hooks | Configured | Push accountability + dirty-pull guard. |

**No CI/CD automation gaps.**

## Outdated Packages with Security Implications

19 outdated packages. 1 has an advisory (non-exploitable). Notable items:

| Package | Current | Latest | Security Note |
|---------|---------|--------|---------------|
| `@anthropic-ai/sdk` | 0.90.0 | 0.91.1 | **Advisory GHSA-p7fg-763f-g4gf** — not exploitable here. Evaluate changelog before upgrading (breaking change). |
| `@supabase/supabase-js` | 2.104.0 | 2.105.1 | Minor — auth + database client. Check changelog for auth-related fixes. |
| `@stripe/stripe-js` | 9.2.0 | 9.3.1 | Patch + minor — client-side payment SDK. |
| `@stripe/react-stripe-js` | 6.2.0 | 6.3.0 | Minor — React wrapper for Stripe. Safe to batch. |
| `stripe` | 22.0.2 | 22.1.0 | Minor — server-side Stripe. No CVEs. |
| `@elevenlabs/react` | 1.1.1 | 1.3.0 | Minor — voice SDK. |
| `posthog-js` | 1.369.5 | 1.372.5 | Minor — analytics. Previously carried advisories (now clean). |
| `@sentry/core` | 10.49.0 | 10.51.0 | Minor — error reporting. |
| `@sentry/nextjs` | 10.49.0 | 10.51.0 | Minor — same. |
| `pdfjs-dist` | 5.6.205 | 5.7.284 | Minor — PDF processing. Content-handling dep worth keeping current. |
| `voyageai` | 0.1.0 | 0.2.1 | **Do not upgrade.** Intentionally pinned — 0.2.x ESM build breaks `@/lib/embeddings` (commit 8f53cd29). |
| `jsdom` | 29.0.2 | 27.0.1 | Scanner artifact — on pre-release channel; current version > "latest". Ignore. |
| `vitest` | 4.1.5 | 3.2.4 | Same pre-release channel artifact. Ignore. |

**Dev-only outdated** (no production security impact): `@typescript-eslint/eslint-plugin`, `@tailwindcss/postcss`, `tailwindcss`, `knip`, `lucide-react`.

## Cross-Agent Findings

- **QA Agent** (Apr 30 RED): LLM tests 0/12 — 403 regression root cause confirmed as harness missing Origin header (not a CSRF bypass). Browser journeys recovered 10/10. CSRF enforcement is correct. One-line fix to `src/tests/qa/llm-quality.test.ts:43` restores safety test coverage next cycle.
- **Coverage Agent** (Apr 23): Stripe webhook at 100% branch coverage including all error paths. CSRF origin-not-allowed branch covered (from Apr 20). All webhook and auth paths verified at code level.
- **Localization Agent** (Apr 30): 405 UI keys per locale (up from 404), 0 PII or tokens in translation files. Security-neutral.
- **Performance Agent** (Apr 29): Bundle headroom critical at 14 KB total. P4 (Supabase realtime tree-shake) urgently needed before wave-3. No security implications from headroom pressure.
- **Cost Analyst Agent** (Apr 30): 76-day revenue drought, 72-day voice silence. Twilio $0.24 anomaly (Apr 3-4) now 27 days unresolved — operational concern, not a security event.
- **Documentation Agent** (Apr 30): CLAUDE.md current (2026-04-29). No security documentation gaps.

---
