/**
 * Immersive page layout with tourist destination metadata.
 *
 * LOCATION-SPECIFIC: This file contains location-specific metadata.
 * When replicating, the LOCATION_CONFIG import will automatically
 * provide correct values if you've updated src/config/location.ts
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/seo/json-ld";
import { LOCATION_CONFIG } from "@/config/location";

// LOCATION-SPECIFIC: Site URL from config
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${LOCATION_CONFIG.domain}`;

// LOCATION-SPECIFIC: Title and description
const title = `Explora ${LOCATION_CONFIG.name} | ${LOCATION_CONFIG.siteName}`;
const description = LOCATION_CONFIG.seo.description;

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description: LOCATION_CONFIG.seo.description,
    url: `${SITE_URL}/immersive`,
    siteName: LOCATION_CONFIG.siteName,
    type: "website",
    locale: LOCATION_CONFIG.seo.locale,
    images: [
      {
        // LOCATION-SPECIFIC: Default OG image
        url: `${SITE_URL}/images/stories/lagos-covadonga.webp`,
        width: 1200,
        height: 630,
        alt: `Explora ${LOCATION_CONFIG.name} - ${LOCATION_CONFIG.siteName}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: LOCATION_CONFIG.seo.description,
    images: [`${SITE_URL}/images/stories/lagos-covadonga.webp`],
  },
  alternates: {
    canonical: `${SITE_URL}/immersive`,
  },
};

export default async function ImmersiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-csp-nonce") ?? undefined;

  return (
    <>
      <JsonLd type="tourist-destination" nonce={nonce} />
      {children}
    </>
  );
}
