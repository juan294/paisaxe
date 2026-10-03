// @vitest-environment node
/**
 * The deposit flow against the live local stack (PayPal hackathon plan,
 * Phase 4): the single capture path, finalization and compensation, with the
 * PayPal adapter replaced by a scripted stand-in so each test states exactly
 * what PayPal reports. Requires `supabase start`; self-skips otherwise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});

const { captureApprovedOrder, ensurePaymentOrder } = await import("./capture");
const { loadBookingView } = await import("./view");
const { verifyBookingCapability, bookingLink } = await import("./links");
const { addDays, madridDate } = await import("./types");

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("capture.postgrest-integration.test.ts");

const MERCHANT = "b0040000-0000-4000-8000-000000000001";
const EXPERIENCE = "b0040000-0000-4000-8000-000000000011"; // capacity 4
const USER = "b0040000-0000-4000-8000-0000000000a1";
const OTHER = "b0040000-0000-4000-8000-0000000000b1";
let dayOffset = 30;

function cleanup(): void {
  const users = sqlList([USER, OTHER]);
  psql(
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
  return psql(`SELECT (public.accept_quote('${quoteId}', '${userId}')).id;`);
}

/** A pending_payment booking for `party` places on a fresh date, with a live hold. */
function newBooking(userId = USER, party = 2): { id: string; date: string } {
  const date = addDays(madridDate(new Date()), dayOffset++);
  return { id: acceptQuoteFor(userId, date, party), date };
}

function expireHold(bookingId: string): void {
  psql(`UPDATE public.holds SET expires_at = now() - interval '1 second' WHERE id = (SELECT hold_id FROM public.bookings WHERE id = '${bookingId}');`);
}

function order(bookingId: string, overrides: Partial<PaypalOrder> = {}): PaypalOrder {
  return {
    id: `ORDER-${bookingId.slice(0, 8)}`,
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
    capture: { id: `CAP-${bookingId.slice(0, 8)}`, status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: bookingId, orderId: null },
  });

const row = (sql: string) => psql(sql);
const bookingStatus = (id: string) => row(`SELECT status FROM public.bookings WHERE id = '${id}';`);
const paymentState = (id: string) =>
  row(`SELECT status || ':' || coalesce(capture_id, '-') || ':' || coalesce(refund_id, '-') FROM public.payments WHERE booking_id = '${id}';`);

