// @vitest-environment node
/**
 * reconcileBookings against the scripted Supabase fake. The capture path,
 * cancellation refund, draft abandonment, inbox processing and PayPal are
 * replaced at the module boundary; the guarded writes (payment-state) are real,
 * so each test pins the step order, the selection filters, the writes and the
 * summary counters. The same scenarios run against the live local stack in
 * reconcile.postgrest-integration.test.ts (skipped in CI).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake, type FakeQuery } from "@/test/booking-supabase-fake";

const capture = vi.hoisted(() => ({ captureApprovedOrder: vi.fn(), finalizeCaptured: vi.fn() }));
vi.mock("./capture", () => capture);

const cancel = vi.hoisted(() => ({ requestCancellationRefund: vi.fn() }));
vi.mock("./cancel", () => cancel);

const drafts = vi.hoisted(() => ({ abandonStaleDrafts: vi.fn() }));
vi.mock("./drafts", () => drafts);

const invoice = vi.hoisted(() => ({ closeInvoiceAfterCancellation: vi.fn() }));
vi.mock("./invoice", () => invoice);

const inbox = vi.hoisted(() => ({ processAndRecordPaypalEvent: vi.fn() }));
vi.mock("./webhook-events", async (importOriginal) => ({ ...(await importOriginal<typeof import("./webhook-events")>()), ...inbox }));

const paypal = vi.hoisted(() => ({ getRefund: vi.fn(), refundCapture: vi.fn(), getCapture: vi.fn() }));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  const money = await vi.importActual<typeof import("@/lib/paypal/money")>("@/lib/paypal/money");
  return { ...types, ...money, ...paypal };
});

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

import { reconcileBookings, type ReconcileSummary } from "./reconcile";
import { PaypalWebhookUnmatched, UNMATCHED_TAG, type PaypalInboxEvent } from "./webhook-events";
import { PaypalError, PaypalNotConfigured } from "@/lib/paypal/types";
import type { Row } from "./payment-state";

const NOW = new Date("2026-11-20T09:00:00.000Z");
const B1 = "b0050000-0000-4000-8000-000000000101";
const B2 = "b0050000-0000-4000-8000-000000000102";
const ZERO: ReconcileSummary = {
  expiredHolds: 0,
  abandonedDrafts: 0,
  eventsReplayed: 0,
  eventsUnmatched: 0,
  confirmed: 0,
  expired: 0,
  stillPending: 0,
  flaggedForAttention: 0,
  refundsRequested: 0,
  refunded: 0,
  refundFailed: 0,
  staleAttention: 0,
  invoicesCancelled: 0,
  errors: 0,
};

/** A payments row with its booking embedded under `bookings`, as the step queries return it. */
function paymentRow(overrides: Row = {}, bookingOverrides: Row = {}): Row {
  const bookingId = (overrides.booking_id as string | undefined) ?? B1;
  return {
    id: `pay-${bookingId.slice(-3)}`,
    booking_id: bookingId,
    order_id: "ORDER-1",
    capture_id: null,
    refund_id: null,
    status: "created",
    reconcile_passes: 0,
    amount_cents: 3000,
    operation_key: "op-key-1",
    compensation_reason: null,
    ...overrides,
    bookings: bookingRow({ id: bookingId, hold_id: "hold-1", refund_cents: null, ...bookingOverrides }),
  };
}

/** The payment as the capture functions take it: without the embedded booking. */
function paymentOnly(row: Row): Row {
  const payment = { ...row };
  delete payment.bookings;
  return payment;
}

function inboxRow(eventId: string): PaypalInboxEvent {
  return {
    event_id: eventId,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    payload: { id: eventId },
    order_id: "ORDER-1",
    capture_id: "CAP-1",
    refund_id: null,
    custom_id: B1,
  };
}

type Result = { data?: unknown; error?: { message: string } | null };

interface Step {
  rows?: unknown[] | null;
  error?: { message: string };
  /** Queries the step's items make, queued after the step's own select: [table, result]. */
  writes?: Array<[string, Result]>;
}

interface Script {
  expiredHolds?: unknown;
  expireError?: { message: string };
  abandoned?: number;
  inbox?: Step;
  open?: Step;
  pending?: Step;
  captured?: Step;
  refunds?: Step;
  cancels?: Step;
  stale?: { ids?: string[] | null; count?: number | null; error?: { message: string } };
  invoices?: Step;
}

type StepName = "inbox" | "open" | "pending" | "captured" | "refunds" | "cancels" | "stale" | "invoices";

/**
 * Local helper: the shared fake resolves only { data, error }, but step 8 reads
 * PostgREST's `count`. This overrides one queued query's settlement to carry it.
 */
function withCount(query: FakeQuery, result: { data: unknown; count: number | null; error: { message: string } | null }): FakeQuery {
  Object.assign(query, {
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  });
  return query;
}

