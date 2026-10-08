/**
 * The operator view behind an operator capability link (PayPal hackathon
 * plan, Phase 5, unit [operator]): one merchant's bookings, live holds and
 * capacity, and the two actions an operator may take, releasing a live hold
 * and re-issuing a visitor's booking link. Every read and write is scoped to
 * the merchant of the verified operator_access row; a hold or booking of
 * another merchant is reported as not found.
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAvailability, type SlotAvailability } from "./availability";
import { bookingLink, verifyOperatorCapability, type OperatorAccess } from "./links";
import { addDays, isUuid, madridDate, toHhMm } from "./types";
import type { BookingPaymentView } from "@/types/booking-page";
import { guardCapability, toPaymentView } from "./view";

/** Days of past bookings shown beside today's and upcoming ones. */
const HISTORY_DAYS = 7;
/** Days of the capacity view, from today. */
const CAPACITY_DAYS = 14;
/** Rows read per view; the demo merchant has far fewer. */
const MAX_BOOKINGS = 500;
/** Booking states that need the operator's eye. */
const EXCEPTION_STATUSES = new Set(["needs_attention", "refund_pending", "cancel_pending"]);

/** The booking page's payment view plus when the deposit was captured (the PayPal ledger check needs it). */
export interface OperatorPayment extends BookingPaymentView {
  capturedAt: string | null;
}

export interface OperatorBooking {
  id: string;
  reference: string;
  experienceTitle: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  status: string;
  depositCents: number;
  balanceCents: number;
  currency: string;
  /** The booking's latest payment. */
  payment: OperatorPayment | null;
  exception: boolean;
}

export interface OperatorHold {
  id: string;
  /** The reference of the booking waiting on this hold. */
  reference: string | null;
  experienceTitle: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  expiresAt: string;
}

export interface OperatorCapacity {
  id: string;
  title: string;
  capacity: number;
  slots: SlotAvailability[];
}

export interface OperatorSummary {
  /** Confirmed bookings from today onward. */
  upcoming: number;
  /** Deposits of the listed bookings whose payment is captured. */
  depositsCollectedCents: number;
  /** Balance still to collect on the day, for upcoming confirmed bookings. */
  balanceDueCents: number;
  exceptions: number;
}

/**
 * Wire contract of GET /api/operator/<capability>.
 *
 * GET  /api/operator/<capability>                                   200 OperatorView | 404 | 429
 * POST /api/operator/<capability>/holds/<holdId>/release            (CSRF) 200 {released: true} | 404 | 409 {error: "hold_not_live"}
 * POST /api/operator/<capability>/bookings/<bookingId>/reissue-link (CSRF) 200 {link} | 404
 * Every response: Cache-Control private, no-store.
 */
export interface OperatorView {
  merchant: { name: string; isFixture: boolean };
  /** Madrid date the view was built for; bookings before it are history. */
  today: string;
  summary: OperatorSummary;
  bookings: OperatorBooking[];
  holds: OperatorHold[];
  capacity: OperatorCapacity[];
}

type Row = Record<string, unknown>;

export function isOperatorException(bookingStatus: string, paymentStatus: string | null): boolean {
  return EXCEPTION_STATUSES.has(bookingStatus) || paymentStatus === "refund_failed";
}

export function summarizeOperatorBookings(bookings: OperatorBooking[], today: string): OperatorSummary {
  const upcoming = bookings.filter((booking) => booking.status === "confirmed" && booking.slotDate >= today);
  return {
    upcoming: upcoming.length,
    depositsCollectedCents: bookings
      .filter((booking) => booking.payment?.status === "captured")
      .reduce((sum, booking) => sum + booking.depositCents, 0),
    balanceDueCents: upcoming.reduce((sum, booking) => sum + booking.balanceCents, 0),
    exceptions: bookings.filter((booking) => booking.exception).length,
  };
}

