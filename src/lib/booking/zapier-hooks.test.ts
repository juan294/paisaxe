// @vitest-environment node
/**
 * Where the Zapier sync fires (PayPal hackathon plan, Phase 8c): once per
 * transition to `confirmed` (consume_hold_and_confirm's own 'confirmed' reply)
 * and to `refunded` (markBookingRefunded's guarded UPDATE changed the row),
 * through every path that reaches them: capture (return page, webhooks,
 * reconciliation), refund settlement, the PayPal refund webhook and the
 * cancellation refund. A failing hook changes no outcome and no write.
 *
 * The real capture, payment-state, webhook and cancel modules run against the
 * scripted Supabase fake (which throws on any query that was not queued, so
 * `touched()` proves which reads and writes happened). PayPal is mocked; the
 * hook is a local HTTP server on loopback.
 */
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";
import type { PaypalOrder } from "@/lib/paypal/types";

const paypal = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  captureOrder: vi.fn(),
  refundCapture: vi.fn(),
  getCapture: vi.fn(),
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  const money = await vi.importActual<typeof import("@/lib/paypal/money")>("@/lib/paypal/money");
  return { ...types, ...money, ...paypal };
});
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const background = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((task: Promise<unknown>) => {
    background.pending.push(task);
  }),
}));

const { captureApprovedOrder, finalizeCaptured } = await import("./capture");
const { applyRefundStatus, markBookingRefunded } = await import("./payment-state");
const { processPaypalEvent } = await import("./webhook-events");
const { requestCancellationRefund } = await import("./cancel");

const ID = bookingRow().id;
const CAPTURE_ID = "CAP-1";
const CHANGED = { data: [{ id: "x" }] };
const LOST = { data: [] };
const FAILED = "[ZAPIER_SYNC_FAILED]";

let server: Server;
let base: string;
let received: Array<{ event: string; id: string }>;
let reply: (res: ServerResponse) => void;
let fake: BookingSupabaseFake;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push(JSON.parse(body));
      reply(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
  fake = createBookingSupabaseFake();
  received = [];
  reply = (res) => res.writeHead(200).end("{}");
  background.pending = [];
});

const settle = async () => {
  await Promise.all(background.pending.splice(0));
};

const touched = () => (fake.client.from as unknown as Mock).mock.calls.map((call) => call[0]);
const failures = () => logger.error.mock.calls.filter(([marker]) => marker === FAILED);

/** The sync's own read of the booking it reports. */
const queuePayloadRead = () => fake.onTable("bookings", { data: { ...bookingRow({ status: "confirmed" }), experience: { title: "Walk" } } });

const capturedPayment = (overrides: Record<string, unknown> = {}) => ({
  id: "pay-1",
  booking_id: ID,
  status: "captured",
  order_id: "ORDER-1",
  capture_id: CAPTURE_ID,
  operation_key: "op-key-1",
  amount_cents: 3000,
  currency: "EUR",
  compensation_reason: null,
  ...overrides,
});

/** The hook fails in each way the plan names: a non-2xx reply, an unreachable host, and the sync's own read failing. */
const FAILURE_MODES: Array<[string, () => void]> = [
  ["the hook answers 500", () => (reply = (res) => res.writeHead(500).end())],
  ["the hook is unreachable", () => vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", "http://127.0.0.1:1/hook")],
  ["the payload read fails", () => {}],
];

/** Queues the sync's read for a failure mode: an error for "the payload read fails", the row otherwise. */
function queuePayloadReadFor(mode: string) {
  if (mode === "the payload read fails") fake.onTable("bookings", { error: { message: "read-boom" } });
  else queuePayloadRead();
}

describe("booking.confirmed: consume_hold_and_confirm's 'confirmed' reply is the transition", () => {
  it("notifies once when the RPC confirmed the booking", async () => {
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    queuePayloadRead();

    expect(await finalizeCaptured(fake.client, bookingRow(), capturedPayment())).toBe("confirmed");
    await settle();

    expect(received).toEqual([expect.objectContaining({ id: "RS-ABC123", event: "booking.confirmed" })]);
  });

  it("a second finalize of the same capture ('already_confirmed') is confirmed but does not notify again", async () => {
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    queuePayloadRead();
    fake.onRpc("consume_hold_and_confirm", { data: "already_confirmed" });

    expect(await finalizeCaptured(fake.client, bookingRow(), capturedPayment())).toBe("confirmed");
    expect(await finalizeCaptured(fake.client, bookingRow({ status: "confirmed" }), capturedPayment())).toBe("confirmed");
    await settle();

    expect(received).toHaveLength(1);
    expect(touched()).toEqual(["bookings"]);
  });

  it("a lapsed hold re-acquired and then confirmed notifies once", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { data: true });
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    queuePayloadRead();

    expect(await finalizeCaptured(fake.client, bookingRow(), capturedPayment())).toBe("confirmed");
    await settle();

    expect(received.map((body) => body.event)).toEqual(["booking.confirmed"]);
  });

  it("a refused confirmation (invalid_state, compensating) does not notify", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "invalid_state" } });

    expect(await finalizeCaptured(fake.client, bookingRow(), capturedPayment())).toBe("compensating");
    await settle();

    expect(received).toEqual([]);
    expect(touched()).toEqual([]);
  });

  it("a confirmed booking seen again by captureApprovedOrder (return page, webhook, cron) does not notify", async () => {
    fake.onTable("bookings", { data: { ...bookingRow({ status: "confirmed" }), hold: {}, experience: { title: "Walk" } } });
    fake.onTable("payments", { data: capturedPayment() });

    expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("confirmed");
    await settle();

    expect(received).toEqual([]);
    expect(touched()).toEqual(["bookings", "payments"]);
  });

  it.each(FAILURE_MODES)("%s: the capture still returns confirmed with exactly the same writes", async (mode, arrange) => {
    arrange();
    const liveHold = { id: "hold-1", consumed_at: null, released_at: null, expires_at: new Date(Date.now() + 600_000).toISOString() };
    fake.onTable("bookings", { data: { ...bookingRow(), hold: liveHold, experience: { title: "Walk" } } });
    fake.onTable("payments", { data: capturedPayment({ status: "approved", capture_id: null }) });
    const writes = [fake.onTable("payments", CHANGED), fake.onTable("payments", CHANGED), fake.onTable("payments", CHANGED)];
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    queuePayloadReadFor(mode);
    const completed: PaypalOrder = {
      id: "ORDER-1",
      status: "COMPLETED",
      amountCents: 3000,
      currency: "EUR",
      customId: ID,
      capture: { id: CAPTURE_ID, status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: ID, orderId: null },
      approveUrl: null,
    };
    paypal.getOrder.mockResolvedValue({ ...completed, status: "APPROVED", capture: null });
    paypal.captureOrder.mockResolvedValue(completed);

    expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("confirmed");
    await settle();

    // loadState (2), approved/capture_pending/captured (3), then only the sync's read: no write, no flag, no refund.
    expect(touched()).toEqual(["bookings", "payments", "payments", "payments", "payments", "bookings"]);
    expect(writes.map((query) => query.update.mock.calls[0][0].status)).toEqual(["approved", "capture_pending", "captured"]);
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(failures()).toHaveLength(1);
  });
});

