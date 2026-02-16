import { describe, it, expect } from "vitest";
import {
  PLATFORM_BADGES,
  PLATFORM_NAMES,
  PLATFORM_CREDENTIALS,
  DAY_NAMES,
  statColorClasses,
} from "./constants";
import type { MarketingPlatform } from "@/types/marketing";

describe("constants", () => {
  describe("PLATFORM_BADGES", () => {
    it("has entries for all platforms", () => {
      const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest"];
      for (const p of platforms) {
        expect(PLATFORM_BADGES[p]).toBeDefined();
        expect(typeof PLATFORM_BADGES[p]).toBe("string");
        expect(PLATFORM_BADGES[p].length).toBeGreaterThan(0);
      }
    });

    it("returns correct badge values", () => {
      expect(PLATFORM_BADGES.x).toBe("X");
      expect(PLATFORM_BADGES.instagram).toBe("IG");
      expect(PLATFORM_BADGES.pinterest).toBe("Pi");
    });
  });

  describe("PLATFORM_NAMES", () => {
    it("has entries for all platforms", () => {
      const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest"];
      for (const p of platforms) {
        expect(PLATFORM_NAMES[p]).toBeDefined();
        expect(typeof PLATFORM_NAMES[p]).toBe("string");
        expect(PLATFORM_NAMES[p].length).toBeGreaterThan(0);
      }
    });

    it("returns correct display names", () => {
      expect(PLATFORM_NAMES.x).toBe("X (Twitter)");
      expect(PLATFORM_NAMES.instagram).toBe("Instagram");
      expect(PLATFORM_NAMES.pinterest).toBe("Pinterest");
    });
  });

  describe("PLATFORM_CREDENTIALS", () => {
    it("has entries for all platforms", () => {
      const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest"];
      for (const p of platforms) {
        expect(PLATFORM_CREDENTIALS[p]).toBeDefined();
        expect(Array.isArray(PLATFORM_CREDENTIALS[p])).toBe(true);
        expect(PLATFORM_CREDENTIALS[p].length).toBeGreaterThan(0);
      }
    });

    it("each credential field has required properties", () => {
      const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest"];
      for (const p of platforms) {
        for (const field of PLATFORM_CREDENTIALS[p]) {
          expect(field).toHaveProperty("key");
          expect(field).toHaveProperty("label");
          expect(field).toHaveProperty("placeholder");
          expect(field).toHaveProperty("required");
          expect(typeof field.key).toBe("string");
          expect(typeof field.label).toBe("string");
          expect(typeof field.placeholder).toBe("string");
          expect(typeof field.required).toBe("boolean");
        }
      }
    });

    it("X platform has 4 credential fields, all required", () => {
      const xCreds = PLATFORM_CREDENTIALS.x;
      expect(xCreds).toHaveLength(4);
      expect(xCreds.every((f) => f.required)).toBe(true);
    });

    it("Instagram platform has 3 credential fields with mixed required", () => {
      const igCreds = PLATFORM_CREDENTIALS.instagram;
      expect(igCreds).toHaveLength(3);
      const required = igCreds.filter((f) => f.required);
      const optional = igCreds.filter((f) => !f.required);
      expect(required).toHaveLength(1);
      expect(optional).toHaveLength(2);
    });

    it("Pinterest platform has 4 credential fields with mixed required", () => {
      const pinCreds = PLATFORM_CREDENTIALS.pinterest;
      expect(pinCreds).toHaveLength(4);
      const required = pinCreds.filter((f) => f.required);
      const optional = pinCreds.filter((f) => !f.required);
      expect(required).toHaveLength(1);
      expect(optional).toHaveLength(3);
    });

    it("credential keys are unique within each platform", () => {
      const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest"];
      for (const p of platforms) {
        const keys = PLATFORM_CREDENTIALS[p].map((f) => f.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
      }
    });
  });

  describe("DAY_NAMES", () => {
    it("has 7 day names", () => {
      expect(DAY_NAMES).toHaveLength(7);
    });

    it("starts with Sun and ends with Sat", () => {
      expect(DAY_NAMES[0]).toBe("Sun");
      expect(DAY_NAMES[6]).toBe("Sat");
    });

    it("contains all abbreviated day names", () => {
      expect(DAY_NAMES).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    });
  });

  describe("statColorClasses", () => {
    it("has blue, emerald, amber, and rose entries", () => {
      expect(statColorClasses).toHaveProperty("blue");
      expect(statColorClasses).toHaveProperty("emerald");
      expect(statColorClasses).toHaveProperty("amber");
      expect(statColorClasses).toHaveProperty("rose");
    });

    it("each entry contains light and dark mode classes", () => {
      for (const [, value] of Object.entries(statColorClasses)) {
        expect(value).toContain("text-");
        expect(value).toContain("dark:");
      }
    });

    it("returns correct class strings", () => {
      expect(statColorClasses.blue).toBe("text-blue-600 dark:text-blue-400");
      expect(statColorClasses.emerald).toBe("text-emerald-600 dark:text-emerald-400");
      expect(statColorClasses.amber).toBe("text-amber-600 dark:text-amber-400");
      expect(statColorClasses.rose).toBe("text-rose-600 dark:text-rose-400");
    });
  });
});
