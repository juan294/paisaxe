# Security Report — 2026-09-24

## 1. Health Status: GREEN

0 advisories detected in `npm audit` against `develop`'s lockfile, 0 exploitable. GREEN streak continues from Sep 17. **Important nuance this cycle:** GitHub's Dependabot Alerts tab shows **15 open alerts, including 2 Critical** (both Next.js RCE advisories). This is not a live gap — verified below, every one of the 15 is already resolved in `develop`'s `package-lock.json`, either via a routine version bump or a standing `overrides` pin. The alerts stay open because Dependabot keys them off the default branch (`main`), which has not yet received these fixes via a production release — consistent with [[reference_dependabot_default_branch]]. Anyone glancing at the GitHub Security tab today would see 2 Critical / 8 High / 5 Medium and reasonably conclude the project is at risk; it is not, on `develop`.

## 2. Executive Summary

**15 GitHub advisories open (2 Critical, 8 High, 5 Medium), 0 exploitable against the current `develop` codebase.** `npm audit` independently confirms 0 vulnerabilities. Verified line-by-line against `package-lock.json`:

- **2 Critical — Next.js RCE** (`GHSA-2xp9-vwfh-vxw4`: unauthenticated RCE via AVIF in the Image Optimization API; `GHSA-p293-qw3h-jr36`: unauthenticated RCE on Windows-hosted servers). Vulnerable range `>=16.0.0, <16.3.3`; patched at `16.3.3`. Installed: **`next@16.3.4`** — already patched, landed as a routine bump before the advisory was even published.
- **1 High — `sharp`** (`GHSA-rgj7-g3m4-5g8c`, libheif vulnerabilities). Vulnerable `<0.35.4`; patched at `0.35.4`. Installed: **`sharp@0.35.4`** — exactly at the patched floor.
- **1 Medium (2 packages) — `vitest` / `@vitest/mocker`** (`GHSA-82fw-gwwq-j7x9`, path traversal / arbitrary file read via mock redirect). Vulnerable `>=2.1.0, <4.1.11`; patched at `4.1.11`. Installed: **`vitest@4.1.11`**, **`@vitest/mocker@4.1.11`** — exactly at the patched floor. Dev-only dependency regardless.
- **10 alerts carried from the Sep 10 cycle** (`browserslist` x2 High, `fast-uri` x4 High, `js-yaml` High, `fflate` Medium, `@humanfs/node` Medium, `baseline-browser-mapping` Medium) — all resolved by the `overrides` block landed in `bfccb22d` and reconfirmed present in `package.json` this cycle (`fast-uri: 4.1.4`, `browserslist: 4.28.9`, `js-yaml: 4.3.2`, `fflate: 0.4.9`, `@humanfs/node: 0.16.8`, `baseline-browser-mapping: 2.11.23`), all at or above their respective patched versions.

No code action is required — every fix is already on `develop`. The alerts will close automatically once `develop` is released to `main` (per the standard release process in `docs/runbooks/release-checklist.md`); this is not something to "fix" again. License compliance is unchanged — no new copyleft violations, all 7 previously-flagged packages remain covered by documented exceptions or are scanner false positives. Security headers, CSP, and CI/CD security automation are all correctly configured with no gaps; the "Security Scan" GitHub Actions workflow is confirmed passing on `develop` (last run 2026-09-22, `89bc25d`, success).

## 3. Vulnerability Table

| Severity | Package | Advisory (GHSA) | Attack Vector | Fixable | Risk Assessment |
|---|---|---|---|---|---|
| Critical | `next` | GHSA-2xp9-vwfh-vxw4 | Unauthenticated RCE via crafted AVIF file through the Image Optimization API (`/_next/image`) | Already fixed | **Not exploitable on `develop`.** Vulnerable `<16.3.3`; installed `16.3.4`. Verified via `package-lock.json`. |
| Critical | `next` | GHSA-p293-qw3h-jr36 | Unauthenticated RCE, Windows-hosted servers only | Already fixed | **Not exploitable anywhere.** Vulnerable `<16.3.3`; installed `16.3.4`. Also: production runs on Vercel (Linux), not Windows — doubly inapplicable even pre-patch. |
| High | `sharp` | GHSA-rgj7-g3m4-5g8c | Vulnerabilities in bundled `libheif` (image parsing) | Already fixed | Not exploitable. Vulnerable `<0.35.4`; installed `0.35.4` (exactly the patched floor). `sharp` processes PDF-extracted and user-uploaded images server-side — would have been a real attack surface pre-patch. |
| High | `browserslist` | GHSA-73wf-gq98-2v4g, GHSA-c83g-rgw3-j3cx | Crash / unbounded memory growth via untrusted `browserslist-stats.json` | Already fixed | Not exploitable — build-time only (Webpack/Babel toolchain), never reachable from the deployed runtime. Installed `4.28.9` via override; patched at `4.28.7`. |
| High | `fast-uri` | GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp | Host confusion / SSRF via URI normalization edge cases | Already fixed | Not exploitable — transitive via `ajv`/`webpack` build tooling, no direct application usage. Installed `4.1.4` via override; patched at `4.1.3`. |
| High | `js-yaml` | GHSA-2883-xcg3-v3hh | CPU exhaustion via unbounded merge-key expansion | Already fixed | Not exploitable — build-tooling transitive, no application code parses untrusted YAML. Installed `4.3.2` via override (exact patched version). |
| Medium | `vitest` / `@vitest/mocker` | GHSA-82fw-gwwq-j7x9 | Path traversal / arbitrary file read via mock redirect | Already fixed | Not exploitable — dev/test-only dependency, never ships or runs in production. Installed `4.1.11` (exact patched floor). |
| Medium | `fflate` | GHSA-px8p-9vwx-vf98 | Infinite loop on malformed ZIP64 archive | Already fixed | Not exploitable — build-tooling transitive. Installed `0.4.9` via override (exact patched version). |
| Medium | `@humanfs/node` | GHSA-p498-v437-472g | Recursive copy follows symlinks outside source tree | Already fixed | Not exploitable — build-tooling transitive, no runtime file-copy operation touches untrusted input. Installed `0.16.8` via override (exact patched version). |
| Medium | `baseline-browser-mapping` | GHSA-w5vr-8v7q-w6rv | Process termination (DoS) on invalid input | Already fixed | Not exploitable — build-time only. Installed `2.11.23` via override; patched at `2.11.0`. |

