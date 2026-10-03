import { NextResponse, type NextRequest } from "next/server";
import { requireBookingAccess } from "@/lib/booking/gate";
import { consume } from "@/lib/booking/metering";
import { acceptQuote } from "@/lib/booking/quotes";
import { bookingCard } from "@/lib/booking/tools";
import { BookingError } from "@/lib/booking/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import type { QuoteAcceptResponse } from "@/types/booking-chat";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * POST /api/booking/quotes/[id]/accept
 *
 * The visitor's explicit acceptance of a quote (the button on the quote card;
 * never a model tool). Spends one booking attempt, then accept_quote holds the
 * places for 15 minutes and creates the pending_payment booking, idempotently.
 * Returns the booking card, the first carrier of the capability link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const access = await requireBookingAccess(request);
  if (access instanceof NextResponse) return access;
  const { id: quoteId } = await params;

  const admin = createAdminClient();
  const allowance = await consume(admin, access.redemption.id, "booking_attempts");
  if (!allowance.allowed) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429, headers: NO_STORE });
  }

  try {
    const { booking } = await acceptQuote(admin, access.userId, quoteId);
    const body: QuoteAcceptResponse = { card: bookingCard(booking) };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof BookingError && (error.code === "quote_expired" || error.code === "no_capacity")) {
      return NextResponse.json({ error: error.code }, { status: 409, headers: NO_STORE });
    }
    if (error instanceof BookingError && error.code === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    }
    logger.error("[BOOKING_ACCEPT_FAILED]", {
      quoteId,
      userId: access.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not accept the quote" }, { status: 500, headers: NO_STORE });
  }
}
