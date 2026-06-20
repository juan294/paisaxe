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

The CI license-check workflow (`license-check.yml`) blocks strong copyleft licenses (GPL, AGPL, SSPL) on all PRs. Weak copyleft (LGPL, MPL) triggers a warning but does not block, consistent with this policy exception.

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

The CI license-check workflow (`license-check.yml`) blocks strong copyleft
(GPL/AGPL/SSPL). `@vercel/analytics` should no longer appear in weak-copyleft
warnings while it remains MIT-licensed.

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

The CI license-check workflow (`license-check.yml`) blocks strong copyleft (GPL/AGPL/SSPL). MPL-2.0 is weak copyleft and is allowed under this policy exception. Because `lightningcss` is a devDependency, it is only visible to the **dev-dependency** license scan (see "Dev-dependency scanning" below), not to a `--production`-only scan.

### Review schedule

Revisit this exception if Tailwind CSS or Vite drop `lightningcss`, if `lightningcss` changes its license, or if it ever becomes a runtime/bundled dependency.

---

## Dev-dependency scanning (policy decision)

Historically the CI license check (`license-check.yml`) and the weekly security agent (`scripts/security-agent.sh`) ran `license-checker --production` only, so weak-copyleft devDependencies such as `lightningcss` (MPL-2.0) were invisible (gap noted in #576 / #623).

**Decision:** both surfaces now also scan **dev dependencies**, but with different enforcement levels matching their risk:

- **Production deps** — strong copyleft (`GPL`, `AGPL`, `SSPL`, `EUPL`, `BSL`, `CPAL`, `OSL`, `CPOL`) **blocks** the build. These licenses would impose obligations on shipped code.
- **Dev/build deps** — scanned and **reported** (non-blocking). Build-time-only tooling that never ships to clients (like `lightningcss`) does not impose copyleft obligations on Paisaxe, so a strong-copyleft *dev* dep is surfaced for review rather than hard-failing CI. Any new weak-copyleft dev dep that is acceptable should be recorded here as an exception.

This keeps the strict permissive-only guarantee for everything we ship while giving visibility into the build toolchain.

---

*To add a new exception, copy the template above and submit a PR with justification.*
