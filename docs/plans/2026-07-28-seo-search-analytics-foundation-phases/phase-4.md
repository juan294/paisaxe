# Phase 4: Keyword Discovery and Initial Guide Cluster

## Goal

Create a repeatable Spanish search-intent workflow and a useful initial guide hub
grounded in Paisaxe's existing content and voice.

## Files

- `scripts/seo/fetch-autocomplete-insights.mjs`
- `scripts/seo/fetch-autocomplete-insights.test.ts`
- `docs/analytics/seo/keyword-intent/README.md`
- generated dated keyword report
- `src/content/guides.ts`
- `src/app/guides/page.tsx`
- `src/app/guides/[slug]/page.tsx`
- `src/components/guides/*`
- guide metadata/JSON-LD/tests
- `src/app/sitemap.ts`
- navigation/footer/internal-link components

## Seed Categories

1. Asturias trip planning
2. Asturias without a car
3. Asturias with children
4. Asturias by season
5. Asturias food and cider
6. Asturias hiking and nature

Example Spanish seeds include `viaje a Asturias`, `Asturias sin coche`,
`Asturias con niños`, `Asturias en invierno`, `qué comer en Asturias`, and
`rutas en Asturias`.

## Steps

1. Port the Spoken Letter extractor as a pure/testable module plus CLI:
   - direct suggestion request;
   - selected alphabet expansion;
   - Spanish language and Spain market parameters;
   - rate limiting;
   - cross-seed deduplication;
   - deterministic Markdown output;
   - raw JSON artifact for later comparison.
2. Run it once and save a dated factual intent report.
3. Create `/guides` with a visible H1, description, and links to the first cluster.
4. Create:
   - `/guides/asturias-sin-coche`
   - `/guides/asturias-con-ninos`
   - `/guides/asturias-en-invierno`
5. Each guide must:
   - answer the intent directly in the opening section;
   - remain warm and non-salesy;
   - use visible H2/H3 structure;
   - link to relevant story landing pages;
   - link to official source material;
   - include practical caveats and last-reviewed date;
   - end with an immersive-discovery CTA;
   - use only licensed/existing imagery.
6. Add Article and Breadcrumb JSON-LD matching the visible page.
7. Add FAQ JSON-LD only for visible Q&A sections with substantive on-page answers.
8. Add guide routes to the sitemap with stable `lastModified`.
9. Add internal links from story landings and public navigation without changing
   the immersive interface's minimal core.
10. Instrument `guide_view` and `guide_cta_click`.

## Pseudocode

```text
for category in SEED_CATEGORIES:
  for seed in category:
    suggestions += fetch(seed, language="es", country="ES")
    for letter in SELECTED_LETTERS:
      suggestions += fetch(seed + " " + letter)
    persist(dedupe(normalize(suggestions)))

guide(slug):
  metadata = GUIDE_CONTENT[slug]
  render visible answer + source-backed sections + related stories + CTA
  render Article/Breadcrumb JSON-LD from the same metadata
```

## Automated Success Criteria

- Extractor tests cover parsing, deduplication, empty responses, rate-limit errors,
  deterministic output, and safe filenames.
- Each guide has unique metadata, canonical, one H1, visible source links,
  descriptive alt text, and valid JSON-LD.
- Sitemap includes the hub and three guide URLs exactly once.
- Internal-link tests prove every guide links to existing story slugs.
- Sequential typecheck, lint, test, build, E2E, prelaunch, and public-surface check
  pass.

## Manual Success Criteria

- Content reads naturally in Spanish and matches the project charter.
- All factual travel guidance is traceable to cited official sources.
- Each guide works without JavaScript for its core content.
- Mobile and desktop layouts preserve the image-first Paisaxe aesthetic.

## Stop Gate

Stop after content and visual review. Do not submit the new URLs to search engines
or IndexNow until they are released to production.
