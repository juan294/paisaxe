// @vitest-environment node
//
// PE-H4 (#807): the Lighthouse CI job builds with dummy Supabase credentials,
// which makes `getStoriesFromDB()` / `getStoriesServer()` short-circuit to
// `FALLBACK_STORIES` (see src/lib/stories-data.ts and src/lib/stories-server.ts).
// Before this fix, content/fallback-stories.json held only 8 entries, so the
// Lighthouse performance budget (Perf >= 70%, LCP < 4s) was measuring roughly
// 1/9th of the real ~71-story payload.
//
// This test guards the fixture size directly so a future edit can't silently
// shrink it back down without failing CI. It intentionally does NOT assert
// FALLBACK_STORIES.length === 71: the real story count lives in the (gitignored)
// production database and content/processed/ pipeline output, neither of which
// is available in this fixture. Instead it asserts parity with the two static,
// committed sources of real story content that this fixture was expanded from:
// scripts/seed-database.ts (ALL_STORIES) and scripts/seed-cycling-stories.ts
// (cyclingStories) — the same slug lists that src/lib/i18n/story-translations-
// coverage.test.ts already requires to carry full 5-locale translation coverage
// regardless of this fixture's contents, so reusing them here adds no new
// translation debt.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Keep this in sync with SEED_DATABASE_SLUGS / SEED_CYCLING_SLUGS in
// src/lib/i18n/story-translations-coverage.test.ts — both lists enumerate the
// same static, rarely-changing story sources.
const SEED_DATABASE_SLUGS = [
  "lagos-covadonga", "oviedo-catedral", "fabada", "prerromanico", "ruta-cares",
  "playa-silencio", "sidra", "gijon", "aviles", "camino-santiago",
  "llanes", "cangas-onis", "descenso-sella", "quesos-asturianos", "museo-jurrasico",
  "senda-oso", "cudillero", "taramundi", "bufones-pria", "luarca",
];

const SEED_CYCLING_SLUGS = [
  "angliru-bestia-asturias", "lagos-covadonga-bicicleta", "vias-verdes-asturias",
  "ruta-costera-llanes-niembro", "camino-santiago-bicicleta",
];

const EXPECTED_SLUGS = new Set([...SEED_DATABASE_SLUGS, ...SEED_CYCLING_SLUGS]);

interface FallbackStory {
  id: string;
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  category: string;
  sourcePdf: string;
  location?: string;
  duration?: string;
}

function loadFallbackStories(): FallbackStory[] {
  const raw = readFileSync(
    join(process.cwd(), "content/fallback-stories.json"),
    "utf-8"
  );
  const parsed = JSON.parse(raw) as { stories: FallbackStory[] };
  return parsed.stories;
}

describe("content/fallback-stories.json (PE-H4 fixture size)", () => {
  const stories = loadFallbackStories();

  it("is production-representative, not the old 8-story fixture", () => {
    // Matches every static, translation-covered slug we expanded it with
    // (25), which is itself the regression guard against the old 8-story
    // fixture — if this ever shrinks back to 8, the exact-match fails.
    expect(stories.length).toBe(EXPECTED_SLUGS.size);
  });

  it("contains exactly the slugs from ALL_STORIES + cyclingStories (translation-covered)", () => {
    const actualSlugs = new Set(stories.map((s) => s.slug ?? s.id));
    expect(actualSlugs).toEqual(EXPECTED_SLUGS);
  });

  it("has unique, non-empty ids for every entry", () => {
    const ids = stories.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toBeTruthy());
  });

  it("has valid category/location/duration for every entry", () => {
    const validCategories = ["nature", "cities", "food", "culture", "activities"];
    const validLocations = ["eastern", "central", "western"];
    const validDurations = ["day-trip", "weekend", "week"];

    stories.forEach((story) => {
      expect(validCategories).toContain(story.category);
      expect(validLocations).toContain(story.location);
      expect(validDurations).toContain(story.duration);
      expect(story.title).toBeTruthy();
      expect(story.description).toBeTruthy();
      expect(story.image).toBeTruthy();
      expect(story.sourcePdf).toBeTruthy();
    });
  });
});
