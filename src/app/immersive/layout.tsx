import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Explora Asturias | Paisaxe",
  description:
    "Descubre Asturias a través de historias visuales inmersivas. Paisajes, rutas, gastronomía y cultura del norte de España.",
  openGraph: {
    title: "Explora Asturias | Paisaxe",
    description:
      "Descubre Asturias a través de historias visuales inmersivas.",
    url: "https://paisaxe.com/immersive",
    siteName: "Paisaxe",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explora Asturias | Paisaxe",
    description:
      "Descubre Asturias a través de historias visuales inmersivas.",
  },
  alternates: {
    canonical: "https://paisaxe.com/immersive",
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
