# Localization Report — 2026-04-25

Status: GREEN — 100% translation coverage across all 6 supported locales.

## Summary

| Locale | UI keys | Story translations | Completion |
|--------|---------|--------------------|-----------:|
| es (Spanish, source of truth) | 395 | 100 (base) | 100% |
| en (English)                  | 395 | 100 | 100% |
| fr (French)                   | 395 | 100 | 100% |
| de (German)                   | 395 | 100 | 100% |
| pt (Portuguese)               | 395 | 100 | 100% |
| ast (Asturian)                | 395 | 100 | 100% |

Note: The agent brief lists 5 supported locales (es, en, fr, de, pt). The codebase also ships `ast.ts` (Asturian/Bable) and `ast` story translations — included here for completeness since they follow the same invariants.

## UI Translations (src/lib/i18n/)

- Leaf key count: 395 per locale (up +3 from last report's 392 — three new keys propagated across all locales since 2026-04-17).
- Missing keys: 0 for every non-es locale.
- Orphaned keys (present in non-es but not in es): 0.
- Type safety: `npx tsc --noEmit` exits clean with 0 errors.

All placeholders (`{current}`, `{total}`, `{title}`, etc.) preserved exactly across locales.

## Story Translations (content/translations/story-translations.ts)

- Stories tracked: 100 (up +5 from last report's 95 — five new stories added and fully translated).
- Expected translations: 100 stories × 5 non-es locales = 500.
- Complete translations (title + subtitle + description): 500.
- Missing/incomplete: 0.

## Fixed

Nothing. No translations were missing, no orphans were present, and no type errors were introduced.

## Remaining gaps

None. Coverage has remained at 100% for 41 consecutive days (since 2026-03-15).

## Orphaned keys

None.

## Cosmetic carry-forward (non-blocking)

`fr.ts`, `de.ts`, `pt.ts` already have the 8 inline `// LOCATION-SPECIFIC` comments that reached parity on 2026-04-14 via triage commit `e858ef7`. Parity with `es.ts`, `en.ts`, `ast.ts` confirmed this run.

## Run notes

- Date: 2026-04-25
- Project: /Users/juan/code/paisaxe
- Command reference:
  - Key extraction via flattened `Translations` tree (leaf paths only, nested objects traversed).
  - Story check: every slug must have `title`, `subtitle`, `description` for each non-es locale.
  - Type validation: `npx tsc --noEmit` (project-wide, passes cleanly).
