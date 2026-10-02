/**
 * UX-M10 (#903) / bundle-size follow-up: locale-coverage.generated.ts is a
 * committed, generated file (scripts/generate-locale-coverage.ts) so
 * LanguageSwitcher never has to import the full locale files into the
 * client bundle just to compute a percentage. This test recomputes coverage
 * fresh from the real locale files and fails if the generated file has
 * drifted — the exact staleness bug UX-M10 originally fixed, now guarded
 * against for the generated file too.
 */
import { describe, it, expect } from "vitest";
import { es } from "./es";
import { fr } from "./fr";
import { de } from "./de";
import { pt } from "./pt";
import { ast } from "./ast";
import { computeCoverage } from "./coverage";
import { LOCALE_COVERAGE } from "./locale-coverage.generated";
import type { Locale } from "./index";
import type { Translations } from "./types";

describe("locale-coverage.generated.ts freshness", () => {
  const LOCALE_FILES: Partial<Record<Locale, Translations>> = { fr, de, pt, ast };

  it("matches coverage freshly computed from the real locale files", () => {
    const fresh: Partial<Record<Locale, number>> = Object.fromEntries(
      Object.entries(LOCALE_FILES).map(([code, data]) => [code, computeCoverage(es, data)])
    );

    expect(
      LOCALE_COVERAGE,
      "locale-coverage.generated.ts is stale — run `npm run generate-locale-coverage` and commit the result"
    ).toEqual(fresh);
  });
});
