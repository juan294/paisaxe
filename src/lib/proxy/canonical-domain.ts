import { NextRequest, NextResponse } from "next/server";
import { LOCATION_CONFIG } from "@/config/location";

/**
 * Redirect alternate/www domains to the primary canonical domain.
 *
 * Defense-in-depth: vercel.json "redirects" handle this at the CDN edge.
 * This handler is the second layer for preview deployments, direct IP access,
 * or future domain additions not yet in vercel.json.
 *
 * Uses 308 (permanent, preserves method) to avoid double-redirect chains like:
 *   paisaxe.com/ → 308 → paisaxe.com/immersive → 308 → paisaxe.es/immersive
 */
export function handleCanonicalDomain(request: NextRequest): NextResponse | null {
  const canonicalDomain = LOCATION_CONFIG.domain;
  const hostname = request.nextUrl.hostname;

  if (hostname === canonicalDomain) return null;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  const alternateDomains = [
    `www.${canonicalDomain}`,
    LOCATION_CONFIG.alternateDomain,
    LOCATION_CONFIG.alternateDomain ? `www.${LOCATION_CONFIG.alternateDomain}` : null,
  ].filter(Boolean);

  if (!alternateDomains.includes(hostname)) return null;

  const url = request.nextUrl.clone();
  url.host = canonicalDomain;
  url.port = "";
  url.protocol = "https";

  return NextResponse.redirect(url, 308);
}
