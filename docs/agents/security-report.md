# Security Report — 2026-10-01

Claim labels: VERIFIED = I ran the command or read the file this session (evidence cited). INFERRED = extrapolated or not re-checked.

## 1. Health Status: YELLOW

3 npm audit findings (1 high, 1 moderate, 1 low), 0 exploitable against the shipped application. All three are build-time or analytics-internal paths with no user-controlled input. YELLOW rather than GREEN because (a) the high-severity `undici` finding is held in place by our own exact-version override, so the advertised `npm audit fix` does not clear it, and (b) one low advisory sits in a production transitive dependency. The GREEN streak from Sep 24 ends.

## 2. Executive Summary

**3 audit entries detected (2 root advisory packages plus 1 dependent), 0 exploitable.**

- `undici@7.29.0` (high, 10 advisories, 2 rated High at CVSS 7.4 to 7.5): DEV-ONLY. VERIFIED: `npm ls undici` shows it only under `jsdom@30.0.1`, a devDependency (`package.json:132`) used by vitest. `npm audit --omit=dev` lists only the dompurify advisory, so undici does not reach the production tree. VERIFIED: no `src/` file imports `undici`; the only `src/` hit is a comment or string in `src/tests/qa/llm-quality.test.ts`. The vulnerable code runs only inside the local test runner, never in the deployed app.
- `jsdom` (moderate): the same advisory, reported through its dependency on `undici`. No separate defect.
- `dompurify@3.4.13` (low, GHSA-p98j-92pf-mc4p, CWE-79): production tree, transitive via `posthog-js@1.430.2` (`npm ls`). VERIFIED: no file in `src/` references `dompurify`. The flaw needs the IN_PLACE mode with a node-removing `afterSanitize` hook, which our code never configures. NOT EXPLOITABLE here; PostHog uses it internally.

**Fixability finding (VERIFIED):** `package.json:148` pins `"undici": "7.29.0"` exactly. Every undici advisory has range `<7.29.1`. `npm audit fix --dry-run` still reports the same 3 vulnerabilities afterwards. The metrics header's "Fixable via npm audit fix: 3" is therefore wrong for undici and jsdom (the dry-run output shows them remaining). INFERRED: the exact override is the cause. The fix is to edit the override, not to run `npm audit fix`. 7.29.1 and 7.30.0 both exist on the registry (VERIFIED: `npm view undici@7 version`).

## 3. Vulnerability Table

CVE identifiers were not retrieved this cycle (no GHSA-to-CVE lookup was run); the column is marked accordingly rather than filled from memory.

| Severity | Package | Advisory (GHSA) | CVE | Attack Vector | Fixable | Risk Assessment |
|----------|---------|-----------------|-----|---------------|---------|-----------------|
| High (7.5) | undici 7.29.0 | GHSA-rfgv-xxqx-mfg5 (DoS, unrequested WebSocket subprotocol) | not looked up | Network, malicious WebSocket server | Yes, raise override to 7.29.1+ | Dev-only; no WebSocket client use in the app |
| High (7.4) | undici 7.29.0 | GHSA-w293-vg96-wgc3 (TLS validation bypass via BalancedPool, range >=7.24.1) | not looked up | MITM on undici BalancedPool connections | Yes, same | Dev-only; app does not use undici or BalancedPool |
| Moderate (6.5) | undici 7.29.0 | GHSA-2jfj-6hjv-fm6j (cross-user cookie disclosure in shared cache) | not looked up | Shared-cache interceptor | Yes, same | Dev-only; no cache interceptor used |
| Moderate (5.9) | undici 7.29.0 | GHSA-3wwx-pv8p-q78v, GHSA-pmjh-fq2x-6v4x, GHSA-3xpg-4rpp-hhhm, GHSA-rx4f-c7p8-82vq | not looked up | DoS (decompression, retry, WebSocket) | Yes, same | Dev-only |
| Low (3.7) | undici 7.29.0 | GHSA-r53p-7pc4-xj5r, GHSA-2gqq-gqf2-x968, GHSA-8436-99hf-9mmv | not looked up | Response splitting, truncation, unsafe-method caching | Yes, same | Dev-only |
| Moderate | jsdom 30.0.1 | via undici | n/a | Test environment | Yes, via undici | Dev-only (vitest DOM) |
| Low | dompurify 3.4.13 (range 3.4.13 - 3.4.15) | GHSA-p98j-92pf-mc4p | not looked up | DOM XSS through IN_PLACE with node-removing afterSanitize hook | Yes, `npm audit fix` (dry-run output does not list it as remaining; 3.4.16 is latest, `posthog-js` accepts `^3.4.13`) | Production transitive, not reachable from our code |

