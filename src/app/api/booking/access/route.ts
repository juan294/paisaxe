import { NextResponse, connection, type NextRequest } from "next/server";
import { requireBookingAccess } from "@/lib/booking/gate";

/** Per-user answer either way; never cached by a browser or CDN. */
const NO_STORE = "private, no-store";

/**
 * GET /api/booking/access
 *
 * {active: true, limits} for a user with an active voucher redemption; the
 * gate's 404 otherwise, so the booking entry stays invisible.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Per request: never prerender (the flag read would run at build time).
  await connection();
  const access = await requireBookingAccess(request);
  if (access instanceof NextResponse) {
    access.headers.set("Cache-Control", NO_STORE);
    return access;
  }

  return NextResponse.json(
    { active: true, limits: access.redemption.limits },
    { headers: { "Cache-Control": NO_STORE } }
  );
}
