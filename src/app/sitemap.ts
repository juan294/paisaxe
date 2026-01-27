import type { MetadataRoute } from "next";
import { getStoriesFromDB } from "@/lib/stories-data";

const BASE_URL = "https://paisaxe.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stories = await getStoriesFromDB();

  const storyEntries: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${BASE_URL}/immersive?story=${story.slug || story.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/immersive`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/favorites`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
    ...storyEntries,
  ];
}
