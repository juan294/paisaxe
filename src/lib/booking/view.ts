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
import type { BalanceInvoiceStatus, BookingPaymentView, BookingView } from "@/types/booking-page";
import { verifyBookingCapability } from "./links";
import { isPreviewDeployment } from "./surface";
import type { Booking } from "./types";

/** Capability routes never cache, never send a Referer, never get indexed (plan F05). */
export const CAPABILITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

// Polling every 5 s is 12 a minute; the page's actions fit beside it.
const CAPABILITY_ROUTE_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30, maxEntries: 10_000 };

/**
 * Shared front of every capability route (booking and operator): a per-IP
 * limit before any database read, then `verify`. An unknown, bad or expired
 * capability, and every capability on a Preview (whose data is
 * production's), is a 404 with no data.
 */
export async function guardCapability<T>(
  request: NextRequest,
  bucket: string,
  verify: (admin: SupabaseClient) => Promise<T | null>
): Promise<{ admin: SupabaseClient; found: T } | NextResponse> {
  const rateLimit = await checkRateLimit(`${bucket}:${getClientIp(request)}`, CAPABILITY_ROUTE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CAPABILITY_HEADERS, ...buildRateLimitHeaders(rateLimit, true) } }
    );
  }
  const admin = createAdminClient();
  const found = isPreviewDeployment() ? null : await verify(admin);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CAPABILITY_HEADERS });
  return { admin, found };
}

/** The booking-page routes' front: guardCapability with the booking capability. */
export async function guardCapabilityRoute(
  request: NextRequest,
  capability: string
): Promise<{ admin: SupabaseClient; booking: Booking } | NextResponse> {
  const guard = await guardCapability(request, "booking-capability", (admin) => verifyBookingCapability(admin, capability));
  return guard instanceof NextResponse ? guard : { admin: guard.admin, booking: guard.found };
}

/** A payments row as the booking page and the operator view show it. */
export function toPaymentView(row: Record<string, unknown>): BookingPaymentView {
  return {
    status: row.status as string,
    orderId: (row.order_id as string | null) ?? null,
    captureId: (row.capture_id as string | null) ?? null,
    refundId: (row.refund_id as string | null) ?? null,
  };
}

export async function loadBookingView(client: SupabaseClient, booking: Booking): Promise<BookingView> {
  const [experience, payment, hold] = await Promise.all([
    client.from("experiences").select("title").eq("id", booking.experienceId).maybeSingle(),
    client
      .from("payments")
      .select("status, order_id, capture_id, refund_id")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from("bookings").select("invoice_status, invoice_url, hold:holds(expires_at)").eq("id", booking.id).single(),
  ]);
  for (const result of [experience, payment, hold]) {
    if (result.error) throw new Error(`Failed to load booking view: ${result.error.message}`);
  }
  const row = hold.data as {
    hold: { expires_at: string } | null;
    invoice_status?: BalanceInvoiceStatus | null;
    invoice_url?: string | null;
  } | null;
  const holdRow = row?.hold;

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
    payment: payment.data ? toPaymentView(payment.data) : null,
    invoice: row?.invoice_status ? { status: row.invoice_status, url: row.invoice_url ?? null } : null,
  };
}
