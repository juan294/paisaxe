/**
 * Regenerates src/lib/i18n/locale-coverage.generated.ts from the real locale
 * files. Run this whenever fr.ts/de.ts/pt.ts/ast.ts change.
 *
 * Node-only: importing the full locale files here is fine (this never runs
 * in the browser). LanguageSwitcher imports only the small generated
 * constant this script writes, so no locale-file bytes reach the client
 * bundle just to compute a coverage percentage.
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { es } from "../src/lib/i18n/es";
import { fr } from "../src/lib/i18n/fr";
import { de } from "../src/lib/i18n/de";
import { pt } from "../src/lib/i18n/pt";
import { ast } from "../src/lib/i18n/ast";
import { computeCoverage } from "../src/lib/i18n/coverage";
import type { Locale } from "../src/lib/i18n";
import type { Translations } from "../src/lib/i18n/types";

const LOCALE_FILES: Partial<Record<Locale, Translations>> = { fr, de, pt, ast };

const coverage: Partial<Record<Locale, number>> = Object.fromEntries(
  Object.entries(LOCALE_FILES).map(([code, data]) => [code, computeCoverage(es, data)])
) as Partial<Record<Locale, number>>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "src", "lib", "i18n", "locale-coverage.generated.ts");

const contents = `// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run generate-locale-coverage
// (or: tsx scripts/generate-locale-coverage.ts)
//
// UX-M10 (#903): measured UI translation coverage per locale (0-100%),
// computed from the real locale files at build time instead of a
// hand-maintained constant that can silently drift from reality.
import type { Locale } from "@/lib/i18n";

export const LOCALE_COVERAGE: Partial<Record<Locale, number>> = ${JSON.stringify(coverage, null, 2)};
`;

writeFileSync(outPath, contents);

for (const [code, pct] of Object.entries(coverage)) {
  console.log(`${code}: ${pct}%`);
}
