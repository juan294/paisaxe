import type { Metadata } from "next";
import { LOCATION_CONFIG } from "@/config/location";
import { StoriesProvider } from "@/hooks/use-stories";

// LOCATION-SPECIFIC: Site URL from config
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${LOCATION_CONFIG.domain}`;

export const metadata: Metadata = {
  // LOCATION-SPECIFIC: Title uses site name
  title: `Guardados | ${LOCATION_CONFIG.siteName}`,
  // LOCATION-SPECIFIC: Description uses location name
  description: `Tus lugares guardados de ${LOCATION_CONFIG.name}.`,
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: `${SITE_URL}/favorites`,
  },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoriesProvider>{children}</StoriesProvider>;
}
