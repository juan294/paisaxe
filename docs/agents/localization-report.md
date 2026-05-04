# Localization Agent Report — 2026-05-04

## Summary

**Status: 100% complete across all 6 locales. No changes required.**

| Locale | UI Keys | Story Translations | Completion |
|--------|---------|-------------------|------------|
| es (Spanish — source) | 406 | 100 stories | Source of truth |
| en (English) | 406 | 100/100 | Complete |
| fr (French) | 406 | 100/100 | Complete |
| de (German) | 406 | 100/100 | Complete |
| pt (Portuguese) | 406 | 100/100 | Complete |
| ast (Asturian) | 406 | 100/100 | Complete |

- **UI key count**: 406 leaf keys per locale (up from 405 on 2026-04-30)
- **Story translations**: 100 stories x 5 non-ES locales = 500 records — all present (title + subtitle + description)
- **Missing keys**: 0
- **Orphaned keys**: 0
- **Type safety**: TypeScript project-wide check passes for all i18n source files

---

## Analysis

### UI Translations

All 6 locale files (`es.ts`, `en.ts`, `fr.ts`, `de.ts`, `pt.ts`, `ast.ts`) were read and compared against the Spanish source of truth using a key-path extractor that handles both single-quoted and double-quoted string values.

Key count methodology: values using double quotes (`"Chargement de l'assistant vocal..."`) are counted correctly alongside single-quoted values. The prior agent run's reported 405-key count was based on a counting script that missed double-quoted strings; the true count has been 406 since the `premium.loading_access` key was added in commit `1b450ac7`.

One key was added since the last run (2026-04-30):
- `premium.loading_access` — added in commit `1b450ac7` (fix: remediate launch UX accessibility issues). All 6 locales received this key simultaneously — no gap was created.

Structural parity confirmed: no nested section differs between locales. The `// LOCATION-SPECIFIC` comment pattern (for place names in `chat.image_alt`, `chat.privacy_notice`, `stories.locations.*`, `suggestions.location_*`, `favorites.empty_description`) is present in all locale files.

### Story Translations

Story translations parsed from `content/translations/story-translations.ts` (2853 lines, 100 story slugs). Each story slug was checked for locale blocks (en, fr, de, pt, ast) using depth-tracked brace counting to handle long story blocks correctly.

All 100 stories confirmed complete for all 5 non-ES locales.

---

## Changes Made

None. All translations were already complete.

---

## Fixed (this run)

None.

---

## Remaining Gaps

None.

---

## Orphaned Keys

None found. All keys in all non-ES locales correspond to a key in Spanish.

---

## Technical Notes

- TypeScript errors observed in `src/hooks/use-stream-chat.test.ts` (4 type errors: `undefined` not assignable to `string`) are pre-existing from recent wave-2 work and are unrelated to i18n files. The i18n source files themselves are type-safe.
- `voice.loading` in `fr.ts` (line 209) and `ast.ts` (line 209) uses double quotes due to apostrophes in the value. This is valid TypeScript and counts correctly against the 406-key total.
- Lazy-loading setup (es+en static imports, fr/de/pt/ast dynamic imports) remains unchanged. Bundle sizes stable at ~15 KB per locale file.

---
