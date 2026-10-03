/**
 * What the booking page and its polling route show (PayPal hackathon plan,
 * Phase 4), and the capability check every booking-page route shares.
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRateLimitHeaders } from "@/lib/chat-route-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { createAdminClient } from "@/lib/supabase-admin";
import type { BookingView } from "@/types/booking-page";
import { verifyBookingCapability } from "./links";
import { isPreviewDeployment } from "./surface";
import type { Booking } from "./types";

/** Capability routes never cache, never send a Referer, never get indexed (plan F05). */
export const CAPABILITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

/**
 * The booking a capability opens, or null. Needs no voucher and keeps working
 * after the flag is turned off; only a Preview deployment hides it.
 */
export async function bookingForCapability(client: SupabaseClient, capability: string): Promise<Booking | null> {
  if (isPreviewDeployment()) return null;
  return verifyBookingCapability(client, capability);
}

// Polling every 5 s is 12 a minute; the pay and return calls fit beside it.
const CAPABILITY_ROUTE_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30, maxEntries: 10_000 };

/**
 * Shared front of the booking-page routes: a per-IP limit (before any
 * database read), then the capability. Returns the booking or the response.
 */
export async function guardCapabilityRoute(
  request: NextRequest,
  capability: string
): Promise<{ admin: SupabaseClient; booking: Booking } | NextResponse> {
  const rateLimit = await checkRateLimit(`booking-capability:${getClientIp(request)}`, CAPABILITY_ROUTE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CAPABILITY_HEADERS, ...buildRateLimitHeaders(rateLimit, true) } }
    );
  }
  const admin = createAdminClient();
  const booking = await bookingForCapability(admin, capability);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CAPABILITY_HEADERS });
  return { admin, booking };
}

export async function loadBookingView(client: SupabaseClient, booking: Booking): Promise<BookingView> {
  const [experience, payment, hold] = await Promise.all([
    client.from("experiences").select("title").eq("id", booking.experienceId).maybeSingle(),
    client
      .from("payments")
      .select("status, order_id, capture_id")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from("bookings").select("hold:holds(expires_at)").eq("id", booking.id).single(),
  ]);
  for (const result of [experience, payment, hold]) {
    if (result.error) throw new Error(`Failed to load booking view: ${result.error.message}`);
  }
  const holdRow = (hold.data as { hold: { expires_at: string } | null } | null)?.hold;

  return {
    reference: booking.reference,
    status: booking.status,
    experienceTitle: (experience.data?.title as string | undefined) ?? "",
    slotDate: booking.slotDate,
    slotTime: booking.slotTime,
    partySize: booking.partySize,
    totalCents: booking.totalCents,
    depositCents: booking.depositCents,
    balanceCents: booking.balanceCents,
    currency: booking.currency,
    cancellationWindowHours: booking.cancellationWindowHours,
    holdExpiresAt: booking.status === "pending_payment" ? (holdRow?.expires_at ?? null) : null,
    payment: payment.data
      ? {
          status: payment.data.status as string,
          orderId: (payment.data.order_id as string | null) ?? null,
          captureId: (payment.data.capture_id as string | null) ?? null,
        }
      : null,
  };
}
