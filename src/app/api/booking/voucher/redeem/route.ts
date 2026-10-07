import { NextResponse, type NextRequest } from "next/server";
import { buildRateLimitHeaders } from "@/lib/chat-route-utils";
import { requireBookingSurface } from "@/lib/booking/gate";
import { redeemVoucher } from "@/lib/booking/vouchers";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { createAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/supabase-auth";

// Keyed on IP, not user: anyone can mint anonymous identities, so a per-user
// limit would not bound guessing. Codes are 32 random bytes; 10 tries a
// minute per IP makes brute force pointless.
const VOUCHER_REDEEM_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 10,
  maxEntries: 10_000,
};

/**
 * POST /api/booking/voucher/redeem {code}
 *
 * Redeems a voucher for the signed-in user (anonymous or Google): grants the
 * booking surface and a 24-hour voice pass, renewable by redeeming again.
 * 404 when the booking surface is closed (flag off or Preview); 401
 * anon_required without a session; 403 with reason invalid | expired |
 * exhausted. Never logs the code.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const closed = await requireBookingSurface();
  if (closed) return closed;

  const rateLimit = await checkRateLimit(`voucher-redeem:${getClientIp(request)}`, VOUCHER_REDEEM_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: buildRateLimitHeaders(rateLimit, true) }
    );
  }

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Sign-in required", code: "anon_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;

  let result;
  try {
    result = await redeemVoucher(createAdminClient(), user.id, body?.code);
  } catch (error) {
    logger.error("[VOUCHER_GRANT_FAILED]", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not redeem the voucher" }, { status: 500 });
  }

  if (result.status !== "ok") {
    return NextResponse.json({ error: "Voucher not accepted", reason: result.status }, { status: 403 });
  }

  return NextResponse.json({ ok: true, voicePassUntil: result.voicePassUntil, limits: result.limits });
}
