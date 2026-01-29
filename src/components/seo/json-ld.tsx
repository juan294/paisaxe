import type { Story, StoryLocation } from "@/types/immersive";

interface JsonLdProps {
  type: "website" | "tourist-destination";
}

export function JsonLd({ type }: JsonLdProps) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.com";
  const data =
    type === "website"
      ? getWebsiteData(siteUrl)
      : getTouristDestinationData(siteUrl);

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function getWebsiteData(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Paisaxe",
    url: siteUrl,
    description:
      "Tu guía personal para explorar Asturias. Descubre paisajes, rutas, gastronomía y cultura.",
    inLanguage: ["es", "en"],
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/immersive?story={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function getTouristDestinationData(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: "Asturias",
    description:
      "Descubre Asturias: paisajes, rutas de senderismo, gastronomía, cultura y actividades en el norte de España.",
    url: `${siteUrl}/immersive`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: 43.3614,
      longitude: -5.8593,
    },
    touristType: [
      "Nature lovers",
      "Hikers",
      "Food enthusiasts",
      "Culture seekers",
      "Families",
    ],
    containedInPlace: {
      "@type": "Country",
      name: "España",
    },
  };
}

// Geo coordinates for Asturias regions
const LOCATION_COORDINATES: Record<StoryLocation, { lat: number; lng: number }> = {
  eastern: { lat: 43.35, lng: -4.85 },   // Cangas de Onís area
  central: { lat: 43.36, lng: -5.85 },   // Oviedo/Gijón area
  western: { lat: 43.54, lng: -6.55 },   // Cudillero/Luarca area
};

interface StoryJsonLdProps {
  story: Story;
}

export function StoryJsonLd({ story }: StoryJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.com";
  const storyUrl = `${siteUrl}/immersive?story=${story.slug || story.id}`;
  const imageUrl = story.image.startsWith("http")
    ? story.image
    : `${siteUrl}${story.image}`;

  // Get geo coordinates based on location, default to central Asturias
  const coords = story.location
    ? LOCATION_COORDINATES[story.location]
    : LOCATION_COORDINATES.central;

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
      name: "Paisaxe",
      url: siteUrl,
    },
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: "Asturias, España",
    },
  };

  // Add Restaurant-specific fields
  if (schemaType === "Restaurant") {
    return (
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...baseData,
            servesCuisine: "Asturian",
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
        __html: JSON.stringify({
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.com";

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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
