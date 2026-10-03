import { NextResponse, type NextRequest } from "next/server";
import { ensurePaymentOrder } from "@/lib/booking/capture";
import { BookingError } from "@/lib/booking/types";
import { CAPABILITY_HEADERS, guardCapabilityRoute } from "@/lib/booking/view";
import { logger } from "@/lib/logger";
import type { PaymentStartResponse } from "@/types/booking-page";

const ERROR_STATUS: Partial<Record<BookingError["code"], number>> = {
  hold_expired: 409,
  invalid_state: 409,
  payment_in_progress: 409,
  payment_unavailable: 503,
};

/**
 * POST /api/booking/bookings/<id>.<token>/payment
 *
 * The booking page's "Pagar con PayPal" button, twin of the
 * create_payment_order tool (plan F06 fallback): creates or reuses the
 * booking's one PayPal order and returns its approval link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  const guard = await guardCapabilityRoute(request, (await params).capability);
  if (guard instanceof NextResponse) return guard;
  const { admin, booking } = guard;

  try {
    const body: PaymentStartResponse = await ensurePaymentOrder(admin, booking.id);
    return NextResponse.json(body, { headers: CAPABILITY_HEADERS });
  } catch (error) {
    const status = error instanceof BookingError ? ERROR_STATUS[error.code] : undefined;
    if (error instanceof BookingError && status) {
      return NextResponse.json({ error: error.code }, { status, headers: CAPABILITY_HEADERS });
    }
    logger.error("[BOOKING_PAYMENT_START_FAILED]", {
      bookingId: booking.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not start the payment" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