let fake: BookingSupabaseFake;

/**
 * Queues one whole run in call order. Returns each step's select, and every
 * per-item query (`writes`, in the order queued) for assertions.
 */
function script(s: Script = {}): Record<StepName, FakeQuery> & { writes: FakeQuery[] } {
  fake.onRpc("expire_holds", s.expireError ? { error: s.expireError } : { data: s.expiredHolds ?? 0 });
  drafts.abandonStaleDrafts.mockResolvedValue(s.abandoned ?? 0);
  const writes: FakeQuery[] = [];
  const stage = (table: string, step: Step = {}) => {
    const query = fake.onTable(table, { data: step.rows === undefined ? [] : step.rows, error: step.error });
    for (const [writeTable, result] of step.writes ?? []) writes.push(fake.onTable(writeTable, result));
    return query;
  };
  const queries = {
    inbox: stage("paypal_webhook_events", s.inbox),
    open: stage("payments", s.open),
    pending: stage("payments", s.pending),
    captured: stage("payments", s.captured),
    refunds: stage("payments", s.refunds),
    cancels: stage("payments", s.cancels),
  };
  const stale = s.stale ?? {};
  const ids = stale.ids === undefined ? [] : stale.ids;
  const staleQuery = withCount(fake.onTable("bookings", {}), {
    data: ids === null ? null : ids.map((id) => ({ id })),
    count: stale.count === undefined ? ids?.length ?? 0 : stale.count,
    error: stale.error ?? null,
  });
  const invoices = stage("bookings", s.invoices);
  return { ...queries, stale: staleQuery, invoices, writes };
}

/** A guarded write's result: whether a row matched the guard. */
const changed = (yes = true): Result => ({ data: yes ? [{ id: "row" }] : [] });

const tablesQueried = () => vi.mocked(fake.client.from).mock.calls.map(([table]) => table);

/** Every update payload sent to `table`, in order (the fake records them on the queued queries). */
function updatesTo(table: string): unknown[] {
  return vi
    .mocked(fake.client.from)
    .mock.calls.map(([name], index) => [name, vi.mocked(fake.client.from).mock.results[index]?.value as FakeQuery | undefined] as const)
    .filter(([name, query]) => name === table && query && query.update.mock.calls.length > 0)
    .map(([, query]) => (query as FakeQuery).update.mock.calls[0][0]);
}

