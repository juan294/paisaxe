import { NextResponse, type NextRequest } from "next/server";
import { guardOperatorRoute, reissueBookingLink } from "@/lib/booking/operator";
import { CAPABILITY_HEADERS } from "@/lib/booking/view";
import { logger } from "@/lib/logger";

/**
 * POST /api/operator/<id>.<token>/bookings/<bookingId>/reissue-link  (CSRF via proxy)
 *
 * Revokes the visitor's booking link (link_version + 1) and returns the new
 * one, once (PayPal hackathon plan, Phase 5; failure mode "visitor lost the
 * booking link"). Another merchant's or an unknown booking answers 404.
 * Logged with the booking id only, never either capability.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string; bookingId: string }> }
): Promise<NextResponse> {
  const { capability, bookingId } = await params;
  const guard = await guardOperatorRoute(request, capability);
  if (guard instanceof NextResponse) return guard;

  try {
    const link = await reissueBookingLink(guard.admin, guard.access.merchantId, bookingId);
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CAPABILITY_HEADERS });
    logger.info("[OPERATOR_LINK_REISSUED]", { bookingId });
    return NextResponse.json({ link }, { headers: CAPABILITY_HEADERS });
  } catch (error) {
    logger.error("[OPERATOR_LINK_REISSUE_FAILED]", { bookingId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Could not re-issue the link" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
