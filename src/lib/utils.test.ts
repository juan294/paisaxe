import { describe, it, expect } from "vitest";
import { cn, toIntlLocale } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("should merge tailwind classes correctly", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
    });
  });

  // UX-M11 (#904): every visitor-facing date/time formatter must resolve the
  // app's active locale to an explicit BCP-47 Intl tag rather than relying on
  // the browser's locale (or passing the raw app locale value straight in).
  describe("toIntlLocale", () => {
    it("maps each supported app locale to an explicit BCP-47 tag", () => {
      expect(toIntlLocale("es")).toBe("es-ES");
      expect(toIntlLocale("en")).toBe("en-US");
      expect(toIntlLocale("fr")).toBe("fr-FR");
      expect(toIntlLocale("de")).toBe("de-DE");
      expect(toIntlLocale("pt")).toBe("pt-PT");
    });

    it("maps the Asturian app locale to an explicit tag rather than passing it through implicitly", () => {
      // Asturian doesn't have guaranteed ICU support in every runtime, so this
      // must be an explicit, deliberate mapping — not an accident of 'ast'
      // happening to also be a valid BCP-47 subtag.
      expect(toIntlLocale("ast")).toBe("ast");
    });

    it("produces a tag Intl.DateTimeFormat accepts without throwing for every supported locale", () => {
      const locales = ["es", "en", "fr", "de", "pt", "ast"] as const;
      for (const locale of locales) {
        expect(() => new Intl.DateTimeFormat(toIntlLocale(locale))).not.toThrow();
      }
    });
  });
});
