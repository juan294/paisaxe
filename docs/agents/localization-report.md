# Localization Report

Date: 2026-07-17
Agent: Paisaxe Localization Agent
Status: Complete — 100% coverage, no edits required

## Summary

Coverage is complete for every supported locale. This is the 68th consecutive
clean run (prior clean run: 2026-07-16). No missing keys, no orphaned keys, no
empty string values, and no placeholder mismatches were found. No files were
changed this cycle.

Translation files remain unmodified since 2026-06-20 (UI locales) and 2026-06-10
(story translations). The only product-source change since the last cycle is
test-only (`src/lib/chat-action-detection.test.ts`, per the Coverage Agent's
2026-07-17 entry), so no new translatable strings could have been introduced.

Note: this project ships a 6th locale, ast (Asturianu), in addition to the five
locales named in the agent brief (es, en, fr, de, pt). All six are validated
below.

### UI Translations (src/lib/i18n/*.ts)

Spanish (es) is the source of truth with 411 leaf keys. Every non-Spanish locale
matches exactly. Verified programmatically by importing each locale module and
recursively diffing leaf key paths — not by reading the files by eye.

| Locale | Leaf keys | Missing | Orphaned | Empty values | Completion |
|--------|-----------|---------|----------|--------------|------------|
| es (source) | 411 | — | — | 0 | 100% |
| en | 411 | 0 | 0 | 0 | 100% |
| fr | 411 | 0 | 0 | 0 | 100% |
| de | 411 | 0 | 0 | 0 | 100% |
| pt | 411 | 0 | 0 | 0 | 100% |
| ast | 411 | 0 | 0 | 0 | 100% |

### Story Translations (content/translations/story-translations.ts)

113 story slugs x 5 target locales = 565 translation records. All complete.

| Field | Records present | Records missing |
|-------|-----------------|-----------------|
| title | 565 | 0 |
| subtitle | 565 | 0 |
| description | 565 | 0 |

## Fixed

Nothing. No missing or malformed translations existed to fix.

## Remaining Gaps

None.

## Orphaned Keys

None. No locale defines a key absent from the Spanish source.

## Verification Performed

- Key parity: all 6 locale modules imported and leaf-key paths diffed against es.
  411/411 in every locale, 0 missing, 0 orphaned.
- Empty-value scan: every leaf string checked for blank/whitespace-only content
  across all 6 locales. 0 found.
- Placeholder parity (new this cycle): every `{placeholder}` token in each es
  string compared against its counterpart in all 5 other locales. 0 mismatches
  across 411 keys x 5 locales. Prior cycles asserted placeholders were preserved
  but did not verify it programmatically; this now confirms it.
- Subtitle coverage (new this cycle): prior reports verified only title and
  description on story records, while the agent brief specifies subtitle as a
  translated field. Subtitle is present and non-empty on all 565 records — the
  previously unverified field turns out to be fully covered, so this closes a
  reporting gap rather than surfacing a defect.
- Type safety: `npx tsc --noEmit -p tsconfig.json` exits 0 with zero diagnostics.
  (Note: the brief's `npx tsc --noEmit src/lib/i18n/*.ts` form bypasses the
  project tsconfig and would typecheck under default compiler options rather than
  the project's strict settings; the project-scoped invocation is used instead.)
- Tests: 207/207 passing across 6 files under `src/lib/i18n/` (`translations`,
  `story-translations-coverage`, `detect-language`, `resolve`, `provider`,
  `provider.initiallocale`). Prior reports cited "105/105", which counted a
  narrower subset of this directory; the 207 figure reflects the full i18n test
  directory. No test count regression — the difference is reporting scope, not
  lost tests.

## Notes for Next Cycle

`src/lib/i18n/translations.test.ts` compares each locale's key count to es
dynamically, so any future key added to es without locale parity fails CI
automatically. The placeholder-parity and subtitle checks run in this cycle are
not yet encoded in that test file — they passed, but they are agent-side checks
rather than CI-enforced invariants. Worth adding to `translations.test.ts` if
locale drift ever becomes a recurring concern.