const attentionLogs = () => logger.error.mock.calls.filter(([tag]) => tag === "[CRON_RECONCILE_ATTENTION]");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  fake = createBookingSupabaseFake();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reconcileBookings: the run", () => {
  it("runs the nine steps in order and reports nothing when nothing is due", async () => {
    script();

    await expect(reconcileBookings(fake.client)).resolves.toEqual(ZERO);

    expect(fake.rpc).toHaveBeenCalledWith("expire_holds");
    expect(fake.rpc.mock.invocationCallOrder[0]).toBeLessThan(drafts.abandonStaleDrafts.mock.invocationCallOrder[0]);
    expect(drafts.abandonStaleDrafts.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fake.client.from).mock.invocationCallOrder[0]);
    expect(drafts.abandonStaleDrafts).toHaveBeenCalledWith(fake.client);
    expect(tablesQueried()).toEqual(["paypal_webhook_events", "payments", "payments", "payments", "payments", "payments", "bookings", "bookings"]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("selects each step's rows with its filters, oldest first, in batches of 50", async () => {
    const q = script();

    await reconcileBookings(fake.client);

    for (const step of ["open", "pending", "captured", "refunds", "cancels"] as const) {
      expect(q[step].select).toHaveBeenCalledWith("*, bookings!inner(*)");
      expect(q[step].order).toHaveBeenCalledWith("created_at", { ascending: true });
      expect(q[step].limit).toHaveBeenCalledWith(50);
    }
    // Step 3: open orders of bookings still awaiting payment.
    expect(q.open.in).toHaveBeenCalledWith("status", ["created", "approved"]);
    expect(q.open.eq).toHaveBeenCalledWith("bookings.status", "pending_payment");
    // Step 4: every capture_pending payment, whatever its booking's status (a flagged booking keeps being reconciled).
    expect(q.pending.in).toHaveBeenCalledWith("status", ["capture_pending"]);
    expect(q.pending.eq).not.toHaveBeenCalled();
    // Step 5: captured payments with a capture id whose booking is not finalized.
    expect(q.captured.in).toHaveBeenCalledWith("status", ["captured"]);
    expect(q.captured.not).toHaveBeenCalledWith("capture_id", "is", null);
    expect(q.captured.in).toHaveBeenCalledWith("bookings.status", ["pending_payment", "needs_attention", "expired"]);
    // ...and never a booking whose cancellation was confirmed: finalizing it would refund it as a compensation.
    expect(q.captured.is).toHaveBeenCalledWith("bookings.cancellation_confirmed_at", null);
    // Step 6
    expect(q.refunds.in).toHaveBeenCalledWith("status", ["refund_pending"]);
    // Step 7: only confirmed cancellations with something to refund and no refund yet.
    expect(q.cancels.in).toHaveBeenCalledWith("status", ["captured"]);
    expect(q.cancels.is).toHaveBeenCalledWith("refund_id", null);
    expect(q.cancels.eq).toHaveBeenCalledWith("bookings.status", "cancel_pending");
    expect(q.cancels.not).toHaveBeenCalledWith("bookings.cancellation_confirmed_at", "is", null);
    expect(q.cancels.gt).toHaveBeenCalledWith("bookings.refund_cents", 0);
    // Unscoped: no booking filter anywhere.
    for (const step of ["inbox", "open", "pending", "captured", "refunds", "cancels", "stale", "invoices"] as const) {
      expect(q[step].in).not.toHaveBeenCalledWith(expect.stringMatching(/^(booking_id|custom_id|id)$/), expect.anything());
    }
  });

  it("drains only events unprocessed for two minutes, skipping unmatched ones so they never starve the batch", async () => {
    const q = script();

    await reconcileBookings(fake.client);

    expect(q.inbox.select).toHaveBeenCalledWith("event_id, event_type, payload, order_id, capture_id, refund_id, custom_id");
    expect(q.inbox.is).toHaveBeenCalledWith("processed_at", null);
    expect(q.inbox.lt).toHaveBeenCalledWith("received_at", "2026-11-20T08:58:00.000Z");
    expect(q.inbox.or).toHaveBeenCalledWith(`last_error.is.null,last_error.not.like.${UNMATCHED_TAG}*`);
    expect(q.inbox.order).toHaveBeenCalledWith("received_at", { ascending: true });
    expect(q.inbox.limit).toHaveBeenCalledWith(50);
  });

  it("scopes steps 2 to 8 to the given bookings (manual replay, shared test databases)", async () => {
    const q = script();

    await reconcileBookings(fake.client, { bookingIds: [B1, B2] });

    expect(q.inbox.in).toHaveBeenCalledWith("custom_id", [B1, B2]);
    for (const step of ["open", "pending", "captured", "refunds", "cancels"] as const) {
      expect(q[step].in).toHaveBeenCalledWith("booking_id", [B1, B2]);
    }
    expect(q.stale.in).toHaveBeenCalledWith("id", [B1, B2]);
    expect(q.invoices.in).toHaveBeenCalledWith("id", [B1, B2]);
    // Step 1 is global.
    expect(fake.rpc).toHaveBeenCalledWith("expire_holds");
    expect(drafts.abandonStaleDrafts).toHaveBeenCalledWith(fake.client);
  });

  it("treats a step select that returns no data as no rows", async () => {
    script({ open: { rows: null }, pending: { rows: null } });

    await expect(reconcileBookings(fake.client)).resolves.toEqual(ZERO);
    expect(capture.captureApprovedOrder).not.toHaveBeenCalled();
  });

  it("fails the run when a step's rows cannot be loaded", async () => {
    script({ open: { error: { message: "timeout" } } });

    await expect(reconcileBookings(fake.client)).rejects.toThrow("Failed to load created|approved payments: timeout");
    expect(tablesQueried()).toEqual(["paypal_webhook_events", "payments"]);
  });
});

