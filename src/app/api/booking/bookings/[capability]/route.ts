import { NextResponse, type NextRequest } from "next/server";
import { CAPABILITY_HEADERS, guardCapabilityRoute, loadBookingView } from "@/lib/booking/view";

/**
 * GET /api/booking/bookings/<id>.<token>
 *
 * The booking page's status poll (PayPal hackathon plan, Phase 4). Authorized
 * by the capability alone; contract in src/types/booking-page.ts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  const guard = await guardCapabilityRoute(request, (await params).capability);
  if (guard instanceof NextResponse) return guard;

  return NextResponse.json(await loadBookingView(guard.admin, guard.booking), { headers: CAPABILITY_HEADERS });
}
