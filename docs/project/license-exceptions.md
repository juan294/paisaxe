# License Policy Exceptions

> Paisaxe enforces a strict **permissive-only** license policy (MIT, Apache-2.0, BSD, ISC). This document records approved exceptions where a non-permissive dependency is acceptable under specific conditions.

## Exception 1: `@img/sharp-libvips-*` (LGPL-3.0-or-later)

| Field | Value |
|-------|-------|
| Package | `@img/sharp-libvips-darwin-arm64@1.2.4` (and platform variants) |
| License | LGPL-3.0-or-later |
| Parent dependency | `sharp` (Apache-2.0) |
| Added | 2026-03-07 |
| Identified by | Pre-launch security audit (2026-02-16) |

### Why this is acceptable

The LGPL-3.0 is a **weak copyleft** license. Its copyleft obligations apply only when:

1. The LGPL-licensed code is **modified**, or
2. The LGPL-licensed code is **statically linked** into proprietary code.

Neither condition applies here:

- **`sharp-libvips` is a pre-built native binary** — it is dynamically linked at runtime, not compiled into the application. The application interacts with it only through `sharp`'s public API.
- **No modifications** are made to `libvips` or its source code.
- **SaaS deployment** — Paisaxe is deployed as a hosted web service (Vercel). The LGPL does not require source distribution for SaaS usage (unlike AGPL). Users never receive a copy of the binary.

Under these conditions, the LGPL imposes **no copyleft obligations** on Paisaxe's application code.

### CI enforcement

The production license check (`npm run check-licenses`, `scripts/check-production-licenses.ts`) enforces an allowlist — see "Allowlist enforcement (policy decision)" below. `LGPL-3.0-or-later` is listed in `EXCEPTION_LICENSES` specifically to admit `@img/sharp-libvips-*`; without that entry the build would fail on this package the same way it now fails on any unreviewed license.

### Review schedule

This exception should be revisited if:

- `sharp` changes its linking model (static linking would change the analysis)
- The application is distributed as a downloadable binary (would trigger LGPL distribution obligations)
- The `libvips` license changes

---

## Resolved Exception 2: `@vercel/analytics` (formerly MPL-2.0)

| Field | Value |
|-------|-------|
| Package | `@vercel/analytics@2.0.1` |
| Current license | MIT |
| Previous license | MPL-2.0 (Mozilla Public License 2.0) |
| Added | 2026-04-12 |
| Identified by | Security agent license scan (2026-04-12) |
| Resolved | 2026-06-11 — upstream package now ships under MIT |

### Resolution

This is no longer an active exception. The installed `@vercel/analytics@2.0.1`
package now declares an MIT license, so it fits the standard permissive-only
policy and no longer requires weak-copyleft review.

### Historical assessment

When this package was MPL-2.0, the license was acceptable because MPL-2.0 is a
**file-level weak copyleft** license. Its obligations applied only to
modifications made to the MPL-licensed files themselves, not to the consuming
application.

Neither condition that would trigger copyleft obligations applies here:

- **No modifications** are made to `@vercel/analytics` source code.
- **File-level scope** — MPL-2.0 copyleft does not extend to files in the consuming project, only to changes within the MPL-licensed files.
- **SaaS deployment** — Paisaxe is deployed as a hosted web service. No binary distribution occurs.

Under those conditions, the MPL-2.0 imposed **no copyleft obligations** on Paisaxe's application code.

### CI enforcement

The production license check (`npm run check-licenses`) now enforces an allowlist rather than a denylist (see "Allowlist enforcement (policy decision)" below). `@vercel/analytics` needs no exception entry while it remains plain MIT-licensed — `MIT` is in `CORE_ALLOWED_LICENSES`.

---

## Exception 3: `lightningcss` + platform binaries (MPL-2.0)

| Field | Value |
|-------|-------|
| Packages | `lightningcss@1.32.0` and its platform binaries (`lightningcss-darwin-arm64`, `-linux-x64-gnu`, `-win32-x64-msvc`, and the ~9 other `lightningcss-<platform>` variants) |
| License | MPL-2.0 (Mozilla Public License 2.0) |
| Parent dependency | `@tailwindcss/postcss` → `@tailwindcss/node` (Tailwind CSS v4 build tooling) and `vite` (via `@vitejs/plugin-react`) |
| Dependency type | **devDependency / build-time only** — not shipped to clients |
| Added | 2026-06-19 |
| Identified by | Pre-launch security audit (2026-06-12, SE-L1) |

