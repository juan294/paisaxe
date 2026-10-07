import { NextResponse, type NextRequest } from "next/server";
import { guardOperatorRoute, releaseOperatorHold } from "@/lib/booking/operator";
import { CAPABILITY_HEADERS } from "@/lib/booking/view";
import { logger } from "@/lib/logger";

/**
 * POST /api/operator/<id>.<token>/holds/<holdId>/release  (CSRF via proxy)
 *
 * Releases one of the operator's merchant's live holds, freeing its places
 * (PayPal hackathon plan, Phase 5). An expired, consumed or already released
 * hold answers 409; another merchant's or an unknown hold answers 404.
 * Logged with the hold id only, never the capability.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string; holdId: string }> }
): Promise<NextResponse> {
  const { capability, holdId } = await params;
  const guard = await guardOperatorRoute(request, capability);
  if (guard instanceof NextResponse) return guard;

  try {
    const outcome = await releaseOperatorHold(guard.admin, guard.access.merchantId, holdId);
    if (outcome === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404, headers: CAPABILITY_HEADERS });
    if (outcome === "not_live") {
      return NextResponse.json({ error: "hold_not_live" }, { status: 409, headers: CAPABILITY_HEADERS });
    }
    logger.info("[OPERATOR_HOLD_RELEASED]", { holdId });
    return NextResponse.json({ released: true }, { headers: CAPABILITY_HEADERS });
  } catch (error) {
    logger.error("[OPERATOR_HOLD_RELEASE_FAILED]", { holdId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Could not release the hold" }, { status: 500, headers: CAPABILITY_HEADERS });
  }
}
