import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { captureApprovedOrder } from "@/lib/booking/capture";
import { CAPABILITY_HEADERS, guardCapabilityRoute } from "@/lib/booking/view";
import { logger } from "@/lib/logger";
import type { CaptureOutcome, CaptureRequest, CaptureResponse } from "@/types/booking-page";

const bodySchema: z.ZodType<CaptureRequest> = z.object({
  capability: z.string().min(1).max(200),
  orderId: z.string().min(1).max(64),
});

const OUTCOME_STATUS: Record<CaptureOutcome, number> = {
  confirmed: 200,
  pending: 202,
  awaiting_approval: 202,
  slot_gone: 409,
  mismatch: 409,
  compensating: 409,
  failed: 409,
};

const outcome = (value: CaptureOutcome) =>
  NextResponse.json({ outcome: value } satisfies CaptureResponse, { status: OUTCOME_STATUS[value], headers: CAPABILITY_HEADERS });

/**
 * POST /api/booking/payments/capture {capability, orderId}
 *
 * Called by the return page with PayPal's `token` (the order id). Runs the
 * single capture path (plan F02); the webhook and reconciliation reach the
 * same outcome without the browser.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: CAPABILITY_HEADERS });
  }

  const guard = await guardCapabilityRoute(request, parsed.data.capability);
  if (guard instanceof NextResponse) return guard;
  const { admin, booking } = guard;

  try {
    return outcome(await captureApprovedOrder(admin, booking.id, "return", parsed.data.orderId));
  } catch (error) {
    logger.error("[BOOKING_CAPTURE_FAILED]", {
      bookingId: booking.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not confirm the payment" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
