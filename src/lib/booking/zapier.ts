/**
 * Zapier sync of booking transitions (PayPal hackathon plan, Phase 8c).
 *
 * After a booking becomes `confirmed` or `refunded`, POSTs a small JSON
 * summary to ZAPIER_BOOKING_HOOK_URL. The callers sit where the transition
 * itself happened (consume_hold_and_confirm answered 'confirmed';
 * markBookingRefunded's guarded UPDATE changed the row), so each transition
 * notifies once.
 *
 * Never part of the booking's outcome: the work runs in the background
 * (next/server `after()`), is bounded by one 5 s deadline for the read and the
 * POST, and every failure is logged as [ZAPIER_SYNC_FAILED] and swallowed.
 *
 * The payload carries no capability link, booking id, user or PayPal ids
 * (F05): the hook URL is itself a credential held by a third party, and Zapier
 * stores every payload it receives.
 */
import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { toHhMm } from "./types";

export type BookingSyncEvent = "booking.confirmed" | "booking.refunded";

const FAILED = "[ZAPIER_SYNC_FAILED]";
const TIMEOUT_MS = 5_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The only columns read, so nothing else can reach the payload:
 * - reference: the stable id. Shown to the visitor and the operator; grants nothing (the capability is the HMAC link).
 * - slot_date, slot_time, party_size: what the operator plans for.
 * - total_cents, deposit_cents, currency: the deposit taken (or refunded) and the balance due on the day.
 * - experiences.title: which experience, in the merchant's own words.
 */
const PAYLOAD_COLUMNS = "reference, slot_date, slot_time, party_size, total_cents, deposit_cents, currency, experience:experiences(title)";

/** The last value read and its verdict: a URL is validated, and an invalid one logged, once. */
let validated: { raw: string; url: string | null } | null = null;

/** https anywhere; http only on loopback outside production (local tests). No credentials in the URL. */
function allowedUrl(raw: string): string | null {
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    // Reported below with the other refusals.
  }
  const https = url?.protocol === "https:";
  const loopback = url?.protocol === "http:" && process.env.NODE_ENV !== "production" && LOOPBACK_HOSTS.has(url.hostname);
  if (url && !url.username && !url.password && (https || loopback)) return url.href;
  // The URL itself is a secret: never logged.
  logger.error(FAILED, { reason: "invalid_url" });
  return null;
}

/** undefined: not configured; null: configured but refused. */
function hookUrl(): string | null | undefined {
  const raw = getEnv("ZAPIER_BOOKING_HOOK_URL");
  if (!raw) return undefined;
  if (validated?.raw !== raw) validated = { raw, url: allowedUrl(raw) };
  return validated.url;
}

function payload(row: Record<string, unknown>, event: BookingSyncEvent) {
  const total = row.total_cents as number;
  const deposit = row.deposit_cents as number;
  return {
    id: row.reference,
    event,
    slotDate: row.slot_date,
    slotTime: toHhMm(row.slot_time as string),
    partySize: row.party_size,
    totalCents: total,
    depositCents: deposit,
    balanceCents: total - deposit,
    currency: row.currency,
    experienceTitle: (row.experience as { title: string } | null)?.title ?? "",
  };
}

/** Reads the booking and POSTs it. Never rejects. */
async function send(client: SupabaseClient, url: string, bookingId: string, event: BookingSyncEvent): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const fail = (reason: string, details: Record<string, unknown> = {}) =>
    logger.error(FAILED, controller.signal.aborted ? { bookingId, event, reason: "timeout" } : { bookingId, event, reason, ...details });

  try {
    const { data, error } = await client
      .from("bookings")
      .select(PAYLOAD_COLUMNS)
      .eq("id", bookingId)
      .abortSignal(controller.signal)
      .single();
    if (error || !data) return fail("booking_read", { error: error?.message ?? "not found" });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(data, event)),
      signal: controller.signal,
      // A redirect could carry the payload elsewhere: it counts as a failure.
      redirect: "error",
    });
    await response.arrayBuffer();
    if (!response.ok) fail("http_status", { status: response.status });
  } catch (error) {
    fail("network", { error: error instanceof Error ? error.message : String(error) });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget: returns at once and never throws. Call it only where the
 * transition to `event` actually happened, never where it is merely observed.
 */
export function notifyBookingSync(client: SupabaseClient, bookingId: string, event: BookingSyncEvent): void {
  const url = hookUrl();
  if (url === undefined) {
    logger.debug("[ZAPIER_SYNC_SKIPPED]", { bookingId, event });
    return;
  }
  if (url === null) return;

  const pending = send(client, url, bookingId, event);
  try {
    after(pending);
  } catch {
    // No request scope (scripts, tests): `pending` still runs, and it never rejects.
  }
}
