interface JsonLdProps {
  type: "website" | "tourist-destination";
}

export function JsonLd({ type }: JsonLdProps) {
  const data =
    type === "website" ? getWebsiteData() : getTouristDestinationData();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function getWebsiteData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Paisaxe",
    url: "https://paisaxe.com",
    description:
      "Tu guía personal para explorar Asturias. Descubre paisajes, rutas, gastronomía y cultura.",
    inLanguage: ["es", "en"],
    potentialAction: {
      "@type": "SearchAction",
      target: "https://paisaxe.com/immersive?story={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
}

function getTouristDestinationData() {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: "Asturias",
    description:
      "Descubre Asturias: paisajes, rutas de senderismo, gastronomía, cultura y actividades en el norte de España.",
    url: "https://paisaxe.com/immersive",
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
      name: "Spain",
    },
  };
}
