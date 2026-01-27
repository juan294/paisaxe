import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/stories-data", () => ({
  getStoriesFromDB: vi.fn().mockResolvedValue([
    { id: "story-1", slug: "lagos-covadonga", title: "Lagos" },
    { id: "story-2", slug: "ruta-cares", title: "Ruta del Cares" },
  ]),
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("returns static pages plus story entries", async () => {
    const entries = await sitemap();

    // Static pages
    expect(entries).toContainEqual(
      expect.objectContaining({ url: "https://paisaxe.com" })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ url: "https://paisaxe.com/immersive" })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ url: "https://paisaxe.com/favorites" })
    );

    // Story pages
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://paisaxe.com/immersive?story=lagos-covadonga",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://paisaxe.com/immersive?story=ruta-cares",
      })
    );
  });

  it("sets correct priorities", async () => {
    const entries = await sitemap();

    const home = entries.find((e) => e.url === "https://paisaxe.com");
    const immersive = entries.find(
      (e) => e.url === "https://paisaxe.com/immersive"
    );
    const storyEntry = entries.find((e) => e.url?.includes("story="));

    expect(home?.priority).toBe(1);
    expect(immersive?.priority).toBe(0.9);
    expect(storyEntry?.priority).toBe(0.8);
  });

  it("sets changeFrequency on entries", async () => {
    const entries = await sitemap();

    const home = entries.find((e) => e.url === "https://paisaxe.com");
    expect(home?.changeFrequency).toBe("daily");
  });
});
