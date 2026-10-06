// @vitest-environment node
/**
 * Visitor cancellation against the live local stack (PayPal hackathon plan,
 * Phase 5): the read-only preview (F01), the confirm that refuses changed
 * terms (R2-05), one refund under retries, and places returning to the slot.
 * PayPal is a scripted stand-in. Requires `supabase start`; self-skips otherwise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Live local Supabase: a loaded host can push a test past the 5 s default (#997).
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
import {
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const paypal = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  captureOrder: vi.fn(),
  getCapture: vi.fn(),
  refundCapture: vi.fn(),
  getRefund: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});

const { PaypalError } = await import("@/lib/paypal/types");
const { cancellationPreview, confirmCancellation } = await import("./cancel");
const { captureApprovedOrder } = await import("./capture");
const { reconcileBookings } = await import("./reconcile");
const { mapBooking, addDays, madridDate } = await import("./types");

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("cancel.postgrest-integration.test.ts");

const MERCHANT = "b0070000-0000-4000-8000-000000000001";
const EXPERIENCE = "b0070000-0000-4000-8000-000000000011"; // capacity 4, 24 h window
const USER = "b0070000-0000-4000-8000-0000000000a1";
let dayOffset = 30;

function cleanup(): void {
  psql(
    `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE experience_id = '${EXPERIENCE}');` +
      `DELETE FROM public.bookings WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.holds WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.quotes WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.booking_drafts WHERE user_id = '${USER}';` +
      `DELETE FROM public.experiences WHERE id = '${EXPERIENCE}';` +
      `DELETE FROM public.merchants WHERE id = '${MERCHANT}';` +
      `DELETE FROM public.user_profiles WHERE user_id IN (${sqlList([USER])});` +
      `DELETE FROM auth.users WHERE id = '${USER}';`
  );
}

/** A confirmed booking for `party` places on a fresh date, paid with capture CAP-<id prefix>. */
function confirmedBooking(party = 2): { id: string; date: string } {
  const date = addDays(madridDate(new Date()), dayOffset++);
  const draftId = psql(`INSERT INTO public.booking_drafts (user_id, status) VALUES ('${USER}', 'abandoned') RETURNING id;`).split("\n")[0];
  const quoteId = psql(
    `INSERT INTO public.quotes (draft_id, user_id, experience_id, version, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, expires_at) VALUES (` +
      `'${draftId}', '${USER}', '${EXPERIENCE}', 1, '${date}', '10:00', ${party}, 12000, 3000, 'EUR', 24, now() + interval '20 minutes') RETURNING id;`
  ).split("\n")[0];
  const id = psql(`SELECT (public.accept_quote('${quoteId}', '${USER}')).id;`);
  psql(
    `INSERT INTO public.payments (booking_id, amount_cents, currency, status, order_id) VALUES ('${id}', 3000, 'EUR', 'capture_pending', 'ORDER-${id.slice(0, 8)}');` +
      `SELECT public.consume_hold_and_confirm('${id}', 'CAP-${id.slice(0, 8)}');`
  );
  return { id, date };
}

const row = (sql: string) => psql(sql);
const bookingOf = (id: string) => mapBooking(JSON.parse(row(`SELECT row_to_json(b) FROM public.bookings b WHERE id = '${id}';`)));
const bookingStatus = (id: string) => row(`SELECT status FROM public.bookings WHERE id = '${id}';`);
const paymentState = (id: string) =>
  row(`SELECT status || ':' || coalesce(refund_id, '-') FROM public.payments WHERE booking_id = '${id}' ORDER BY created_at DESC LIMIT 1;`);
const snapshot = (id: string) =>
  row(`SELECT row_to_json(b)::text || (SELECT json_agg(p ORDER BY p.created_at)::text FROM public.payments p WHERE p.booking_id = b.id) FROM public.bookings b WHERE b.id = '${id}';`);
const cutoffOf = (id: string) => new Date(row(`SELECT to_json(refund_until)#>>'{}' FROM public.cancellation_terms('${id}');`));
const available = (date: string) =>
  Number(row(`SELECT available FROM public.experience_availability('${EXPERIENCE}', '${date}') WHERE start_time = '10:00';`));
const reconcile = (id: string) => reconcileBookings(localServiceClient(), { bookingIds: [id] });