function latestPayment(rows: Row[] | null | undefined): OperatorPayment | null {
  const latest = [...(rows ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  return latest ? { ...toPaymentView(latest), capturedAt: (latest.captured_at as string | null) ?? null } : null;
}

/** A to-one embed arrives as an object, or as a one-element array when PostgREST cannot tell. */
function single(embed: unknown): Row | null {
  return ((Array.isArray(embed) ? embed[0] : embed) as Row | undefined) ?? null;
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`Failed to load ${what}: ${error.message}`);
}

function experiencesOf(client: SupabaseClient, merchantId: string) {
  return client.from("experiences").select("id, title, capacity_per_slot, active").eq("merchant_id", merchantId).order("title");
}

/** The bookings of these experiences from HISTORY_DAYS ago onwards, each with its latest payment. */
async function bookingsOf(client: SupabaseClient, experienceRows: Row[], today: string): Promise<OperatorBooking[]> {
  const titles = new Map(experienceRows.map((row) => [row.id as string, row.title as string]));
  const bookings = await client
    .from("bookings")
    .select(
      "id, reference, experience_id, slot_date, slot_time, party_size, status, total_cents, deposit_cents, currency, " +
        "payments(status, order_id, capture_id, refund_id, created_at, captured_at)"
    )
    .in("experience_id", [...titles.keys()])
    .gte("slot_date", addDays(today, -HISTORY_DAYS))
    .order("slot_date")
    .order("slot_time")
    .limit(MAX_BOOKINGS);
  fail("bookings", bookings.error);

  return ((bookings.data ?? []) as unknown as Row[]).map((row): OperatorBooking => {
    const payment = latestPayment(row.payments as Row[] | null);
    const total = row.total_cents as number;
    const deposit = row.deposit_cents as number;
    return {
      id: row.id as string,
      reference: row.reference as string,
      experienceTitle: titles.get(row.experience_id as string) ?? "",
      slotDate: row.slot_date as string,
      slotTime: toHhMm(row.slot_time as string),
      partySize: row.party_size as number,
      status: row.status as string,
      depositCents: deposit,
      balanceCents: total - deposit,
      currency: row.currency as string,
      payment,
      exception: isOperatorException(row.status as string, payment?.status ?? null),
    };
  });
}

/** The bookings the operator view lists, without its holds and capacity (the PayPal ledger check needs only these). */
export async function loadOperatorBookings(
  client: SupabaseClient,
  access: OperatorAccess,
  now: Date = new Date()
): Promise<OperatorBooking[]> {
  const experiences = await experiencesOf(client, access.merchantId);
  fail("experiences", experiences.error);
  return bookingsOf(client, (experiences.data ?? []) as Row[], madridDate(now));
}

export async function loadOperatorView(
  client: SupabaseClient,
  access: OperatorAccess,
  now: Date = new Date()
): Promise<OperatorView> {
  const today = madridDate(now);
  const [merchant, experiences] = await Promise.all([
    client.from("merchants").select("name, is_fixture").eq("id", access.merchantId).single(),
    experiencesOf(client, access.merchantId),
  ]);
  fail("merchant", merchant.error);
  fail("experiences", experiences.error);
  const merchantRow = merchant.data as Row;

  const experienceRows = experiences.data ?? [];
  const titles = new Map(experienceRows.map((row) => [row.id as string, row.title as string]));
  const experienceIds = [...titles.keys()];

  const [bookingList, holds, capacity] = await Promise.all([
    bookingsOf(client, experienceRows as Row[], today),
    client
      .from("holds")
      .select("id, experience_id, slot_date, slot_time, party_size, expires_at, bookings(reference)")
      .in("experience_id", experienceIds)
      .is("consumed_at", null)
      .is("released_at", null)
      .gt("expires_at", now.toISOString())
      .order("expires_at"),
    Promise.all(
      experienceRows
        .filter((row) => row.active)
        .map(async (row) => ({
          id: row.id as string,
          title: row.title as string,
          capacity: row.capacity_per_slot as number,
          slots: await listAvailability(client, row.id as string, today, CAPACITY_DAYS),
        }))
    ),
  ]);
  fail("holds", holds.error);

  return {
    merchant: { name: merchantRow.name as string, isFixture: merchantRow.is_fixture === true },
    today,
    summary: summarizeOperatorBookings(bookingList, today),
    bookings: bookingList,
    holds: ((holds.data ?? []) as Row[]).map((row) => ({
      id: row.id as string,
      reference: (single(row.bookings)?.reference as string | undefined) ?? null,
      experienceTitle: titles.get(row.experience_id as string) ?? "",
      slotDate: row.slot_date as string,
      slotTime: toHhMm(row.slot_time as string),
      partySize: row.party_size as number,
      expiresAt: row.expires_at as string,
    })),
    capacity,
  };
}

/** The merchant of a hold's or booking's experience, or null when the row does not exist. */
async function merchantOf(client: SupabaseClient, table: "holds" | "bookings", id: string, columns: string): Promise<Row | null> {
  const { data, error } = await client
    .from(table)
    .select(`${columns}, experience:experiences(merchant_id)`)
    .eq("id", id)
    .maybeSingle();
  fail(table, error);
  return (data as Row | null) ?? null;
}

const belongsTo = (row: Row | null, merchantId: string): row is Row => single(row?.experience)?.merchant_id === merchantId;

/**
 * Releases one of the merchant's live holds, freeing its places at once
 * (availability counts only live holds). One guarded UPDATE: a hold that
 * expired, was consumed by a confirmation or was already released is left
 * untouched and reported as not_live, also when it changes under a race.
 */
export async function releaseOperatorHold(
  client: SupabaseClient,
  merchantId: string,
  holdId: string,
  now: Date = new Date()
): Promise<"released" | "not_found" | "not_live"> {
  if (!isUuid(holdId)) return "not_found";
  if (!belongsTo(await merchantOf(client, "holds", holdId, "id"), merchantId)) return "not_found";

  const { data, error } = await client
    .from("holds")
    .update({ released_at: now.toISOString() })
    .eq("id", holdId)
    .is("consumed_at", null)
    .is("released_at", null)
    .gt("expires_at", now.toISOString())
    .select("id");
  if (error) throw new Error(`Failed to release hold: ${error.message}`);
  return (data?.length ?? 0) > 0 ? "released" : "not_live";
}

const REISSUE_ATTEMPTS = 3;

/**
 * Revokes the visitor's booking link by incrementing link_version and returns
 * the new link (shown to the operator once, never stored). A compare-and-set
 * on the version keeps two concurrent re-issues from returning the same link.
 * Null when the booking is not this merchant's.
 */
export async function reissueBookingLink(client: SupabaseClient, merchantId: string, bookingId: string): Promise<string | null> {
  if (!isUuid(bookingId)) return null;
  for (let attempt = 0; attempt < REISSUE_ATTEMPTS; attempt++) {
    const booking = await merchantOf(client, "bookings", bookingId, "id, link_version");
    if (!belongsTo(booking, merchantId)) return null;

    const linkVersion = (booking.link_version as number) + 1;
    const { data, error } = await client
      .from("bookings")
      .update({ link_version: linkVersion })
      .eq("id", bookingId)
      .eq("link_version", booking.link_version)
      .select("id");
    if (error) throw new Error(`Failed to re-issue booking link: ${error.message}`);
    if ((data?.length ?? 0) > 0) return bookingLink({ id: bookingId, linkVersion });
  }
  throw new Error("Failed to re-issue booking link: link_version kept changing");
}

/** The operator routes' front: guardCapability with the operator capability. */
export async function guardOperatorRoute(
  request: NextRequest,
  capability: string
): Promise<{ admin: SupabaseClient; access: OperatorAccess } | NextResponse> {
  const guard = await guardCapability(request, "operator-capability", (admin) => verifyOperatorCapability(admin, capability));
  return guard instanceof NextResponse ? guard : { admin: guard.admin, access: guard.found };
}
