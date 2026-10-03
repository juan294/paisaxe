import { NextResponse, connection, type NextRequest } from "next/server";
import { verifyBookingCapability } from "@/lib/booking/links";
import { isPreviewDeployment } from "@/lib/booking/surface";
import { createAdminClient } from "@/lib/supabase-admin";

/** Capability routes never cache, never send a Referer, never get indexed (plan F05). */
const CAPABILITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

/**
 * GET /booking/<id>.<token>
 *
 * PLACEHOLDER (PayPal hackathon plan, Phase 3 acceptance): the booking the
 * capability opens, as JSON. Phase 4 replaces this route with the booking
 * page. Like every capability route it needs no voucher and keeps working
 * after the flag is turned off; only a Preview deployment hides it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  await connection();
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: CAPABILITY_HEADERS });
  if (isPreviewDeployment()) return notFound();

  const { capability } = await params;
  const booking = await verifyBookingCapability(createAdminClient(), capability);
  if (!booking) return notFound();

  return NextResponse.json(
    {
      reference: booking.reference,
      status: booking.status,
      date: booking.slotDate,
      time: booking.slotTime,
      partySize: booking.partySize,
      totalCents: booking.totalCents,
      depositCents: booking.depositCents,
      balanceCents: booking.balanceCents,
      currency: booking.currency,
    },
    { headers: CAPABILITY_HEADERS }
  );
}
