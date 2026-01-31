import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Inter: () => ({
    variable: "--font-inter",
    className: "inter-font",
  }),
}));

// Mock language detection to return Spanish (jsdom defaults to English)
vi.mock("@/lib/i18n/detect-language", () => ({
  resolveLocale: () => "es",
  storeLocale: vi.fn(),
  detectBrowserLanguage: () => "es",
  getStoredLocale: () => null,
  mapLanguageTag: (tag: string) => tag.startsWith("es") ? "es" : tag.startsWith("en") ? "en" : null,
}));

const SITE_URL = "https://paisaxe.es";

describe("RootLayout", () => {
  describe("metadata", () => {
    it("should have correct title", () => {
      expect(metadata.title).toBe("Paisaxe | Descubre Asturias");
    });

    it("should have correct description", () => {
      // Description comes from LOCATION_CONFIG.seo.description
      expect(metadata.description).toContain("Asturias");
      expect(metadata.description).toContain("historias visuales");
    });

    it("should have relevant keywords", () => {
      // Keywords come from LOCATION_CONFIG.seo.keywords
      expect(metadata.keywords).toContain("Paisaxe");
      expect(metadata.keywords).toContain("Asturias");
      expect(metadata.keywords).toContain("turismo");
      expect(metadata.keywords).toContain("Spain");
      expect(metadata.keywords).toContain("travel");
      expect(metadata.keywords).toContain("sidra");
      expect(metadata.keywords).toContain("naturaleza");
    });

    it("should include metadataBase for resolving relative URLs", () => {
      expect(metadata.metadataBase).toBeDefined();
      expect(metadata.metadataBase!.toString()).toBe(`${SITE_URL}/`);
    });
  });

  describe("Open Graph tags", () => {
    it("should include og:title, og:type, og:site_name, and og:locale", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og).toMatchObject({
        title: "Paisaxe | Descubre Asturias",
        type: "website",
        siteName: "Paisaxe",
        locale: "es_ES",
      });
    });

    it("should include og:description", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og!.description).toBeTruthy();
      expect(og!.description).toContain("Asturias");
    });

    it("should include og:url pointing to site URL", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og!.url).toBe(SITE_URL);
    });

    it("should include og:image with dimensions and alt text", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og!.images).toBeDefined();
      const images = og!.images as Array<{
        url: string;
        width: number;
        height: number;
        alt: string;
      }>;
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].url).toContain("/images/");
      expect(images[0].width).toBe(1200);
      expect(images[0].height).toBe(630);
      expect(images[0].alt).toBeTruthy();
    });
  });

  describe("Twitter card tags", () => {
    it("should include twitter:card as summary_large_image", () => {
      const twitter = metadata.twitter as Record<string, unknown>;
      expect(twitter).toBeDefined();
      expect(twitter.card).toBe("summary_large_image");
    });

    it("should include twitter:title and twitter:description", () => {
      const twitter = metadata.twitter;
      expect(twitter).toBeDefined();
      expect(twitter!.title).toBe("Paisaxe | Descubre Asturias");
      expect(twitter!.description).toBeTruthy();
    });

    it("should include twitter:images", () => {
      const twitter = metadata.twitter;
      expect(twitter).toBeDefined();
      expect(twitter!.images).toBeDefined();
    });
  });

  describe("canonical URL", () => {
    it("should include canonical URL via alternates", () => {
      expect(metadata.alternates).toBeDefined();
      expect(metadata.alternates!.canonical).toBe(SITE_URL);
    });
  });

  describe("rendering", () => {
    it("should render children", () => {
      render(
        <RootLayout>
          <div data-testid="child">Test Child</div>
        </RootLayout>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Test Child")).toBeInTheDocument();
    });

    it("should set html lang to es", () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      );

      const html = document.documentElement;
      expect(html.getAttribute("lang")).toBe("es");
    });

    it("should apply font classes to body", () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      );

      const body = document.body;
      expect(body.className).toContain("font-sans");
      expect(body.className).toContain("antialiased");
    });

    it("should render JsonLd WebSite component", () => {
      const { container } = render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      );
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      expect(script).toBeInTheDocument();
      const data = JSON.parse(script!.textContent!);
      expect(data["@type"]).toBe("WebSite");
    });
  });
});
