import { NextRequest, NextResponse } from "next/server";
import { LOCATION_CONFIG } from "@/config/location";

// Build allowed origins from config domains
const ALLOWED_ORIGINS: string[] = [
  `https://${LOCATION_CONFIG.domain}`,
  `https://www.${LOCATION_CONFIG.domain}`,
];

if (LOCATION_CONFIG.alternateDomain) {
  ALLOWED_ORIGINS.push(`https://${LOCATION_CONFIG.alternateDomain}`);
  ALLOWED_ORIGINS.push(`https://www.${LOCATION_CONFIG.alternateDomain}`);
}

if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
}

export { ALLOWED_ORIGINS };

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-csrf-token",
  "Access-Control-Max-Age": "86400",
};

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Handle CORS preflight requests for API routes.
 * Returns a preflight response or null to continue normal processing.
 */
export function handleCORS(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) return null;

  if (request.method === "OPTIONS") {
    if (isAllowedOrigin(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin!,
          ...CORS_HEADERS,
        },
      });
    }
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

/**
 * Add CORS response headers to API responses with allowed origins.
 */
export function addCORSHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get("origin");
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
    response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);
  }
}
