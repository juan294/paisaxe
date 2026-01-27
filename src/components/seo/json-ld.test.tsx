import { describe, it, expect } from "vitest";
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
    expect(data["@type"]).toBe("WebSite");
    expect(data.name).toBe("Paisaxe");
    expect(data.url).toBe("https://paisaxe.com");
  });

  it("renders tourist destination structured data", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
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

  it("includes search action for website", () => {
    const { container } = render(<JsonLd type="website" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.potentialAction).toBeDefined();
    expect(data.potentialAction["@type"]).toBe("SearchAction");
  });
});