**Fixable via `npm audit fix`: 0** (nothing to fix — `npm audit` already reports 0 vulnerabilities against `develop`'s lockfile; the 15 GitHub alerts above are a `main`-branch reporting lag, not an unfixed state).

## 4. Detailed Exploitability Analysis (Critical/High)

**Next.js RCE pair (Critical)** — the only advisories in this batch with a plausible real-world attack path if unpatched: the AVIF Image Optimization RCE (`GHSA-2xp9-vwfh-vxw4`) targets `/_next/image`, a route this app exposes for all `img-src` image optimization (see CSP's `img-src` directive covering Supabase storage, Unsplash, and Google avatar URLs — all valid inputs to that endpoint). Had this shipped unpatched to `main`, it would have been directly internet-reachable and unauthenticated. It did not ship unpatched: `develop` has run `next@16.3.4` (patched floor `16.3.3`) since before this advisory's publication, confirmed via `package-lock.json`. The Windows-RCE advisory (`GHSA-p293-qw3h-jr36`) is additionally inapplicable regardless of Next.js version, since Vercel's production runtime is Linux, not Windows.

**`sharp` libheif vulnerabilities (High)** — `sharp` is used in the PDF ingestion / image-extraction pipeline (`docs/agents` seed-db flow) and processes files that ultimately originate from admin-uploaded PDFs, not arbitrary internet input, which would have narrowed exploitability even pre-patch. Moot regardless: installed version sits exactly at the patched floor.

**All remaining High/Medium items (`browserslist`, `fast-uri` x4, `js-yaml`, `fflate`, `@humanfs/node`, `baseline-browser-mapping`, `vitest`/`@vitest/mocker`)** are unchanged in substance from the Sep 10/17 analysis: every one traces to build-time tooling (Webpack, Babel, `ajv`, Vitest) or dev-only test infrastructure, never reachable from the deployed runtime or any API route, and every one is already at or above its patched version in `develop`.

## 5. Prioritized Remediation Steps

No code action required this cycle — `develop` is already ahead of every open advisory. Standing items:

1. **No action needed for the 15 open Dependabot alerts.** They will close automatically on the next `develop` -> `main` release (per `docs/runbooks/release-checklist.md`). Do not attempt to "fix" already-fixed dependencies or file a duplicate issue — re-verify against `package-lock.json` first if this resurfaces, per [[reference_dependabot_default_branch]].
2. **GitHub Advanced Security (CodeQL / native secret scanning)** remains disabled (403/404 on API) — a billing decision for the user, not a code fix. Carried as a standing owner item since 2026-08-18; not re-escalating without new information.
3. **`typescript` 6.0.3 -> 7.0.2`** and **`@vitest/coverage-v8` 4.1.11 -> 5.0.1`** are major-version jumps in the outdated-packages list below — defer to a dedicated `/upgrade-deps` cycle, not a security-driven change.
4. **`@sentry/core` / `@sentry/nextjs` 10.74.0 -> 11.0.0`** — flagging as elevated risk for the next dependency batch (see Section 9): this is a **major** version bump, and the Aug 30 triage history shows a much smaller Sentry *minor* bump (10.70->10.72) previously broke 17 vitest tests via a new `@sentry/server-utils` orchestrion path. Isolate and test this specific upgrade before batching with the other 24 outdated packages.

## 6. License Compliance

No new copyleft violations. Copyleft license scan for production dependencies: **false** (no GPL/AGPL/LGPL-strong found). All 7 flagged packages are unchanged from prior cycles and remain covered by `docs/project/license-exceptions.md`:

| Package | License | Scope | Status |
|---|---|---|---|
| `@img/sharp-libvips-darwin-arm64@1.3.3` | LGPL-3.0-or-later | Production (native binary, dynamically linked to `sharp`) | Approved — Exception 1 |
| `dompurify@3.4.13` | (MPL-2.0 OR Apache-2.0) | Production (dual-licensed via `posthog-js`; Apache-2.0 branch elected) | Approved — "Dual-licensed dependencies" section |
| `expand-template@2.0.3` | (MIT OR WTFPL) | Production (dual-licensed via `canvas` -> `prebuild-install`; MIT branch elected) | Approved — not a real flag |
| `simple-concat@1.0.1` | MIT | Production | Not a real flag — plain MIT, scanner false positive |
| `simple-get@4.0.1` | MIT | Production | Not a real flag — plain MIT, scanner false positive |
| `@babel/template@7.29.7` | MIT | Production | Not a real flag — plain MIT, scanner false positive |
| `paisaxe@1.6.0` | UNLICENSED | This repo itself | Expected — private application, not published |

Dev-only tree also includes `lightningcss@1.32.0` / `lightningcss-darwin-arm64@1.32.0` (MPL-2.0, via Tailwind CSS's build toolchain) — Approved under Exception 3, non-blocking (build-time only, not shipped to clients). `@sentry/cli` / `@sentry/cli-darwin` (FSL-1.1-MIT, Exception 4) remain in the production tree at 2 packages per the license summary, correctly excluded from the MPL/LGPL/GPL/UNLICENSED flag categories used by this scan (FSL is a separate exception track), unchanged from prior cycles.

No action needed. This list is identical in substance to every cycle since Apr 20.

## 7. Security Headers Status

All headers confirmed present and correctly configured:

| Header | Value | Status |
|---|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://js.stripe.com https://checkout.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com https://*.stripe.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com https://checkout.stripe.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://js.stripe.com https://checkout.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Pass — correctly avoids `'strict-dynamic'` and nonce-only policies per CLAUDE.md's PPR/`cacheComponents` constraint |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Pass |
| X-Frame-Options | `DENY` | Pass |
| X-Content-Type-Options | `nosniff` | Pass |
| Referrer-Policy | `strict-origin-when-cross-origin` | Pass |
| Permissions-Policy | `camera=(), geolocation=(), microphone=(self)` | Pass — microphone scoped to same-origin, consistent with the Pelayo voice-agent use case |

No gaps. Headers appear duplicated in the raw scan output, consistent with both `next.config.ts` and `src/proxy.ts` setting them (expected, not a misconfiguration).

## 8. CI/CD Security Automation Status

| Control | Status |
|---|---|
| Dependabot | Configured (pinned to `develop`, per prior triage) |
| Renovate | Not configured (Dependabot covers this; no gap) |
| Gitleaks (secret scanning in CI) | Configured |
| `npm audit` in CI | Configured — "Security Scan" workflow reconfirmed passing on `develop` this cycle (last run 2026-09-22, commit `89bc25d`, success; verified via `gh run list`) |
| GitHub Advanced Security (CodeQL / native secret scanning) | Disabled (403/404 on API) — standing owner/billing decision, not re-flagged as new |

No new CI/CD gaps this cycle. Note for the next release: once `develop` merges to `main`, re-run the Dependabot alerts check to confirm all 15 currently-open alerts auto-close.

## 9. Outdated Packages With Security Implications

25 outdated packages (up from 17 on Sep 17), none carrying an open advisory beyond what's already addressed in Section 3 — routine minor/patch drift plus two majors:

- **`@sentry/core` / `@sentry/nextjs` 10.74.0 -> 11.0.0`** — **major** version bump, elevated risk. No CVE driving it, but see Section 5 item 4: a much smaller Sentry minor bump previously broke 17 vitest tests. Isolate and test before batching.
- `typescript` 6.0.3 -> 7.0.2` — major, dev-only, no CVE. Defer to `/upgrade-deps`.
- `@vitest/coverage-v8` 4.1.11 -> 5.0.1` — major, dev-only, no CVE. Defer to `/upgrade-deps`.
- `@anthropic-ai/sdk` 0.125.0 -> 0.128.0`, `@supabase/supabase-js` 2.116.0 -> 2.117.1`, `posthog-js` 1.430.2 -> 1.434.12`, `@upstash/redis` 1.38.4 -> 1.39.0`, `@upstash/ratelimit` v2.0.8 -> 2.2.0` — minor/patch, no CVE. `@upstash/ratelimit` is a security control (rate limiting) — review changelog for behavioral changes before bumping, but no advisory.
- `next` 16.3.4 -> 16.3.6`, `@stripe/react-stripe-js` 6.10.0 -> 6.12.0`, `@stripe/stripe-js` 9.16.0 -> 9.17.0`, `resend` 6.27.0 -> 6.28.1`, `zod` 4.6.2 -> 4.6.5`, `yaml` 2.9.0 -> 2.9.1`, `lucide-react` 1.44.0 -> 1.48.0`, `tailwind-merge` 3.6.0 -> 3.7.0`, `dotenv` 17.4.2 -> 18.0.3` — minor/patch, no CVE.
- Dev-only, no production exposure: `@next/bundle-analyzer`, `@next/eslint-plugin-next`, `@testing-library/dom`, `@types/node`, `@typescript-eslint/eslint-plugin`, `knip`, `tsx`.

---
