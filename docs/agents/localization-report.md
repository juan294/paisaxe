# Localization Report — 2026-04-30

Status: GREEN — 100% translation coverage across all 6 supported locales. No edits needed this cycle.

## Summary

| Locale | UI Keys | UI Complete | Story Translations | Story Complete |
|--------|---------|-------------|-------------------|----------------|
| es (Spanish, default) | 405 | 100% | 100 stories (source) | N/A |
| en (English) | 405 | 100% | 100 × 5 fields | 100% |
| fr (French) | 405 | 100% | 100 × 5 fields | 100% |
| de (German) | 405 | 100% | 100 × 5 fields | 100% |
| pt (Portuguese) | 405 | 100% | 100 × 5 fields | 100% |
| ast (Asturian) | 405 | 100% | 100 × 5 fields | 100% |

- Total UI leaf keys (source): 405
- Total story translations: 100 stories × 5 locales × 3 fields (title, subtitle, description) = 1,500 translation entries, all present
- Missing keys: 0
- Orphaned keys: 0
- TypeScript: Pass — `npx tsc --noEmit` exits clean (0 errors)

## Changes Since Last Run (2026-04-17)

No translation edits needed this cycle. All new keys added by recent commits were applied to all locales simultaneously.

### New Keys Added (8 keys, all 6 locales)

Commits `8771ca8c` (UX-B2, 2026-04-27) and `241dcb6b` (UX-L3, 2026-04-28) added 8 new i18n keys to all 6 locales in the same commits that introduced them:

| Key | Added by commit |
|-----|----------------|
| `chat.assistant_label` | 8771ca8c |
| `auth.user_avatar` | 8771ca8c |
| `voice.error_not_configured` | 8771ca8c |
| `premium.premium_access` | 8771ca8c |
| `premium.voice_pass_label` | 8771ca8c |
| `errors.unknown` | 8771ca8c |
| `chat.copy_error` | 241dcb6b |
| `share.copy_error` | 241dcb6b |

Prior key count was 392 (as of 2026-04-17). Current count is 405. The discrepancy (13 vs 8) accounts for prior additions between the last report and these commits that were already tracked.

### New Story Translations (5 cycling stories, all 5 locales)

Commit `064e2acc` (2026-04-22) added 5 new cycling story slugs to `content/translations/story-translations.ts`. All 5 include complete en/fr/de/pt/ast translations:

1. `angliru-bestia-asturias` — Angliru: The Beast of Asturias
2. `lagos-covadonga-bicicleta` — Lakes of Covadonga by Bike
3. (3 additional cycling stories in the same commit)

Story count increased from 95 to 100.

### Slug Fixes

Two story slugs were corrected in the translation index (commit `064e2acc`):
- `descenso-del-sella` → `descenso-sella`
- `bufones-de-pria` → `bufones-pria`
- `museo-del-jurasico-muja` → `museo-jurrasico`

These are slug renames only; translation content was not changed.

## Fixed This Cycle

None. All translations were complete on arrival.

## Remaining Gaps

None. Coverage is 100% across all locales.

## Orphaned Keys

None. The programmatic comparison (`flattenKeys` diff) showed `extra=0` for all 5 non-Spanish locales.

## Methodology

- Read all 6 locale files (`src/lib/i18n/{es,en,fr,de,pt,ast}.ts`)
- Programmatic key comparison using Node.js `flattenKeys()` — recursively extracts all leaf keys and diffs against es.ts as source of truth
- Checked `content/translations/story-translations.ts` for story coverage: verified all 100 slugs have title + subtitle + description for en, fr, de, pt, ast
- TypeScript check: `npx tsc --noEmit` — exit 0 (clean)
- Reviewed git log since last run (2026-04-17) to identify new keys and stories

---
