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

*To add a new exception, copy the template above and submit a PR with justification.*
