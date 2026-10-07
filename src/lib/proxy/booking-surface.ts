import { NextResponse, type NextRequest } from "next/server";
import { isBookingSurfaceOpen } from "@/lib/booking/surface";

/**
 * Real 404s for the voucher entry while the booking surface is closed (flag
 * off or Preview), and the /access → /acceso alias.
 *
 * The page cannot do this itself: under PPR (cacheComponents) the static
 * shell is already sent with 200 when its dynamic part calls notFound(). A
 * rewrite to a path no route matches renders the standard not-found page
 * with a 404 status. Only these two exact paths read the flag.
 */
const CLOSED_PATH = "/_booking-surface-closed";

export async function handleBookingSurface(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (pathname !== "/acceso" && pathname !== "/access") return null;

  if (!(await isBookingSurfaceOpen())) {
    return NextResponse.rewrite(new URL(CLOSED_PATH, request.url));
  }
  return pathname === "/access" ? NextResponse.redirect(new URL("/acceso", request.url), 307) : null;
}
