// @vitest-environment node
/**
 * Booking domain guarantees against the REAL local Supabase stack
 * (migrations 112 to 117, PayPal hackathon plan Phase 1).
 *
 * The unit tests in this directory mock the Supabase client. The guarantees
 * that matter here (one inventory owner per stage, atomic and idempotent
 * quote acceptance, service-role-only posture) live in Postgres, so they are
 * exercised over PostgREST exactly as createAdminClient() would, with psql
 * used only for fixture setup and as independent ground truth.
 *
 * Requires `supabase start` (local Docker) and self-skips when the stack is
 * not reachable, like the other *.postgrest-integration tests.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_ANON_KEY,
  LOCAL_DB_CONTAINER,
  LOCAL_REST_URL,
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";
import { lockRow, releaseRowLock, waitForBackendCount } from "@/test/local-supabase-locks";
import { acceptQuote, createQuote } from "./quotes";
import { searchExperiences } from "./availability";
import { getOrCreateOpenDraft, updateDraft } from "./drafts";
import { verifyBookingCapability } from "./links";
import { FIXTURE_EXPERIENCE_SLUGS, FIXTURE_MERCHANT_SLUG } from "./fixtures";
import { addDays, madridDate } from "./types";

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("booking.postgrest-integration.test.ts");
}

const MERCHANT = "b0010000-0000-4000-8000-000000000001";
/** capacity 4, max party 4, one daily start time */
const EXP_SMALL = "b0010000-0000-4000-8000-000000000011";
/** capacity 12, max party 6, two daily start times */
const EXP_BIG = "b0010000-0000-4000-8000-000000000012";
const USER_A = "b0010000-0000-4000-8000-0000000000a1";
const USER_B = "b0010000-0000-4000-8000-0000000000b1";
const ALL_USERS = [USER_A, USER_B];

const USERS_SQL = sqlList(ALL_USERS);
const EXPS_SQL = sqlList([EXP_SMALL, EXP_BIG]);

const BOOKING_TABLES = [
  "merchants",
  "experiences",
  "experience_facts",
  "booking_drafts",
  "quotes",
  "holds",
  "bookings",
  "payments",
  "vouchers",
  "voucher_redemptions",
  "paypal_webhook_events",
  "operator_access",
];

const BOOKING_RPCS = [
  "experience_availability(uuid, date)",
  "accept_quote(uuid, uuid)",
  "reacquire_hold(uuid)",
  "consume_hold_and_confirm(uuid, text)",
  "expire_holds()",
  "grant_voucher_voice_pass_idempotent(uuid, timestamptz, timestamptz)",
  "redeem_voucher(text, uuid, timestamptz, timestamptz)",
  "consume_voucher_counter(uuid, text)",
  "upsert_paypal_event(text, text, jsonb, text, text, text, text, text)",
  "mark_paypal_event_processed(text)",
  "mark_paypal_event_failed(text, text)",
];


/** A future date (Madrid slots are always in the future 20+ days ahead). */
function futureDate(daysAhead: number): string {
  return addDays(madridDate(new Date()), daysAhead);
}

function deleteFixtureRows(): void {
  psql(
    `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE experience_id IN (${EXPS_SQL}) OR user_id IN (${USERS_SQL}));`
  );
  psql(`DELETE FROM public.bookings WHERE experience_id IN (${EXPS_SQL}) OR user_id IN (${USERS_SQL});`);
  psql(`DELETE FROM public.holds WHERE experience_id IN (${EXPS_SQL});`);
  psql(`DELETE FROM public.quotes WHERE experience_id IN (${EXPS_SQL}) OR user_id IN (${USERS_SQL});`);
  psql(`DELETE FROM public.booking_drafts WHERE user_id IN (${USERS_SQL});`);
  psql(`DELETE FROM public.experience_facts WHERE experience_id IN (${EXPS_SQL});`);
  psql(`DELETE FROM public.experiences WHERE id IN (${EXPS_SQL});`);
  psql(`DELETE FROM public.merchants WHERE id = '${MERCHANT}';`);
  psql(
    `DELETE FROM public.voice_purchases WHERE user_id IN (${USERS_SQL});` +
      `DELETE FROM public.voucher_redemptions WHERE user_id IN (${USERS_SQL});` +
      `DELETE FROM public.vouchers WHERE label LIKE 'it-booking-%';` +
      `DELETE FROM public.paypal_webhook_events WHERE event_id LIKE 'WH-IT-BOOKING-%';`
  );
  psql(`DELETE FROM public.user_profiles WHERE user_id IN (${USERS_SQL});`);
  psql(`DELETE FROM auth.users WHERE id IN (${USERS_SQL});`);
}