Severity note: npm audit reports the undici group as "high" because of the two 7.4 to 7.5 entries; the other eight are moderate or low.

## 4. Exploitability Analysis (High)

**undici (dev-only).** Attack vectors need undici acting as a client against an attacker-controlled server or intermediary (WebSocket, BalancedPool, retry or cache interceptors). In this repository undici exists solely as jsdom's HTTP layer inside vitest. Tests run on a developer machine or in CI against mocked or local endpoints. No deployed code path loads it. Risk to production users: none. Residual risk: a developer or CI job fetching a hostile URL from a jsdom test, which is not a pattern in this codebase (INFERRED; I did not audit every test for outbound fetches, only confirmed `src/` has no undici import).

**dompurify (low).** Needs a caller to run `sanitize(..., { IN_PLACE: true })` with a node-removing hook. Not our code (0 references in `src/`). PostHog's internal use does not configure that mode (INFERRED from the advisory conditions; PostHog source not inspected).

## 5. Prioritized Remediation

1. Raise the undici override (clears 10 advisories and the jsdom entry). Work in a worktree on `develop`, per project rules:
   ```bash
   # package.json overrides: "undici": "7.29.0"  ->  "undici": "7.30.0"  (or ">=7.29.1")
   npm install
   npm audit && npm run test -- --maxWorkers=4 && npm run typecheck && npm run lint
   ```
   Risk: jsdom 30 may pin an undici range; confirm `npm ls undici` shows no "invalid" marker. Issue #951 documents earlier dependency-batch test breakage, so run the full suite before merging.
2. Clear dompurify: `npm audit fix` (lockfile-only move to 3.4.16, no `package.json` change). Alternatively wait for the weekly Dependabot group.
3. Check the metrics script: it counts "fixable via npm audit fix" from the audit text, which overstated fixability here because overrides block the fix. Suggest the script run `npm audit fix --dry-run` and count what remains.

No production-affecting action is needed; nothing here requires touching `main`.

## 6. License Compliance

Production tree: no copyleft violations (metrics: copyleft in production deps false; dev deps false).

Flagged packages, by name:
- `@img/sharp-libvips-darwin-arm64@1.3.3`, LGPL-3.0-or-later. Documented exception 1 in `docs/project/license-exceptions.md` (dynamically linked prebuilt binary via `sharp`). The doc names version 1.2.4 as the example and says "and platform variants"; the installed 1.3.3 is covered by that wording (VERIFIED: doc lines 5 to 9). Optional: refresh the version in the doc.
- `dompurify@3.4.13`, (MPL-2.0 OR Apache-2.0). Dual license; Apache-2.0 elected. Documented (line 157) but the doc row says `3.4.11`; version drift only.
- `lightningcss@1.32.0` and `lightningcss-darwin-arm64@1.32.0`, MPL-2.0. Dev/build only (Tailwind v4); documented exception 3.
- `paisaxe@1.6.0`, UNLICENSED. The project itself (private); false positive.
- `expand-template@2.0.3` (MIT OR WTFPL), `simple-concat@1.0.1` (MIT), `simple-get@4.0.1` (MIT), `@babel/template@7.29.7` (MIT). Scanner false positives (permissive licenses); the WTFPL alternative is not a restriction because MIT is also offered.
- Other non-standard entries in the summary: FSL-1.1-MIT (2 packages) and CC-BY-4.0 (1 package) were not named by the metrics. INFERRED that they were previously reviewed; the package names were not listed this cycle and I did not look them up.

