// @vitest-environment node
/**
 * The PayPal webhook inbox and booking reconciliation against the live local
 * stack (PayPal hackathon plan, Phase 4, unit [webhook-cron]). The PayPal
 * adapter is replaced by a scripted stand-in so each test states exactly what
 * PayPal reports; the database, the inbox RPCs, the capture path and the
 * cron lease are real. Requires `supabase start`; self-skips otherwise.
 *
 * Reconciliation runs scoped to this file's bookings, because other suites
 * share the local database while they run.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Live local Supabase: a loaded host can push a test past the 5 s default (#997).
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";
import type { PaypalOrder } from "@/lib/paypal/types";

const paypal = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  captureOrder: vi.fn(),
  refundCapture: vi.fn(),
  getRefund: vi.fn(),
  getCapture: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  const money = await vi.importActual<typeof import("@/lib/paypal/money")>("@/lib/paypal/money");
  return { ...types, ...money, ...paypal };
});

const admin = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => admin);

const { PaypalError } = await import("@/lib/paypal/types");
const { ensurePaymentOrder } = await import("./capture");
const { reconcileBookings } = await import("./reconcile");
const { addDays, madridDate } = await import("./types");
const { logger } = await import("@/lib/logger");
const { POST: webhook } = await import("@/app/api/webhooks/paypal/route");
const { GET: cron } = await import("@/app/api/cron/reconcile-bookings/route");

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("reconcile.postgrest-integration.test.ts");

const MERCHANT = "b0050000-0000-4000-8000-000000000001";
const EXPERIENCE = "b0050000-0000-4000-8000-000000000011"; // capacity 4
const USER = "b0050000-0000-4000-8000-0000000000a1";
const OTHER = "b0050000-0000-4000-8000-0000000000b1";
const EVENT_PREFIX = "WH-B005-";
const CRON_SECRET = "reconcile-it-cron-secret";
let dayOffset = 60;
let eventSeq = 0;
const created: string[] = [];

function cleanup(): void {
  const users = sqlList([USER, OTHER]);
  psql(
    `DELETE FROM public.paypal_webhook_events WHERE event_id LIKE '${EVENT_PREFIX}%';` +
      `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE experience_id = '${EXPERIENCE}');` +
      `DELETE FROM public.bookings WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.holds WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.quotes WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.booking_drafts WHERE user_id IN (${users});` +
      `DELETE FROM public.experiences WHERE id = '${EXPERIENCE}';` +
      `DELETE FROM public.merchants WHERE id = '${MERCHANT}';` +
      `DELETE FROM public.user_profiles WHERE user_id IN (${users});` +
      `DELETE FROM auth.users WHERE id IN (${users});`
  );
}

/** Accepts a fresh quote for `party` places on `date`; returns the booking id. */
function acceptQuoteFor(userId: string, date: string, party: number): string {
  const draftId = psql(`INSERT INTO public.booking_drafts (user_id, status) VALUES ('${userId}', 'abandoned') RETURNING id;`).split("\n")[0];
  const quoteId = psql(
    `INSERT INTO public.quotes (draft_id, user_id, experience_id, version, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, expires_at) VALUES (` +
      `'${draftId}', '${userId}', '${EXPERIENCE}', 1, '${date}', '10:00', ${party}, 12000, 3000, 'EUR', 24, now() + interval '20 minutes') RETURNING id;`
  ).split("\n")[0];
  const id = psql(`SELECT (public.accept_quote('${quoteId}', '${userId}')).id;`);
  created.push(id);
  return id;
}

/** A pending_payment booking for `party` places on a fresh date, with a live hold. */
function newBooking(userId = USER, party = 2): { id: string; date: string } {
  const date = addDays(madridDate(new Date()), dayOffset++);
  return { id: acceptQuoteFor(userId, date, party), date };
}

function expireHold(bookingId: string): void {
  psql(`UPDATE public.holds SET expires_at = now() - interval '1 second' WHERE id = (SELECT hold_id FROM public.bookings WHERE id = '${bookingId}');`);
}

const orderId = (bookingId: string) => `ORDER-${bookingId.slice(0, 8)}`;
const captureId = (bookingId: string) => `CAP-${bookingId.slice(0, 8)}`;
const refundOf = (capture: string) => `RF-B005-${capture}`;

