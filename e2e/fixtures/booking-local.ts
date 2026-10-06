import { randomBytes, randomInt } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalDatastore } from "../../scripts/release/probe-guards";
import { createVoucher, parseVoucherArgs } from "../../scripts/booking/create-voucher";
import { slotDateAfter } from "../../scripts/booking/postman-local";

export * from "./booking-env";

/**
 * Shared constants and helpers for the LOCAL-DOCKER booking probes
 * (booking-access-boundary, booking-roundtrip; PayPal hackathon plan, Phase 6).
 *
 * Everything here is local-only: the datastore guard refuses any Supabase URL
 * that is not loopback, the PayPal stand-in listens on 127.0.0.1, and the
 * link secret below is a public test value that only the local web server
 * started by playwright.config.ts uses.
 */

export interface LocalBookingEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
}

/** Fails closed (never skips) unless every prerequisite points at the local stack. */
export function requireLocalBookingEnv(): LocalBookingEnv {
  assertLocalDatastore(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.RELEASE_TARGET_URL?.trim()) {
    throw new Error("RELEASE_TARGET_URL is set: local booking probes run only against the local web server.");
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!anonKey || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY must hold the LOCAL keys (supabase status -o env)."
    );
  }
  return { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), anonKey, serviceKey };
}

export function localServiceClient(env: LocalBookingEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The booking surface is on for the development environment of the LOCAL database. */
export async function ensureBookingSurfaceOn(admin: SupabaseClient): Promise<void> {
  const { error } = await admin
    .from("feature_flags")
    .upsert(
      { flag_key: "experience_booking", environment: "development", enabled: true, label: "Experience Booking", description: "Local booking probes", config: {} },
      { onConflict: "flag_key,environment" }
    );
  if (error) throw new Error(`Could not turn the local booking flag on: ${error.message}`);
}

/** A unique tag for this run's rows, so cleanup touches nothing else. */
export function runTag(probe: string): string {
  return `e2e-${probe}-${randomBytes(4).toString("hex")}`;
}

export async function issueVoucher(admin: SupabaseClient, label: string, max: number): Promise<string> {
  const { code } = await createVoucher(admin, parseVoucherArgs(["--label", label, "--max", String(max), "--no-voice"]));
  return code;
}

export interface LocalUser {
  userId: string;
  accessToken: string;
}

/** A confirmed email/password user signed in on the local stack (no anonymous sign-in quota spent). */
export async function createSignedInUser(env: LocalBookingEnv, admin: SupabaseClient, tag: string): Promise<LocalUser> {
  const email = `${tag}-${randomBytes(3).toString("hex")}@paisaxe.dev`;
  const password = randomBytes(18).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Could not create a local user: ${created.error?.message}`);
  const client = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error(`Could not sign in the local user: ${signedIn.error?.message}`);
  return { userId: created.data.user.id, accessToken: signedIn.data.session.access_token };
}

/** Headers the CSRF proxy needs on a state-changing /api request from outside a browser. */
export function csrfHeaders(origin: string, extra: Record<string, string> = {}): Record<string, string> {
  const token = randomBytes(16).toString("hex");
  return { origin, cookie: `__csrf=${token}`, "x-csrf-token": token, "content-type": "application/json", ...extra };
}

export interface SseEvent {
  type: string;
  [key: string]: unknown;
}

export function parseSse(body: string): SseEvent[] {
  return body
    .split("\n\n")
    .map((frame) => frame.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice("data: ".length)) as SseEvent);
}

export interface CreatedRows {
  userIds: string[];
  voucherLabels: string[];
  operatorLabels: string[];
}

async function idsWhere(admin: SupabaseClient, table: string, column: string, values: string[]): Promise<string[]> {
  if (values.length === 0) return [];
  const { data, error } = await admin.from(table).select("id").in(column, values);
  if (error) throw new Error(`Cleanup read of ${table} failed: ${error.message}`);
  return (data ?? []).map((row) => row.id as string);
}

async function deleteIds(admin: SupabaseClient, table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) throw new Error(`Cleanup of ${table} failed: ${error.message}`);
}

/**
 * Deletes every row this run created, children first (payments, bookings,
 * holds, quotes; drafts and redemptions go with their users), then returns
 * how many of them are still there. The probes assert zero: the cleanup
 * oracle observes the deletion instead of assuming it.
 */
export async function cleanupBookingRows(admin: SupabaseClient, rows: CreatedRows): Promise<Record<string, number>> {
  const quoteIds = await idsWhere(admin, "quotes", "user_id", rows.userIds);
  const bookingIds = await idsWhere(admin, "bookings", "quote_id", quoteIds);
  const paymentIds = await idsWhere(admin, "payments", "booking_id", bookingIds);
  const holdIds = await idsWhere(admin, "holds", "quote_id", quoteIds);
  const voucherIds = await idsWhere(admin, "vouchers", "label", rows.voucherLabels);
  const operatorIds = await idsWhere(admin, "operator_access", "label", rows.operatorLabels);

  await deleteIds(admin, "payments", paymentIds);
  await deleteIds(admin, "bookings", bookingIds);
  await deleteIds(admin, "holds", holdIds);
  await deleteIds(admin, "quotes", quoteIds);
  await deleteIds(admin, "operator_access", operatorIds);
  await deleteIds(admin, "vouchers", voucherIds);
  for (const userId of rows.userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Cleanup of user ${userId} failed: ${error.message}`);
  }

  const count = async (table: string, column: string, ids: string[]) => (await idsWhere(admin, table, column, ids)).length;
  const [payments, bookings, holds, quotes, booking_drafts, voucher_redemptions, vouchers, operator_access] = await Promise.all([
    count("payments", "id", paymentIds),
    count("bookings", "id", bookingIds),
    count("holds", "id", holdIds),
    count("quotes", "id", quoteIds),
    count("booking_drafts", "user_id", rows.userIds),
    count("voucher_redemptions", "user_id", rows.userIds),
    count("vouchers", "id", voucherIds),
    count("operator_access", "id", operatorIds),
  ]);
  return { payments, bookings, holds, quotes, booking_drafts, voucher_redemptions, vouchers, operator_access };
}

/** What cleanupBookingRows must report: every row a probe created is gone. */
export const NOTHING_LEFT = {
  payments: 0,
  bookings: 0,
  holds: 0,
  quotes: 0,
  booking_drafts: 0,
  voucher_redemptions: 0,
  vouchers: 0,
  operator_access: 0,
};

/** A slot 20 to 39 days ahead (Madrid calendar), so runs rarely share a slot. */
export function randomSlotDate(): string {
  return slotDateAfter(new Date(), 20 + randomInt(20));
}
