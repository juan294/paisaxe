// @vitest-environment node
/**
 * The phone-confirmation stretch against the live local stack (PayPal
 * hackathon plan, Phase 8b, decision R7): migration 126 (column, checks,
 * trigger, fixture, replay), and the whole flow with the real PayPal adapter
 * against the local PayPal stand-in (src/test/paypal-mock-server.ts), the real
 * pending_bookings claim, the real ElevenLabs webhook route and its idempotent
 * RPC, and reconciliation. Only the dial itself (initiateCall) and the daily
 * call cap's counter are replaced: no call is ever placed and the shared
 * database's daily counter is untouched. Requires `supabase start`; self-skips
 * otherwise. Fixture ids use the b0090000 prefix.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Live local Supabase: a loaded host can push a test past the 5 s default (#997).
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import {
  LOCAL_DB_CONTAINER,
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";

const dial = vi.hoisted(() => ({ initiateCall: vi.fn() }));
vi.mock("@/lib/services/elevenlabs-call-service", () => dial);

const cap = vi.hoisted(() => ({ claimDailyBookingCallSlot: vi.fn() }));
vi.mock("@/lib/services/booking-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/booking-service")>()),
  claimDailyBookingCallSlot: cap.claimDailyBookingCallSlot,
}));

const flags = vi.hoisted(() => ({ isFeatureFlagEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags-server", () => flags);

const admin = vi.hoisted(() => ({ createAdminClient: vi.fn(), getAdminClient: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => admin);

const { resetPaypalClientForTests } = await import("@/lib/paypal/client");
const { captureApprovedOrder, ensurePaymentOrder } = await import("./capture");
const { settlePhoneConfirmationCall } = await import("./phone-confirmation");
const { reconcileBookings } = await import("./reconcile");
const { BookingError, addDays, madridDate } = await import("./types");
const { POST: elevenLabsWebhook } = await import("@/app/api/webhooks/elevenlabs/route");

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("phone-confirmation.postgrest-integration.test.ts");

const MERCHANT = "b0090000-0000-4000-8000-000000000001";
const EXPERIENCE = "b0090000-0000-4000-8000-000000000011";
const USER = "b0090000-0000-4000-8000-0000000000a1";
const TEST_PHONE = "+34612345678";
const WEBHOOK_SECRET = "phone-confirmation-it-webhook-secret";
const MIGRATION = resolve(process.cwd(), "supabase/migrations/126_phone_confirmation.sql");
let dayOffset = 40;
let callSeq = 0;
let mock: PaypalMock;

function cleanup(): void {
  const bookings = `SELECT id FROM public.bookings WHERE experience_id = '${EXPERIENCE}'`;
  psql(
    `CREATE TEMP TABLE b009_calls AS SELECT phone_call_id AS id FROM public.payments WHERE booking_id IN (${bookings}) AND phone_call_id IS NOT NULL;` +
      `DELETE FROM public.payments WHERE booking_id IN (${bookings});` +
      `DELETE FROM public.pending_bookings WHERE id IN (SELECT id FROM b009_calls);` +
      `DELETE FROM public.bookings WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.holds WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.quotes WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.booking_drafts WHERE user_id = '${USER}';` +
      `DELETE FROM public.experiences WHERE id = '${EXPERIENCE}';` +
      `DELETE FROM public.merchants WHERE id = '${MERCHANT}';` +
      `DELETE FROM public.user_profiles WHERE user_id = '${USER}';` +
      `DELETE FROM auth.users WHERE id = '${USER}';`
  );
}

/** A pending_payment booking for the phone merchant on a fresh date, with a live hold. */
function newBooking(party = 2): string {
  const date = addDays(madridDate(new Date()), dayOffset++);
  const draftId = psql(`INSERT INTO public.booking_drafts (user_id, status) VALUES ('${USER}', 'abandoned') RETURNING id;`).split("\n")[0];
  const quoteId = psql(
    `INSERT INTO public.quotes (draft_id, user_id, experience_id, version, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, expires_at) VALUES (` +
      `'${draftId}', '${USER}', '${EXPERIENCE}', 1, '${date}', '11:00', ${party}, 16000, 4000, 'EUR', 24, now() + interval '20 minutes') RETURNING id;`
  ).split("\n")[0];
  return psql(`SELECT (public.accept_quote('${quoteId}', '${USER}')).id;`);
}