## 7. Security Headers

Server not running, so live headers were not checked (metrics: "Server not running - skipped"). Source configuration VERIFIED by reading `next.config.ts:65-70` and `src/lib/proxy/csp.ts:59-60`:
- Strict-Transport-Security: `max-age=63072000; includeSubDomains; preload`, emitted conditionally (production only, per line 65).
- X-Content-Type-Options: nosniff. Pass.
- X-Frame-Options: DENY. Pass.
- Referrer-Policy: strict-origin-when-cross-origin. Pass.
- Permissions-Policy: `camera=(), geolocation=(), microphone=(self)`. Pass.
- Content-Security-Policy: set in `src/proxy.ts:73` via `buildCspHeader()`; includes `object-src 'none'` and `frame-ancestors 'none'`. Script policy intentionally `'self' 'unsafe-inline'` for PPR compatibility (project CLAUDE.md); tests in `src/proxy.test.ts` assert no `strict-dynamic`.
- Live validation of the deployed response headers remains outstanding (carried from Apr 25). A single `curl -sI https://paisaxe.es` check would close it; not run because this agent does not hit production.

## 8. CI/CD Security Automation

- Dependabot: configured for npm and github-actions, targeting `develop`, weekly (VERIFIED: `.github/dependabot.yml`).
- Gitleaks: job "Gitleaks secret scan" in `.github/workflows/security.yml` (VERIFIED), daily schedule `0 8 * * *`.
- npm audit: job "npm audit" runs `npm audit --omit=dev --audit-level=moderate` (VERIFIED `security.yml:73`). Note this gate is production-only and moderate-or-higher. Today it would not fail on the single production low-severity dompurify advisory, and it ignores dev-only high findings like undici by design. That is a conscious trade-off, but it means the undici override staleness is only visible in the informational step.
- License check: `license-check.yml` present.
- Renovate: not configured (not needed alongside Dependabot).
- Not verified this session: whether the latest Security Scan run on `develop` passed.
- Standing from earlier cycles, unchanged: GitHub code scanning and secret scanning unavailable under the current plan (billing decision); 15 default-branch Dependabot alerts remain open until `develop` is released to `main`. Neither was re-checked today.

## 9. Outdated Packages with Security Implications

28 outdated packages (metrics). None has a known advisory in the audit output. Notes:
- `next` 16.3.4 -> 16.3.8, `sharp` 0.35.4 -> 0.35.5, `@supabase/supabase-js`, `stripe` 22.6.2 -> 23.0.0 (major), `@sentry/nextjs` and `@sentry/core` 10.74.0 -> 11.1.0 (major). Patch updates for `next` are worth taking since `next` is the highest-exposure package and its patch releases have carried security fixes before; I did not look up whether 16.3.5 to 16.3.8 include any.
- Majors (`stripe` 23, `@sentry/*` 11, `typescript` 7, `dotenv` 18, `@vitest/coverage-v8` 5): defer and isolate. Past evidence: the Sep 24 triage deferred vitest 5 majors and issue #951 recorded Sentry/vitest incompatibility. Performance agent also notes the Sentry/PostHog chunk grew 12.2% on minor bumps alone.
- `posthog-js` is current at 1.430.2 per the table (no update listed); its dompurify is fixed by the lockfile bump, not a posthog upgrade.
- node_modules size is at 95.5% of its 1,100 MB budget (Performance, Sep 24); not re-measured here.

## Working-tree note

The audit run left `.security-metrics.tmp`, `docs/agents/security-report.md.backup.Y0FFtW`, and `docs/agents/security-report.md.draft.uwIBJm` untracked in the repository. They appear to be script artifacts; I did not delete them.
