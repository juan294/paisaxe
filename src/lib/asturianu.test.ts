import { describe, it, expect } from "vitest";
import { getLabel } from "./asturianu";

describe("getLabel", () => {
  it("returns Spanish label when disabled", () => {
    expect(getLabel("ask_about", false)).toBe("Preguntar sobre esto");
  });

  it("returns Asturianu label when enabled", () => {
    expect(getLabel("ask_about", true)).toBe("Entrugame sobre esto");
  });

  it("returns the key as fallback for unknown keys", () => {
    expect(getLabel("nonexistent_key", false)).toBe("nonexistent_key");
    expect(getLabel("nonexistent_key", true)).toBe("nonexistent_key");
  });

  describe("specific labels", () => {
    it("ask_about: Spanish vs Asturianu", () => {
      expect(getLabel("ask_about", false)).toBe("Preguntar sobre esto");
      expect(getLabel("ask_about", true)).toBe("Entrugame sobre esto");
    });

    it("saved: Spanish vs Asturianu", () => {
      expect(getLabel("saved", false)).toBe("Guardados");
      expect(getLabel("saved", true)).toBe("Guardaos");
    });

    it("navigate: Spanish vs Asturianu", () => {
      expect(getLabel("navigate", false)).toBe("navegar");
      expect(getLabel("navigate", true)).toBe("navegar");
    });
  });

  describe("UX-H5 (#891): bookmarks button must never render a raw key", () => {
    it("has no 'bookmarks' entry — callers must use the existing 'saved' key instead", () => {
      // ASTURIANU_LABELS intentionally has no 'bookmarks' entry: 'saved' is the
      // semantically identical, already-translated key ("Guardados"/"Guardaos",
      // matching favorites.bookmarks in every locale file). A call site that
      // still asks for "bookmarks" would silently get the raw key back.
      expect(getLabel("bookmarks", false)).toBe("bookmarks");
      expect(getLabel("bookmarks", true)).toBe("bookmarks");
    });

    it("'saved' returns real Asturian text, never a raw key", () => {
      expect(getLabel("saved", true)).toBe("Guardaos");
      expect(getLabel("saved", true)).not.toBe("saved");
    });
  });
});
