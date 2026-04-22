# Localization Report — 2026-04-22

## Summary

| Locale | UI Keys | Missing | Orphan |
|--------|---------|---------|--------|
| es (source of truth) | 395 | — | — |
| en | 395 | 0 | 0 |
| fr | 395 | 0 | 0 |
| de | 395 | 0 | 0 |
| pt | 395 | 0 | 0 |
| ast | 395 | 0 | 0 |

**UI coverage: 100% (6/6 locales, 395 leaf keys each)**

| Story translations | Count |
|--------------------|-------|
| Translation entries | 100 |
| Locales per entry | 5 (en, fr, de, pt, ast) |
| Fields per locale | 3 (title, subtitle, description) |
| Incomplete entries | 0 |

**Story translation coverage: 100% (100 stories × 5 locales × 3 fields = 1,500 translations, all present)**

TypeScript check: Pass. `npx tsc --noEmit` reports zero i18n- or translations-related errors.

## Fixed This Run

None. All translations are complete and stable since the last clean run. No missing keys, no orphan keys, no incomplete story entries.

## Remaining Gaps

None.

## Orphaned Keys

None — every non-Spanish key traces back to an es.ts source key.

## Changes Since Last Report (2026-04-17)

- UI key count increased from 392 → 395 (3 new leaf keys added under one of the existing sections; all locales already in sync).
- Story translation entries increased from 95 → 100 (5 new stories added to `STORY_TRANSLATIONS`, all with full en/fr/de/pt/ast coverage).
- Zero missing or orphan keys across any locale or any story.

## Notes

- `content/translations/story-translations.ts` shows as modified in `git status` — the modification is historical (translation additions from prior commits) already present in the working tree. No edits were made by this agent run.
- Spanish (es) remains the source of truth for both UI and story content. Story Spanish fields live on the story metadata itself, not in `story-translations.ts`.
- The project uses lazy-loaded locale bundles (es+en static, fr/de/pt/ast dynamic) — no performance impact from the unchanged key count.