function seedFixtures(): void {
  for (const id of ALL_USERS) {
    // The on_auth_user_created trigger creates the user_profiles row.
    psql(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${id}@booking-it.test') ON CONFLICT (id) DO NOTHING;`);
  }
  psql(
    `INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) ` +
      `VALUES ('${MERCHANT}', 'it-booking-merchant', 'IT merchant', 'Europe/Madrid', 24, true);`
  );
  psql(
    `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) VALUES ` +
      `('${EXP_SMALL}', '${MERCHANT}', 'it-booking-small', 'IT small', 8000, 2000, 4, 4, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}'),` +
      `('${EXP_BIG}', '${MERCHANT}', 'it-booking-big', 'IT big', 12000, 3000, 6, 12, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00","16:00"]}');`
  );
}

function insertDraft(userId: string): string {
  return psql(
    `INSERT INTO public.booking_drafts (user_id, status) VALUES ('${userId}', 'abandoned') RETURNING id;`
  ).split("\n")[0];
}

/** Inserts a quote directly so RPC tests do not depend on the TS service. */
function insertQuote(args: {
  userId: string;
  experienceId: string;
  date: string;
  time?: string;
  party: number;
  expires?: string;
  superseded?: boolean;
}): string {
  const draftId = insertDraft(args.userId);
  return psql(
    `INSERT INTO public.quotes (draft_id, user_id, experience_id, version, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, expires_at, superseded_at) VALUES (` +
      `'${draftId}', '${args.userId}', '${args.experienceId}', 1, '${args.date}', '${args.time ?? "10:00"}', ${args.party}, ` +
      `8000, 2000, 'EUR', 24, now() + interval '${args.expires ?? "20 minutes"}', ${args.superseded ? "now()" : "null"}) RETURNING id;`
  ).split("\n")[0];
}

async function available(experienceId: string, date: string, time = "10:00:00"): Promise<number> {
  const { data, error } = await localServiceClient().rpc("experience_availability", {
    p_experience_id: experienceId,
    p_date: date,
  });
  if (error) throw new Error(error.message);
  const row = (data as { start_time: string; available: number }[]).find((r) => r.start_time === time);
  if (!row) throw new Error(`no slot ${time} on ${date}`);
  return row.available;
}

function accept(quoteId: string, userId: string) {
  return localServiceClient().rpc("accept_quote", { p_quote_id: quoteId, p_user_id: userId });
}

async function acceptedBookingId(quoteId: string, userId: string): Promise<string> {
  const { data, error } = await accept(quoteId, userId);
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

function confirm(bookingId: string, captureId: string | null) {
  return localServiceClient().rpc("consume_hold_and_confirm", { p_booking_id: bookingId, p_capture_id: captureId });
}

function expireHoldFor(bookingId: string): void {
  psql(
    `UPDATE public.holds SET expires_at = now() - interval '1 second' WHERE id = (SELECT hold_id FROM public.bookings WHERE id = '${bookingId}');`
  );
}

function insertPayment(bookingId: string, captureId: string): void {
  psql(
    `INSERT INTO public.payments (booking_id, amount_cents, currency, status, order_id, capture_id) ` +
      `VALUES ('${bookingId}', 2000, 'EUR', 'capture_pending', 'ORDER-${captureId}', '${captureId}');`
  );
}

const EXPERIENCE_LOCKER = "it_booking_locker";

describe.skipIf(!dbReachable)("booking domain against live local Supabase", () => {
  beforeAll(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "integration-test-secret-that-is-at-least-32-bytes");
    deleteFixtureRows();
    seedFixtures();
  });

  afterAll(() => {
    deleteFixtureRows();
    vi.unstubAllEnvs();
  });

  describe("posture", () => {
    it.each(BOOKING_TABLES)("anon and authenticated hold no privilege on %s", (table) => {
      const granted = psql(
        `SELECT bool_or(has_table_privilege(r, 'public.${table}', p)) FROM unnest(array['anon','authenticated']) r, ` +
          `unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;`
      );
      expect(granted).toBe("f");
      expect(psql(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${table}'::regclass;`)).toBe("t");
    });

    it.each(BOOKING_RPCS)("anon and authenticated cannot execute %s", (signature) => {
      const callable = psql(
        `SELECT has_function_privilege('anon', 'public.${signature}', 'EXECUTE') ` +
          `OR has_function_privilege('authenticated', 'public.${signature}', 'EXECUTE');`
      );
      expect(callable).toBe("f");
    });

    it("the anon key is refused over PostgREST for a booking table and a booking RPC", async () => {
      const read = await fetch(`${LOCAL_REST_URL}/bookings?select=id`, {
        headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${LOCAL_ANON_KEY}` },
      });
      expect(read.status).toBe(401);
      expect(((await read.json()) as { code: string }).code).toBe("42501");

      const call = await fetch(`${LOCAL_REST_URL}/rpc/accept_quote`, {
        method: "POST",
        headers: {
          apikey: LOCAL_ANON_KEY,
          Authorization: `Bearer ${LOCAL_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_quote_id: EXP_SMALL, p_user_id: USER_A }),
      });
      expect(call.status).toBe(401);
      expect(((await call.json()) as { code: string }).code).toBe("42501");
    });
  });

  describe("experience_availability", () => {
    it("returns capacity per start time and nothing on a weekday outside the slot rule", async () => {
      const date = futureDate(40);
      expect(await available(EXP_BIG, date, "10:00:00")).toBe(12);
      expect(await available(EXP_BIG, date, "16:00:00")).toBe(12);

      psql(
        `UPDATE public.experiences SET slot_rule = '{"weekdays":[],"start_times":["10:00"]}' WHERE id = '${EXP_SMALL}';`
      );
      try {
        const { data } = await localServiceClient().rpc("experience_availability", {
          p_experience_id: EXP_SMALL,
          p_date: date,
        });
        expect(data).toEqual([]);
      } finally {
        psql(
          `UPDATE public.experiences SET slot_rule = '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}' WHERE id = '${EXP_SMALL}';`
        );
      }
    });

    it("reports a slot that has already started as unavailable", async () => {
      const yesterday = futureDate(-1);
      expect(await available(EXP_BIG, yesterday, "10:00:00")).toBe(0);
    });
  });

  describe("accept_quote", () => {
    it("last-slot race: two different quotes for the whole slot, exactly one wins", async () => {
      const date = futureDate(30);
      const q1 = insertQuote({ userId: USER_A, experienceId: EXP_SMALL, date, party: 4 });
      const q2 = insertQuote({ userId: USER_B, experienceId: EXP_SMALL, date, party: 4 });

      const results = await Promise.all([accept(q1, USER_A), accept(q2, USER_B)]);
      const wins = results.filter((r) => !r.error);
      const losses = results.filter((r) => r.error);

      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
      expect(losses[0].error?.message).toBe("no_capacity");
      expect(await available(EXP_SMALL, date)).toBe(0);
    });

    it("two simultaneous accepts of the same quote that both pass the fast path return one booking (R2-03)", { timeout: 20_000 }, async () => {
      const date = futureDate(31);
      // party == capacity: without the recheck inside the lock, the second
      // caller would see the first caller's hold and fail with no_capacity.
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_SMALL, date, party: 4 });

      // Hold the experience lock in a separate session so both RPCs pass the
      // fast path (no booking yet) and queue on the lock.
      const locker = await lockRow("experiences", EXP_SMALL, EXPERIENCE_LOCKER);
      try {
        const both = Promise.all([accept(quoteId, USER_A), accept(quoteId, USER_A)]);

        await waitForBackendCount(`wait_event_type = 'Lock' AND query LIKE '%accept_quote%'`, 2);
        releaseRowLock(locker, EXPERIENCE_LOCKER);

        const [first, second] = await both;
        expect(first.error).toBeNull();
        expect(second.error).toBeNull();
        expect((first.data as { id: string }).id).toBe((second.data as { id: string }).id);
        expect(psql(`SELECT count(*) FROM public.holds WHERE quote_id = '${quoteId}';`)).toBe("1");
        expect(psql(`SELECT count(*) FROM public.bookings WHERE quote_id = '${quoteId}';`)).toBe("1");
      } finally {
        releaseRowLock(locker, EXPERIENCE_LOCKER);
      }
    });

    it("a sequential retry returns the same booking", async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date: futureDate(32), party: 2 });
      const first = await accept(quoteId, USER_A);
      const second = await accept(quoteId, USER_A);
      expect(first.error).toBeNull();
      expect((second.data as { id: string }).id).toBe((first.data as { id: string }).id);
    });

    it("rejects a quote whose owner was deleted, even with a null user id (review finding 9)", async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date: futureDate(47), party: 1 });
      psql(`UPDATE public.quotes SET user_id = NULL WHERE id = '${quoteId}';`);
      const result = await localServiceClient().rpc("accept_quote", { p_quote_id: quoteId, p_user_id: null });
      expect(result.error?.message).toBe("not_found");
    });

    it("rejects an expired or superseded quote, and a foreign one", async () => {
      const date = futureDate(33);
      const expired = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date, party: 2, expires: "-1 minute" });
      const superseded = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date, party: 2, superseded: true });
      const foreign = insertQuote({ userId: USER_B, experienceId: EXP_BIG, date, party: 2 });

      expect((await accept(expired, USER_A)).error?.message).toBe("quote_expired");
      expect((await accept(superseded, USER_A)).error?.message).toBe("quote_expired");
      expect((await accept(foreign, USER_A)).error?.message).toBe("not_found");
    });

    it("creates a pending_payment booking with an RS- reference, a 15-minute hold, and closes the draft", async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date: futureDate(34), party: 3 });
      psql(`UPDATE public.booking_drafts SET status = 'open' WHERE id = (SELECT draft_id FROM public.quotes WHERE id = '${quoteId}');`);
      const { data, error } = await accept(quoteId, USER_A);
      expect(error).toBeNull();
      const booking = data as { id: string; status: string; reference: string; party_size: number };
      expect(booking.status).toBe("pending_payment");
      expect(booking.reference).toMatch(/^RS-[A-Z0-9]{6}$/);
      expect(
        Number(
          psql(
            `SELECT round(extract(epoch FROM h.expires_at - now()) / 60) FROM public.holds h JOIN public.bookings b ON b.hold_id = h.id WHERE b.id = '${booking.id}';`
          )
        )
      ).toBe(15);
      expect(psql(`SELECT accepted_at IS NOT NULL FROM public.quotes WHERE id = '${quoteId}';`)).toBe("t");
      expect(
        psql(`SELECT status FROM public.booking_drafts WHERE id = (SELECT draft_id FROM public.quotes WHERE id = '${quoteId}');`)
      ).toBe("accepted");
    });
  });

  describe("inventory accounting (F04)", () => {
    it("a party of four consumes exactly four places from accept through expiry, confirmation and cancellation", async () => {
      const date = futureDate(35);
      const before = await available(EXP_BIG, date);
      expect(before).toBe(12);

      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date, party: 4 });
      const { data } = await accept(quoteId, USER_A);
      const bookingId = (data as { id: string }).id;
      expect(await available(EXP_BIG, date)).toBe(8);

      // Hold expiry frees capacity at that instant, without any cron run.
      expireHoldFor(bookingId);
      expect(await available(EXP_BIG, date)).toBe(12);

      const reacquired = await localServiceClient().rpc("reacquire_hold", { p_booking_id: bookingId });
      expect(reacquired.data).toBe(true);
      expect(await available(EXP_BIG, date)).toBe(8);

      insertPayment(bookingId, "CAPTURE-IT-F04");
      const confirmed = await confirm(bookingId, "CAPTURE-IT-F04");
      expect(confirmed.error).toBeNull();
      expect(confirmed.data).toBe("confirmed");
      // The confirmed booking now owns the capacity; the consumed hold does not count twice.
      expect(await available(EXP_BIG, date)).toBe(8);
      expect(psql(`SELECT status FROM public.payments WHERE booking_id = '${bookingId}';`)).toBe("captured");

      psql(`UPDATE public.bookings SET status = 'cancel_pending', cancellation_confirmed_at = now() WHERE id = '${bookingId}';`);
      expect(await available(EXP_BIG, date)).toBe(12);
    });

    it("consume_hold_and_confirm twice returns already_confirmed", async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date: futureDate(36), party: 2 });
      const bookingId = await acceptedBookingId(quoteId, USER_A);
      insertPayment(bookingId, "CAPTURE-IT-TWICE");

      expect((await confirm(bookingId, "CAPTURE-IT-TWICE")).data).toBe("confirmed");
      expect((await confirm(bookingId, "CAPTURE-IT-TWICE")).data).toBe("already_confirmed");
    });

    it("consume_hold_and_confirm refuses a booking whose hold is no longer live", async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date: futureDate(37), party: 2 });
      const bookingId = await acceptedBookingId(quoteId, USER_A);
      insertPayment(bookingId, "CAPTURE-IT-LAPSED");
      expireHoldFor(bookingId);

      const result = await confirm(bookingId, "CAPTURE-IT-LAPSED");
      expect(result.error?.message).toBe("hold_not_live");
      expect(psql(`SELECT status FROM public.bookings WHERE id = '${bookingId}';`)).toBe("pending_payment");
    });

    it("a booking under compensation is never re-confirmed, even once capacity frees up (review finding 1)", async () => {
      const date = futureDate(44);
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date, party: 2 });
      const bookingId = await acceptedBookingId(quoteId, USER_A);
      insertPayment(bookingId, "CAPTURE-IT-COMPENSATING");
      // Captured, slot judged gone, refund in flight: the compensation state.
      psql(
        `UPDATE public.payments SET status = 'refund_pending', compensation_reason = 'slot_unavailable' WHERE booking_id = '${bookingId}';` +
          `UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${bookingId}';`
      );
      expireHoldFor(bookingId);

      const reacquired = await localServiceClient().rpc("reacquire_hold", { p_booking_id: bookingId });
      expect(reacquired.error?.message).toBe("invalid_state");

      const confirmed = await confirm(bookingId, "CAPTURE-IT-COMPENSATING");
      expect(confirmed.error?.message).toBe("invalid_state");
      expect(psql(`SELECT b.status || ':' || p.status FROM public.bookings b JOIN public.payments p ON p.booking_id = b.id WHERE b.id = '${bookingId}';`)).toBe(
        "needs_attention:refund_pending"
      );
    });

    it("consume_hold_and_confirm refuses a null capture id", async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_BIG, date: futureDate(45), party: 1 });
      const bookingId = await acceptedBookingId(quoteId, USER_A);
      insertPayment(bookingId, "CAPTURE-IT-NULL");

      const result = await confirm(bookingId, null);
      expect(result.error?.message).toBe("invalid_input");
      expect(psql(`SELECT status FROM public.bookings WHERE id = '${bookingId}';`)).toBe("pending_payment");
    });

    it("consume_hold_and_confirm judges hold liveness after taking the experience lock (review finding 2)", { timeout: 20_000 }, async () => {
      const quoteId = insertQuote({ userId: USER_A, experienceId: EXP_SMALL, date: futureDate(46), party: 2 });
      const bookingId = await acceptedBookingId(quoteId, USER_A);
      insertPayment(bookingId, "CAPTURE-IT-EXPIRY-RACE");

      const locker = await lockRow("experiences", EXP_SMALL, EXPERIENCE_LOCKER);
      try {
        // Promise.resolve dispatches the (lazy) request now instead of at the await.
        const pending = Promise.resolve(confirm(bookingId, "CAPTURE-IT-EXPIRY-RACE"));
        await waitForBackendCount(`wait_event_type = 'Lock' AND query LIKE '%consume_hold_and_confirm%'`, 1);
        // The hold was live when the call started and expires while it waits for the lock.
        psql(
          `UPDATE public.holds SET expires_at = clock_timestamp() + interval '300 milliseconds' WHERE id = (SELECT hold_id FROM public.bookings WHERE id = '${bookingId}');`
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        releaseRowLock(locker, EXPERIENCE_LOCKER);

        const result = await pending;
        expect(result.error?.message).toBe("hold_not_live");
        expect(psql(`SELECT status FROM public.bookings WHERE id = '${bookingId}';`)).toBe("pending_payment");
      } finally {
        releaseRowLock(locker, EXPERIENCE_LOCKER);
      }
    });

    it("reacquire_hold fails once another booking has taken the capacity", async () => {
      const date = futureDate(38);
      const first = insertQuote({ userId: USER_A, experienceId: EXP_SMALL, date, party: 4 });
      const firstBooking = await acceptedBookingId(first, USER_A);
      expireHoldFor(firstBooking);

      const second = insertQuote({ userId: USER_B, experienceId: EXP_SMALL, date, party: 4 });
      expect((await accept(second, USER_B)).error).toBeNull();

      const result = await localServiceClient().rpc("reacquire_hold", { p_booking_id: firstBooking });
      expect(result.data).toBe(false);
    });

    it("reacquire_hold does not count the booking's own hold when it lapses while the call waits (R1)", async () => {
      const date = futureDate(70);
      const bookingId = await acceptedBookingId(insertQuote({ userId: USER_A, experienceId: EXP_SMALL, date, party: 4 }), USER_A);

      // One transaction: the hold is live at transaction start (now()) and
      // lapsed by the time reacquire_hold reads clock_timestamp().
      const result = psql(
        `BEGIN; UPDATE public.holds SET expires_at = now() + interval '50 milliseconds' WHERE id = (SELECT hold_id FROM public.bookings WHERE id = '${bookingId}');` +
          `SELECT pg_sleep(0.1); SELECT public.reacquire_hold('${bookingId}'); COMMIT;`
      );

      expect(result.split("\n").filter((line) => line === "t" || line === "f")).toEqual(["t"]);
    });

    it("expire_holds expires unpaid bookings whose hold lapsed, and leaves bookings with a payment for reconciliation", async () => {
      const date = futureDate(39);
      const unpaid = await acceptedBookingId(insertQuote({ userId: USER_A, experienceId: EXP_BIG, date, party: 1 }), USER_A);
      const withOrder = await acceptedBookingId(insertQuote({ userId: USER_A, experienceId: EXP_BIG, date, party: 1 }), USER_A);
      psql(`INSERT INTO public.payments (booking_id, amount_cents, currency, status, order_id) VALUES ('${withOrder}', 2000, 'EUR', 'created', 'ORDER-IT-EXPIRE');`);
      expireHoldFor(unpaid);
      expireHoldFor(withOrder);

      const { data, error } = await localServiceClient().rpc("expire_holds");
      expect(error).toBeNull();
      // The count is not asserted: live test files run in parallel, and reconciliation
      // in another file runs expire_holds over the whole database too. The rows are the oracle.
      expect(typeof data).toBe("number");
      expect(psql(`SELECT status FROM public.bookings WHERE id = '${unpaid}';`)).toBe("expired");
      expect(psql(`SELECT status FROM public.bookings WHERE id = '${withOrder}';`)).toBe("pending_payment");
    });
  });

  describe("TypeScript service over the live database", () => {
    it("draft -> quote -> accept -> capability link round trip", async () => {
      const client = localServiceClient();
      psql(`UPDATE public.booking_drafts SET status = 'abandoned' WHERE user_id = '${USER_B}' AND status = 'open';`);
      const draft = await getOrCreateOpenDraft(client, USER_B);
      expect((await getOrCreateOpenDraft(client, USER_B)).id).toBe(draft.id);

      const date = futureDate(41);
      await updateDraft(client, USER_B, { partySize: 4, date });

      const quote = await createQuote(client, USER_B, {
        draftId: draft.id,
        experienceId: EXP_BIG,
        slotDate: date,
        slotTime: "16:00",
        partySize: 4,
      });
      expect(quote.totalCents).toBe(12000);
      expect(quote.depositCents).toBe(3000);
      expect(quote.balanceCents).toBe(9000);
      expect(quote.version).toBe(1);

      const second = await createQuote(client, USER_B, {
        draftId: draft.id,
        experienceId: EXP_BIG,
        slotDate: date,
        slotTime: "16:00",
        partySize: 4,
      });
      expect(second.version).toBe(2);
      await expect(acceptQuote(client, USER_B, quote.id)).rejects.toMatchObject({ code: "quote_expired" });
      await expect(acceptQuote(client, USER_A, second.id)).rejects.toMatchObject({ code: "not_found" });

      const { booking, link } = await acceptQuote(client, USER_B, second.id);
      expect(booking.status).toBe("pending_payment");
      expect(link).toMatch(new RegExp(`^/booking/${booking.id}\\.[A-Za-z0-9_-]+$`));

      const capability = link.slice("/booking/".length);
      expect((await verifyBookingCapability(client, capability))?.id).toBe(booking.id);

      psql(`UPDATE public.bookings SET link_version = link_version + 1 WHERE id = '${booking.id}';`);
      expect(await verifyBookingCapability(client, capability)).toBeNull();
    });

    it("createQuote refuses a draft owned by someone else", async () => {
      const client = localServiceClient();
      const draft = await getOrCreateOpenDraft(client, USER_A);
      await expect(
        createQuote(client, USER_B, {
          draftId: draft.id,
          experienceId: EXP_BIG,
          slotDate: futureDate(42),
          slotTime: "10:00",
          partySize: 2,
        })
      ).rejects.toMatchObject({ name: "BookingError", code: "not_owned" });
    });
  });

  describe("fixture merchant (migration 116)", () => {
    beforeEach(() => {
      expect(psql(`SELECT count(*) FROM public.merchants WHERE slug = '${FIXTURE_MERCHANT_SLUG}';`)).toBe("1");
    });

    it("seeds three experiences that exercise every step_free value", () => {
      const rows = psql(
        `SELECT e.slug || ':' || f.value || ':' || f.confirmed_by_provider FROM public.experiences e ` +
          `JOIN public.merchants m ON m.id = e.merchant_id ` +
          `JOIN public.experience_facts f ON f.experience_id = e.id AND f.key = 'step_free' ` +
          `WHERE m.slug = '${FIXTURE_MERCHANT_SLUG}' ORDER BY e.slug;`
      ).split("\n");
      expect(rows.sort()).toEqual(
        [
          `${FIXTURE_EXPERIENCE_SLUGS.canoe}:no:true`,
          `${FIXTURE_EXPERIENCE_SLUGS.coastalWalk}:yes:true`,
          `${FIXTURE_EXPERIENCE_SLUGS.jeep}:unknown:false`,
        ].sort()
      );
      expect(psql(`SELECT count(*) FROM public.operator_access WHERE merchant_id = (SELECT id FROM public.merchants WHERE slug = '${FIXTURE_MERCHANT_SLUG}');`)).toBe("1");
    });

    it("re-running migration 116 changes nothing (idempotent seed)", () => {
      // Scoped to the fixture merchant: other live test files create and delete
      // their own merchants and experiences in parallel.
      const fixture = `(SELECT id FROM public.merchants WHERE slug = '${FIXTURE_MERCHANT_SLUG}')`;
      const experiences = `(SELECT id FROM public.experiences WHERE merchant_id = ${fixture})`;
      const snapshot = () =>
        psql(
          `SELECT (SELECT count(*) FROM public.merchants WHERE slug = '${FIXTURE_MERCHANT_SLUG}') || '/' || ` +
            `(SELECT count(*) FROM public.experiences WHERE merchant_id = ${fixture}) || '/' || ` +
            `(SELECT count(*) FROM public.experience_facts WHERE experience_id IN ${experiences}) || '/' || ` +
            `(SELECT count(*) FROM public.operator_access WHERE merchant_id = ${fixture}) || '/' || ` +
            `(SELECT string_agg(id::text, ',' ORDER BY slug) FROM public.experiences WHERE merchant_id = ${fixture});`
        );
      const before = snapshot();
      const sql = readFileSync(
        join(process.cwd(), "supabase/migrations/116_operator_access_and_fixture.sql"),
        "utf8"
      );
      execFileSync("docker", ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
        input: sql,
        encoding: "utf8",
      });
      expect(snapshot()).toBe(before);
    });

    it("searchExperiences rejects the stepped option and flags the unknown one for a step-free party of four within 120 EUR", async () => {
      const results = await searchExperiences(localServiceClient(), {
        partySize: 4,
        date: futureDate(43),
        budgetCents: 12000,
        constraints: { step_free: true },
      });
      const bySlug = Object.fromEntries(results.map((r) => [r.experience.slug, r]));

      expect(bySlug[FIXTURE_EXPERIENCE_SLUGS.coastalWalk].suitability).toBe("suitable");
      expect(bySlug[FIXTURE_EXPERIENCE_SLUGS.coastalWalk].slots.length).toBeGreaterThan(0);
      expect(bySlug[FIXTURE_EXPERIENCE_SLUGS.canoe].suitability).toBe("rejected");
      expect(bySlug[FIXTURE_EXPERIENCE_SLUGS.canoe].reasons).toContain("constraint_unsupported");
      // The 4x4 costs 200 EUR: over budget, and its step-free fact is unknown.
      expect(bySlug[FIXTURE_EXPERIENCE_SLUGS.jeep].reasons).toContain("over_budget");
      expect(
        bySlug[FIXTURE_EXPERIENCE_SLUGS.jeep].verdicts.find((v) => v.key === "step_free")?.verdict
      ).toBe("unknown");
    });
  });

  describe("vouchers (migration 114)", () => {
    function seedRedemption(chatTurnsLimit = 2): string {
      const voucherId = psql(
        `INSERT INTO public.vouchers (code_hash, label, expires_at, chat_turns_limit) ` +
          `VALUES (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 'it-booking-voucher', now() + interval '30 days', ${chatTurnsLimit}) RETURNING id;`
      ).split("\n")[0];
      return psql(
        `INSERT INTO public.voucher_redemptions (voucher_id, user_id) VALUES ('${voucherId}', '${USER_A}') ` +
          `ON CONFLICT (voucher_id, user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING id;`
      ).split("\n")[0];
    }

    it("grant_voucher_voice_pass_idempotent grants once inside the window and renews after it", async () => {
      const redemptionId = seedRedemption();
      const until = new Date(Date.now() + 24 * 3_600_000).toISOString();
      const grant = () =>
        localServiceClient().rpc("grant_voucher_voice_pass_idempotent", { p_redemption_id: redemptionId, p_until: until });

      expect((await grant()).data).toBe("granted");
      expect((await grant()).data).toBe("duplicate");
      const rows = () =>
        psql(
          `SELECT count(*) || ':' || min(purchase_type) || ':' || min(amount_paid) FROM public.voice_purchases WHERE payment_provider_id = 'voucher:${redemptionId}';`
        );
      expect(rows()).toBe("1:voucher_pass:0");
      expect(psql(`SELECT count(*) FROM public.stripe_webhook_events WHERE payment_provider_id = 'voucher:${redemptionId}';`)).toBe("0");

      psql(`UPDATE public.voice_purchases SET expires_at = now() - interval '1 minute' WHERE payment_provider_id = 'voucher:${redemptionId}';`);
      expect((await grant()).data).toBe("granted");
      expect(rows()).toBe("1:voucher_pass:0");
      expect(psql(`SELECT voice_pass_grants FROM public.voucher_redemptions WHERE id = '${redemptionId}';`)).toBe("2");
    });

    it("consume_voucher_counter stops at the voucher's limit", async () => {
      const redemptionId = seedRedemption(2);
      const consume = () =>
        localServiceClient().rpc("consume_voucher_counter", { p_redemption_id: redemptionId, p_counter: "chat_turns" });
      expect((await consume()).data).toEqual({ allowed: true, remaining: 1 });
      expect((await consume()).data).toEqual({ allowed: true, remaining: 0 });
      expect((await consume()).data).toEqual({ allowed: false, remaining: 0 });
      expect(
        (await localServiceClient().rpc("consume_voucher_counter", { p_redemption_id: redemptionId, p_counter: "nonsense" })).error?.message
      ).toBe("invalid_counter");
    });
  });

  describe("PayPal webhook inbox (migration 115)", () => {
    it("upsert returns new, then pending, then processed, and stores the replayable payload (R2-04)", async () => {
      const eventId = "WH-IT-BOOKING-1";
      const upsert = () =>
        localServiceClient().rpc("upsert_paypal_event", {
          p_event_id: eventId,
          p_event_type: "CHECKOUT.ORDER.APPROVED",
          p_payload: { id: eventId, resource: { id: "ORDER-IT-1" } },
          p_order_id: "ORDER-IT-1",
          p_capture_id: "CAPTURE-IT-1",
          p_refund_id: null,
          p_custom_id: "booking:abc",
          p_verification: "SUCCESS",
        });

      expect((await upsert()).data).toBe("new");
      expect((await upsert()).data).toBe("pending");
      expect(
        (await localServiceClient().rpc("mark_paypal_event_failed", { p_event_id: eventId, p_error: "boom" })).error
      ).toBeNull();
      expect(psql(`SELECT last_error || ':' || (processed_at IS NULL) FROM public.paypal_webhook_events WHERE event_id = '${eventId}';`)).toBe("boom:true");

      expect((await localServiceClient().rpc("mark_paypal_event_processed", { p_event_id: eventId })).error).toBeNull();
      expect((await upsert()).data).toBe("processed");

      expect(
        psql(
          `SELECT payload->'resource'->>'id' || ':' || order_id || ':' || capture_id || ':' || custom_id || ':' || verification || ':' || attempts ` +
            `FROM public.paypal_webhook_events WHERE event_id = '${eventId}';`
        )
      ).toBe("ORDER-IT-1:ORDER-IT-1:CAPTURE-IT-1:booking:abc:SUCCESS:2");
    });
  });

  describe("feature flag (migration 117)", () => {
    it("experience_booking is on in development and off in production", () => {
      expect(
        psql(`SELECT environment || ':' || enabled FROM public.feature_flags WHERE flag_key = 'experience_booking' ORDER BY environment;`)
      ).toBe("development:true\nproduction:false");
    });
  });
});
