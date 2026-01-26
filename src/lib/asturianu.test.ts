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
});
