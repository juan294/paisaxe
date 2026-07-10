# Localization Report

Date: 2026-07-10
Agent: Paisaxe Localization Agent
Status: GREEN — 100% translation coverage across all 6 locales. No edits required.

## Summary

| Locale | UI leaf keys | Missing | Orphaned | Placeholder mismatches | Story records |
|--------|-------------:|--------:|---------:|-----------------------:|--------------:|
| es (source) | 411 | — | — | — | — |
| en | 411 | 0 | 0 | 0 | 113 |
| fr | 411 | 0 | 0 | 0 | 113 |
| de | 411 | 0 | 0 | 0 | 113 |
| pt | 411 | 0 | 0 | 0 | 113 |
| ast | 411 | 0 | 0 | 0 | 113 |

- UI strings: 411 leaf keys per locale. All 5 non-Spanish locales match the Spanish source exactly — 0 missing, 0 orphaned, 0 placeholder mismatches.
- Story translations: 113 stories x 5 target locales = 565 translation records. Every record has title, subtitle, and description present (0 partials, 0 empty fields).
- Completion: 100% for every locale, both UI strings and story content.
- Note: The task brief lists 5 locales (es, en, fr, de, pt). The codebase ships a 6th supported locale, ast (Asturianu), which is verified at full parity here as it has been in prior cycles.

## Verification method

Independent programmatic verification, not only the existing test suite:

1. Loaded all 6 locale modules via tsx and flattened each to its leaf-key set. Compared every non-Spanish locale against `es.ts` as source of truth for missing keys, orphaned keys, and placeholder drift (regex `\{[a-zA-Z_]+\}` — e.g. `{current}`, `{total}`, `{title}`). Result: 411/411 keys, all sets identical, all placeholders preserved.
2. Loaded `STORY_TRANSLATIONS` and checked all 113 slugs for presence and non-empty title/subtitle/description in en/fr/de/pt/ast. Result: 565/565 records complete.
3. Ran the in-repo parity suites: `translations.test.ts` + `story-translations-coverage.test.ts` — 105/105 tests passing.
4. `npx tsc --noEmit -p tsconfig.json` — exit 0, 0 errors.

## Fixed

None. No translations were missing, orphaned, or malformed. No files were modified this cycle.

## Remaining gaps

None. All auto-generatable translations are present.

## Orphaned keys

None. No keys exist in any non-Spanish locale that are absent from the Spanish source.

## Cross-agent notes

- Coverage Agent's CI safety net (`translations.test.ts` dynamically compares each locale's key count to ES) continues to catch any future key addition that lands without locale parity — no drift can slip through unnoticed.
- No PII, tokens, or secrets present in any locale file or in `story-translations.ts` (relevant to Security Agent's recurring locale scan).
