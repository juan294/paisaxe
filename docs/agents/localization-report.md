# Localization Report — 2026-05-03

## Status: GREEN — 100% coverage across all 6 locales

## Summary

| Locale | UI keys | Missing | Orphans | Story translations |
|--------|---------|---------|---------|--------------------|
| es (Spanish, source) | 405 | n/a | n/a | n/a (source) |
| en (English) | 405 | 0 | 0 | 100/100 complete |
| fr (French) | 405 | 0 | 0 | 100/100 complete |
| de (German) | 405 | 0 | 0 | 100/100 complete |
| pt (Portuguese) | 405 | 0 | 0 | 100/100 complete |
| ast (Asturian) | 405 | 0 | 0 | 100/100 complete |

- **UI translation coverage**: 100% — every leaf key in `es.ts` (405) is present in all 5 other locales. No orphans (no keys in target locales without a Spanish source).
- **Story translation coverage**: 100% — 100 stories x 5 target locales = 500 translation records. Each contains `title`, `subtitle`, and `description`. Story count grew from 95 (2026-04-17) to 100 in commit `064e2acc` (5 new cycling stories).
- **Type safety**: Pass — `npx tsc --noEmit` exits clean (0 errors).
- **Parity test suite**: Pass — `src/lib/i18n/translations.test.ts` 102/102 tests passing (run time 956 ms).

## Fixed

Nothing this cycle. Coverage has been 100% for 44 consecutive days (since 2026-03-21).

## Remaining gaps

None.

## Orphaned keys

None across any of the 5 target locales.

## Verification method

1. Read `src/lib/i18n/{es,en,fr,de,pt,ast}.ts` and `content/translations/story-translations.ts`.
2. Recursively collected all leaf keys (string-valued paths) from each locale file.
3. Diffed each target locale against Spanish (source) for both directions (missing + orphan).
4. Iterated the `STORY_TRANSLATIONS` map and confirmed every entry has all three fields populated for `en`, `fr`, `de`, `pt`, `ast`.
5. Ran the existing parity test suite (`translations.test.ts`) which programmatically enforces (a) equal key counts, (b) full-key bidirectional inclusion, (c) no empty string values, (d) diacritic correctness in fr/de/pt/es, (e) presence of all essential keys in every locale.
6. Ran project-wide `tsc --noEmit` to confirm no type drift.

## Housekeeping

- One temporary diagnostic script (`scripts/tmp-i18n-audit.mjs`) was created during this run to cross-verify the parity-test results outside vitest. The sandbox blocked deletion; please remove it manually with `rm scripts/tmp-i18n-audit.mjs` (it is not used by any other code path).
