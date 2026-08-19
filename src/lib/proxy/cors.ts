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
  ALLOWED_ORIGINS.push("http://localhost:3006");
}

// Allow the E2E test server origin (set in playwright.config.ts webServer.env).
// Guarded on VERCEL_ENV being unset (BE-M5 pattern) rather than NODE_ENV: Vercel
// sets VERCEL_ENV for every deployment (production, preview, staging), so its
// absence reliably means "running locally". NODE_ENV alone is not sufficient —
// Playwright sometimes runs against a local production build (`next build &&
// next start`), where NODE_ENV is "production" but VERCEL_ENV is still unset,
// and the E2E suite needs this origin honored in that case. (SE-L3)
if (process.env.PLAYWRIGHT_TEST_ORIGIN && process.env.VERCEL_ENV === undefined) {
  ALLOWED_ORIGINS.push(process.env.PLAYWRIGHT_TEST_ORIGIN);
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
