import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ImmersiveLayout, { metadata } from "./layout";

const SITE_URL = "https://paisaxe.com";

describe("ImmersiveLayout", () => {
  it("renders children", () => {
    const { getByText } = render(
      <ImmersiveLayout>
        <div>Test content</div>
      </ImmersiveLayout>
    );
    expect(getByText("Test content")).toBeInTheDocument();
  });

  it("renders JsonLd TouristDestination component", () => {
    const { container } = render(
      <ImmersiveLayout>
        <div>Content</div>
      </ImmersiveLayout>
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("TouristDestination");
  });

  describe("metadata", () => {
    it("has correct title", () => {
      expect(metadata.title).toBe("Explora Asturias | Paisaxe");
    });

    it("includes Open Graph tags", () => {
      const og = metadata.openGraph as Record<string, unknown>;
      expect(og).toBeDefined();
      expect(og.title).toBe("Explora Asturias | Paisaxe");
      expect(og.type).toBe("website");
      expect(og.siteName).toBe("Paisaxe");
      expect(og.locale).toBe("es_ES");
      expect(og.description).toBeTruthy();
      expect(og.url).toBe(`${SITE_URL}/immersive`);
    });

    it("includes OG image with dimensions", () => {
      const og = metadata.openGraph;
      expect(og!.images).toBeDefined();
      const images = og!.images as Array<{
        url: string;
        width: number;
        height: number;
        alt: string;
      }>;
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].width).toBe(1200);
      expect(images[0].height).toBe(630);
      expect(images[0].alt).toBeTruthy();
    });

    it("includes Twitter card tags", () => {
      const twitter = metadata.twitter as Record<string, unknown>;
      expect(twitter).toBeDefined();
      expect(twitter.card).toBe("summary_large_image");
      expect(twitter.title).toBe("Explora Asturias | Paisaxe");
      expect(twitter.description).toBeTruthy();
      expect(twitter.images).toBeDefined();
    });

    it("includes canonical URL", () => {
      expect(metadata.alternates?.canonical).toBe(
        `${SITE_URL}/immersive`
      );
    });
  });
});
