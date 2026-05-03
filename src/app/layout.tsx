/**
 * Root layout for the application.
 *
 * LOCATION-SPECIFIC: This file contains location-specific metadata.
 * When replicating, the LOCATION_CONFIG import will automatically
 * provide correct values if you've updated src/config/location.ts
 */

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { VercelAnalytics } from "@/components/analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { LOCATION_CONFIG } from "@/config/location";
import { getSiteUrl, getSupabaseUrl } from "@/lib/env";
import { Providers } from "./providers";
import { PostHogPageView } from "@/components/posthog-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// LOCATION-SPECIFIC: Site URL from config
const SITE_URL = getSiteUrl() ?? `https://${LOCATION_CONFIG.domain}`;
const SUPABASE_URL = getSupabaseUrl();

// LOCATION-SPECIFIC: Title and description from config
const title = `${LOCATION_CONFIG.siteName} | Descubre ${LOCATION_CONFIG.name}`;
const description = LOCATION_CONFIG.seo.description;

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: LOCATION_CONFIG.siteName,
  },
  description,
  // LOCATION-SPECIFIC: Keywords from config
  keywords: [
    LOCATION_CONFIG.siteName,
    ...LOCATION_CONFIG.seo.keywords,
  ],
  authors: [{ name: LOCATION_CONFIG.siteName }],
  creator: LOCATION_CONFIG.siteName,
  publisher: LOCATION_CONFIG.siteName,
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
    // LOCATION-SPECIFIC: OpenGraph description
    description: LOCATION_CONFIG.seo.description,
    url: SITE_URL,
    siteName: LOCATION_CONFIG.siteName,
    type: "website",
    locale: LOCATION_CONFIG.seo.locale,
    images: [
      {
        // LOCATION-SPECIFIC: Default OG image
        url: `${SITE_URL}/images/stories/lagos-covadonga.webp`,
        width: 1200,
        height: 630,
        alt: `Lagos de Covadonga, ${LOCATION_CONFIG.name} - ${LOCATION_CONFIG.siteName}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    // LOCATION-SPECIFIC: Twitter description
    description: LOCATION_CONFIG.seo.description,
    images: [`${SITE_URL}/images/stories/lagos-covadonga.webp`],
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
    <html lang={LOCATION_CONFIG.primaryLanguage} suppressHydrationWarning>
      <head>
        {/* Supabase preconnects - critical for image loading LCP */}
        {SUPABASE_URL && (
          <>
            <link rel="dns-prefetch" href={SUPABASE_URL} />
            <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
          </>
        )}
        {/* Unsplash preconnect for external images */}
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link
          rel="preconnect"
          href="https://images.unsplash.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <JsonLd type="website" />
        <Providers>
          <PostHogPageView />
          <div id="main-content">
            {children}
          </div>
        </Providers>
        <VercelAnalytics />
      </body>
    </html>
  );
}
