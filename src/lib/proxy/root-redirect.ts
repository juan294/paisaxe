import { NextRequest, NextResponse } from "next/server";

/**
 * Redirect root path (/) to /immersive.
 *
 * Replaces the next.config.ts redirect (which ran at CDN level before the
 * proxy, bypassing canonical domain checks). Uses 308 (permanent, preserves
 * method) — /immersive is the canonical landing page.
 */
export function handleRootRedirect(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/") return null;

  const url = request.nextUrl.clone();
  url.pathname = "/immersive";
  return NextResponse.redirect(url, 308);
}
