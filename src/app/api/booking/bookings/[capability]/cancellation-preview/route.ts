import { NextResponse, type NextRequest } from "next/server";
import { cancellationPreview } from "@/lib/booking/cancel";
import { BookingError } from "@/lib/booking/types";
import { CAPABILITY_HEADERS, guardCapabilityRoute } from "@/lib/booking/view";
import { logger } from "@/lib/logger";

/**
 * GET /api/booking/bookings/<id>.<token>/cancellation-preview
 *
 * What cancelling now would refund (PayPal hackathon plan, Phase 5). Read
 * only (F01): nothing is written, so leaving the preview changes nothing.
 * Contract in src/types/booking-page.ts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  const guard = await guardCapabilityRoute(request, (await params).capability);
  if (guard instanceof NextResponse) return guard;

  try {
    return NextResponse.json(await cancellationPreview(guard.admin, guard.booking), { headers: CAPABILITY_HEADERS });
  } catch (error) {
    if (error instanceof BookingError && error.code === "invalid_state") {
      return NextResponse.json({ error: "invalid_state" }, { status: 409, headers: CAPABILITY_HEADERS });
    }
    logger.error("[BOOKING_CANCEL_PREVIEW_FAILED]", {
      bookingId: guard.booking.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not compute the cancellation" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
