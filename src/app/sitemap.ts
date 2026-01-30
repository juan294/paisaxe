import type { MetadataRoute } from "next";
import { getStoriesFromDB } from "@/lib/stories-data";

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.es";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const stories = await getStoriesFromDB();

  const storyEntries: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${siteUrl}/immersive?story=${story.slug || story.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${siteUrl}/immersive`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${siteUrl}/favorites`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
    ...storyEntries,
  ];
}
