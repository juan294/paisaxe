/**
 * JSON-LD structured data components for SEO.
 *
 * LOCATION-SPECIFIC: This file contains location-specific structured data.
 * When replicating, the LOCATION_CONFIG import will automatically
 * provide correct values if you've updated src/config/location.ts
 */

import type { Story, StoryLocation } from "@/types/immersive";
import { LOCATION_CONFIG, getRegionCoordinates } from "@/config/location";

/** Safe serialization for JSON-LD inside <script> tags — prevents </script>-injection XSS. */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

interface JsonLdProps {
  type: "website" | "tourist-destination";
}

export function JsonLd({ type }: JsonLdProps) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || `https://${LOCATION_CONFIG.domain}`;
  const data =
    type === "website"
      ? getWebsiteData(siteUrl)
      : getTouristDestinationData(siteUrl);

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

function getWebsiteData(siteUrl: string) {
  // LOCATION-SPECIFIC: Site identity from config
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: LOCATION_CONFIG.siteName,
    url: siteUrl,
    description: LOCATION_CONFIG.seo.description,
    inLanguage: [LOCATION_CONFIG.primaryLanguage, "en"],
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/immersive?story={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function getTouristDestinationData(siteUrl: string) {
  // LOCATION-SPECIFIC: Destination data from config
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: LOCATION_CONFIG.name,
    description: LOCATION_CONFIG.seo.description,
    url: `${siteUrl}/immersive`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: LOCATION_CONFIG.center.lat,
      longitude: LOCATION_CONFIG.center.lng,
    },
    touristType: [
      "Nature lovers",
      "Hikers",
      "Food enthusiasts",
      "Culture seekers",
      "Families",
    ],
    containedInPlace: {
      "@type": LOCATION_CONFIG.containedIn.type,
      name: LOCATION_CONFIG.containedIn.name,
    },
  };
}

// LOCATION-SPECIFIC: Geo coordinates for regions
// These are now imported from location config via getRegionCoordinates()

interface StoryJsonLdProps {
  story: Story;
}

export function StoryJsonLd({ story }: StoryJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${LOCATION_CONFIG.domain}`;
  const storyUrl = `${siteUrl}/immersive?story=${story.slug || story.id}`;
  const imageUrl = story.image.startsWith("http")
    ? story.image
    : `${siteUrl}${story.image}`;

  // LOCATION-SPECIFIC: Get geo coordinates based on region
  const coords = getRegionCoordinates(story.location as StoryLocation | undefined);

  // Food stories get Restaurant schema, everything else gets TouristAttraction
  const schemaType = story.category === "food" ? "Restaurant" : "TouristAttraction";

  const baseData = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: story.title,
    description: story.description,
    url: storyUrl,
    image: imageUrl,
    geo: {
      "@type": "GeoCoordinates",
      latitude: coords.lat,
      longitude: coords.lng,
    },
    isPartOf: {
      "@type": "WebSite",
      name: LOCATION_CONFIG.siteName,
      url: siteUrl,
    },
    // LOCATION-SPECIFIC: Containing place
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: `${LOCATION_CONFIG.name}, ${LOCATION_CONFIG.containedIn.name}`,
    },
  };

  // Add Restaurant-specific fields
  if (schemaType === "Restaurant") {
    return (
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            ...baseData,
            // LOCATION-SPECIFIC: Cuisine style
            servesCuisine: LOCATION_CONFIG.categories.cuisineStyle,
            priceRange: "$$",
          }),
        }}
      />
    );
  }

  // TouristAttraction schema
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: safeJsonLd({
          ...baseData,
          touristType: getTouristTypeForCategory(story.category),
        }),
      }}
    />
  );
}

function getTouristTypeForCategory(category: Story["category"]): string[] {
  switch (category) {
    case "nature":
      return ["Nature lovers", "Hikers", "Photographers"];
    case "activities":
      return ["Adventure seekers", "Sports enthusiasts", "Families"];
    case "culture":
      return ["Culture seekers", "History buffs", "Art lovers"];
    case "cities":
      return ["Urban explorers", "Shoppers", "Foodies"];
    default:
      return ["Tourists"];
  }
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${LOCATION_CONFIG.domain}`;

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "WebPage",
        "@id": item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
        name: item.name,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

interface FAQQuestion {
  question: string;
  answer: string;
}

interface FAQJsonLdProps {
  questions: FAQQuestion[];
}

export function FAQJsonLd({ questions }: FAQJsonLdProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
