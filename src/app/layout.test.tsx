import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
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

// RootLayout is an async server component that awaits headers() (FE-M4 server-side
// locale resolution). Mock next/headers so server-side locale resolution falls back
// to 'es' (no cookie / no Accept-Language), matching the default-locale expectations.
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({ get: () => null }),
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

  describe("content target", () => {
    it("renders a non-landmark #main-content target so route pages own the main landmark", async () => {
      const Component = await RootLayout({ children: <div data-testid="child">Child</div> });
      const { container } = render(Component);
      const mainTarget = container.querySelector("#main-content");
      expect(mainTarget).not.toBeNull();
      expect(mainTarget?.tagName).toBe("DIV");
      expect(container.querySelector("main#main-content")).toBeNull();
    });

    it("places children inside the #main-content target", async () => {
      const Component = await RootLayout({ children: <div data-testid="inner">Inner</div> });
      const { container } = render(Component);
      const mainTarget = container.querySelector("#main-content");
      expect(mainTarget).not.toBeNull();
      expect(mainTarget?.querySelector("[data-testid='inner']")).not.toBeNull();
    });
  });

  describe("preconnect links", () => {
    const layoutSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/layout.tsx"),
      "utf-8"
    );

    it("should not contain Google Fonts preconnect links (next/font self-hosts)", () => {
      expect(layoutSource).not.toContain("fonts.googleapis.com");
      expect(layoutSource).not.toContain("fonts.gstatic.com");
    });

    it("should keep Supabase preconnect links", () => {
      expect(layoutSource).toContain("getSupabaseUrl");
    });

    it("should keep Unsplash preconnect links", () => {
      expect(layoutSource).toContain("images.unsplash.com");
    });
  });

  describe("SITE_URL fallback", () => {
    afterEach(() => {
      vi.doUnmock("@/lib/env");
      vi.resetModules();
    });

    it("falls back to LOCATION_CONFIG.domain when getSiteUrl() returns undefined", async () => {
      // SITE_URL = getSiteUrl() ?? `https://${LOCATION_CONFIG.domain}` -- exercise
      // the ?? fallback for when NEXT_PUBLIC_SITE_URL is unset (getSiteUrl()
      // returns undefined per src/lib/env.ts).
      vi.doMock("@/lib/env", () => ({
        getSiteUrl: () => undefined,
        getSupabaseUrl: () => undefined,
      }));
      vi.resetModules();
      const { metadata: freshMetadata } = await import("./layout");
      expect(freshMetadata.metadataBase!.toString()).toBe("https://paisaxe.es/");
    });
  });

  describe("rendering", () => {
    it("should render children", async () => {
      const Component = await RootLayout({ children: <div data-testid="child">Test Child</div> });
      render(Component);

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Test Child")).toBeInTheDocument();
    });

    it("should set html lang to es", async () => {
      const Component = await RootLayout({ children: <div>Content</div> });
      render(Component);

      const html = document.documentElement;
      expect(html.getAttribute("lang")).toBe("es");
    });

    it("should apply font classes to body", async () => {
      const Component = await RootLayout({ children: <div>Content</div> });
      render(Component);

      const body = document.body;
      expect(body.className).toContain("font-sans");
      expect(body.className).toContain("antialiased");
    });

    it("should render JsonLd WebSite component", async () => {
      const Component = await RootLayout({ children: <div>Content</div> });
      const { container } = render(Component);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      expect(script).toBeInTheDocument();
      const data = JSON.parse(script!.textContent!);
      expect(data["@type"]).toBe("WebSite");
    });
  });
});