function order(bookingId: string, overrides: Partial<PaypalOrder> = {}): PaypalOrder {
  return {
    id: orderId(bookingId),
    status: "APPROVED",
    amountCents: 3000,
    currency: "EUR",
    customId: bookingId,
    capture: null,
    approveUrl: null,
    ...overrides,
  };
}

const completed = (bookingId: string) =>
  order(bookingId, {
    status: "COMPLETED",
    capture: { id: captureId(bookingId), status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: bookingId, orderId: orderId(bookingId) },
  });

const bookingStatus = (id: string) => psql(`SELECT status FROM public.bookings WHERE id = '${id}';`);
const paymentState = (id: string) =>
  psql(`SELECT status || ':' || coalesce(capture_id, '-') || ':' || coalesce(refund_id, '-') FROM public.payments WHERE booking_id = '${id}';`);
const paymentField = (id: string, column: string) => psql(`SELECT ${column} FROM public.payments WHERE booking_id = '${id}';`);
const operationKey = (id: string) => paymentField(id, "operation_key");

async function withOrder(bookingId: string): Promise<void> {
  paypal.createOrder.mockResolvedValueOnce({ orderId: orderId(bookingId), approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=X" });
  await ensurePaymentOrder(localServiceClient(), bookingId);
}

function setPayment(bookingId: string, assignments: string): void {
  psql(`UPDATE public.payments SET ${assignments} WHERE booking_id = '${bookingId}';`);
}

const reconcile = (...bookingIds: string[]) => reconcileBookings(localServiceClient(), { bookingIds });

// --- PayPal webhook events, in PayPal's wire format -------------------------

const nextEventId = () => `${EVENT_PREFIX}${Date.now()}-${++eventSeq}`;

function approvedEvent(bookingId: string) {
  return {
    id: nextEventId(),
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: {
      id: orderId(bookingId),
      status: "APPROVED",
      purchase_units: [{ custom_id: bookingId, amount: { currency_code: "EUR", value: "30.00" } }],
    },
  };
}

function captureCompletedEvent(bookingId: string, amount = "30.00") {
  return {
    id: nextEventId(),
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: captureId(bookingId),
      status: "COMPLETED",
      amount: { currency_code: "EUR", value: amount },
      custom_id: bookingId,
      supplementary_data: { related_ids: { order_id: orderId(bookingId) } },
    },
  };
}

function refundedEvent(bookingId: string, refundId: string) {
  return {
    id: nextEventId(),
    event_type: "PAYMENT.CAPTURE.REFUNDED",
    resource: {
      id: refundId,
      status: "COMPLETED",
      amount: { currency_code: "EUR", value: "30.00" },
      custom_id: bookingId,
      links: [{ rel: "up", href: `https://api.sandbox.paypal.com/v2/payments/captures/${captureId(bookingId)}`, method: "GET" }],
    },
  };
}

function deliver(event: { id: string }): Promise<Response> {
  return webhook(
    new NextRequest("http://localhost/api/webhooks/paypal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
        "paypal-transmission-id": `tx-${event.id}`,
        "paypal-transmission-sig": "c2lnbmF0dXJl",
        "paypal-transmission-time": new Date().toISOString(),
      },
      body: JSON.stringify(event),
    })
  );
}

const inbox = (eventId: string, columns: string) =>
  psql(`SELECT ${columns} FROM public.paypal_webhook_events WHERE event_id = '${eventId}';`);

/**
 * A service client whose first UPDATE on `table` fails as a dropped
 * connection would: the request dies before anything is written.
 */
function clientFailingFirstUpdate(table: string): SupabaseClient {
  const real = localServiceClient();
  let failed = false;
  const failedQuery = (): unknown => {
    const result = { data: null, error: { message: "connection reset by peer" } };
    const chain: unknown = new Proxy(
      {},
      { get: (_target, property) => (property === "then" ? (resolve: (value: unknown) => void) => resolve(result) : () => chain) }
    );
    return chain;
  };
  return new Proxy(real, {
    get(target, property, receiver) {
      if (property !== "from") return Reflect.get(target, property, receiver);
      return (name: string) => {
        const builder = target.from(name);
        if (name !== table || failed) return builder;
        return new Proxy(builder, {
          get(inner, key) {
            if (key === "update") {
              failed = true;
              return failedQuery;
            }
            const value = Reflect.get(inner, key);
            return typeof value === "function" ? value.bind(inner) : value;
          },
        });
      };
    },
  });
}

