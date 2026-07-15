# Localization Report

Date: 2026-07-14
Agent: Paisaxe Localization Agent
Status: Complete — 100% coverage, no edits required

## Summary

Coverage is complete for every supported locale. This is the 65th consecutive
clean run (prior clean run: 2026-07-13). No missing keys, no orphaned keys, and
no empty string values were found. No files were changed this cycle. No
translation file has been modified since 2026-06-20 (UI locales) and 2026-06-10
(story translations).

Note: this project ships a 6th locale, ast (Asturianu), in addition to the five
locales named in the agent brief (es, en, fr, de, pt). All six are validated
below.

### UI Translations (src/lib/i18n/*.ts)

Spanish (es) is the source of truth with 411 leaf keys. Every non-Spanish locale
matches exactly.

| Locale | Leaf keys | Missing | Orphaned | Empty values | Completion |
|--------|-----------|---------|----------|--------------|------------|
| es (source) | 411 | — | — | 0 | 100% |
| en | 411 | 0 | 0 | 0 | 100% |
| fr | 411 | 0 | 0 | 0 | 100% |
| de | 411 | 0 | 0 | 0 | 100% |
| pt | 411 | 0 | 0 | 0 | 100% |
| ast | 411 | 0 | 0 | 0 | 100% |

Placeholder integrity: verified. Every interpolation token ({current}, {total},
{title}, etc.) present in a Spanish string appears identically in all other
locales. 0 mismatches across all 411 keys x 5 target locales.

### Story Translations (content/translations/story-translations.ts)

113 story slugs carry translations. Each slug has entries for all 5 target
locales (en, fr, de, pt, ast), and each entry has a title, subtitle, and
description.

- Records: 113 slugs x 5 locales = 565 translation records
- Fields present: title 565/565, subtitle 565/565, description 565/565
- Per-story gaps: 0
- Seed-slug coverage: all static seed slugs (seed-database.ts,
  seed-cycling-stories.ts, fallback-stories.json) have translations for every
  target locale (verified by story-translations-coverage.test.ts).

## Fixed

No translations were added or modified this cycle. Both the UI locale files and
the story translations were already at 100% parity.

## Remaining Gaps

None. All UI keys and all story translations are present for every supported
locale.

## Orphaned Keys

None. No key exists in a non-Spanish locale without a matching Spanish source.

## Verification

- Programmatic key-parity analysis: 411/411 keys for all 5 non-Spanish locales,
  0 missing, 0 orphaned, 0 empty.
- Placeholder-token consistency scan: 0 mismatches.
- Story translation completeness scan: 565/565 records complete (title,
  subtitle, and description all verified per record).
- Test suite: `npx vitest run src/lib/i18n/translations.test.ts
  src/lib/i18n/story-translations-coverage.test.ts --maxWorkers=4` — 105/105
  passing.
- Type check: `npx tsc --noEmit` — 0 errors in any i18n or translation file.
- Nothing committed (per agent rules — user reviews and commits manually; there
  was nothing to commit this cycle regardless).

## Cross-Agent Notes

No localization-relevant issues surfaced in the shared context from other agents
this cycle. The translation lazy-loading design (es + en static, fr/de/pt/ast
dynamic-imported) noted by prior Performance/Speed-Insights work remains
unaffected — this cycle added no translation content and made no structural
changes.
