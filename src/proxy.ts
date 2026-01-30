import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://paisaxe.es",
  "https://www.paisaxe.es",
  "https://paisaxe.com",
  "https://www.paisaxe.com",
];

// Allow localhost in development
if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Handle preflight requests
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
    // Unknown origin preflight - respond without CORS headers
    return new NextResponse(null, { status: 204 });
  }

  // For actual requests
  const response = NextResponse.next();

  // Only add CORS headers if origin is allowed
  if (isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  // Same-origin requests (no Origin header) pass through unchanged

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