describe("step 1: expire_holds and stale drafts", () => {
  it("counts expired holds and abandoned drafts", async () => {
    script({ expiredHolds: 3, abandoned: 2 });

    await expect(reconcileBookings(fake.client)).resolves.toMatchObject({ expiredHolds: 3, abandonedDrafts: 2 });
  });

  it("counts zero expired holds when expire_holds returns no number", async () => {
    script({ expiredHolds: "3" });

    await expect(reconcileBookings(fake.client)).resolves.toMatchObject({ expiredHolds: 0 });
  });

  it("fails the run before any other step when expire_holds fails", async () => {
    script({ expireError: { message: "denied" } });

    await expect(reconcileBookings(fake.client)).rejects.toThrow("expire_holds failed: denied");
    expect(drafts.abandonStaleDrafts).not.toHaveBeenCalled();
    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("step 2: inbox drain (R2-04)", () => {
  it("replays each due event from its inbox row alone", async () => {
    const events = [inboxRow("WH-1"), inboxRow("WH-2")];
    script({ inbox: { rows: events } });
    inbox.processAndRecordPaypalEvent.mockResolvedValue("confirmed");

    const summary = await reconcileBookings(fake.client);

    expect(summary.eventsReplayed).toBe(2);
    expect(inbox.processAndRecordPaypalEvent).toHaveBeenNthCalledWith(1, fake.client, events[0]);
    expect(inbox.processAndRecordPaypalEvent).toHaveBeenNthCalledWith(2, fake.client, events[1]);
    expect(paypal.getCapture).not.toHaveBeenCalled();
  });

  it("counts unmatched events apart from errors and keeps draining", async () => {
    script({ inbox: { rows: [inboxRow("WH-UNM"), inboxRow("WH-BAD"), inboxRow("WH-OK")] } });
    inbox.processAndRecordPaypalEvent
      .mockRejectedValueOnce(new PaypalWebhookUnmatched("WH-UNM"))
      .mockRejectedValueOnce(new Error("connection reset by peer"))
      .mockResolvedValueOnce("confirmed");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toMatchObject({ eventsUnmatched: 1, errors: 1, eventsReplayed: 1 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ITEM_FAILED]", { step: "inbox", eventId: "WH-BAD", error: "connection reset by peer" });
  });

  it("logs a non-Error failure by its string form", async () => {
    script({ inbox: { rows: [inboxRow("WH-STR")] } });
    inbox.processAndRecordPaypalEvent.mockRejectedValueOnce("plain failure");

    await expect(reconcileBookings(fake.client)).resolves.toMatchObject({ errors: 1 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ITEM_FAILED]", expect.objectContaining({ error: "plain failure" }));
  });

  it("aborts the run when PayPal is unreachable while replaying", async () => {
    script({ inbox: { rows: [inboxRow("WH-1"), inboxRow("WH-2")] } });
    inbox.processAndRecordPaypalEvent.mockRejectedValueOnce(new PaypalError("PayPal getOrder failed with HTTP 503", { status: 503 }));

    await expect(reconcileBookings(fake.client)).rejects.toThrow("HTTP 503");
    expect(inbox.processAndRecordPaypalEvent).toHaveBeenCalledTimes(1);
    expect(tablesQueried()).toEqual(["paypal_webhook_events"]);
  });

  it("fails the run when the inbox cannot be read", async () => {
    script({ inbox: { error: { message: "denied" } } });

    await expect(reconcileBookings(fake.client)).rejects.toThrow("Failed to load unprocessed PayPal events: denied");
  });

  it("replays nothing when the inbox read returns no rows", async () => {
    script({ inbox: { rows: null } });

    await expect(reconcileBookings(fake.client)).resolves.toMatchObject({ eventsReplayed: 0 });
    expect(inbox.processAndRecordPaypalEvent).not.toHaveBeenCalled();
  });
});

describe("step 3: open orders", () => {
  const liveHold = { expires_at: "2026-11-20T09:10:00.000Z", consumed_at: null, released_at: null };
  const deadHold = { expires_at: "2026-11-20T08:59:59.000Z", consumed_at: null, released_at: null };

  it("captures the approved-and-abandoned browser's order through the shared capture path", async () => {
    const row = paymentRow({ status: "approved" });
    script({ open: { rows: [row] } });
    capture.captureApprovedOrder.mockResolvedValue("confirmed");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, confirmed: 1 });
    expect(capture.captureApprovedOrder).toHaveBeenCalledWith(fake.client, B1, "reconcile");
    expect(tablesQueried()).not.toContain("holds");
  });

  it("counts a slot gone at capture as expired", async () => {
    script({ open: { rows: [paymentRow({ status: "approved" })] } });
    capture.captureApprovedOrder.mockResolvedValue("slot_gone");

    await expect(reconcileBookings(fake.client)).resolves.toEqual({ ...ZERO, expired: 1 });
  });

  it("counts nothing for any other outcome", async () => {
    script({ open: { rows: [paymentRow({ status: "approved" })] } });
    capture.captureApprovedOrder.mockResolvedValue("compensating");

    await expect(reconcileBookings(fake.client)).resolves.toEqual(ZERO);
  });

  it("leaves an order awaiting approval alone while its hold is live", async () => {
    const { writes } = script({ open: { rows: [paymentRow()], writes: [["holds", { data: liveHold }]] } });
    capture.captureApprovedOrder.mockResolvedValue("awaiting_approval");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual(ZERO);
    expect(writes[0].select).toHaveBeenCalledWith("expires_at, consumed_at, released_at");
    expect(writes[0].eq).toHaveBeenCalledWith("id", "hold-1");
    expect(updatesTo("payments")).toEqual([]);
    expect(updatesTo("bookings")).toEqual([]);
  });

  it.each([
    ["has expired", deadHold],
    ["was released", { ...liveHold, released_at: "2026-11-20T08:00:00.000Z" }],
  ])("expires payment and booking, guarded, when the order still awaits approval and the hold %s", async (_label, hold) => {
    const { writes } = script({ open: { rows: [paymentRow()], writes: [["holds", { data: hold }], ["payments", changed()], ["bookings", changed()]] } });
    capture.captureApprovedOrder.mockResolvedValue("awaiting_approval");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, expired: 1 });
    const [, paymentGuard, bookingGuard] = writes;
    expect(paymentGuard.update).toHaveBeenCalledWith({ status: "expired" });
    expect(paymentGuard.eq).toHaveBeenCalledWith("id", "pay-101");
    expect(paymentGuard.in).toHaveBeenCalledWith("status", ["created", "approved"]);
    expect(bookingGuard.update).toHaveBeenCalledWith({ status: "expired" });
    expect(bookingGuard.eq).toHaveBeenCalledWith("id", B1);
    expect(bookingGuard.in).toHaveBeenCalledWith("status", ["pending_payment"]);
  });

  it("does not expire the booking when another caller moved the payment first", async () => {
    script({ open: { rows: [paymentRow()], writes: [["holds", { data: deadHold }], ["payments", changed(false)]] } });
    capture.captureApprovedOrder.mockResolvedValue("awaiting_approval");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual(ZERO);
    expect(updatesTo("bookings")).toEqual([]);
  });

  it("counts a hold that cannot be loaded as an item error and keeps going", async () => {
    const second = paymentRow({ booking_id: B2, status: "approved" });
    script({ open: { rows: [paymentRow(), second], writes: [["holds", { error: { message: "gone" } }]] } });
    capture.captureApprovedOrder.mockResolvedValueOnce("awaiting_approval").mockResolvedValueOnce("confirmed");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, errors: 1, confirmed: 1 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ITEM_FAILED]", {
      step: "open_orders",
      bookingId: B1,
      paymentId: "pay-101",
      error: "Failed to load hold: gone",
    });
  });
});

