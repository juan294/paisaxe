/**
 * Default OpenGraph image for social sharing.
 *
 * LOCATION-SPECIFIC: This file contains location-specific branding.
 * When replicating, update the tagline in LOCATION_CONFIG or modify this file directly.
 */

import { ImageResponse } from "next/og";
import {
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
  OG_COLORS,
} from "@/lib/og-image-helpers";
import { LOCATION_CONFIG } from "@/config/location";

// LOCATION-SPECIFIC: Alt text uses site name and tagline
export const alt = `${LOCATION_CONFIG.siteName} — ${LOCATION_CONFIG.tagline}`;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const runtime = "edge";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${OG_COLORS.background} 0%, ${OG_COLORS.backgroundGradient} 50%, ${OG_COLORS.background} 100%)`,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: 80,
            height: 4,
            backgroundColor: OG_COLORS.accent,
            borderRadius: 2,
            marginBottom: 32,
            display: "flex",
          }}
        />

        {/* LOCATION-SPECIFIC: Site name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: OG_COLORS.text,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          {LOCATION_CONFIG.siteName}
        </div>

        {/* LOCATION-SPECIFIC: Tagline */}
        <div
          style={{
            fontSize: 28,
            color: OG_COLORS.textMuted,
            marginTop: 16,
            letterSpacing: "0.05em",
            display: "flex",
          }}
        >
          {LOCATION_CONFIG.tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
