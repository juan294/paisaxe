import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "@/components/seo/json-ld";
import { Providers } from "./providers";
import { PostHogPageView } from "@/components/posthog-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://paisaxe.es";

const title = "Paisaxe | Descubre Asturias";
const description =
  "Tu guía personal para explorar Asturias. Descubre paisajes, rutas, gastronomía y cultura. Your personal guide to explore Asturias.";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  keywords: [
    "Paisaxe",
    "Asturias",
    "turismo",
    "tourism",
    "Spain",
    "travel",
    "sidra",
    "naturaleza",
    "Picos de Europa",
    "Oviedo",
    "Gijón",
  ],
  authors: [{ name: "Paisaxe" }],
  creator: "Paisaxe",
  publisher: "Paisaxe",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
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
    languages: {
      "es-ES": SITE_URL,
      "x-default": SITE_URL,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <JsonLd type="website" />
        <Providers>
          <PostHogPageView />
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