describe.skipIf(!dbReachable)("PayPal webhook inbox and reconciliation against live local Supabase", () => {
  beforeAll(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "integration-test-secret-that-is-at-least-32-bytes");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    cleanup();
    for (const id of [USER, OTHER]) {
      psql(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${id}@reconcile-it.test') ON CONFLICT (id) DO NOTHING;`);
    }
    psql(`INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) ` +
        `VALUES ('${MERCHANT}', 'it-reconcile-merchant', 'IT', 'Europe/Madrid', 24, true);`);
    psql(
      `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) ` +
        `VALUES ('${EXPERIENCE}', '${MERCHANT}', 'it-reconcile-exp', 'IT experience', 12000, 3000, 4, 4, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}');`
    );
  });

  afterAll(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    admin.createAdminClient.mockImplementation(() => localServiceClient());
    paypal.verifyWebhookSignature.mockResolvedValue("SUCCESS");
    // Refund ids are UNIQUE across the shared database: derive them from the capture.
    paypal.refundCapture.mockImplementation((capture: string) => Promise.resolve({ id: refundOf(capture), status: "PENDING" }));
    const unexpected = (name: string) => () => Promise.reject(new Error(`unexpected PayPal call: ${name}`));
    paypal.getOrder.mockImplementation(unexpected("getOrder"));
    paypal.captureOrder.mockImplementation(unexpected("captureOrder"));
    paypal.getRefund.mockImplementation(unexpected("getRefund"));
    paypal.getCapture.mockImplementation(unexpected("getCapture"));
  });

  describe("POST /api/webhooks/paypal (F03 inbox)", () => {
    it("CHECKOUT.ORDER.APPROVED with no browser return ends confirmed (F02)", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));
      const event = approvedEvent(id);

      const response = await deliver(event);

      expect(response.status).toBe(200);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(paymentState(id)).toBe(`captured:${captureId(id)}:-`);
      expect(paypal.captureOrder).toHaveBeenCalledWith(orderId(id), operationKey(id));
      expect(inbox(event.id, "processed_at IS NOT NULL")).toBe("t");
      expect(inbox(event.id, "order_id || '|' || custom_id")).toBe(`${orderId(id)}|${id}`);
    });

    it("a processed event is acknowledged without reprocessing", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));
      const event = approvedEvent(id);
      expect((await deliver(event)).status).toBe(200);
      vi.clearAllMocks();

      const again = await deliver(event);

      expect(again.status).toBe(200);
      expect(paypal.getOrder).not.toHaveBeenCalled();
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(inbox(event.id, "attempts")).toBe("1");
    });

    it("processing throws -> 500 and the event stays unprocessed -> redelivery processes it once (F03)", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockRejectedValueOnce(new PaypalError("PayPal getOrder failed with HTTP 503", { status: 503 }));
      const event = approvedEvent(id);

      const failed = await deliver(event);

      expect(failed.status).toBe(500);
      expect(inbox(event.id, "processed_at IS NULL")).toBe("t");
      expect(inbox(event.id, "last_error")).toContain("HTTP 503");
      expect(bookingStatus(id)).toBe("pending_payment");

      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));
      const redelivered = await deliver(event);

      expect(redelivered.status).toBe(200);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(inbox(event.id, "processed_at IS NOT NULL")).toBe("t");
      expect(inbox(event.id, "attempts")).toBe("2");
      expect(paypal.captureOrder).toHaveBeenCalledTimes(1);
    });

    it("R2-04 oracle: a capture event that fails mid-request is replayed from the inbox row alone by the cron drain", async () => {
      const { id } = newBooking();
      await withOrder(id);
      // The capture happened at PayPal but its response was lost: no capture id yet.
      setPayment(id, "status = 'capture_pending'");
      admin.createAdminClient.mockImplementation(() => clientFailingFirstUpdate("payments"));
      const event = captureCompletedEvent(id);

      const failed = await deliver(event);

      expect(failed.status).toBe(500);
      expect(paymentState(id)).toBe("capture_pending:-:-");
      expect(inbox(event.id, "processed_at IS NULL")).toBe("t");

      // The request is over. PayPal does not redeliver and is not asked again:
      // every PayPal read rejects, so only the stored row can carry the capture.
      psql(`UPDATE public.paypal_webhook_events SET received_at = now() - interval '3 minutes' WHERE event_id = '${event.id}';`);
      const summary = await reconcile(id);

      expect(summary.eventsReplayed).toBe(1);
      expect(paymentState(id)).toBe(`captured:${captureId(id)}:-`);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(inbox(event.id, "processed_at IS NOT NULL")).toBe("t");
      expect(paypal.getOrder).not.toHaveBeenCalled();
      expect(paypal.getCapture).not.toHaveBeenCalled();
    });

    it("a completed capture is recorded even over capture_failed, because money moved (R2-01, same rule as the capture path)", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_failed'");
      psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);

      expect((await deliver(captureCompletedEvent(id))).status).toBe(200);

      expect(paymentState(id)).toBe(`captured:${captureId(id)}:-`);
      expect(bookingStatus(id)).toBe("confirmed");
    });

    it("a capture event whose amount does not match the booking compensates, never confirms", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");

      expect((await deliver(captureCompletedEvent(id, "1.00"))).status).toBe(200);

      expect(bookingStatus(id)).toBe("needs_attention");
      expect(paymentState(id)).toBe(`refund_pending:${captureId(id)}:${refundOf(captureId(id))}`);
      expect(paymentField(id, "compensation_reason")).toBe("order_mismatch");
      expect(paypal.refundCapture).toHaveBeenCalledWith(captureId(id), 3000, operationKey(id));
    });

    it("refund-then-completed out of order does not regress", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, `status = 'refund_pending', capture_id = '${captureId(id)}', refund_id = 'RF-B005-OOO-${id.slice(0, 8)}', compensation_reason = 'slot_gone'`);
      psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);

      expect((await deliver(refundedEvent(id, `RF-B005-OOO-${id.slice(0, 8)}`))).status).toBe(200);
      expect(paymentState(id)).toBe(`refunded:${captureId(id)}:RF-B005-OOO-${id.slice(0, 8)}`);
      expect(bookingStatus(id)).toBe("refunded");

      const late = captureCompletedEvent(id);
      expect((await deliver(late)).status).toBe(200);

      expect(paymentState(id)).toBe(`refunded:${captureId(id)}:RF-B005-OOO-${id.slice(0, 8)}`);
      expect(bookingStatus(id)).toBe("refunded");
      expect(inbox(late.id, "processed_at IS NOT NULL")).toBe("t");
      expect(paypal.refundCapture).not.toHaveBeenCalled();
    });

    it("CHECKOUT.ORDER.APPROVED for an expired payment never captures", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'expired'");
      psql(`UPDATE public.bookings SET status = 'expired' WHERE id = '${id}';`);
      paypal.getOrder.mockResolvedValue(order(id));

      expect((await deliver(approvedEvent(id))).status).toBe(200);

      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(paymentState(id)).toBe("expired:-:-");
      expect(bookingStatus(id)).toBe("expired");
    });

    it("PAYMENT.CAPTURE.DENIED fails the payment and flags the booking", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");
      const event = { ...captureCompletedEvent(id), event_type: "PAYMENT.CAPTURE.DENIED" };
      event.resource = { ...event.resource, status: "DECLINED" };

      expect((await deliver(event)).status).toBe(200);

      expect(paymentState(id)).toBe(`capture_failed:${captureId(id)}:-`);
      expect(bookingStatus(id)).toBe("needs_attention");
    });

    it("an event that matches no payment stays unprocessed and answers 500", async () => {
      paypal.getCapture.mockResolvedValue({ id: "CAP-NOBODY", status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: null, orderId: "ORDER-NOBODY" });
      const event = {
        id: nextEventId(),
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { id: "CAP-NOBODY", status: "COMPLETED", amount: { currency_code: "EUR", value: "30.00" } },
      };

      expect((await deliver(event)).status).toBe(500);
      expect(inbox(event.id, "processed_at IS NULL")).toBe("t");
      expect(inbox(event.id, "last_error")).toContain("PAYPAL_WEBHOOK_UNMATCHED");
    });

    it("a mismatched capture event is never written as captured, not even transiently", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");
      const writes: Record<string, unknown>[] = [];
      admin.createAdminClient.mockImplementation(() => {
        const client = localServiceClient();
        const from = client.from.bind(client);
        client.from = ((table: string) => {
          const builder = from(table);
          if (table !== "payments") return builder;
          const update = builder.update.bind(builder);
          builder.update = ((fields: Record<string, unknown>) => {
            writes.push(fields);
            return update(fields);
          }) as typeof builder.update;
          return builder;
        }) as typeof client.from;
        return client;
      });

      expect((await deliver(captureCompletedEvent(id, "1.00"))).status).toBe(200);

      expect(writes.some((fields) => fields.status === "captured")).toBe(false);
      expect(paymentState(id)).toBe(`refund_pending:${captureId(id)}:${refundOf(captureId(id))}`);
    });

    it("an event type the booking flow does not use is recorded and acknowledged", async () => {
      const event = { id: nextEventId(), event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE-1" } };

      expect((await deliver(event)).status).toBe(200);
      expect(inbox(event.id, "processed_at IS NOT NULL")).toBe("t");
    });
  });

  describe("reconcileBookings", () => {
    it("R2-02 oracle: three inconclusive passes flag the booking but keep reconciling; the next run confirms", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");
      const errors = vi.spyOn(logger, "error");
      // Webhooks are off; PayPal answers APPROVED and every capture call times out.
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockRejectedValue(new Error("TimeoutError"));

      for (let pass = 1; pass <= 2; pass++) {
        await reconcile(id);
        expect(paymentField(id, "reconcile_passes")).toBe(String(pass));
        expect(bookingStatus(id)).toBe("pending_payment");
      }
      expect(errors.mock.calls.some(([tag]) => tag === "[CRON_RECONCILE_ATTENTION]")).toBe(false);

      await reconcile(id);
      expect(paymentState(id)).toBe("capture_pending:-:-");
      expect(paymentField(id, "reconcile_passes")).toBe("3");
      expect(bookingStatus(id)).toBe("needs_attention");
      expect(errors).toHaveBeenCalledWith("[CRON_RECONCILE_ATTENTION]", expect.objectContaining({ bookingId: id, passes: 3 }));

      // The order completes at PayPal after pass three.
      paypal.getOrder.mockResolvedValue(completed(id));
      const summary = await reconcile(id);

      expect(summary.confirmed).toBe(1);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(paymentState(id)).toBe(`captured:${captureId(id)}:-`);
    });

    it("capture_pending with the order still APPROVED and the slot gone stays pending and is flagged, never expired", async () => {
      const { id, date } = newBooking(USER, 4);
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");
      expireHold(id);
      acceptQuoteFor(OTHER, date, 4);
      // APPROVED is not proof that the timed-out capture did not happen.
      paypal.getOrder.mockResolvedValue(order(id));

      for (let pass = 1; pass <= 3; pass++) {
        await reconcile(id);
        expect(paymentState(id)).toBe("capture_pending:-:-");
        expect(paymentField(id, "reconcile_passes")).toBe(String(pass));
      }

      expect(bookingStatus(id)).toBe("needs_attention");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
    });

    it("unmatched events do not starve the inbox drain", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");
      const stranger = "b0050000-0000-4000-8000-0000000000ff";
      psql(
        `INSERT INTO public.paypal_webhook_events (event_id, event_type, payload, custom_id, received_at, attempts, last_error) ` +
          `SELECT '${EVENT_PREFIX}UNM-' || n, 'PAYMENT.CAPTURE.COMPLETED', '{}'::jsonb, '${stranger}', now() - interval '1 hour' - n * interval '1 second', 1, ` +
          `'[PAYPAL_WEBHOOK_UNMATCHED] event ' || n || ' matches no payment' FROM generate_series(1, 60) AS n;`
      );
      const event = captureCompletedEvent(id);
      psql(
        `INSERT INTO public.paypal_webhook_events (event_id, event_type, payload, order_id, capture_id, custom_id, received_at, attempts, last_error) ` +
          `VALUES ('${event.id}', '${event.event_type}', '${JSON.stringify(event)}'::jsonb, '${orderId(id)}', '${captureId(id)}', '${id}', now() - interval '3 minutes', 1, 'connection reset by peer');`
      );

      const summary = await reconcile(id, stranger);

      expect(summary.eventsReplayed).toBe(1);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(paypal.getCapture).not.toHaveBeenCalled();
    });

    it("PayPal unreachable leaves every state as it was and fails the run", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, "status = 'capture_pending'");
      paypal.getOrder.mockRejectedValue(new PaypalError("PayPal getOrder could not be reached", { status: null }));

      await expect(reconcile(id)).rejects.toThrow("could not be reached");

      expect(paymentState(id)).toBe("capture_pending:-:-");
      expect(paymentField(id, "reconcile_passes")).toBe("0");
      expect(bookingStatus(id)).toBe("pending_payment");
    });

    it("the approved-and-abandoned browser: an approved order is captured and confirmed", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));

      const summary = await reconcile(id);

      expect(summary.confirmed).toBe(1);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(paypal.captureOrder).toHaveBeenCalledWith(orderId(id), operationKey(id));
    });

    it.each(["CREATED", "PAYER_ACTION_REQUIRED", "SAVED", "VOIDED"])("never captures an order that is %s", async (status) => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id, { status }));

      await reconcile(id);

      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(paymentState(id)).toBe("created:-:-");
      expect(bookingStatus(id)).toBe("pending_payment");
    });

    it("an order still awaiting approval when the hold has died expires the payment and the booking", async () => {
      const { id } = newBooking();
      await withOrder(id);
      expireHold(id);
      paypal.getOrder.mockResolvedValue(order(id, { status: "PAYER_ACTION_REQUIRED" }));

      const summary = await reconcile(id);

      expect(summary.expired).toBe(1);
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(paymentState(id)).toBe("expired:-:-");
      expect(bookingStatus(id)).toBe("expired");
    });

    it("a captured payment whose booking is not confirmed is finalized without asking PayPal", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, `status = 'captured', capture_id = '${captureId(id)}'`);
      expireHold(id);

      const summary = await reconcile(id);

      expect(summary.confirmed).toBe(1);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(paypal.getOrder).not.toHaveBeenCalled();
    });

    it("refund_pending with no refund id retries the refund with the same key, then follows it", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, `status = 'refund_pending', capture_id = '${captureId(id)}', compensation_reason = 'slot_gone'`);
      psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);

      const first = await reconcile(id);

      expect(first.refundsRequested).toBe(1);
      expect(paypal.refundCapture).toHaveBeenCalledWith(captureId(id), 3000, operationKey(id));
      expect(paymentState(id)).toBe(`refund_pending:${captureId(id)}:${refundOf(captureId(id))}`);

      paypal.getRefund.mockResolvedValue({ id: refundOf(captureId(id)), status: "PENDING" });
      await reconcile(id);

      expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
      expect(paypal.getRefund).toHaveBeenCalledWith(refundOf(captureId(id)));
      expect(paymentState(id)).toBe(`refund_pending:${captureId(id)}:${refundOf(captureId(id))}`);
    });

    it("a completed refund marks the payment and the booking refunded", async () => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, `status = 'refund_pending', capture_id = '${captureId(id)}', refund_id = 'RF-B005-OK-${id.slice(0, 8)}', compensation_reason = 'slot_gone'`);
      psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);
      paypal.getRefund.mockResolvedValue({ id: `RF-B005-OK-${id.slice(0, 8)}`, status: "COMPLETED" });

      const summary = await reconcile(id);

      expect(summary.refunded).toBe(1);
      expect(paymentState(id)).toBe(`refunded:${captureId(id)}:RF-B005-OK-${id.slice(0, 8)}`);
      expect(paymentField(id, "refunded_at IS NOT NULL")).toBe("t");
      expect(bookingStatus(id)).toBe("refunded");
    });

    it.each(["FAILED", "CANCELLED"])("a %s refund marks the payment refund_failed and the booking needs_attention", async (status) => {
      const { id } = newBooking();
      await withOrder(id);
      setPayment(id, `status = 'refund_pending', capture_id = '${captureId(id)}', refund_id = 'RF-B005-${status}-${id.slice(0, 8)}', compensation_reason = 'slot_gone'`);
      paypal.getRefund.mockResolvedValue({ id: `RF-B005-${status}-${id.slice(0, 8)}`, status });

      const summary = await reconcile(id);

      expect(summary.refundFailed).toBe(1);
      expect(paymentState(id)).toBe(`refund_failed:${captureId(id)}:RF-B005-${status}-${id.slice(0, 8)}`);
      expect(bookingStatus(id)).toBe("needs_attention");
    });

    it("a confirmed cancellation whose refund call failed is retried with the same key (Phase 5 cancel_pending)", async () => {
      const confirmedCancel = newBooking();
      const notConfirmed = newBooking();
      for (const { id } of [confirmedCancel, notConfirmed]) {
        await withOrder(id);
        setPayment(id, `status = 'captured', capture_id = '${captureId(id)}'`);
      }
      psql(`UPDATE public.bookings SET status = 'cancel_pending', cancellation_confirmed_at = now(), refund_cents = 1500 WHERE id = '${confirmedCancel.id}';`);
      psql(`UPDATE public.bookings SET status = 'cancel_pending', refund_cents = 1500 WHERE id = '${notConfirmed.id}';`);

      const summary = await reconcile(confirmedCancel.id, notConfirmed.id);

      expect(summary.refundsRequested).toBe(1);
      expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
      expect(paypal.refundCapture).toHaveBeenCalledWith(captureId(confirmedCancel.id), 1500, operationKey(confirmedCancel.id));
      expect(paymentState(confirmedCancel.id)).toBe(`refund_pending:${captureId(confirmedCancel.id)}:${refundOf(captureId(confirmedCancel.id))}`);
      expect(bookingStatus(confirmedCancel.id)).toBe("refund_pending");
      expect(paymentState(notConfirmed.id)).toBe(`captured:${captureId(notConfirmed.id)}:-`);
      expect(bookingStatus(notConfirmed.id)).toBe("cancel_pending");
    });

    it("expires lapsed holds without a payment and abandons drafts idle for more than a day", async () => {
      const { id } = newBooking();
      expireHold(id);
      const stale = psql(`INSERT INTO public.booking_drafts (user_id, status, updated_at) VALUES ('${USER}', 'open', now() - interval '25 hours') RETURNING id;`).split("\n")[0];

      const summary = await reconcile(id);

      expect(bookingStatus(id)).toBe("expired");
      expect(psql(`SELECT status FROM public.booking_drafts WHERE id = '${stale}';`)).toBe("abandoned");
      // The hold expiry and the draft sweep are global (expire_holds(), abandonStaleDrafts), and other
      // live-database files reconcile in parallel workers: whichever run sweeps first gets the count, so
      // this run's summary may be 0 although its own rows above are expired. The count mapping itself is
      // pinned in reconcile.test.ts ("counts expired holds and abandoned drafts").
      expect(summary.expiredHolds).toEqual(expect.any(Number));
      expect(summary.abandonedDrafts).toEqual(expect.any(Number));
    });

    it("logs needs_attention bookings older than 15 minutes", async () => {
      const { id } = newBooking();
      psql(`SET session_replication_role = replica; UPDATE public.bookings SET status = 'needs_attention', updated_at = now() - interval '16 minutes' WHERE id = '${id}';`);
      const errors = vi.spyOn(logger, "error");

      const summary = await reconcile(id);

      expect(summary.staleAttention).toBe(1);
      expect(errors).toHaveBeenCalledWith("[CRON_RECONCILE_ATTENTION]", expect.objectContaining({ staleCount: 1, bookingIds: [id] }));
    });
  });

  describe("GET /api/cron/reconcile-bookings", () => {
    it("the lease prevents an overlapping run", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));
      const client = localServiceClient();
      const { data: token, error } = await client.rpc("try_acquire_cron_job_lock", { p_lock_key: "reconcile-bookings", p_lease_seconds: 60 });
      expect(error).toBeNull();
      expect(token).toBeTruthy();

      try {
        const response = await cron(
          new NextRequest("http://localhost/api/cron/reconcile-bookings", { headers: { authorization: `Bearer ${CRON_SECRET}` } })
        );
        expect(response.status).toBe(409);
        expect(paypal.getOrder).not.toHaveBeenCalled();
        expect(bookingStatus(id)).toBe("pending_payment");
      } finally {
        await client.rpc("release_cron_job_lock", { p_lock_key: "reconcile-bookings", p_lock_token: token });
      }
    });
  });
});