describe("step 4: capture_pending (R2-02)", () => {
  function pendingRow(passes: number, bookingStatus = "pending_payment") {
    return paymentRow({ status: "capture_pending", reconcile_passes: passes }, { status: bookingStatus });
  }

  it.each([
    [0, 1],
    [1, 2],
  ])("counts an inconclusive pass (%i -> %i) without flagging the booking", async (before, after) => {
    script({ pending: { rows: [pendingRow(before)], writes: [["payments", changed()]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, stillPending: 1 });
    expect(updatesTo("payments")).toEqual([{ reconcile_passes: after }]);
    expect(updatesTo("bookings")).toEqual([]);
    expect(attentionLogs()).toEqual([]);
  });

  it("counts the pass only if no other run counted it (compare-and-set on the old count)", async () => {
    const { writes } = script({ pending: { rows: [pendingRow(1)], writes: [["payments", changed()]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    await reconcileBookings(fake.client);

    const [passWrite] = writes;
    expect(passWrite.update).toHaveBeenCalledWith({ reconcile_passes: 2 });
    expect(passWrite.eq).toHaveBeenCalledWith("id", "pay-101");
    expect(passWrite.eq).toHaveBeenCalledWith("status", "capture_pending");
    expect(passWrite.eq).toHaveBeenCalledWith("reconcile_passes", 1);
    expect(passWrite.select).toHaveBeenCalledWith("id");
  });

  it("flags the booking on the third inconclusive pass, keeps the payment capture_pending, and logs the attention", async () => {
    script({ pending: { rows: [pendingRow(2)], writes: [["payments", changed()], ["bookings", changed()]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, stillPending: 1, flaggedForAttention: 1 });
    expect(updatesTo("payments")).toEqual([{ reconcile_passes: 3 }]);
    expect(updatesTo("bookings")).toEqual([{ status: "needs_attention" }]);
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ATTENTION]", {
      bookingId: B1,
      paymentId: "pay-101",
      passes: 3,
      reason: "capture_unconfirmed",
    });
  });

  it("treats awaiting_approval as inconclusive too", async () => {
    script({ pending: { rows: [pendingRow(2)], writes: [["payments", changed()], ["bookings", changed()]] } });
    capture.captureApprovedOrder.mockResolvedValue("awaiting_approval");

    await expect(reconcileBookings(fake.client)).resolves.toEqual({ ...ZERO, stillPending: 1, flaggedForAttention: 1 });
  });

  it("still reports the third pass when the booking was already flagged", async () => {
    script({ pending: { rows: [pendingRow(2, "needs_attention")], writes: [["payments", changed()], ["bookings", changed(false)]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    const summary = await reconcileBookings(fake.client);

    expect(summary.flaggedForAttention).toBe(1);
    expect(attentionLogs()).toHaveLength(1);
  });

  it("keeps reconciling a flagged booking after the third pass without reporting it again", async () => {
    script({ pending: { rows: [pendingRow(3, "needs_attention")], writes: [["payments", changed()], ["bookings", changed(false)]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    const summary = await reconcileBookings(fake.client);

    expect(capture.captureApprovedOrder).toHaveBeenCalledWith(fake.client, B1, "reconcile");
    expect(summary).toEqual({ ...ZERO, stillPending: 1 });
    expect(updatesTo("payments")).toEqual([{ reconcile_passes: 4 }]);
    expect(attentionLogs()).toEqual([]);
  });

  it("confirms a flagged booking on the next run once PayPal completes the order", async () => {
    script({ pending: { rows: [pendingRow(3, "needs_attention")] } });
    capture.captureApprovedOrder.mockResolvedValue("confirmed");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, confirmed: 1 });
    expect(updatesTo("payments")).toEqual([]);
  });

  it("does not flag when a concurrent run already counted the pass", async () => {
    script({ pending: { rows: [pendingRow(2)], writes: [["payments", changed(false)]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, stillPending: 1 });
    expect(updatesTo("bookings")).toEqual([]);
    expect(attentionLogs()).toEqual([]);
  });

  it("counts a pass that cannot be written as an item error", async () => {
    script({ pending: { rows: [pendingRow(0)], writes: [["payments", { error: { message: "conflict" } }]] } });
    capture.captureApprovedOrder.mockResolvedValue("pending");

    const summary = await reconcileBookings(fake.client);

    expect(summary.errors).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_RECONCILE_ITEM_FAILED]",
      expect.objectContaining({ step: "capture_pending", error: "Failed to count reconcile pass: conflict" })
    );
  });
});

describe("PayPal unreachable aborts the run with states untouched", () => {
  it.each([
    ["no answer at all", new PaypalError("PayPal getOrder could not be reached", { status: null })],
    ["a 5xx", new PaypalError("PayPal getOrder failed with HTTP 502", { status: 502 })],
    ["PayPal not configured", new PaypalNotConfigured()],
  ])("on %s while following capture_pending: no pass counted, no later step", async (_label, error) => {
    script({ pending: { rows: [paymentRow({ status: "capture_pending" }), paymentRow({ booking_id: B2, status: "capture_pending" })] } });
    capture.captureApprovedOrder.mockRejectedValue(error);

    await expect(reconcileBookings(fake.client)).rejects.toBe(error);

    expect(capture.captureApprovedOrder).toHaveBeenCalledTimes(1);
    expect(updatesTo("payments")).toEqual([]);
    expect(updatesTo("bookings")).toEqual([]);
    expect(tablesQueried()).toEqual(["paypal_webhook_events", "payments", "payments"]);
  });

  it("a PayPal 4xx is an item error: counted, and the run continues", async () => {
    script({ open: { rows: [paymentRow({ status: "approved" }), paymentRow({ booking_id: B2, status: "approved" })] } });
    capture.captureApprovedOrder
      .mockRejectedValueOnce(new PaypalError("PayPal getOrder failed with HTTP 404", { status: 404 }))
      .mockResolvedValueOnce("confirmed");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, errors: 1, confirmed: 1 });
    expect(tablesQueried()).toContain("bookings");
  });
});

describe("step 5: captured payments not yet confirmed", () => {
  it("finalizes without asking PayPal and counts the outcome", async () => {
    const confirmedRow = paymentRow({ status: "captured", capture_id: "CAP-1" }, { status: "expired" });
    const goneRow = paymentRow({ booking_id: B2, status: "captured", capture_id: "CAP-2" });
    script({ captured: { rows: [confirmedRow, goneRow] } });
    capture.finalizeCaptured.mockResolvedValueOnce("confirmed").mockResolvedValueOnce("slot_gone");

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, confirmed: 1, expired: 1 });
    expect(capture.finalizeCaptured).toHaveBeenNthCalledWith(1, fake.client, confirmedRow.bookings, paymentOnly(confirmedRow));
    expect(capture.captureApprovedOrder).not.toHaveBeenCalled();
  });
});

describe("step 6: refund_pending", () => {
  function refundRow(overrides: Row = {}, bookingOverrides: Row = {}) {
    return paymentRow({ status: "refund_pending", capture_id: "CAP-1", ...overrides }, { status: "needs_attention", ...bookingOverrides });
  }

  it("follows a COMPLETED refund to refunded, payment and booking", async () => {
    script({ refunds: { rows: [refundRow({ refund_id: "RF-1", compensation_reason: "slot_gone" })], writes: [["payments", changed()], ["bookings", changed()]] } });
    paypal.getRefund.mockResolvedValue({ id: "RF-1", status: "COMPLETED" });

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, refunded: 1 });
    expect(paypal.getRefund).toHaveBeenCalledWith("RF-1");
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(updatesTo("payments")).toEqual([{ status: "refunded", refunded_at: NOW.toISOString() }]);
    expect(updatesTo("bookings")).toEqual([{ status: "refunded" }]);
  });

  it.each(["FAILED", "CANCELLED"])("follows a %s refund to refund_failed and flags the booking", async (status) => {
    script({ refunds: { rows: [refundRow({ refund_id: "RF-1" })], writes: [["payments", changed()], ["bookings", changed()]] } });
    paypal.getRefund.mockResolvedValue({ id: "RF-1", status });

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, refundFailed: 1 });
    expect(updatesTo("payments")).toEqual([{ status: "refund_failed" }]);
    expect(updatesTo("bookings")).toEqual([{ status: "needs_attention" }]);
  });

  it("changes nothing while PayPal still reports the refund PENDING", async () => {
    script({ refunds: { rows: [refundRow({ refund_id: "RF-1" })] } });
    paypal.getRefund.mockResolvedValue({ id: "RF-1", status: "PENDING" });

    await expect(reconcileBookings(fake.client)).resolves.toEqual(ZERO);
    expect(updatesTo("payments")).toEqual([]);
  });

  it("counts nothing when another caller applied the refund status first", async () => {
    script({ refunds: { rows: [refundRow({ refund_id: "RF-1" })], writes: [["payments", changed(false)]] } });
    paypal.getRefund.mockResolvedValue({ id: "RF-1", status: "COMPLETED" });

    await expect(reconcileBookings(fake.client)).resolves.toEqual(ZERO);
  });

  it("retries a compensation refund with no refund id for the whole capture with the payment's fixed key", async () => {
    script({ refunds: { rows: [refundRow({ compensation_reason: "slot_gone" })], writes: [["payments", changed()]] } });
    paypal.refundCapture.mockResolvedValue({ id: "RF-NEW", status: "PENDING" });

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, refundsRequested: 1 });
    expect(paypal.refundCapture).toHaveBeenCalledWith("CAP-1", 3000, "op-key-1");
    expect(updatesTo("payments")).toEqual([{ refund_id: "RF-NEW" }]);
    expect(paypal.getRefund).not.toHaveBeenCalled();
  });

  it("requests a cancellation refund for the amount Phase 5 computed, and applies an immediate COMPLETED", async () => {
    script({
      refunds: {
        rows: [refundRow({}, { status: "refund_pending", refund_cents: 1500 })],
        writes: [["payments", changed()], ["payments", changed()], ["bookings", changed()]],
      },
    });
    paypal.refundCapture.mockResolvedValue({ id: "RF-NEW", status: "COMPLETED" });

    const summary = await reconcileBookings(fake.client);

    expect(paypal.refundCapture).toHaveBeenCalledWith("CAP-1", 1500, "op-key-1");
    expect(summary).toEqual({ ...ZERO, refundsRequested: 1, refunded: 1 });
    expect(updatesTo("payments")).toEqual([{ refund_id: "RF-NEW" }, { status: "refunded", refunded_at: NOW.toISOString() }]);
  });

  it.each([
    ["no amount", null],
    ["zero", 0],
    ["a negative amount", -5],
    ["a fractional amount", 12.5],
  ])("never requests a refund for %s: item error", async (_label, refundCents) => {
    script({ refunds: { rows: [refundRow({}, { refund_cents: refundCents })] } });

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, errors: 1 });
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_RECONCILE_ITEM_FAILED]",
      expect.objectContaining({ step: "refund_pending", error: "No refund amount for payment pay-101" })
    );
  });

  it("aborts with nothing written when PayPal is unreachable for the refund", async () => {
    script({ refunds: { rows: [refundRow({ compensation_reason: "slot_gone" })] } });
    paypal.refundCapture.mockRejectedValue(new PaypalError("PayPal refund could not be reached", { status: null }));

    await expect(reconcileBookings(fake.client)).rejects.toThrow("could not be reached");
    expect(updatesTo("payments")).toEqual([]);
  });
});

