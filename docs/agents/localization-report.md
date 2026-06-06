# Localization Report

Date: 2026-06-06
Agent: Paisaxe Localization Agent
Status: GREEN — 100% translation coverage across all 6 locales. No edits required this cycle. Sixtieth consecutive clean run (prior run 2026-06-05 was the 59th).

All supported locales are fully translated against the Spanish (es) source of
truth. No missing keys, no orphaned keys, no incomplete story records.

Supported locales: es (Spanish, default), en (English), fr (French), de (German),
pt (Portuguese), ast (Asturianu). Note: the codebase ships a sixth locale, ast,
in addition to the five named in the task brief. It is included in this audit and
is at full parity.

## 1. UI Translations (src/lib/i18n/*.ts)

Source of truth: es.ts with 406 leaf keys.

| Locale | Leaf keys | Missing | Orphaned | Coverage |
|--------|-----------|---------|----------|----------|
| es (source) | 406 | — | — | 100.00% |
| en | 406 | 0 | 0 | 100.00% |
| fr | 406 | 0 | 0 | 100.00% |
| de | 406 | 0 | 0 | 100.00% |
| pt | 406 | 0 | 0 | 100.00% |
| ast | 406 | 0 | 0 | 100.00% |

Method: programmatic leaf-key extraction from each locale module, compared as
sets against the es key set. Every non-Spanish locale has exactly the same 406
keys, with zero missing and zero orphaned. Placeholder tokens (e.g. {current})
and nested key structure are identical across all locales.

## 2. Story Translations (content/translations/story-translations.ts)

| Metric | Value |
|--------|-------|
| Story slugs with translations | 100 |
| Target locales per story | 5 (en, fr, de, pt, ast) |
| Target-locale records expected | 500 |
| Records with missing/empty title, subtitle, or description | 0 |

Spanish (es) story fields live in the main story record, not in this file (by
design), so the file holds the 5 non-default locales. Every one of the 100
stories has complete title + subtitle + description for all 5 target locales.

### Cross-check against story data sources

- content/fallback-stories.json (tracked): 8 slugs — all 8 are translated. Pass.
- content/processed/generated-stories.json and extracted-stories.json: these are
  gitignored intermediate pipeline artifacts (confirmed via git check-ignore),
  not the production source of truth. They contain 13 slugs with no translations
  (listed below under Remaining gaps). They are extraction/generation
  intermediates that are deduplicated and reconciled before DB seeding; 16 of the
  100 translated slugs do not appear in these JSON files at all, confirming the
  translations file tracks the seeded database, not these intermediates.

The production source of truth is the Supabase stories table (reconciled by slug
in scripts/seed-translations.ts). The translations file has been maintained
against it and remains at 100% for the seeded story set.

## 3. Fixes Applied

None. All locales were already at 100% parity. No keys added, no story records
added, no files modified this cycle. The translations.test.ts suite dynamically
compares each locale's key count to Spanish, so any future key addition without
locale parity is caught in CI automatically — there were no such additions since
the last run.

## 4. Remaining Gaps

No gaps in the production translation set.

The following 13 slugs exist only in gitignored intermediate pipeline artifacts
(content/processed/generated-stories.json and extracted-stories.json) and have no
translations. They are not part of the tracked/seeded production story set, so no
translations were auto-generated for them. If any are promoted into the seeded
database in the future, they will need en/fr/de/pt/ast translations added:

- castro-coana-asentamiento-prerromano
- senda-del-oso-teverga
- iglesia-santa-cristina-lena
- cuevas-arte-rupestre-oriente
- playas-salvajes-cudillero
- huellas-dinosaurios-costa-jurasica
- palacio-selgas-occidente
- ruta-cares-picos-europa
- bufones-de-pria
- descenso-del-sella
- museo-del-jurasico-muja
- gastro-fabada-asturiana
- gastro-sidra-asturiana

Recommendation: leave as-is. These are not in the production story set and
translating speculative pipeline intermediates would add unused records.

## 5. Orphaned Keys

None. No keys exist in any non-Spanish locale that are absent from the Spanish
source.

## 6. Verification

- Translation parity tests: Pass — 102 / 102 tests passing
  (src/lib/i18n/translations.test.ts).
- TypeScript: Pass — 0 errors in any i18n or story-translations file
  (tsc --noEmit, project config).
- Verification scripts were temporary and removed after the run; no source files
  were modified.

## 7. Cross-Agent Notes

- Performance Agent (Jun 3-5, RED bundle breach 3,398 KB / 3,100 KB): the i18n
  layer is not implicated. Translation files are ~15 KB each and use lazy-loading
  (es + en static imports, fr/de/pt/ast dynamic). No localization-driven bundle
  growth this cycle.
- Cost Analyst (Jun 6): no cost-related localization concerns. Translation
  content is static and incurs no per-request cost.
