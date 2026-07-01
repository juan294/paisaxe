import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import FavoritesLayout, { metadata } from "./layout";

vi.mock("@/lib/stories-data", () => ({
  FALLBACK_STORIES: [],
  getStoriesFromDB: vi.fn().mockResolvedValue([]),
}));

describe("FavoritesLayout", () => {
  it("renders children", () => {
    const { getByText } = render(
      <FavoritesLayout>
        <div>Test content</div>
      </FavoritesLayout>
    );
    expect(getByText("Test content")).toBeInTheDocument();
  });

  it("exports metadata with noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("exports correct title", () => {
    expect(metadata.title).toBe("Guardados | Paisaxe");
  });

  it("exports canonical URL", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://paisaxe.es/favorites"
    );
  });

  describe("SITE_URL fallback", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("falls back to LOCATION_CONFIG.domain when NEXT_PUBLIC_SITE_URL is unset", async () => {
      // SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${LOCATION_CONFIG.domain}`
      // -- exercise the || fallback branch for an empty env var.
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.resetModules();
      const { metadata: freshMetadata } = await import("./layout");
      expect(freshMetadata.alternates?.canonical).toBe(
        "https://paisaxe.es/favorites"
      );
    });
  });
});
