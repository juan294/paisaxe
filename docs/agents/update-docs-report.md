# Documentation Update Report
> Generated on 2026-06-20 | Branch: `develop` | Changes since `v1.5.0`

## Summary
- 2 documents updated (CHANGELOG.md, docs/operations/proxy-architecture.md)
- 0 diagrams refreshed (no Mermaid/architecture diagram depicted changed flows)
- 0 version references corrected (version bump handled by `/release`)
- 0 inline doc blocks updated (remediation changes were behavioural/test, not signature changes to documented APIs)
- 0 items flagged [NEEDS REVIEW]

Scope: this update reflects the pre-launch remediation (audit 2026-06-20) of 50 findings
across all 8 domains, merged into `develop`. Point-in-time snapshots under
`docs/plans/`, `docs/research/`, and `docs/agents/` were intentionally left unchanged
(historical records, not living docs). New living docs created during remediation
(`docs/operations/pre-launch-security-checklist.md`, `docs/decisions/0023-*.md`) were
authored by the remediation agents and need no further refresh.

## Changes by File

### CHANGELOG.md
Added pre-launch remediation entries to the `[Unreleased]` section, grouped per Keep-a-Changelog:
- **Added** — tiered pricing module (`src/lib/pricing.ts`), `supabase-admin.ts`, Sentry
  `onRequestError`, `SUPABASE_STORAGE_LIMIT_MB`, `lint:deps` madge CI guard,
  pre-launch security checklist, ADR-0023, locale-coverage gating, branded error/404,
  new chat-resilience + checkout tests.
- **Fixed** — BE-B1 Stripe tier fulfilment, FE-H1 voice/mic teardown, FE-H2 failure UX,
  BE-H1 rate-limit bucket, BE-H2 booking-timeout reconciliation, UX-H2 upsell tiers,
  UX-M5 image alt text, BE-M2 SMS retry, FE-M2/FE-M3 SSE + chat-list hygiene,
  BE-M1 cron auth logging, BE-L1/BE-L2 bounds + RPC timeout, UX-L2 favorites delay,
  DO-L2 health cron degrade, AR-L1/BE-M4 cleanup.
- **Changed** — UX-H1/UX-S1 green brand token, UX-M1/UX-M2 mobile controls + tap zones,
  FE-M1/PE-M3 provider memoization + deferred analytics, PE-M2 proxy API fast-path,
  PE-L2 narrowed select, DO-M2 smoke visibility, FE-L1/FE-L2 memoization.
- **Security** — server-only secret boundary (AR-M1/AR-M2), documented SSRF/CSP
  compensating controls + checklist (SE-L1/SE-L2/SE-S1).

### docs/operations/proxy-architecture.md
Added a note to the CSRF step documenting the PE-M2 hot-path optimization: `/api/*`
responses skip CSP-header and CSRF-cookie decoration, while CSRF validation on mutating
requests is still enforced.

## Flagged for Review
None.

## Notes
- Markdown line-length (MD013) warnings from default `markdownlint` are pre-existing
  CHANGELOG style (long single-line entries); markdown is not part of the project's
  `npm run lint` gate or CI, so no change was made to line wrapping.
- The orphaned `src/lib/i18n/resolve-server-locale.ts` was removed (not a doc change)
  when FE-M4's server-side locale resolution was reverted for PPR static-shell
  compatibility — see CLAUDE.md "CSP and PPR Compatibility".
