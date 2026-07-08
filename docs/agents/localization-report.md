# Localization Report

Date: 2026-07-08
Agent: Paisaxe Localization Agent
Status: GREEN — 100% translation coverage. No edits made this cycle.

## Summary

All supported locales are at full parity. This is the 70th consecutive clean run.

Supported locales: es (source of truth), en, fr, de, pt, ast (Asturianu).
Note: the operational codebase carries six locales — the fifth non-Spanish
locale, ast (Asturianu), is a first-class supported locale in
`src/lib/i18n/types.ts` and is validated on equal footing with en/fr/de/pt.

### UI Strings (`src/lib/i18n/*.ts`)

| Locale | Leaf keys | Missing vs es | Orphaned | Completion |
|--------|-----------|---------------|----------|------------|
| es (source) | 411 | — | — | 100% |
| en | 411 | 0 | 0 | 100% |
| fr | 411 | 0 | 0 | 100% |
| de | 411 | 0 | 0 | 100% |
| pt | 411 | 0 | 0 | 100% |
| ast | 411 | 0 | 0 | 100% |

- Every non-Spanish locale has exactly 411 leaf keys — full parity with the Spanish source. Independently recomputed this cycle with a recursive key-collector script run via `npx tsx`, not just the test suite.
- 0 missing keys, 0 orphaned keys across all five target locales.
- Placeholder parity verified: every interpolation token (e.g. `{current}`, `{total}`, `{title}`) present in a Spanish string appears, unmodified, in the corresponding string of all five target locales. 0 mismatches.
- Key count unchanged since Jun 20 — no commits have touched `src/lib/i18n/` since then (last: `a449504e`).

### Story Translations (`content/translations/story-translations.ts`)

| Metric | Value |
|--------|-------|
| Stories with translations | 113 |
| Target locales per story | 5 (en, fr, de, pt, ast) |
| Total target-locale records | 565 |
| Records missing title or description | 0 |
| Records missing subtitle | 0 |
| Known slugs without a translation entry | 0 |

- All 113 story slugs carry a complete record (title + subtitle + description) in every one of the five target locales — 565/565 records complete, verified programmatically this cycle (subtitle presence checked with a dedicated pass in addition to the title/description check).
- Slug coverage against the seeded story sources is enforced by `src/lib/i18n/story-translations-coverage.test.ts`, which passed (see Type Safety below).
- File unchanged since Jun 10 — no new stories have been added since the last full validation.

## Fixed

No translations were added, edited, or removed this cycle. Coverage was already complete on entry.

## Remaining Gaps

None. All UI keys and all story translations are complete across all six locales.

## Orphaned Keys

None. No key exists in a non-Spanish locale without a corresponding Spanish source.

## Type Safety

- `vitest run` on `translations.test.ts` + `story-translations-coverage.test.ts` — Pass. 105/105 tests passing (includes dynamic key-count parity checks per locale and story slug coverage).
- Full-project `npm run typecheck` — Pass, zero errors. The stale `.next/dev/types/` artifact failure flagged in the Jul 7 report no longer reproduces; the environmental issue has resolved itself (dev server regenerated the truncated files). No action needed from Triage on that item.
- CI guardrail active: `translations.test.ts` compares each locale's key set against the Spanish source, so any future key addition without full locale parity fails CI automatically.

## Cross-Agent Notes

- Cost Analyst (Jul 8): ElevenLabs cycle reset on schedule; Twilio July charge posted and reconciled. No translation or locale-content implication.
- QA Agent (Jul 7): New harness issues #719 (network-error retry) and #720 (PPR pre-hydration click race) are E2E-infrastructure items with no i18n involvement. Standing issues #716 (chat-safety over-block) and #714 (English-only decline/redirect validators) remain language-handling bugs in the safety filter and QA harness respectively — neither touches the translation files.
- Security Agent (Jul 7): no tokens, secrets, or PII in any locale file or in `story-translations.ts`. Files unchanged since the last security pass — re-confirmed by mtime/git-log inspection this cycle.
- Performance Agent (Jul 7): locale bundle lazy-loading (es + en static, fr/de/pt/ast dynamic-imported) unchanged. If the P1 Supabase `getClient()` async deferral lands, it does not touch the i18n layer.
- General note: no source changes have landed in `src/lib/i18n/` (since Jun 20) or `content/translations/` (since Jun 10) — this cycle's clean result reflects a stable, unmodified translation surface.
