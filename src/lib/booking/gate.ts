/**
 * Access contract for the booking surface (plan design "Access and
 * identity" item 7, F10).
 *
 * - requireBookingSurface: flag on and not a Preview. /acceso and voucher
 *   redemption.
 * - requireBookingAccess: the surface, plus a user with a redemption of an
 *   unexpired, unrevoked voucher. Booking chat, quote acceptance,
 *   payment-order creation and the booking list tool.
 * - Capability routes (booking page, status, capture, cancellation) call
 *   neither, so an existing booking stays reachable after the voucher expires
 *   or the flag is turned off; they check isPreviewDeployment (surface.ts) only.
 *
 * Every refusal is a 404, so the surface is invisible to ordinary visitors.
 * The /acceso page itself is gated in proxy.ts (lib/proxy/booking-surface.ts).
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/supabase-auth";
import { isBookingSurfaceOpen } from "./surface";
import { findActiveRedemption, type ActiveRedemption } from "./vouchers";

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function requireBookingSurface(): Promise<NextResponse | null> {
  return (await isBookingSurfaceOpen()) ? null : notFound();
}

export async function requireBookingAccess(
  request: NextRequest,
  now: Date = new Date()
): Promise<{ userId: string; redemption: ActiveRedemption } | NextResponse> {
  if (!(await isBookingSurfaceOpen())) return notFound();

  const user = await getUserFromRequest(request);
  if (!user) return notFound();

  const redemption = await findActiveRedemption(createAdminClient(), user.id, now);
  if (!redemption) return notFound();

  return { userId: user.id, redemption };
}
