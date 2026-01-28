import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/stories-data", () => ({
  getStoriesFromDB: vi.fn().mockResolvedValue([
    { id: "story-1", slug: "lagos-covadonga", title: "Lagos" },
    { id: "story-2", slug: "ruta-cares", title: "Ruta del Cares" },
  ]),
}));

import sitemap from "./sitemap";

const SITE_URL = "https://paisaxe.com";

describe("sitemap", () => {
  it("returns static pages plus story entries", async () => {
    const entries = await sitemap();

    // Static pages
    expect(entries).toContainEqual(
      expect.objectContaining({ url: SITE_URL })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ url: `${SITE_URL}/immersive` })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ url: `${SITE_URL}/favorites` })
    );

    // Story pages
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: `${SITE_URL}/immersive?story=lagos-covadonga`,
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: `${SITE_URL}/immersive?story=ruta-cares`,
      })
    );
  });

  it("sets correct priorities", async () => {
    const entries = await sitemap();

    const home = entries.find((e) => e.url === SITE_URL);
    const immersive = entries.find(
      (e) => e.url === `${SITE_URL}/immersive`
    );
    const storyEntry = entries.find((e) => e.url?.includes("story="));

    expect(home?.priority).toBe(1);
    expect(immersive?.priority).toBe(0.9);
    expect(storyEntry?.priority).toBe(0.8);
  });

  it("sets changeFrequency on entries", async () => {
    const entries = await sitemap();

    const home = entries.find((e) => e.url === SITE_URL);
    expect(home?.changeFrequency).toBe("daily");
  });

  it("each entry has required fields", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url).toBeTruthy();
      expect(entry.lastModified).toBeDefined();
      expect(entry.changeFrequency).toBeTruthy();
      expect(entry.priority).toBeTypeOf("number");
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });

  describe("uses NEXT_PUBLIC_SITE_URL env var", () => {
    const CUSTOM_URL = "https://custom.example.com";

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", CUSTOM_URL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses env var for all URLs", async () => {
      const entries = await sitemap();
      for (const entry of entries) {
        expect(entry.url).toContain(CUSTOM_URL);
      }
    });
  });
});
