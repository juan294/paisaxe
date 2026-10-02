import type { Translations } from "./types";

/**
 * Recursively collect every leaf translation key using dot-notation
 * (e.g. "chat.placeholder"). Mirrors the collector used by
 * `src/lib/i18n/translations.test.ts` for key-parity checks.
 */
export function collectTranslationKeys(obj: Translations, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "string") {
      keys.push(fullKey);
    } else if (typeof value === "object" && value !== null) {
      keys.push(...collectTranslationKeys(value, fullKey));
    }
  }
  return keys;
}

export function getByPath(obj: Translations, path: string): string | Translations | undefined {
  return path.split(".").reduce<Translations | string | undefined>((acc, segment) => {
    if (acc && typeof acc === "object") return acc[segment];
    return undefined;
  }, obj);
}

/**
 * UX-M10 (#903): Compute translation coverage directly from each locale file
 * against the Spanish reference, instead of hand-maintaining a percentage
 * constant. A hand-maintained constant silently drifts out of sync with the
 * real file — 'ast' was pinned at a stale 40% long after the locale file
 * reached 81% real coverage, hiding a fully-usable locale from the switcher.
 *
 * A key counts as "translated" when its value differs from the Spanish
 * reference value at the same path (an untranslated key is typically a
 * verbatim copy of the Spanish string). Coverage is the percentage of
 * Spanish leaf keys with a translated (different) counterpart in the target
 * locale.
 *
 * This is a Node-safe module with no locale-file imports of its own, so it
 * can be shared between the build-time generator (scripts/generate-locale-
 * coverage.ts), the freshness test (locale-coverage.test.ts), and any other
 * server-only context — without pulling locale file bytes into a client
 * bundle. See locale-coverage.generated.ts for the client-facing constant.
 */
export function computeCoverage(reference: Translations, target: Translations): number {
  const referenceKeys = collectTranslationKeys(reference);
  if (referenceKeys.length === 0) return 0;
  let translated = 0;
  for (const key of referenceKeys) {
    if (getByPath(target, key) !== getByPath(reference, key)) translated++;
  }
  return Math.round((translated / referenceKeys.length) * 100);
}