### Why this is acceptable

MPL-2.0 is a **file-level weak copyleft** license. Its copyleft obligations apply only to modifications made to the MPL-licensed files themselves, never to the consuming application.

None of the triggering conditions apply here:

- **No modifications** are made to `lightningcss` or its source.
- **File-level scope** — MPL-2.0 copyleft does not extend to Paisaxe's own files, only to changes within the MPL-licensed files.
- **Build-time only** — `lightningcss` is the CSS transformer used by Tailwind CSS v4 and Vite during the build. It runs on the build machine and its code is **not bundled into the shipped client output**. End users never receive a copy of it.
- **SaaS deployment** — Paisaxe is a hosted web service (Vercel). MPL-2.0 imposes no source-distribution obligation for SaaS usage.

Under these conditions, MPL-2.0 imposes **no copyleft obligations** on Paisaxe's application code.

### CI enforcement

`lightningcss` is a true devDependency (not reachable from any `dependencies` entry in `package.json`), so it is invisible to `scripts/check-production-licenses.ts` / `npm run check-licenses` (the blocking production allowlist) — it is only visible to the **dev-dependency** scan (see "Allowlist enforcement (policy decision)" below), which reports but does not block.

### Review schedule

Revisit this exception if Tailwind CSS or Vite drop `lightningcss`, if `lightningcss` changes its license, or if it ever becomes a runtime/bundled dependency.

---

## Exception 4: `@sentry/cli` + `@sentry/cli-darwin` (FSL-1.1-MIT)

