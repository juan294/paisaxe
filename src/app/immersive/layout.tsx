import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.es";

const title = "Explora Asturias | Paisaxe";
const description =
  "Descubre Asturias a través de historias visuales inmersivas. Paisajes, rutas, gastronomía y cultura del norte de España.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description:
      "Descubre Asturias a través de historias visuales inmersivas. Paisajes, rutas, gastronomía y cultura.",
    url: `${SITE_URL}/immersive`,
    siteName: "Paisaxe",
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: `${SITE_URL}/images/stories/lagos-covadonga.png`,
        width: 1200,
        height: 630,
        alt: "Explora Asturias - Paisaxe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description:
      "Descubre Asturias a través de historias visuales inmersivas. Paisajes, rutas, gastronomía y cultura.",
    images: [`${SITE_URL}/images/stories/lagos-covadonga.png`],
  },
  alternates: {
    canonical: `${SITE_URL}/immersive`,
  },
};

export default function ImmersiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd type="tourist-destination" />
      {children}
    </>
  );
}
