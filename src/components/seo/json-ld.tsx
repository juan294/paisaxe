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
