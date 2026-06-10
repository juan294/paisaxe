# Localization Agent Report

Date: 2026-06-08
Agent: Paisaxe Localization Agent
Status: COMPLETE — gap found and fixed. 8 story translations added; 100% coverage restored.

## Summary

Supported locales: es (source of truth), en, fr, de, pt, ast.

UI translations are 100% complete and unchanged. Story translations had a real
gap this cycle: 8 freshly generated stories lacked target-locale translations.
All 8 were translated into the 5 target locales (en, fr, de, pt, ast) and added
to `content/translations/story-translations.ts`. Coverage is now 100% across all
locales and all stories.

This continues the pattern noted in the 2026-06-07 run: each cycle new stories
appear in the seeder pool, and the localization test does not assert per-story
slug coverage against seeder output, so these gaps are only caught by this
agent's programmatic cross-reference, not by CI.

### UI Strings (`src/lib/i18n/*.ts`)

| Locale | Leaf keys | Missing | Orphaned | Completion |
|--------|-----------|---------|----------|------------|
| es (source) | 406 | - | - | 100% |
| en | 406 | 0 | 0 | 100% |
| fr | 406 | 0 | 0 | 100% |
| de | 406 | 0 | 0 | 100% |
| pt | 406 | 0 | 0 | 100% |
| ast | 406 | 0 | 0 | 100% |

No UI string changes were needed. All five non-Spanish locales have exactly the
same 406 leaf keys as the Spanish source, with zero missing and zero orphaned
keys (verified programmatically by transpiling each locale module and diffing
leaf-key sets against es).

### Story Translations (`content/translations/story-translations.ts`)

| Metric | Before | After |
|--------|--------|-------|
| Stories with translations | 105 | 113 |
| Target-locale records (5 per story) | 525 | 565 |
| Stories missing one or more locales | 8 | 0 |
| Empty/missing title or description fields | 0 | 0 |

Canonical story slugs were collected from the union of all source seed files:
`content/processed/extracted-stories.json` (81), `seed-database.ts` (20),
`seed-cycling-stories.ts` (5), `content/processed/generated-stories.json` (8),
and `content/fallback-stories.json` (8) — 113 unique slugs after de-duplication.
After this cycle all 113 have full en/fr/de/pt/ast translations, and there are
zero translation entries without a canonical source.

Note: the pre-existing uncommitted diff on `story-translations.ts` (from the
2026-06-07 run, not yet committed) already introduced 5 stories — bufones-de-pria,
descenso-del-sella, museo-del-jurasico-muja, gastro-fabada-asturiana,
gastro-sidra-asturiana — taking the baseline from 100 to 105. Those were left
untouched.

## Fixed (translations added this cycle)

Eight generated stories (from `content/processed/generated-stories.json`, the
output of `scripts/generate-stories.ts`) had Spanish source content but no
target-locale translations. Each was translated into all 5 target locales
(title + subtitle + description), preserving tone and proper place names
(Coaña, Teverga, Lena, Aramo, Cudillero, Villaviciosa, Ribadesella, Selgas,
Cares, Picos de Europa) and the named bears Paca and Molina:

1. castro-coana-asentamiento-prerromano (Castro de Coaña)
2. senda-del-oso-teverga (Senda del Oso)
3. iglesia-santa-cristina-lena (Iglesia de Santa Cristina de Lena)
4. cuevas-arte-rupestre-oriente (Cuevas de Arte Rupestre)
5. playas-salvajes-cudillero (Playas Rocosas de Cudillero)
6. huellas-dinosaurios-costa-jurasica (Huellas de Dinosaurios)
7. palacio-selgas-occidente (Palacio de Selgas)
8. ruta-cares-picos-europa (Ruta del Cares)

Total: 8 stories x 5 locales x 3 fields = 120 new translated strings.

## Remaining Gaps

None. All UI keys and all story translations are complete across all 6 locales.

## Orphaned Keys

None. No keys exist in any non-Spanish UI locale that are absent from the
Spanish source, and no story-translation entry exists without a canonical
source slug.

## Verification

- Type safety: `npx tsc --noEmit -p tsconfig.json` — 0 errors.
- Translation tests: `src/lib/i18n/translations.test.ts` — 102 / 102 passing.
  The test dynamically compares each UI locale's leaf-key count to the Spanish
  source, so any future UI key addition without locale parity fails CI
  automatically.
- Coverage re-verification: programmatic re-scan after edits confirms 113 / 113
  stories complete and 406 / 406 UI keys per locale.

## Recurring Recommendation (carried from 2026-06-07)

The localization test (`translations.test.ts`) covers UI-string parity but does
NOT assert per-story translation completeness for `STORY_TRANSLATIONS` against the
seeder slug pool. This is why generated stories repeatedly ship without
translations until this agent runs. A small CI test that loops the canonical slug
union (extracted + generated + fallback + seed-database + seed-cycling) and
asserts each story has all 5 target locales with non-empty title/description would
close this gap permanently. Recommended owner: Coverage Agent.

## Cross-Agent Notes

- Performance Agent: this cycle ADDS ~6 KB of static content to
  `story-translations.ts` (8 stories x 5 locales). This file feeds the seed
  script (`seed-translations.ts`) and is not part of the client bundle, so there
  is no first-load impact. The confirmed 3,398 KB / 3,100 KB bundle breach
  (ElevenLabs 605 KB deferred chunk) is outside localization scope.
- Coverage Agent: see recurring recommendation above.
- Security Agent: no PII, tokens, or secrets in any locale or story-translations
  file. Confirmed.
