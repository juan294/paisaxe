# Localization Report

Date: 2026-06-04
Agent: Paisaxe Localization Agent
Status: GREEN — 100% translation coverage across all 6 locales. No edits required this cycle. Fifty-eighth consecutive clean run (prior run 2026-06-03 was the 57th).

## Summary

| Locale | UI leaf keys | Completion | Missing | Orphaned |
|--------|-------------|------------|---------|----------|
| es (source of truth) | 406 | 100.00% | — | — |
| en | 406 | 100.00% | 0 | 0 |
| fr | 406 | 100.00% | 0 | 0 |
| de | 406 | 100.00% | 0 | 0 |
| pt | 406 | 100.00% | 0 | 0 |
| ast | 406 | 100.00% | 0 | 0 |

Note: the project ships 6 locales. The agent brief lists 5 (es, en, fr, de, pt); Asturianu (`ast`) is the sixth supported locale, declared in `src/lib/i18n/types.ts` and shipped as `src/lib/i18n/ast.ts`. It is verified here alongside the others.

UI key parity was verified programmatically: every non-Spanish locale has exactly 406 leaf keys, matching Spanish one-for-one. Zero missing keys, zero orphaned keys.

### Story translations

| Metric | Value |
|--------|-------|
| Story slugs with translations | 100 |
| Target locales per story | 5 (en, fr, de, pt, ast) |
| Fully complete stories (5 locales x 3 fields) | 100 |
| Stories with any gap | 0 |
| Target-locale records | 500 (100 stories x 5 locales) |

Each story record carries `title`, `subtitle`, and `description`. All 500 target-locale records are present and non-empty.

Source-of-truth cross-check: all 25 unique story slugs defined in the seed scripts (`scripts/seed-database.ts`, `scripts/seed-cycling-stories.ts`) and all 8 slugs in `content/fallback-stories.json` are present in `STORY_TRANSLATIONS`. No source story is missing a translation entry.

## Fixed

No translations added this cycle. All locales were already at 100% parity. The `translations.test.ts` suite dynamically compares each locale's key count to Spanish, so any future key addition without locale parity is caught in CI automatically — there were no such additions since the last run.

## Remaining gaps

None. UI strings and story translations are both at 100% across all supported locales.

## Orphaned keys

None. No locale contains a key absent from the Spanish source.

## Type safety and tests

- Project-wide `npx tsc --noEmit` (tsconfig.json): Pass — 0 TypeScript errors.
- `src/lib/i18n/translations.test.ts`: Pass — 102 / 102 tests passing.
- The earlier-reported `src/lib/stripe.ts` apiVersion tsc concern (raised by other agents) does NOT reproduce in a clean type check here; per the Performance Agent (Jun 2) it was local `node_modules` install drift, not a develop-branch error. No localization impact either way.

## Location-specific content

The Spanish source file (`src/lib/i18n/es.ts`) flags location-specific strings (`stories.locations.*`, `suggestions.location_*`, `chat.image_alt`, `chat.privacy_notice`, `voice.*`, `favorites.empty_description`). All carry properly localized place names and persona references in every target locale — including Asturianu forms such as "Cuadonga" for Covadonga in the story set. No mis-localized place names were found.

## Methodology

- UI parity: dynamic import of all six locale modules, recursive leaf-key extraction, set comparison against Spanish.
- Story parity: dynamic import of `STORY_TRANSLATIONS`, per-slug check of all 5 target locales x 3 required fields for presence and non-empty value.
- Source cross-check: regex extraction of `slug:` entries from seed scripts and fallback JSON, compared against translated slugs.
- Verification scripts were temporary and removed after the run; no source files were modified.
