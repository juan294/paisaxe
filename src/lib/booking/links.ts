/**
 * Capability links for guest bookings and the operator view (plan F05).
 *
 * The capability is derived, not stored:
 *   token = base64url(HMAC-SHA256(BOOKING_LINK_SECRET, "<purpose>:" + id + ":" + link_version))
 * so the server can rebuild a link whenever it needs it (PayPal return URL,
 * re-issue through chat, operator view) and revoke it by incrementing
 * link_version. Never log a capability or put one in model-visible text.
 */
import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/safe-equal";
import { isUuid, mapBooking, type Booking } from "./types";

type Purpose = "booking" | "operator";

/** 32-byte HMAC-SHA256 digest in unpadded base64url. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const MIN_SECRET_BYTES = 32;

export interface OperatorAccess {
  id: string;
  merchantId: string;
  label: string;
  linkVersion: number;
  expiresAt: string;
}

function linkSecret(): string {
  const secret = getEnv("BOOKING_LINK_SECRET");
  if (!secret || Buffer.byteLength(secret) < MIN_SECRET_BYTES) {
    throw new Error(`BOOKING_LINK_SECRET must be set to at least ${MIN_SECRET_BYTES} bytes`);
  }
  return secret;
}

function capabilityToken(purpose: Purpose, id: string, linkVersion: number): string {
  return createHmac("sha256", linkSecret()).update(`${purpose}:${id}:${linkVersion}`).digest("base64url");
}

function parseCapability(capability: string): { id: string; token: string } | null {
  const dot = capability.indexOf(".");
  if (dot === -1) return null;
  const id = capability.slice(0, dot);
  const token = capability.slice(dot + 1);
  if (!isUuid(id) || !TOKEN_RE.test(token)) return null;
  return { id, token };
}

/** The `<id>.<token>` capability alone, for a card whose button calls a capability route. */
export function bookingCapability(booking: { id: string; linkVersion: number }): string {
  return `${booking.id}.${capabilityToken("booking", booking.id, booking.linkVersion)}`;
}

export function bookingLink(booking: { id: string; linkVersion: number }): string {
  return `/booking/${bookingCapability(booking)}`;
}

export function operatorLink(access: { id: string; linkVersion: number }): string {
  return `/operator/${access.id}.${capabilityToken("operator", access.id, access.linkVersion)}`;
}

/** Returns the booking the capability (`<id>.<token>`) opens, or null. */
export async function verifyBookingCapability(
  client: SupabaseClient,
  capability: string
): Promise<Booking | null> {
  const parsed = parseCapability(capability);
  if (!parsed) return null;

  const { data, error } = await client.from("bookings").select("*").eq("id", parsed.id).maybeSingle();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  if (!data) return null;

  const booking = mapBooking(data);
  const expected = capabilityToken("booking", booking.id, booking.linkVersion);
  return safeEqual(expected, parsed.token) ? booking : null;
}

/** Returns the operator access the capability opens while unexpired, or null. */
export async function verifyOperatorCapability(
  client: SupabaseClient,
  capability: string,
  now: Date = new Date()
): Promise<OperatorAccess | null> {
  const parsed = parseCapability(capability);
  if (!parsed) return null;

  const { data, error } = await client
    .from("operator_access")
    .select("id, merchant_id, label, link_version, expires_at")
    .eq("id", parsed.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load operator access: ${error.message}`);
  if (!data) return null;

  const access: OperatorAccess = {
    id: data.id as string,
    merchantId: data.merchant_id as string,
    label: data.label as string,
    linkVersion: data.link_version as number,
    expiresAt: data.expires_at as string,
  };
  const expected = capabilityToken("operator", access.id, access.linkVersion);
  if (!safeEqual(expected, parsed.token)) return null;
  return new Date(access.expiresAt) > now ? access : null;
}