describe.skipIf(!dbReachable)("cancellation against live local Supabase", () => {
  beforeAll(() => {
    cleanup();
    psql(`INSERT INTO auth.users (id, email) VALUES ('${USER}', '${USER}@cancel-it.test') ON CONFLICT (id) DO NOTHING;`);
    psql(
      `INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) ` +
        `VALUES ('${MERCHANT}', 'it-cancel-merchant', 'IT', 'Europe/Madrid', 24, true);`
    );
    psql(
      `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) ` +
        `VALUES ('${EXPERIENCE}', '${MERCHANT}', 'it-cancel-exp', 'IT experience', 12000, 3000, 4, 4, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}');`
    );
  });

  afterAll(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    // refund_id is unique: one stand-in refund per capture.
    paypal.refundCapture.mockImplementation(async (captureId: string) => ({ id: `RF-B007-${captureId}`, status: "PENDING" }));
  });

  it("the preview writes nothing; reconciliation afterwards finds nothing to do (F01)", async () => {
    const { id, date } = confirmedBooking();
    const before = snapshot(id);

    const preview = await cancellationPreview(localServiceClient(), bookingOf(id));
    await reconcile(id);

    expect(preview).toMatchObject({ refundCents: 3000, depositCents: 3000, currency: "EUR", cancellationWindowHours: 24 });
    expect(preview.termsValidUntil).toBe(cutoffOf(id).toISOString());
    expect(snapshot(id)).toBe(before);
    expect(available(date)).toBe(2);
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("F01 oracle: a preview left for more than ten minutes changes nothing when reconciliation runs (clock advanced)", async () => {
    const { id, date } = confirmedBooking();
    await cancellationPreview(localServiceClient(), bookingOf(id));
    const before = snapshot(id);

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(Date.now() + 11 * 60_000));
      await reconcile(id);
    } finally {
      vi.useRealTimers();
    }

    expect(snapshot(id)).toBe(before);
    expect(bookingStatus(id)).toBe("confirmed");
    expect(available(date)).toBe(2);
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("R2-05 oracle: shown 30 EUR just before the cutoff, clicked just after -> refused with the new terms; confirming 0 cancels with no PayPal call", async () => {
    const { id, date } = confirmedBooking();
    const cutoff = cutoffOf(id);
    const before = new Date(cutoff.getTime() - 1_000);
    const after = new Date(cutoff.getTime() + 1_000);

    expect((await cancellationPreview(localServiceClient(), bookingOf(id), before)).refundCents).toBe(3000);

    const refused = await confirmCancellation(localServiceClient(), bookingOf(id), 3000, after);
    expect(refused).toMatchObject({ outcome: "terms_changed", terms: { refundCents: 0, termsValidUntil: null } });
    expect(bookingStatus(id)).toBe("confirmed");
    expect(row(`SELECT cancellation_confirmed_at IS NULL FROM public.bookings WHERE id = '${id}';`)).toBe("t");
    expect(available(date)).toBe(2);

    const cancelled = await confirmCancellation(localServiceClient(), bookingOf(id), 0, after);
    expect(cancelled).toMatchObject({ outcome: "cancelled", status: "cancelled", refundCents: 0 });
    expect(bookingStatus(id)).toBe("cancelled");
    expect(paymentState(id)).toBe("captured:-");
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("an expectation above the policy is refused, never refunded", async () => {
    const { id } = confirmedBooking();

    expect(await confirmCancellation(localServiceClient(), bookingOf(id), 5000)).toMatchObject({
      outcome: "terms_changed",
      terms: { refundCents: 3000 },
    });
    expect(bookingStatus(id)).toBe("confirmed");
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("confirming inside the window refunds the server's amount once with the payment's key; a second confirm does nothing", async () => {
    const { id } = confirmedBooking();

    const first = await confirmCancellation(localServiceClient(), bookingOf(id), 3000);
    const second = await confirmCancellation(localServiceClient(), bookingOf(id), 3000);

    expect(first).toMatchObject({ outcome: "cancelled", status: "refund_pending", refundCents: 3000 });
    expect(second).toMatchObject({ outcome: "unchanged", status: "refund_pending" });
    const key = row(`SELECT operation_key FROM public.payments WHERE booking_id = '${id}';`);
    expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
    expect(paypal.refundCapture).toHaveBeenCalledWith(`CAP-${id.slice(0, 8)}`, 3000, key);
    expect(paymentState(id)).toBe(`refund_pending:RF-B007-CAP-${id.slice(0, 8)}`);
    expect(row(`SELECT refund_cents FROM public.bookings WHERE id = '${id}';`)).toBe("3000");
  });

  it("a refund PayPal completes at once ends refunded", async () => {
    const { id } = confirmedBooking();
    paypal.refundCapture.mockImplementation(async (captureId: string) => ({ id: `RF-B007-${captureId}`, status: "COMPLETED" }));

    expect(await confirmCancellation(localServiceClient(), bookingOf(id), 3000)).toMatchObject({ status: "refunded" });
    expect(bookingStatus(id)).toBe("refunded");
    expect(paymentState(id)).toBe(`refunded:RF-B007-CAP-${id.slice(0, 8)}`);
  });

  it("a PayPal failure keeps the confirmed cancellation; reconciliation requests the refund with the same key", async () => {
    const { id } = confirmedBooking();
    paypal.refundCapture.mockRejectedValueOnce(new PaypalError("timeout", { status: null }));

    await expect(confirmCancellation(localServiceClient(), bookingOf(id), 3000)).rejects.toMatchObject({ code: "refund_unavailable" });
    expect(bookingStatus(id)).toBe("cancel_pending");
    expect(row(`SELECT cancellation_confirmed_at IS NOT NULL FROM public.bookings WHERE id = '${id}';`)).toBe("t");

    await reconcile(id);

    const key = row(`SELECT operation_key FROM public.payments WHERE booking_id = '${id}';`);
    expect(paypal.refundCapture).toHaveBeenCalledTimes(2);
    expect(paypal.refundCapture.mock.calls.map((call) => call[2])).toEqual([key, key]);
    expect(bookingStatus(id)).toBe("refund_pending");
  });

  it("clicking confirm again after a refused refund reports the refused refund, not 'cannot cancel'", async () => {
    const { id } = confirmedBooking();
    paypal.refundCapture.mockRejectedValue(new PaypalError("refused", { status: 422, issue: "REFUND_NOT_ALLOWED" }));
    await confirmCancellation(localServiceClient(), bookingOf(id), 3000);

    expect(await confirmCancellation(localServiceClient(), bookingOf(id), 3000)).toMatchObject({ outcome: "unchanged", status: "needs_attention" });
  });

  it("a refund PayPal refuses for good goes to a person; reconciliation does not retry it", async () => {
    const { id } = confirmedBooking();
    paypal.refundCapture.mockRejectedValue(new PaypalError("refused", { status: 422, issue: "INSUFFICIENT_FUNDS" }));

    expect(await confirmCancellation(localServiceClient(), bookingOf(id), 3000)).toMatchObject({ status: "needs_attention" });
    await reconcile(id);

    expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
    expect(bookingStatus(id)).toBe("needs_attention");
    expect(paymentState(id)).toBe("refund_failed:-");
    expect(row(`SELECT cancellation_confirmed_at IS NOT NULL FROM public.bookings WHERE id = '${id}';`)).toBe("t");
  });

  it("reconciliation never finalizes (and so never compensates) a captured payment of a confirmed cancellation", async () => {
    // A cancellation without refund, whose booking was later flagged (e.g. another payment's refund failed).
    const { id } = confirmedBooking();
    await confirmCancellation(localServiceClient(), bookingOf(id), 3000, new Date(cutoffOf(id).getTime() + 1_000)).catch(() => undefined);
    await confirmCancellation(localServiceClient(), bookingOf(id), 0, new Date(cutoffOf(id).getTime() + 1_000));
    psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);

    await reconcile(id);

    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(paymentState(id)).toBe("captured:-");
  });

  it("reconciliation never refunds a cancel_pending booking without a confirmation", async () => {
    const { id } = confirmedBooking();
    psql(`UPDATE public.bookings SET status = 'cancel_pending', refund_cents = 3000 WHERE id = '${id}';`);

    await reconcile(id);

    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(bookingStatus(id)).toBe("cancel_pending");
  });

  it("a cancelled booking returns its places to the same slot", async () => {
    const { id, date } = confirmedBooking(4);
    expect(available(date)).toBe(0);

    await confirmCancellation(localServiceClient(), bookingOf(id), 3000);

    expect(available(date)).toBe(4);
  });

  it("confirming an unpaid booking is refused, not reported as cancelled", async () => {
    const { id } = confirmedBooking();
    psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);

    await expect(confirmCancellation(localServiceClient(), bookingOf(id), 3000)).rejects.toMatchObject({ code: "invalid_state" });
    expect(bookingStatus(id)).toBe("needs_attention");
  });

  it("no capture path finalizes a booking whose cancellation was confirmed (return page, webhook): no compensation refund", async () => {
    const { id } = confirmedBooking();
    const after = new Date(cutoffOf(id).getTime() + 1_000);
    await confirmCancellation(localServiceClient(), bookingOf(id), 0, after);
    psql(`UPDATE public.bookings SET status = 'needs_attention' WHERE id = '${id}';`);
    paypal.getOrder.mockResolvedValue({
      id: `ORDER-${id.slice(0, 8)}`,
      status: "COMPLETED",
      amountCents: 3000,
      currency: "EUR",
      customId: id,
      approveUrl: null,
      capture: { id: `CAP-${id.slice(0, 8)}`, status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: id, orderId: null },
    });

    expect(await captureApprovedOrder(localServiceClient(), id, "return")).toBe("compensating");
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(bookingStatus(id)).toBe("needs_attention");
    const reacquired = await localServiceClient().rpc("reacquire_hold", { p_booking_id: id });
    expect(reacquired.error?.message).toBe("invalid_state");
  });

  it("only a confirmed booking has a preview", async () => {
    const { id } = confirmedBooking();
    psql(`UPDATE public.bookings SET status = 'refunded' WHERE id = '${id}';`);

    await expect(cancellationPreview(localServiceClient(), bookingOf(id))).rejects.toMatchObject({ code: "invalid_state" });
  });
});
