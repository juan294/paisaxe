/**
 * Root layout for the application.
 *
 * LOCATION-SPECIFIC: This file contains location-specific metadata.
 * When replicating, the LOCATION_CONFIG import will automatically
 * provide correct values if you've updated src/config/location.ts
 */

import type { Metadata, Viewport } from "next";
import { VercelAnalytics } from "@/components/analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { LOCATION_CONFIG } from "@/config/location";
import { getSiteUrl, getSupabaseUrl } from "@/lib/env";
import { es } from "@/lib/i18n/es";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { Suspense } from "react";
import { RequestPresentationProviderShell } from "./request-presentation-provider-shell";
import { PostHogPageView } from "@/components/posthog-provider";
import "./globals.css";

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
        // Existing original text/gradient generator; no photograph or place claim.
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: `${LOCATION_CONFIG.siteName} · Diseño tipográfico original`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    // LOCATION-SPECIFIC: Twitter description
    description: LOCATION_CONFIG.seo.description,
    images: [{ url: `${SITE_URL}/opengraph-image`, alt: `${LOCATION_CONFIG.siteName} · Diseño tipográfico original` }],
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
  // Request reads belong to the streamed server shell, leaving this root static.
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
      {/*
        UX-M1 (#894): explicit dark background, independent of the semantic
        `bg-background` token. The visitor app is all-dark (immersive UI) but
        never toggles `.dark` on <html> — only the admin theme provider does —
        so the token layer resolves to `:root`'s white `--background` here,
        producing a white flash on iOS overscroll. bg-neutral-950 (#0a0a0a)
        matches the `themeColor` above and the dark shade already used across
        the visitor UI. Consolidating the three parallel color systems (token
        layer, ad hoc Tailwind utilities, ~1,969 raw hex literals in admin) is
        tracked separately — see #938.
      */}
      <body className="font-sans antialiased bg-neutral-950">
        <JsonLd type="website" />
        <Suspense fallback={
          <div role="status" aria-busy="true" className="p-6 text-white">
            <p>{resolveTranslation("navigation.preparing", es)}</p>
            <p>{resolveTranslation("navigation.recovery", es)} <a href="/immersive" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{resolveTranslation("navigation.reload", es)}</a>.</p>
          </div>
        }>
        <RequestPresentationProviderShell>
          <PostHogPageView />
          <div id="main-content">
            {children}
          </div>
        </RequestPresentationProviderShell>
        </Suspense>
        <VercelAnalytics />
      </body>
    </html>
  );
}
