import { NextResponse, type NextRequest } from "next/server";
import { guardOperatorRoute, loadOperatorView } from "@/lib/booking/operator";
import { CAPABILITY_HEADERS } from "@/lib/booking/view";
import { logger } from "@/lib/logger";

/**
 * GET /api/operator/<id>.<token>
 *
 * The operator page's data (PayPal hackathon plan, Phase 5): the merchant's
 * bookings, live holds and capacity. Authorized by the operator capability
 * alone; a bad or expired one gets a real 404. Contract on OperatorView.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  const guard = await guardOperatorRoute(request, (await params).capability);
  if (guard instanceof NextResponse) return guard;

  try {
    return NextResponse.json(await loadOperatorView(guard.admin, guard.access), { headers: CAPABILITY_HEADERS });
  } catch (error) {
    logger.error("[OPERATOR_VIEW_FAILED]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Could not load the operator view" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
