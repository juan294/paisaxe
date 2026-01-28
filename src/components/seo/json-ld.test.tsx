import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd } from "./json-ld";

describe("JsonLd", () => {
  it("renders website structured data", () => {
    const { container } = render(<JsonLd type="website" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("WebSite");
    expect(data.name).toBe("Paisaxe");
    expect(data.url).toBe("https://paisaxe.com");
    expect(data.description).toBeTruthy();
    expect(data.inLanguage).toBeDefined();
  });

  it("renders tourist destination structured data", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("TouristDestination");
    expect(data.name).toBe("Asturias");
    expect(data.geo.latitude).toBe(43.3614);
    expect(data.geo.longitude).toBe(-5.8593);
  });

  it("includes geo coordinates for tourist destination", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.geo).toBeDefined();
    expect(data.geo["@type"]).toBe("GeoCoordinates");
  });

  it("includes containedInPlace for tourist destination", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.containedInPlace).toBeDefined();
    expect(data.containedInPlace["@type"]).toBe("Country");
    expect(data.containedInPlace.name).toContain("Espa");
  });

  it("includes touristType array for tourist destination", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.touristType).toBeDefined();
    expect(Array.isArray(data.touristType)).toBe(true);
    expect(data.touristType.length).toBeGreaterThan(0);
  });

  it("includes search action for website", () => {
    const { container } = render(<JsonLd type="website" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.potentialAction).toBeDefined();
    expect(data.potentialAction["@type"]).toBe("SearchAction");
  });

  describe("uses NEXT_PUBLIC_SITE_URL env var", () => {
    const CUSTOM_URL = "https://custom.example.com";

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", CUSTOM_URL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses env var URL for website type", () => {
      const { container } = render(<JsonLd type="website" />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.url).toBe(CUSTOM_URL);
    });

    it("uses env var URL for tourist destination type", () => {
      const { container } = render(<JsonLd type="tourist-destination" />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.url).toBe(`${CUSTOM_URL}/immersive`);
    });

    it("uses env var URL in search action target", () => {
      const { container } = render(<JsonLd type="website" />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.potentialAction.target).toContain(CUSTOM_URL);
    });
  });
});