describe("step 7: confirmed cancellations whose refund was never created", () => {
  it("requests the cancellation refund for each and counts it", async () => {
    const row = paymentRow({ status: "captured", capture_id: "CAP-1" }, { status: "cancel_pending", cancellation_confirmed_at: NOW.toISOString(), refund_cents: 1500 });
    script({ cancels: { rows: [row] } });
    cancel.requestCancellationRefund.mockResolvedValue({ id: "RF-1", status: "PENDING" });

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, refundsRequested: 1 });
    expect(cancel.requestCancellationRefund).toHaveBeenCalledWith(fake.client, row.bookings, paymentOnly(row));
  });

  it("does not count a refund that was refused for good or lost a race (null)", async () => {
    script({ cancels: { rows: [paymentRow({ status: "captured" }, { status: "cancel_pending", refund_cents: 1500 })] } });
    cancel.requestCancellationRefund.mockResolvedValue(null);

    expect(await reconcileBookings(fake.client)).toEqual(ZERO);
  });

  it("counts a failed cancellation refund as an item error", async () => {
    script({ cancels: { rows: [paymentRow({ status: "captured" }, { status: "cancel_pending" })] } });
    cancel.requestCancellationRefund.mockRejectedValue(new Error("refund rejected"));

    const summary = await reconcileBookings(fake.client);

    expect(summary).toEqual({ ...ZERO, errors: 1 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ITEM_FAILED]", expect.objectContaining({ step: "cancel_pending" }));
  });
});

