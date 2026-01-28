import type { MetadataRoute } from "next";

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.com";
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
