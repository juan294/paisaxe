import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "@/components/seo/json-ld";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.com";

const title = "Paisaxe | Descubre Asturias";
const description =
  "Tu guía personal para explorar Asturias. Descubre paisajes, rutas, gastronomía y cultura. Your personal guide to explore Asturias.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  keywords: ["Paisaxe", "Asturias", "turismo", "tourism", "Spain", "travel", "sidra", "naturaleza"],
  openGraph: {
    title,
    description:
      "Descubre Asturias a través de historias visuales inmersivas. Paisajes, gastronomía, cultura y naturaleza del norte de España.",
    url: SITE_URL,
    siteName: "Paisaxe",
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: `${SITE_URL}/images/stories/lagos-covadonga.png`,
        width: 1200,
        height: 630,
        alt: "Lagos de Covadonga, Asturias - Paisaxe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description:
      "Descubre Asturias a través de historias visuales inmersivas. Paisajes, gastronomía, cultura y naturaleza.",
    images: [`${SITE_URL}/images/stories/lagos-covadonga.png`],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <JsonLd type="website" />
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