describe("step 8: stale needs_attention report", () => {
  it("reports needs_attention bookings untouched for 15 minutes", async () => {
    const q = script({ stale: { ids: [B1, B2] } });

    const summary = await reconcileBookings(fake.client);

    expect(summary.staleAttention).toBe(2);
    expect(q.stale.select).toHaveBeenCalledWith("id", { count: "exact" });
    expect(q.stale.eq).toHaveBeenCalledWith("status", "needs_attention");
    expect(q.stale.lt).toHaveBeenCalledWith("updated_at", "2026-11-20T08:45:00.000Z");
    expect(q.stale.order).toHaveBeenCalledWith("updated_at", { ascending: true });
    expect(q.stale.limit).toHaveBeenCalledWith(20);
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ATTENTION]", { staleCount: 2, bookingIds: [B1, B2] });
  });

  it("reports the total count even when the page carries no rows", async () => {
    script({ stale: { ids: null, count: 25 } });

    await expect(reconcileBookings(fake.client)).resolves.toMatchObject({ staleAttention: 25 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ATTENTION]", { staleCount: 25, bookingIds: [] });
  });

  it("reports nothing when the count is missing", async () => {
    script({ stale: { ids: [], count: null } });

    await expect(reconcileBookings(fake.client)).resolves.toMatchObject({ staleAttention: 0 });
    expect(attentionLogs()).toEqual([]);
  });

  it("fails the run when the report cannot be read", async () => {
    script({ stale: { error: { message: "denied" } } });

    await expect(reconcileBookings(fake.client)).rejects.toThrow("Failed to load needs_attention bookings: denied");
  });
});