async function withOrder(bookingId: string): Promise<void> {
  paypal.createOrder.mockResolvedValueOnce({ orderId: `ORDER-${bookingId.slice(0, 8)}`, approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=X" });
  await ensurePaymentOrder(localServiceClient(), bookingId);
}

describe.skipIf(!dbReachable)("deposit flow against live local Supabase", () => {
  beforeAll(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "integration-test-secret-that-is-at-least-32-bytes");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
    cleanup();
    for (const id of [USER, OTHER]) {
      psql(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${id}@capture-it.test') ON CONFLICT (id) DO NOTHING;`);
    }
    psql(`INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) ` +
        `VALUES ('${MERCHANT}', 'it-capture-merchant', 'IT', 'Europe/Madrid', 24, true);`);
    psql(
      `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) ` +
        `VALUES ('${EXPERIENCE}', '${MERCHANT}', 'it-capture-exp', 'IT experience', 12000, 3000, 4, 4, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}');`
    );
  });

  afterAll(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // refund_id is unique: one stand-in refund per capture.
    paypal.refundCapture.mockImplementation(async (captureId: string) => ({ id: `REFUND-${captureId}`, status: "PENDING" }));
  });

  describe("ensurePaymentOrder", () => {
    it("creates one order with the payment's operation key and the capability return URL, then reuses it", async () => {
      const { id } = newBooking();
      await withOrder(id);

      const input = paypal.createOrder.mock.calls[0][0];
      const key = row(`SELECT operation_key FROM public.payments WHERE booking_id = '${id}';`);
      expect(input).toMatchObject({ bookingId: id, amountCents: 3000, currency: "EUR", operationKey: key });
      expect(input.returnUrl).toMatch(new RegExp(`^https://paisaxe\\.es/booking/${id}\\.[A-Za-z0-9_-]{43}/return$`));
      expect(input.cancelUrl).toMatch(/\?cancelled=1$/);

      const again = await ensurePaymentOrder(localServiceClient(), id);
      expect(again.approveUrl).toBe("https://www.sandbox.paypal.com/checkoutnow?token=X");
      expect(paypal.createOrder).toHaveBeenCalledTimes(1);
    });

    it.each(["capture_pending", "captured"])("never creates a second order while the payment is %s", async (status) => {
      const { id } = newBooking();
      await withOrder(id);
      psql(`UPDATE public.payments SET status = '${status}' WHERE booking_id = '${id}';`);
      vi.clearAllMocks();

      await expect(ensurePaymentOrder(localServiceClient(), id)).rejects.toMatchObject({ code: "payment_in_progress" });
      expect(paypal.createOrder).not.toHaveBeenCalled();
      expect(row(`SELECT count(*) FROM public.payments WHERE booking_id = '${id}';`)).toBe("1");
    });

    it("two concurrent calls (tool and pay button) share one payment and one order", async () => {
      const { id } = newBooking();
      paypal.createOrder.mockImplementation(async (input: { operationKey: string }) => ({
        orderId: `ORDER-${input.operationKey.slice(0, 8)}`,
        approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${input.operationKey.slice(0, 8)}`,
      }));

      const [first, second] = await Promise.all([
        ensurePaymentOrder(localServiceClient(), id),
        ensurePaymentOrder(localServiceClient(), id),
      ]);

      expect(row(`SELECT count(*) FROM public.payments WHERE booking_id = '${id}';`)).toBe("1");
      expect(first.approveUrl).toBe(second.approveUrl);
      expect(new Set(paypal.createOrder.mock.calls.map((call) => call[0].operationKey)).size).toBe(1);
    });

    it("refuses when the hold has expired, and when the booking is not pending payment", async () => {
      const lapsed = newBooking();
      expireHold(lapsed.id);
      await expect(ensurePaymentOrder(localServiceClient(), lapsed.id)).rejects.toMatchObject({ code: "hold_expired" });

      const done = newBooking();
      psql(`UPDATE public.bookings SET status = 'expired' WHERE id = '${done.id}';`);
      await expect(ensurePaymentOrder(localServiceClient(), done.id)).rejects.toMatchObject({ code: "invalid_state" });
    });
  });

  describe("captureApprovedOrder (F02)", () => {
    it("approved -> captured with the payment's key -> confirmed", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));

      expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("confirmed");
      const key = row(`SELECT operation_key FROM public.payments WHERE booking_id = '${id}';`);
      expect(paypal.captureOrder).toHaveBeenCalledWith(`ORDER-${id.slice(0, 8)}`, key);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(paymentState(id)).toBe(`captured:CAP-${id.slice(0, 8)}:-`);
    });

    it("a return URL for another order is a mismatch, without asking PayPal or flagging the booking", async () => {
      const { id } = newBooking();
      await withOrder(id);
      vi.clearAllMocks();

      expect(await captureApprovedOrder(localServiceClient(), id, "return", "SOME-OTHER-ORDER")).toBe("mismatch");
      expect(paypal.getOrder).not.toHaveBeenCalled();
      expect(bookingStatus(id)).toBe("pending_payment");
    });

    it("awaiting approval -> no capture", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id, { status: "PAYER_ACTION_REQUIRED" }));

      expect(await captureApprovedOrder(localServiceClient(), id, "webhook")).toBe("awaiting_approval");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
    });

    it.each([
      ["amount", { amountCents: 100 }],
      ["currency", { currency: "USD" }],
      ["custom_id", { customId: "someone-else" }],
    ])("a %s mismatch on an uncaptured order never captures and flags the booking", async (_label, overrides) => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id, overrides));

      expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("mismatch");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(bookingStatus(id)).toBe("needs_attention");
    });

    it("hold expired but re-acquired -> confirmed", async () => {
      const { id } = newBooking();
      await withOrder(id);
      expireHold(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));

      expect(await captureApprovedOrder(localServiceClient(), id, "reconcile")).toBe("confirmed");
    });

    it("uncaptured order with the slot gone -> expired, nothing captured (R2-01)", async () => {
      const { id, date } = newBooking(USER, 4);
      await withOrder(id);
      expireHold(id);
      acceptQuoteFor(OTHER, date, 4);
      paypal.getOrder.mockResolvedValue(order(id));

      expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("slot_gone");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(bookingStatus(id)).toBe("expired");
      expect(paymentState(id)).toMatch(/^expired:-/);
    });

    it("a capture call that times out leaves capture_pending (R2-02)", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockRejectedValue(new Error("TimeoutError"));

      expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("pending");
      expect(paymentState(id)).toBe("capture_pending:-:-");
      expect(bookingStatus(id)).toBe("pending_payment");
    });

    it("a second call after confirmation is a no-op", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));
      await captureApprovedOrder(localServiceClient(), id, "return");
      vi.clearAllMocks();

      expect(await captureApprovedOrder(localServiceClient(), id, "webhook")).toBe("confirmed");
      expect(paypal.getOrder).not.toHaveBeenCalled();
      expect(paypal.captureOrder).not.toHaveBeenCalled();
    });

    it("two concurrent callers (return and webhook) confirm once, with one capture key", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));

      const outcomes = await Promise.all([
        captureApprovedOrder(localServiceClient(), id, "return"),
        captureApprovedOrder(localServiceClient(), id, "webhook"),
      ]);

      expect(outcomes).toEqual(["confirmed", "confirmed"]);
      expect(new Set(paypal.captureOrder.mock.calls.map((call) => call[1])).size).toBe(1);
      expect(row(`SELECT count(*) FROM public.bookings WHERE id = '${id}' AND status = 'confirmed';`)).toBe("1");
      expect(row(`SELECT count(*) FROM public.payments WHERE booking_id = '${id}';`)).toBe("1");
    });

    it("R2-01 oracle: captured but the response was lost, the hold expired and the slot was taken -> refunded exactly once, never expired", async () => {
      const { id, date } = newBooking(USER, 4);
      await withOrder(id);
      // The capture happened at PayPal, but we never heard back.
      psql(`UPDATE public.payments SET status = 'capture_pending' WHERE booking_id = '${id}';`);
      expireHold(id);
      acceptQuoteFor(OTHER, date, 4);
      paypal.getOrder.mockResolvedValue(completed(id));

      for (let run = 0; run < 3; run++) {
        expect(await captureApprovedOrder(localServiceClient(), id, "reconcile")).toBe("compensating");
      }

      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
      const key = row(`SELECT operation_key FROM public.payments WHERE booking_id = '${id}';`);
      expect(paypal.refundCapture).toHaveBeenCalledWith(`CAP-${id.slice(0, 8)}`, 3000, key);
      expect(paymentState(id)).toBe(`refund_pending:CAP-${id.slice(0, 8)}:REFUND-CAP-${id.slice(0, 8)}`);
      expect(row(`SELECT compensation_reason FROM public.payments WHERE booking_id = '${id}';`)).toBe("slot_gone");
      expect(bookingStatus(id)).toBe("needs_attention");
    });

    it("a captured payment whose hold lapsed is confirmed by re-acquiring the free slot, without asking PayPal", async () => {
      const { id } = newBooking();
      await withOrder(id);
      psql(`UPDATE public.payments SET status = 'captured', capture_id = 'CAP-LAPSED' WHERE booking_id = '${id}';`);
      expireHold(id);
      vi.clearAllMocks();

      expect(await captureApprovedOrder(localServiceClient(), id, "reconcile")).toBe("confirmed");
      expect(paypal.getOrder).not.toHaveBeenCalled();
      expect(paypal.refundCapture).not.toHaveBeenCalled();
      expect(bookingStatus(id)).toBe("confirmed");
    });

    it.each(["refund_pending", "refunded", "refund_failed"])("a %s payment never reaches PayPal or the booking again", async (status) => {
      const { id } = newBooking();
      await withOrder(id);
      psql(`UPDATE public.payments SET status = '${status}', capture_id = 'CAP-${status}' WHERE booking_id = '${id}';`);
      vi.clearAllMocks();

      expect(await captureApprovedOrder(localServiceClient(), id, "webhook")).toBe("compensating");
      expect(paypal.getOrder).not.toHaveBeenCalled();
      expect(paypal.refundCapture).not.toHaveBeenCalled();
      expect(bookingStatus(id)).toBe("pending_payment");
    });

    it("a late approval on an expired payment never captures, even when the slot is free again", async () => {
      const { id } = newBooking();
      await withOrder(id);
      expireHold(id);
      psql(`UPDATE public.payments SET status = 'expired' WHERE booking_id = '${id}'; UPDATE public.bookings SET status = 'expired' WHERE id = '${id}';`);
      paypal.getOrder.mockResolvedValue(order(id));

      expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("slot_gone");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(paymentState(id)).toBe("expired:-:-");
      expect(bookingStatus(id)).toBe("expired");
    });

    it("a COMPLETED order on an expired payment is still recorded, because money moved (R2-01)", async () => {
      const { id } = newBooking();
      await withOrder(id);
      expireHold(id);
      psql(`UPDATE public.payments SET status = 'expired' WHERE booking_id = '${id}'; UPDATE public.bookings SET status = 'expired' WHERE id = '${id}';`);
      paypal.getOrder.mockResolvedValue(completed(id));

      expect(await captureApprovedOrder(localServiceClient(), id, "reconcile")).toBe("confirmed");
      expect(paymentState(id)).toBe(`captured:CAP-${id.slice(0, 8)}:-`);
    });

    it("a COMPLETED order whose capture is still PENDING stays capture_pending and is not confirmed", async () => {
      const { id } = newBooking();
      await withOrder(id);
      const pendingCapture = completed(id);
      pendingCapture.capture = { ...pendingCapture.capture!, status: "PENDING" };
      paypal.getOrder.mockResolvedValue(pendingCapture);

      expect(await captureApprovedOrder(localServiceClient(), id, "reconcile")).toBe("pending");
      expect(paymentState(id)).toBe(`capture_pending:CAP-${id.slice(0, 8)}:-`);
      expect(bookingStatus(id)).toBe("pending_payment");
    });

    it("a mismatched COMPLETED order is never written as captured, not even transiently", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue({ ...completed(id), amountCents: 100 });
      const client = localServiceClient();
      const writes: Record<string, unknown>[] = [];
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

      expect(await captureApprovedOrder(client, id, "reconcile")).toBe("compensating");
      expect(writes.some((fields) => fields.status === "captured")).toBe(false);
      expect(paymentState(id)).toBe(`refund_pending:CAP-${id.slice(0, 8)}:REFUND-CAP-${id.slice(0, 8)}`);
      expect(row(`SELECT compensation_reason FROM public.payments WHERE booking_id = '${id}';`)).toBe("order_mismatch");
    });

    it("a declined capture is the only route to capture_failed", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(
        order(id, {
          status: "COMPLETED",
          capture: { id: "CAP-DECLINED", status: "DECLINED", amountCents: 3000, currency: "EUR", customId: id, orderId: null },
        })
      );

      expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("failed");
      expect(paymentState(id)).toBe("capture_failed:CAP-DECLINED:-");
      expect(bookingStatus(id)).toBe("needs_attention");
    });
  });

  describe("loadBookingView", () => {
    async function viewOf(id: string) {
      const linkVersion = Number(row(`SELECT link_version FROM public.bookings WHERE id = '${id}';`));
      const capability = bookingLink({ id, linkVersion }).slice("/booking/".length);
      const booking = await verifyBookingCapability(localServiceClient(), capability);
      return loadBookingView(localServiceClient(), booking!);
    }

    it("shows the hold's expiry and no payment before the first order", async () => {
      const { id } = newBooking();
      const view = await viewOf(id);

      expect(view).toMatchObject({ status: "pending_payment", experienceTitle: "IT experience", depositCents: 3000, payment: null });
      expect(view.holdExpiresAt).toBe(row(`SELECT to_json(h.expires_at)#>>'{}' FROM public.holds h JOIN public.bookings b ON b.hold_id = h.id WHERE b.id = '${id}';`));
    });

    it("shows the order and capture ids once confirmed, and no hold expiry", async () => {
      const { id } = newBooking();
      await withOrder(id);
      paypal.getOrder.mockResolvedValue(order(id));
      paypal.captureOrder.mockResolvedValue(completed(id));
      await captureApprovedOrder(localServiceClient(), id, "return");

      const view = await viewOf(id);
      expect(view.status).toBe("confirmed");
      expect(view.holdExpiresAt).toBeNull();
      expect(view.payment).toEqual({ status: "captured", orderId: `ORDER-${id.slice(0, 8)}`, captureId: `CAP-${id.slice(0, 8)}` });
    });
  });
});
