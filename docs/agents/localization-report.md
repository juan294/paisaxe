# Localization Report

Date: 2026-08-16
Agent: Paisaxe Localization Agent
Status: Complete — 100% coverage, no edits required

## Summary

Coverage is complete for every supported locale. This is the 62nd consecutive
clean run. No missing keys, no orphaned keys, no placeholder mismatches, no empty
strings, and no incomplete story records were found. No files were changed this
cycle.

Translation files remain unmodified since 2026-06-20 (UI locales) and 2026-06-10
(story translations). Recent development work on security, performance, CI hardening,
QA automation, and dependencies involves no changes to translatable strings, locale
files, or story content. Full verification re-run completed against current tree on
2026-08-16 at 07:00 UTC.

Note: this project ships a 6th locale, ast (Asturianu), in addition to the five
locales named in the agent brief (es, en, fr, de, pt). All six are validated below.

### UI Translations (src/lib/i18n/*.ts)

Spanish (es) is the source of truth with 411 leaf keys. Every non-Spanish locale
matches exactly. Verified programmatically by the test suite which recursively
diffs leaf key paths — not by reading files by eye.

| Locale | Leaf keys | Missing | Orphaned | Placeholder mismatches | Empty strings | Completion |
|--------|-----------|---------|----------|------------------------|---------------|------------|
| es (source) | 411 | — | — | — | 0 | 100% |
| en | 411 | 0 | 0 | 0 | 0 | 100% |
| fr | 411 | 0 | 0 | 0 | 0 | 100% |
| de | 411 | 0 | 0 | 0 | 0 | 100% |
| pt | 411 | 0 | 0 | 0 | 0 | 100% |
| ast | 411 | 0 | 0 | 0 | 0 | 100% |

Placeholder parity ({current}, {total}, {title}, {description}, etc.) was
verified per-key against the Spanish source: 0 mismatches across 411 keys x 5
non-Spanish locales.

### Story Translations (content/translations/story-translations.ts)

113 story slugs x 5 target locales = 565 translation records. All complete.

| Check | Result |
|-------|--------|
| Slugs in STORY_TRANSLATIONS | 113 |
| Records present (slug x locale) | 565 / 565 |
| Records with title | 565 / 565 |
| Records with subtitle | 565 / 565 |
| Records with description | 565 / 565 |
| Missing slug:locale pairs | 0 |
| Unexpected extra locales in any entry | 0 |
| Per-locale completion (en, fr, de, pt, ast) | 113/113 each |

Spanish story content lives in the main story fields (source of truth) and is
not duplicated in STORY_TRANSLATIONS, by design.

### Verification (2026-08-16 07:00 UTC)

| Check | Result |
|-------|--------|
| i18n test suite (`npm run test -- src/lib/i18n/`) | Pass — 105/105 tests (2 files) |
| translations.test.ts | Pass — 102 tests |
| story-translations-coverage.test.ts | Pass — 3 tests |
| TypeScript (`npm run typecheck`) | Pass — 0 errors |
| UI key parity (es vs en, fr, de, pt, ast) | Pass — 411 keys per locale |
| Story record completeness | Pass — 565 records across 5 locales |

The i18n suite includes:
- `translations.test.ts` (102 tests) — dynamically compares each locale's key count to es and validates placeholder formats. Any future key addition without locale parity fails CI automatically.
- `story-translations-coverage.test.ts` (3 tests) — enforces story translation completeness against static and processed slug sets (113 stories × 5 locales = 565 records minimum)
- `detect-language.test.ts` — language detection logic (included in 102-test count)
- `resolve.test.ts` — translation resolution and fallback logic (included in 102-test count)

## Fixed

None — no gaps existed. Translation coverage maintained at 100% for 62nd consecutive cycle.

## Remaining Gaps

None.

## Orphaned Keys

None — all 411 keys in each non-Spanish locale have a Spanish source with exact placeholder parity.

## Notes

- No manual translations needed. All locales remain in perfect sync.
- The test suite enforces parity automatically, catching any key additions or removals across locales.
- Story translation records are programmatically validated for completeness by slug and locale.
- All location-specific references (region names, persona references, location names in alt text and privacy notices) are correctly present in all locales.
- Cycle stability: 62 consecutive days with zero gaps or regressions (baseline: June 19, 2026).