| Field | Value |
|-------|-------|
| Packages | `@sentry/cli@2.58.5`, `@sentry/cli-darwin@2.58.5` |
| License | FSL-1.1-MIT (Functional Source License) |
| Parent dependency | `@sentry/nextjs` → `@sentry/webpack-plugin` → `@sentry/bundler-plugin-core` → `@sentry/cli` |
| Dependency type | **Nested dependency of a production package, build-time-only in behavior.** `@sentry/cli` is a plain (non-optional) `dependency` of `@sentry/bundler-plugin-core`, which sits in `@sentry/nextjs`'s production dependency tree — it is **not** a top-level devDependency, and it **is** visible to `license-checker --production` / `scripts/check-production-licenses.ts`. It never ships in the built client or server output: it runs only during `next build` to upload source maps and release metadata to Sentry. |
| Added | 2026-07-08 |
| Identified by | Security agent license scan (2026-07-03); enforcement gap identified by pre-launch audit SE-M3 (2026-08-18, #847) |

### Why this is acceptable

FSL-1.1-MIT is a source-available license that converts to plain MIT two years after each version's release. Its only restriction during that window is against offering the licensed software itself as a competing product or service.

None of the triggering conditions apply here:

- **Paisaxe does not compete with Sentry CLI** — it is used internally as a build-time tool to upload source maps and release metadata to Sentry, not resold or re-offered as a service.
- **Build-time only** — `@sentry/cli` runs during the build to upload source maps; its code is never bundled into the shipped client or server output.
- **Time-limited restriction** — the license converts to MIT after two years regardless, so the restriction is not permanent.

Under these conditions, FSL-1.1-MIT imposes no obligations relevant to Paisaxe's use.

### CI enforcement

`license-check.yml`'s production check (`npm run check-licenses`, backed by `scripts/check-production-licenses.ts`) enforces a **true allowlist** of exact SPDX license IDs — see "Allowlist enforcement (policy decision)" below. `FSL-1.1-MIT` is listed in `EXCEPTION_LICENSES` in that script specifically to admit `@sentry/cli`; without that entry the build fails (verified 2026-08-19 while implementing #847: removing the entry makes the check reject `@sentry/cli@2.58.5` and `@sentry/cli-darwin@2.58.5` by name, then passes again once restored).

Before #847, the production check was a denylist of specific SPDX identifiers (`GPL`, `AGPL`, `SSPL`, ...). `FSL-1.1-MIT` was never on that list, so it passed CI silently — matching this doc, but not because the doc's exception was actually being *enforced*. The allowlist closes that gap: any future unreviewed license now fails the build by default instead of passing until someone happens to add it to a denylist.

### Review schedule

Revisit if Sentry changes `@sentry/cli`'s license terms in a future release, or if `@sentry/cli` is ever invoked outside the build step (e.g. bundled into runtime output).

---

## Dual-licensed dependencies (permissive branch selected)

Some dependencies are published under an "OR" dual license where one branch is permissive and satisfies the policy directly. These are **not exceptions** — Paisaxe elects the permissive branch — but they are recorded here because license scanners repeatedly surface the copyleft branch of the "OR" expression.

| Package | Declared license | Permissive branch elected | Parent dependency | Notes |
|---------|------------------|---------------------------|-------------------|-------|
| `dompurify@3.4.11` | `(MPL-2.0 OR Apache-2.0)` | Apache-2.0 | `posthog-js` | Used internally by PostHog analytics; no application code calls DOMPurify directly. |
| `expand-template@2.0.3` | `(MIT OR WTFPL)` | MIT | `canvas` → `prebuild-install` | Build-time only (native binary prebuild install); not shipped to clients. |

Because a permissive branch is available and elected, no weak-copyleft review is required. Identified by the security agent license scan (2026-07-01).

---

## Allowlist enforcement (policy decision)

The stated policy at the top of this document is **permissive-only, allowlist-based**: MIT, Apache-2.0, BSD, ISC, plus the exceptions recorded above. Until #847 (SE-M3, 2026-08-19), the production CI check (`license-check.yml`) actually enforced this as a **denylist** of specific strong-copyleft SPDX identifiers (`GPL`, `AGPL`, `SSPL`, `EUPL`, `BSL`, `CPAL`, `OSL`, `CPOL`). A denylist can only catch licenses someone anticipated — it silently passed `@sentry/cli`'s `FSL-1.1-MIT` (a source-available license, not in the four permissive families, not on the denylist, and not yet enumerated in code even though it was already documented above as Exception 4).

**Decision (#847):** the production check now runs `scripts/check-production-licenses.ts` (via `npm run check-licenses`), which is a real allowlist:

- It does **not** use `license-checker --onlyAllow` — that flag matches by substring (`license.includes(token)`), so an allowed `"MIT"` token also silently matches `"FSL-1.1-MIT"`, `"SUBMIT-1.0"`, or any other license string that merely contains "MIT". That would have recreated the exact silent-pass bug this fix exists to close.
- Instead it parses each production dependency's exact SPDX expression (a single ID, or a parenthesized `AND`/`OR` compound) and matches every token by **strict equality** against `CORE_ALLOWED_LICENSES` (the four permissive families plus a handful of permissive-equivalent IDs already present in the tree — `BlueOak-1.0.0`, `Unlicense`, `MIT-0`, `0BSD`, `CC-BY-4.0`) union `EXCEPTION_LICENSES` (currently `LGPL-3.0-or-later` and `FSL-1.1-MIT`, mirroring Exceptions 1 and 4 above).
- Any production license not covered by either set **fails the build** by default. Adding a new exception requires both a justification entry in this document AND the exact SPDX ID added to `EXCEPTION_LICENSES` in the script — a one-place denylist add is no longer sufficient (or possible).

**Dev/build deps** are still scanned separately and only **reported** (non-blocking) — `license-check.yml`'s "Report dev-dependency licenses" step. Build-time-only tooling that never ships to clients (like `lightningcss`, MPL-2.0) does not impose copyleft obligations on Paisaxe, so this surfaces new dev-dep licenses for human review rather than hard-failing CI on them. Any new weak-copyleft dev dep that is acceptable should be recorded here as an exception (gap originally noted in #576 / #623).

This keeps the strict permissive-only guarantee for everything we ship, actually enforced as an allowlist rather than assumed from denylist silence, while still giving visibility into the build toolchain.

---

*To add a new exception, copy the template above and submit a PR with justification.*
