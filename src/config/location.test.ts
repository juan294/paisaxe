import { describe, it, expect } from "vitest";
import { LOCATION_CONFIG, getRegionIds, getRegion, getRegionCoordinates } from "./location";

describe("location config", () => {
  describe("LOCATION_CONFIG", () => {
    it("should have Asturias as location name", () => {
      expect(LOCATION_CONFIG.name).toBe("Asturias");
      expect(LOCATION_CONFIG.country).toBe("Spain");
    });

    it("should have three regions", () => {
      const regionKeys = Object.keys(LOCATION_CONFIG.regions);
      expect(regionKeys).toHaveLength(3);
      expect(regionKeys).toEqual(["eastern", "central", "western"]);
    });
  });

  describe("getRegionIds", () => {
    it("should return all region IDs", () => {
      const ids = getRegionIds();
      expect(ids).toEqual(["eastern", "central", "western"]);
    });
  });

  describe("getRegion", () => {
    it("should return eastern region with correct data", () => {
      const region = getRegion("eastern");
      expect(region.id).toBe("eastern");
      expect(region.geo.lat).toBe(43.35);
      expect(region.geo.lng).toBe(-4.85);
      expect(region.places).toContain("Llanes");
    });

    it("should return central region with correct data", () => {
      const region = getRegion("central");
      expect(region.id).toBe("central");
      expect(region.places).toContain("Oviedo");
      expect(region.places).toContain("Gijón");
    });

    it("should return western region with correct data", () => {
      const region = getRegion("western");
      expect(region.id).toBe("western");
      expect(region.places).toContain("Cudillero");
    });
  });

  describe("getRegionCoordinates", () => {
    it("should return central coordinates when no ID provided", () => {
      const coords = getRegionCoordinates();
      expect(coords).toEqual(LOCATION_CONFIG.regions.central.geo);
    });

    it("should return central coordinates when null is provided", () => {
      const coords = getRegionCoordinates(null);
      expect(coords).toEqual(LOCATION_CONFIG.regions.central.geo);
    });

    it("should return specific region coordinates when valid ID provided", () => {
      const coords = getRegionCoordinates("eastern");
      expect(coords).toEqual(LOCATION_CONFIG.regions.eastern.geo);
    });

    it("should return western region coordinates", () => {
      const coords = getRegionCoordinates("western");
      expect(coords.lat).toBe(43.54);
      expect(coords.lng).toBe(-6.55);
    });

    it("should return central fallback for undefined ID cast", () => {
      const coords = getRegionCoordinates(undefined);
      expect(coords).toEqual(LOCATION_CONFIG.regions.central.geo);
    });
  });
});