describe("booking.refunded: markBookingRefunded's guarded UPDATE changing the row is the transition", () => {
  it("notifies once when the booking became refunded", async () => {
    fake.onTable("bookings", CHANGED);
    queuePayloadRead();

    await markBookingRefunded(fake.client, capturedPayment({ status: "refunded" }), ID);
    await settle();

    expect(received).toEqual([expect.objectContaining({ id: "RS-ABC123", event: "booking.refunded" })]);
  });

  it("a lost race or an already refunded booking (no row changed) does not notify", async () => {
    fake.onTable("bookings", LOST);

    await markBookingRefunded(fake.client, capturedPayment({ status: "refunded" }), ID);
    await settle();

    expect(received).toEqual([]);
    expect(touched()).toEqual(["bookings"]);
  });

  it("a refunded duplicate capture leaves the booking confirmed and does not notify", async () => {
    await markBookingRefunded(fake.client, capturedPayment({ compensation_reason: "duplicate_capture" }), ID);
    await settle();

    expect(received).toEqual([]);
    expect(touched()).toEqual([]);
  });

  it("applyRefundStatus: COMPLETED notifies once; the same settlement observed again does not", async () => {
    fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);
    queuePayloadRead();
    fake.onTable("payments", LOST);

    expect(await applyRefundStatus(fake.client, capturedPayment({ status: "refund_pending" }), ID, "COMPLETED")).toBe("refunded");
    expect(await applyRefundStatus(fake.client, capturedPayment({ status: "refund_pending" }), ID, "COMPLETED")).toBeNull();
    await settle();

    expect(received.map((body) => body.event)).toEqual(["booking.refunded"]);
  });

  it("applyRefundStatus: a failed refund does not notify", async () => {
    fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);

    expect(await applyRefundStatus(fake.client, capturedPayment({ status: "refund_pending" }), ID, "FAILED")).toBe("refund_failed");
    await settle();

    expect(received).toEqual([]);
  });

  it("the PayPal refund webhook notifies once; its redelivery is out of order and does not", async () => {
    const event = {
      event_id: "WH-1",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      payload: {},
      order_id: "ORDER-1",
      capture_id: CAPTURE_ID,
      refund_id: "RF-1",
      custom_id: ID,
    };
    fake.onTable("payments", { data: capturedPayment({ status: "refund_pending" }) });
    fake.onTable("bookings", { data: bookingRow({ status: "refund_pending" }) });
    fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);
    queuePayloadRead();
    fake.onTable("payments", { data: capturedPayment({ status: "refunded" }) });
    fake.onTable("bookings", { data: bookingRow({ status: "refunded" }) });
    fake.onTable("payments", LOST);

    expect(await processPaypalEvent(fake.client, event)).toBe("recorded");
    expect(await processPaypalEvent(fake.client, event)).toBe("out_of_order");
    await settle();

    expect(received.map((body) => body.event)).toEqual(["booking.refunded"]);
  });

  it.each(FAILURE_MODES)("%s: the cancellation refund still settles and returns PayPal's refund", async (mode, arrange) => {
    arrange();
    const refund = { id: "RF-1", status: "COMPLETED" };
    paypal.refundCapture.mockResolvedValue(refund);
    const writes = [
      fake.onTable("payments", CHANGED), // captured -> refund_pending
      fake.onTable("bookings", CHANGED), // cancel_pending -> refund_pending
      fake.onTable("payments", CHANGED), // refund_pending -> refunded
      fake.onTable("bookings", CHANGED), // -> refunded
    ];
    queuePayloadReadFor(mode);

    expect(await requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, capturedPayment())).toEqual(refund);
    await settle();

    expect(touched()).toEqual(["payments", "bookings", "payments", "bookings", "bookings"]);
    expect(writes.map((query) => query.update.mock.calls[0][0].status)).toEqual(["refund_pending", "refund_pending", "refunded", "refunded"]);
    expect(failures()).toHaveLength(1);
    expect(received.length).toBe(mode === "the hook answers 500" ? 1 : 0);
  });
});