const one = (sql: string) => psql(sql);
const paymentOf = (bookingId: string) =>
  one(`SELECT status || ':' || coalesce(confirmation_outcome, '-') FROM public.payments WHERE booking_id = '${bookingId}';`);
const bookingStatus = (bookingId: string) => one(`SELECT status FROM public.bookings WHERE id = '${bookingId}';`);
const callOf = (bookingId: string) => one(`SELECT phone_call_id FROM public.payments WHERE booking_id = '${bookingId}';`);
const authorizationOf = (bookingId: string) => one(`SELECT authorization_id FROM public.payments WHERE booking_id = '${bookingId}';`);

/** Booking -> AUTHORIZE order -> buyer approves at the stand-in -> the return page's capture path. Returns the order id. */
async function approveAndReturn(bookingId: string): Promise<string> {
  await ensurePaymentOrder(localServiceClient(), bookingId);
  const orderId = one(`SELECT order_id FROM public.payments WHERE booking_id = '${bookingId}';`);
  mock.approve(orderId);
  await expect(captureApprovedOrder(localServiceClient(), bookingId, "return", orderId)).resolves.toBe("pending");
  return orderId;
}

function signedWebhook(body: unknown): NextRequest {
  const payload = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.${payload}`).digest("hex");
  return new NextRequest("http://localhost:3000/api/webhooks/elevenlabs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "elevenlabs-signature": `t=${ts},v0=${sig}` },
    body: payload,
  });
}

function callOutcome(conversationId: string, words: string) {
  return {
    type: "post_call_transcription",
    data: {
      conversation_id: conversationId,
      transcript: [{ role: "user", message: words }],
      analysis: { call_successful: "success", transcript_summary: words },
    },
  };
}

/** What the ElevenLabs webhook's RPC records for a call (the 5-argument signature the route uses). */
function recordOutcome(callId: string, outcome: string, tag: string): void {
  psql(`SELECT public.process_elevenlabs_event_idempotent('post_call_transcription:${tag}', '${callId}'::uuid, '${outcome}', NULL::text, NULL::text);`);
}

const conversationOf = (bookingId: string) =>
  one(`SELECT conversation_id FROM public.pending_bookings WHERE id = (SELECT phone_call_id FROM public.payments WHERE booking_id = '${bookingId}');`);

describe.skipIf(!dbReachable)("phone confirmation against live local Supabase", () => {
  beforeAll(() => {
    cleanup();
    psql(`INSERT INTO auth.users (id, email) VALUES ('${USER}', '${USER}@phone-it.test') ON CONFLICT (id) DO NOTHING;`);
    psql(
      `INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture, confirmation_mode) ` +
        `VALUES ('${MERCHANT}', 'it-b009-phone-merchant', 'IT phone', 'Europe/Madrid', 24, true, 'phone');`
    );
    psql(
      `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) ` +
        `VALUES ('${EXPERIENCE}', '${MERCHANT}', 'it-b009-phone-exp', 'IT quesería', 16000, 4000, 6, 6, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["11:00"]}');`
    );
  });

  afterAll(() => {
    cleanup();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // A fresh salt per test: order ids are unique in payments across runs.
    mock = await startPaypalMock({ idSalt: `B009${Date.now()}` });
    vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
    vi.stubEnv("BOOKING_LINK_SECRET", "integration-test-secret-that-is-at-least-32-bytes");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
    vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "612 345 678");
    vi.stubEnv("ELEVENLABS_API_KEY", "sk-never-used");
    vi.stubEnv("ELEVENLABS_PHONE_NUMBER_ID", "phnum-never-used");
    vi.stubEnv("ELEVENLABS_BOOKING_AGENT_ID", "agent-never-used");
    vi.stubEnv("ELEVENLABS_WEBHOOK_SECRET", WEBHOOK_SECRET);
    resetPaypalClientForTests();
    const client = localServiceClient();
    admin.createAdminClient.mockReturnValue(client);
    admin.getAdminClient.mockReturnValue(client);
    flags.isFeatureFlagEnabled.mockImplementation(async (key: string) => key === "booking_system");
    cap.claimDailyBookingCallSlot.mockResolvedValue(true);
    dial.initiateCall.mockImplementation(async () => ({ success: true, conversationId: `conv-b009-${Date.now()}-${++callSeq}` }));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    resetPaypalClientForTests();
    await mock.close();
  });

  describe("migration 126", () => {
    it("every existing merchant stays instant; the phone fixture exists, labelled and active", () => {
      expect(one(`SELECT confirmation_mode FROM public.merchants WHERE slug = 'demo-rutas-del-sella';`)).toBe("instant");
      expect(one(`SELECT count(*) FROM public.merchants WHERE confirmation_mode NOT IN ('instant', 'phone');`)).toBe("0");
      expect(
        one(
          `SELECT m.is_fixture || ':' || m.confirmation_mode || ':' || e.active || ':' || e.deposit_cents FROM public.merchants m ` +
            `JOIN public.experiences e ON e.merchant_id = m.id WHERE m.slug = 'demo-confirmacion-telefonica';`
        )
      ).toBe("true:phone:true:4000");
    });

    it("rejects an unknown confirmation mode and an authorized payment without its authorization", () => {
      expect(() => psql(`UPDATE public.merchants SET confirmation_mode = 'fax' WHERE id = '${MERCHANT}';`)).toThrow(/merchants_confirmation_mode_check/);
      const bookingId = newBooking();
      expect(() =>
        psql(`INSERT INTO public.payments (booking_id, amount_cents, status) VALUES ('${bookingId}', 4000, 'authorized');`)
      ).toThrow(/payments_authorized_has_id_check/);
      expect(() =>
        psql(`INSERT INTO public.payments (booking_id, amount_cents, status, confirmation_outcome) VALUES ('${bookingId}', 4000, 'created', 'maybe');`)
      ).toThrow(/payments_confirmation_outcome_check/);
    });

    it("one open payment per booking now includes an authorization", () => {
      const bookingId = newBooking();
      psql(`INSERT INTO public.payments (booking_id, amount_cents, status, authorization_id) VALUES ('${bookingId}', 4000, 'authorized', 'AUTH-B009-UNIQ');`);
      expect(() => psql(`INSERT INTO public.payments (booking_id, amount_cents) VALUES ('${bookingId}', 4000);`)).toThrow(/payments_one_open_per_booking/);
    });

    it("replaying the whole file changes nothing (idempotent like 116)", () => {
      const snapshot = () =>
        one(
          `SELECT (SELECT count(*) FROM public.merchants WHERE slug = 'demo-confirmacion-telefonica') || ':' || ` +
            `(SELECT count(*) FROM public.experiences WHERE slug = 'visita-queseria-telefono') || ':' || ` +
            `(SELECT id FROM public.experiences WHERE slug = 'visita-queseria-telefono') || ':' || ` +
            `(SELECT count(*) FROM pg_trigger WHERE tgname = 'payments_require_recorded_confirmation')`
        );
      const before = snapshot();
      execFileSync("docker", ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-1", "-q"], {
        input: readFileSync(MIGRATION, "utf8"),
      });
      expect(snapshot()).toBe(before);
      expect(before).toMatch(/^1:1:[0-9a-f-]{36}:1$/);
    });
  });

  describe("the database refuses a capture without a recorded confirmation", () => {
    function authorizedWithCall(callStatus: string): { paymentId: string; callId: string } {
      const bookingId = newBooking();
      const callId = psql(
        `INSERT INTO public.pending_bookings (idempotency_key, venue_name, venue_phone, customer_name, customer_phone, party_size, booking_date, booking_time, status) ` +
          `VALUES ('phone-confirmation:it-${bookingId}', 'IT', '${TEST_PHONE}', 'IT', '${TEST_PHONE}', 2, '2026-12-01', '11:00', '${callStatus}') RETURNING id;`
      ).split("\n")[0];
      const paymentId = psql(
        `INSERT INTO public.payments (booking_id, amount_cents, status, authorization_id, phone_call_id) ` +
          `VALUES ('${bookingId}', 4000, 'authorized', 'AUTH-IT-${bookingId.slice(0, 8)}', '${callId}') RETURNING id;`
      ).split("\n")[0];
      return { paymentId, callId };
    }
    const claim = (paymentId: string) => psql(`UPDATE public.payments SET status = 'capture_pending' WHERE id = '${paymentId}';`);

    it("refuses while the call is pending, and for a 'confirmed' status no webhook recorded", () => {
      expect(() => claim(authorizedWithCall("pending").paymentId)).toThrow(/confirmation_not_recorded/);
      expect(() => claim(authorizedWithCall("confirmed").paymentId)).toThrow(/confirmation_not_recorded/);
    });

    it("allows it once the webhook's RPC recorded 'confirmed'", () => {
      const { paymentId, callId } = authorizedWithCall("pending");
      recordOutcome(callId, "confirmed", `it-${callId}`);
      claim(paymentId);
      expect(one(`SELECT status FROM public.payments WHERE id = '${paymentId}';`)).toBe("capture_pending");
    });

    it("refuses after a recorded 'denied'", () => {
      const { paymentId, callId } = authorizedWithCall("pending");
      recordOutcome(callId, "denied", `it-${callId}`);
      expect(() => claim(paymentId)).toThrow(/confirmation_not_recorded/);
    });
  });

  describe("the flow", () => {
    it("approval authorizes (never captures) and calls the test number; 'confirmed' captures once and confirms", async () => {
      const bookingId = newBooking();
      const orderId = await approveAndReturn(bookingId);

      expect(mock.orders.get(orderId)?.intent).toBe("AUTHORIZE");
      expect(mock.requestsTo("POST", /\/v2\/checkout\/orders\/[^/]+\/capture$/)).toHaveLength(0);
      expect(mock.captures.size).toBe(0);
      expect(paymentOf(bookingId)).toBe("authorized:-");
      expect(bookingStatus(bookingId)).toBe("pending_payment");
      expect(dial.initiateCall).toHaveBeenCalledTimes(1);
      expect(dial.initiateCall.mock.calls[0][0]).toBe(TEST_PHONE);
      expect(one(`SELECT status || ':' || venue_phone || ':' || idempotency_key FROM public.pending_bookings WHERE id = '${callOf(bookingId)}';`)).toMatch(
        /^pending:\+34612345678:phone-confirmation:/
      );

      // The owner answers "sí": ElevenLabs posts the outcome.
      const response = await elevenLabsWebhook(signedWebhook(callOutcome(conversationOf(bookingId), "Sí, confirmado, les esperamos")));
      expect(response.status).toBe(200);

      expect(bookingStatus(bookingId)).toBe("confirmed");
      expect(paymentOf(bookingId)).toBe("captured:confirmed");
      expect(mock.captures.size).toBe(1);
      const [capture] = [...mock.captures.values()];
      expect(one(`SELECT capture_id FROM public.payments WHERE booking_id = '${bookingId}';`)).toBe(capture.id);
      expect(mock.authorizations.get(authorizationOf(bookingId))?.status).toBe("CAPTURED");

      // Redelivery and a reconciliation run change nothing and never capture again.
      await elevenLabsWebhook(signedWebhook(callOutcome(conversationOf(bookingId), "Sí, confirmado, les esperamos")));
      await reconcileBookings(localServiceClient(), { bookingIds: [bookingId] });
      expect(mock.requestsTo("POST", /\/v2\/payments\/authorizations\/[^/]+\/capture$/)).toHaveLength(1);
      expect(paymentOf(bookingId)).toBe("captured:confirmed");
    });

    it("'denied' voids the authorization, expires the booking and frees the slot: nothing charged", async () => {
      const bookingId = newBooking(6);
      await approveAndReturn(bookingId);

      await elevenLabsWebhook(signedWebhook(callOutcome(conversationOf(bookingId), "Lo siento, está completo, no tenemos sitio")));

      expect(paymentOf(bookingId)).toBe("voided:denied");
      expect(bookingStatus(bookingId)).toBe("expired");
      expect(mock.authorizations.get(authorizationOf(bookingId))?.status).toBe("VOIDED");
      expect(mock.captures.size).toBe(0);
      expect(one(`SELECT released_at IS NOT NULL FROM public.holds WHERE id = (SELECT hold_id FROM public.bookings WHERE id = '${bookingId}');`)).toBe("t");
      // All six places are free again for that slot.
      const slot = one(`SELECT slot_date FROM public.bookings WHERE id = '${bookingId}';`);
      expect(one(`SELECT available FROM public.experience_availability('${EXPERIENCE}', '${slot}');`)).toBe("6");
    });

    it("'no_answer' recorded without the webhook's hook is voided by reconciliation", async () => {
      const bookingId = newBooking();
      await approveAndReturn(bookingId);
      const callId = callOf(bookingId);
      recordOutcome(callId, "no_answer", `it-noanswer-${callId}`);

      const summary = await reconcileBookings(localServiceClient(), { bookingIds: [bookingId] });

      expect(summary.expired).toBeGreaterThanOrEqual(1);
      expect(paymentOf(bookingId)).toBe("voided:no_answer");
      expect(mock.captures.size).toBe(0);
    });

    it("two settlements racing on one recorded confirmation capture the authorization exactly once", async () => {
      const bookingId = newBooking();
      await approveAndReturn(bookingId);
      const callId = callOf(bookingId);
      recordOutcome(callId, "confirmed", `it-race-${callId}`);

      const results = await Promise.all([
        settlePhoneConfirmationCall(localServiceClient(), callId),
        settlePhoneConfirmationCall(localServiceClient(), callId),
      ]);

      expect(results.sort()).toEqual(["confirmed", "unchanged"]);
      expect(mock.requestsTo("POST", /\/v2\/payments\/authorizations\/[^/]+\/capture$/)).toHaveLength(1);
      expect(bookingStatus(bookingId)).toBe("confirmed");
    });

    it("no outcome within the 3-day honor period: reconciliation voids the authorization", async () => {
      const bookingId = newBooking();
      await approveAndReturn(bookingId);
      psql(`UPDATE public.payments SET authorized_at = now() - interval '3 days 1 minute' WHERE booking_id = '${bookingId}';`);

      await reconcileBookings(localServiceClient(), { bookingIds: [bookingId] });

      expect(paymentOf(bookingId)).toBe("voided:honor_period_elapsed");
      expect(bookingStatus(bookingId)).toBe("expired");
      expect(mock.captures.size).toBe(0);
    });

    it("an authorization that already expired at PayPal ends 'expired': the void is refused, nothing charged", async () => {
      const bookingId = newBooking();
      await approveAndReturn(bookingId);
      mock.setAuthorizationStatus(authorizationOf(bookingId), "EXPIRED");
      const callId = callOf(bookingId);
      recordOutcome(callId, "denied", `it-exp-${callId}`);

      await reconcileBookings(localServiceClient(), { bookingIds: [bookingId] });

      expect(paymentOf(bookingId)).toBe("expired:denied");
      expect(bookingStatus(bookingId)).toBe("expired");
    });

    it("without PHONE_CONFIRMATION_TEST_NUMBER no order is created, nothing is authorized, no call", async () => {
      vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "");
      const bookingId = newBooking();

      await expect(ensurePaymentOrder(localServiceClient(), bookingId)).rejects.toEqual(new BookingError("payment_unavailable"));

      expect(one(`SELECT count(*) FROM public.payments WHERE booking_id = '${bookingId}';`)).toBe("0");
      expect(mock.orders.size).toBe(0);
      expect(dial.initiateCall).not.toHaveBeenCalled();
    });
  });
});
