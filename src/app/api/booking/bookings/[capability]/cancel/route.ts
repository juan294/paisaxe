import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { confirmCancellation } from "@/lib/booking/cancel";
import { BookingError } from "@/lib/booking/types";
import { CAPABILITY_HEADERS, guardCapabilityRoute } from "@/lib/booking/view";
import { logger } from "@/lib/logger";
import type { CancelRequest, CancelResponse } from "@/types/booking-page";

const bodySchema: z.ZodType<CancelRequest> = z.object({ expectedRefundCents: z.number().int().min(0) }).strict();

/**
 * POST /api/booking/bookings/<id>.<token>/cancel {expectedRefundCents}
 *
 * The only authorization of a cancellation (PayPal hackathon plan, Phase 5,
 * F01): the booking page's button and the chat card's button both call it,
 * and no model tool reaches it. The refund is always the server's own
 * computation; a mismatch with what the visitor saw is refused with the fresh
 * terms and writes nothing (R2-05). Contract in src/types/booking-page.ts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  const guard = await guardCapabilityRoute(request, (await params).capability);
  if (guard instanceof NextResponse) return guard;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: CAPABILITY_HEADERS });
  }

  try {
    const result = await confirmCancellation(guard.admin, guard.booking, parsed.data.expectedRefundCents);
    if (result.outcome === "terms_changed") {
      return NextResponse.json({ error: "terms_changed", terms: result.terms }, { status: 409, headers: CAPABILITY_HEADERS });
    }
    const body: CancelResponse = { status: result.status, refundCents: result.refundCents };
    return NextResponse.json(body, { headers: CAPABILITY_HEADERS });
  } catch (error) {
    if (error instanceof BookingError && error.code === "refund_unavailable") {
      return NextResponse.json({ error: "refund_unavailable" }, { status: 502, headers: CAPABILITY_HEADERS });
    }
    if (error instanceof BookingError && error.code === "invalid_state") {
      return NextResponse.json({ error: "invalid_state" }, { status: 409, headers: CAPABILITY_HEADERS });
    }
    logger.error("[BOOKING_CANCEL_FAILED]", {
      bookingId: guard.booking.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not cancel the booking" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