describe("step 9: balance invoices of cancelled bookings (Phase 8a)", () => {
  it("selects confirmed cancellations whose invoice is still open, or whose paid balance awaits the operator", async () => {
    const q = script();

    await reconcileBookings(fake.client);

    expect(q.invoices.select).toHaveBeenCalledWith("id");
    expect(q.invoices.not).toHaveBeenCalledWith("cancellation_confirmed_at", "is", null);
    expect(q.invoices.or).toHaveBeenCalledWith(
      "invoice_status.in.(draft,sent,payment_pending),and(invoice_status.in.(paid,partially_paid),status.in.(cancelled,refunded))"
    );
    expect(q.invoices.order).toHaveBeenCalledWith("updated_at", { ascending: true });
    expect(q.invoices.limit).toHaveBeenCalledWith(50);
  });

  it("closes each one and counts cancelled invoices and bookings flagged for a paid balance", async () => {
    script({ invoices: { rows: [{ id: B1 }, { id: B2 }, { id: "b3" }] } });
    invoice.closeInvoiceAfterCancellation.mockResolvedValueOnce("cancelled").mockResolvedValueOnce("flagged").mockResolvedValueOnce("awaiting_completion");

    const summary = await reconcileBookings(fake.client);

    expect(invoice.closeInvoiceAfterCancellation.mock.calls).toEqual([
      [fake.client, B1],
      [fake.client, B2],
      [fake.client, "b3"],
    ]);
    expect(summary).toEqual({ ...ZERO, invoicesCancelled: 1, flaggedForAttention: 1 });
  });

  it("counts a failure and retries next run; PayPal unreachable stops the run", async () => {
    script({ invoices: { rows: [{ id: B1 }] } });
    invoice.closeInvoiceAfterCancellation.mockRejectedValueOnce(new PaypalError("refused", { status: 422 }));

    await expect(reconcileBookings(fake.client)).resolves.toEqual({ ...ZERO, errors: 1 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_RECONCILE_ITEM_FAILED]", expect.objectContaining({ step: "invoices", bookingId: B1 }));

    script({ invoices: { rows: [{ id: B1 }] } });
    invoice.closeInvoiceAfterCancellation.mockRejectedValueOnce(new PaypalError("down", { status: 503 }));
    await expect(reconcileBookings(fake.client)).rejects.toThrow("down");
  });

  it("treats no data as no rows, and fails the run when the rows cannot be read", async () => {
    script({ invoices: { rows: null } });
    await expect(reconcileBookings(fake.client)).resolves.toEqual(ZERO);

    script({ invoices: { error: { message: "denied" } } });
    await expect(reconcileBookings(fake.client)).rejects.toThrow("Failed to load cancelled bookings with an invoice: denied");
  });
});
