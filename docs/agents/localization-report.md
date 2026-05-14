# Localization Report — 2026-05-13

## Summary

**Status: Complete — 51st consecutive clean run. No edits made.**

All supported locales (es, en, fr, de, pt, ast) are at 100% translation coverage. No missing keys detected in UI strings or story translations.

### UI Translations (src/lib/i18n/)

| Locale | Code | Keys | Missing | Orphaned | Status |
|--------|------|------|---------|----------|--------|
| Spanish | es | 406 | 0 | — | Source of truth |
| English | en | 406 | 0 | 0 | Complete |
| French | fr | 406 | 0 | 0 | Complete |
| German | de | 406 | 0 | 0 | Complete |
| Portuguese | pt | 406 | 0 | 0 | Complete |
| Asturian | ast | 406 | 0 | 0 | Complete |

### Story Translations (content/translations/story-translations.ts)

| Locale | Covered Stories | Total Stories | Missing | Status |
|--------|----------------|---------------|---------|--------|
| English | 100 | 100 | 0 | Complete |
| French | 100 | 100 | 0 | Complete |
| German | 100 | 100 | 0 | Complete |
| Portuguese | 100 | 100 | 0 | Complete |
| Asturian | 100 | 100 | 0 | Complete |

## Verification

- **Test suite**: 102 / 102 translation tests passing (vitest).
- **Type check**: 0 TypeScript errors across all 6 locale files.
- **Key parity**: All 5 non-Spanish locales have exactly 406 leaf keys, dynamically verified by translations.test.ts at each CI run.
- **Story coverage**: 100 stories x 5 non-Spanish locales = 500 records, all present with title + subtitle + description.

## Fixed

No translations added this cycle. Coverage was already at 100%.

## Remaining Gaps

None. All locales complete.

## Orphaned Keys

None. All keys in all locales are present in the Spanish source.

## Notes

- The CI test (translations.test.ts) dynamically compares every locale's key count to Spanish. Any future key additions that lack parity across locales will fail CI automatically.
- Lazy-loading is configured: es and en are static imports; fr, de, pt, ast load on demand. Bundle sizes stable at approximately 15 KB per locale file.
- The Asturian (ast) locale uses the Pelayo persona variant "Pelayu" consistently throughout voice prompts, matching the regional spelling convention.

---
