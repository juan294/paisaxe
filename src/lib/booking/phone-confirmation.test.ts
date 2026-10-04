// @vitest-environment node
/**
 * Unit tests for the phone-confirmation flow (PayPal hackathon plan, Phase 8b,
 * decision R7) over the scripted Supabase fake, so CI (no local Supabase)
 * covers every branch. phone-confirmation.postgrest-integration.test.ts proves
 * the same outcomes and the database's own guard against the live stack.
 *
 * PayPal, the existing voice-booking services (booking-service,
 * elevenlabs-call-service) and the booking_system flag are replaced at the
 * module boundary: no call, no PayPal request. The fake throws on any query
 * that was not queued, so `touched()` also proves which writes did NOT happen.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake, type FakeQuery } from "@/test/booking-supabase-fake";
import type { PaypalAuthorization, PaypalCapture, PaypalOrder } from "@/lib/paypal/types";

const paypal = vi.hoisted(() => ({
  getOrder: vi.fn(),
  authorizeOrder: vi.fn(),
  captureAuthorization: vi.fn(),
  voidAuthorization: vi.fn(),
  getAuthorization: vi.fn(),
  captureOrder: vi.fn(),
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});

const calls = vi.hoisted(() => ({
  claimDailyBookingCallSlot: vi.fn(),
  claimPendingBooking: vi.fn(),
  persistBookingConversationId: vi.fn(),
  markPendingBookingFailed: vi.fn(),
  initiateCall: vi.fn(),
}));
vi.mock("@/lib/services/booking-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/booking-service")>()),
  claimDailyBookingCallSlot: calls.claimDailyBookingCallSlot,
  claimPendingBooking: calls.claimPendingBooking,
  persistBookingConversationId: calls.persistBookingConversationId,
  markPendingBookingFailed: calls.markPendingBookingFailed,
}));
vi.mock("@/lib/services/elevenlabs-call-service", () => ({ initiateCall: calls.initiateCall }));

const flags = vi.hoisted(() => ({ isFeatureFlagEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags-server", () => flags);

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const { PaypalError } = await import("@/lib/paypal/types");
const {
  placeConfirmationCall,
  reconcilePhoneAuthorizations,
  settleApprovedPhoneOrder,
  settlePhoneConfirmationCall,
  settlePhonePayment,
} = await import("./phone-confirmation");

const ID = bookingRow().id;
const ORDER_ID = "ORDER-P1";
const AUTH_ID = "AUTH-P1";
const CAPTURE_ID = "CAP-P1";
const CALL_ID = "b0090000-0000-4000-8000-0000000000c1";
const KEY = "op-key-p1";
const TEST_PHONE = "+34612345678";
const CHANGED = { data: [{ id: "x" }] };
const LOST = { data: [] };
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const DAY = 86_400_000;

const liveHold = () => ({ id: "hold-1", consumed_at: null, released_at: null, expires_at: new Date(Date.now() + 600_000).toISOString() });
const lapsedHold = () => ({ id: "hold-1", consumed_at: null, released_at: null, expires_at: new Date(Date.now() - 1_000).toISOString() });

const booking = (overrides: Record<string, unknown> = {}) =>
  bookingRow({ deposit_cents: 4000, total_cents: 16000, hold_id: "hold-1", slot_date: "2026-11-21", slot_time: "11:00:00", ...overrides });

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-p1",
    booking_id: ID,
    status: "created",
    order_id: ORDER_ID,
    capture_id: null,
    operation_key: KEY,
    amount_cents: 4000,
    currency: "EUR",
    authorization_id: null,
    authorized_at: null,
    phone_call_id: null,
    confirmation_outcome: null,
    ...overrides,
  };
}

const authorizedPayment = (overrides: Record<string, unknown> = {}) =>
  payment({ status: "authorized", authorization_id: AUTH_ID, authorized_at: new Date().toISOString(), phone_call_id: CALL_ID, ...overrides });

function authorization(overrides: Partial<PaypalAuthorization> = {}): PaypalAuthorization {
  return { id: AUTH_ID, status: "CREATED", amountCents: 4000, currency: "EUR", customId: ID, orderId: ORDER_ID, expiresAt: "2026-12-20T09:00:00.000Z", ...overrides };
}

function capture(overrides: Partial<PaypalCapture> = {}): PaypalCapture {
  return { id: CAPTURE_ID, status: "COMPLETED", amountCents: 4000, currency: "EUR", customId: ID, orderId: ORDER_ID, ...overrides };
}

function order(overrides: Partial<PaypalOrder> = {}): PaypalOrder {
  return { id: ORDER_ID, status: "APPROVED", amountCents: 4000, currency: "EUR", customId: ID, capture: null, approveUrl: null, ...overrides };
}

const authorizedOrder = (overrides: Partial<PaypalAuthorization> = {}) => order({ status: "COMPLETED", authorization: authorization(overrides) });

let fake: BookingSupabaseFake;

const write = (table: string, changed = true) => fake.onTable(table, changed ? CHANGED : LOST);
const touched = () => (fake.client.from as unknown as Mock).mock.calls.map((call) => call[0]);
const rpcs = () => fake.rpc.mock.calls.map((call) => call[0]);

function expectWrite(query: FakeQuery, id: string, fields: Record<string, unknown>, from: string[]) {
  expect(query.update).toHaveBeenCalledWith(fields);
  expect(query.eq).toHaveBeenCalledWith("id", id);
  expect(query.in).toHaveBeenCalledWith("status", from);
}

/** The recorded call outcome (pending_bookings.status) the settlement reads. */
const outcome = (status: string | null) => fake.onTable("pending_bookings", { data: status === null ? null : { status } });

function configure() {
  vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "612 345 678");
  vi.stubEnv("ELEVENLABS_API_KEY", "sk-test");
  vi.stubEnv("ELEVENLABS_PHONE_NUMBER_ID", "phnum-test");
  vi.stubEnv("ELEVENLABS_BOOKING_AGENT_ID", "agent-test");
}

/** The queries a successful call placement makes: experience title, then the call link. */
function queueCall() {
  const experience = fake.onTable("experiences", { data: { title: "Visita a una quesería artesana" } });
  const link = fake.onTable("payments", CHANGED);
  return { experience, link };
}

/** The writes a completed void makes: payment, booking, hold release. */
function queueVoidClose(paymentChanged = true) {
  return { payment: write("payments", paymentChanged), booking: write("bookings"), hold: fake.onTable("holds", {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
  configure();
  flags.isFeatureFlagEnabled.mockResolvedValue(true);
  calls.claimDailyBookingCallSlot.mockResolvedValue(true);
  calls.claimPendingBooking.mockResolvedValue({ kind: "claimed", pendingRowId: CALL_ID });
  calls.initiateCall.mockResolvedValue({ success: true, conversationId: "conv-1" });
  calls.persistBookingConversationId.mockResolvedValue(true);
  calls.markPendingBookingFailed.mockResolvedValue(undefined);
  paypal.voidAuthorization.mockResolvedValue(authorization({ status: "VOIDED" }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("settleApprovedPhoneOrder: the buyer's approval authorizes, never captures", () => {
  const state = (overrides: { booking?: Record<string, unknown>; payment?: Record<string, unknown>; hold?: Record<string, unknown> } = {}) => ({
    booking: booking(overrides.booking),
    payment: payment(overrides.payment),
    hold: overrides.hold ?? liveHold(),
  });

  it("authorizes the approved order, records the authorization, then places the confirmation call", async () => {
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockResolvedValue(authorizedOrder());
    const approved = write("payments");
    const recorded = write("payments");
    const { experience, link } = queueCall();

    await expect(settleApprovedPhoneOrder(fake.client, state(), "return")).resolves.toBe("pending");

    expect(paypal.authorizeOrder).toHaveBeenCalledWith(ORDER_ID, KEY);
    expect(paypal.captureOrder).not.toHaveBeenCalled();
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
    expectWrite(approved, "pay-p1", { status: "approved" }, ["created"]);
    expectWrite(
      recorded,
      "pay-p1",
      { status: "authorized", authorization_id: AUTH_ID, authorized_at: ISO, authorization_expires_at: "2026-12-20T09:00:00.000Z" },
      ["created", "approved"]
    );
    expect(experience.eq).toHaveBeenCalledWith("id", "exp-1");
    expect(link.update).toHaveBeenCalledWith({ phone_call_id: CALL_ID });
    expect(link.is).toHaveBeenCalledWith("phone_call_id", null);

    // The existing voice-booking path: daily cap, claim keyed by the payment, the call to the test number.
    expect(calls.claimDailyBookingCallSlot).toHaveBeenCalledTimes(1);
    expect(calls.claimPendingBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "phone-confirmation:pay-p1",
        venueName: "Visita a una quesería artesana",
        venuePhone: TEST_PHONE,
        customerPhone: TEST_PHONE,
        customerName: "Paisaxe RS-ABC123",
        partySize: 4,
        bookingDate: "2026-11-21",
        bookingTime: "11:00",
      })
    );
    expect(calls.initiateCall).toHaveBeenCalledWith(TEST_PHONE, {
      customer_name: "Paisaxe RS-ABC123",
      customer_phone: TEST_PHONE,
      party_size: 4,
      date: "21 de noviembre",
      time: "11:00",
      special_requests: expect.stringContaining("40,00"),
      booking_id: CALL_ID,
    });
    expect(calls.persistBookingConversationId).toHaveBeenCalledWith(CALL_ID, "conv-1", "phone-confirmation:pay-p1");
    expect(logger.info).toHaveBeenCalledWith("[PHONE_CONFIRMATION_CALL_PLACED]", expect.objectContaining({ bookingId: ID }));
  });

  it("an order the buyer has not approved is awaiting_approval: nothing authorized, nothing written", async () => {
    paypal.getOrder.mockResolvedValue(order({ status: "PAYER_ACTION_REQUIRED" }));
    await expect(settleApprovedPhoneOrder(fake.client, state(), "reconcile")).resolves.toBe("awaiting_approval");
    expect(paypal.authorizeOrder).not.toHaveBeenCalled();
    expect(touched()).toEqual([]);
  });

  it("an order that does not match the deposit is never authorized and needs attention", async () => {
    paypal.getOrder.mockResolvedValue(order({ amountCents: 1 }));
    const flagged = write("bookings");
    await expect(settleApprovedPhoneOrder(fake.client, state(), "webhook")).resolves.toBe("mismatch");
    expectWrite(flagged, ID, { status: "needs_attention" }, ["pending_payment", "expired"]);
    expect(paypal.authorizeOrder).not.toHaveBeenCalled();
  });

  it("a lapsed hold whose slot is gone expires the unauthorized payment: nothing authorized, slot_gone", async () => {
    paypal.getOrder.mockResolvedValue(order());
    write("payments");
    fake.onRpc("reacquire_hold", { data: false });
    const expiredPayment = write("payments");
    const expiredBooking = write("bookings");

    await expect(settleApprovedPhoneOrder(fake.client, state({ hold: lapsedHold() }), "reconcile")).resolves.toBe("slot_gone");

    expectWrite(expiredPayment, "pay-p1", { status: "expired" }, ["created", "approved"]);
    expectWrite(expiredBooking, ID, { status: "expired" }, ["pending_payment"]);
    expect(paypal.authorizeOrder).not.toHaveBeenCalled();
  });

  it("a lapsed hold re-acquired goes on to authorize", async () => {
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockResolvedValue(authorizedOrder());
    write("payments");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    queueCall();
    await expect(settleApprovedPhoneOrder(fake.client, state({ hold: lapsedHold() }), "reconcile")).resolves.toBe("pending");
    expect(paypal.authorizeOrder).toHaveBeenCalledTimes(1);
  });

  it("a failed re-acquire read is an error, not a decision", async () => {
    paypal.getOrder.mockResolvedValue(order());
    write("payments");
    fake.onRpc("reacquire_hold", { error: { message: "boom" } });
    await expect(settleApprovedPhoneOrder(fake.client, state({ hold: lapsedHold() }), "reconcile")).rejects.toThrow("re-acquire");
  });

  it("not configured at approval (test number removed): nothing authorized, no call, payment and booking expire", async () => {
    vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "");
    paypal.getOrder.mockResolvedValue(order());
    write("payments");
    const expiredPayment = write("payments");
    write("bookings");

    await expect(settleApprovedPhoneOrder(fake.client, state(), "return")).resolves.toBe("slot_gone");

    expectWrite(expiredPayment, "pay-p1", { status: "expired", confirmation_outcome: "not_configured" }, ["created", "approved"]);
    expect(paypal.authorizeOrder).not.toHaveBeenCalled();
    expect(calls.initiateCall).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("[PHONE_CONFIRMATION_NOT_CONFIGURED]", { bookingId: ID, reason: "not_configured" });
  });

  it("an authorize call with an unknown outcome stays pending for reconciliation", async () => {
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockRejectedValue(new PaypalError("timed out"));
    write("payments");
    await expect(settleApprovedPhoneOrder(fake.client, state(), "return")).resolves.toBe("pending");
    expect(touched()).toEqual(["payments"]);
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_AUTHORIZE_PENDING]", expect.objectContaining({ bookingId: ID, error: "timed out" }));
  });

  it("a non-Error authorize failure is logged by its string form", async () => {
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockRejectedValue("socket hang up");
    write("payments");
    await expect(settleApprovedPhoneOrder(fake.client, state(), "return")).resolves.toBe("pending");
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_AUTHORIZE_PENDING]", expect.objectContaining({ error: "socket hang up" }));
  });

  it("an authorization without an expiration time is recorded as valid for 29 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-20T09:00:00.000Z") });
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockResolvedValue(authorizedOrder({ expiresAt: null }));
    write("payments");
    const recorded = write("payments");
    queueCall();
    await settleApprovedPhoneOrder(fake.client, state(), "return");
    expect(recorded.update).toHaveBeenCalledWith(expect.objectContaining({ authorization_expires_at: "2026-12-19T09:00:00.000Z" }));
  });

  it("an unauthorized payment another caller already moved does not expire the booking", async () => {
    paypal.getOrder.mockResolvedValue(order());
    write("payments");
    fake.onRpc("reacquire_hold", { data: false });
    write("payments", false);
    await expect(settleApprovedPhoneOrder(fake.client, state({ hold: lapsedHold() }), "reconcile")).resolves.toBe("slot_gone");
    expect(touched()).toEqual(["payments", "payments"]);
  });

  it("an order already authorized at PayPal (response lost) is recorded without authorizing again", async () => {
    paypal.getOrder.mockResolvedValue(authorizedOrder());
    write("payments");
    queueCall();
    await expect(settleApprovedPhoneOrder(fake.client, state({ payment: { status: "approved" } }), "reconcile")).resolves.toBe("pending");
    expect(paypal.authorizeOrder).not.toHaveBeenCalled();
    expect(calls.initiateCall).toHaveBeenCalledTimes(1);
  });

  it("an authorization for another amount is voided at once and needs attention", async () => {
    paypal.getOrder.mockResolvedValue(order({ status: "COMPLETED", amountCents: 1, authorization: authorization() }));
    const recorded = write("payments");
    const claim = write("payments");
    queueVoidClose();
    await expect(settleApprovedPhoneOrder(fake.client, state(), "webhook")).resolves.toBe("slot_gone");
    expect(recorded.update).toHaveBeenCalledWith(expect.objectContaining({ status: "authorized" }));
    expectWrite(claim, "pay-p1", { status: "void_pending", confirmation_outcome: "order_mismatch" }, ["authorized"]);
    expect(paypal.voidAuthorization).toHaveBeenCalledWith(AUTH_ID, KEY);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_CAPTURE_MISMATCH]", expect.objectContaining({ phone: true, captured: false }));
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("a DENIED authorization fails the payment and needs attention", async () => {
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockResolvedValue(authorizedOrder({ status: "DENIED" }));
    write("payments");
    const failed = write("payments");
    const flagged = write("bookings");
    await expect(settleApprovedPhoneOrder(fake.client, state(), "return")).resolves.toBe("failed");
    expectWrite(failed, "pay-p1", { status: "capture_failed", authorization_id: AUTH_ID }, ["created", "approved"]);
    expectWrite(flagged, ID, { status: "needs_attention" }, ["pending_payment", "expired"]);
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("a concurrent caller that recorded the authorization first places the call; this one does not", async () => {
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockResolvedValue(authorizedOrder());
    write("payments");
    write("payments", false);
    await expect(settleApprovedPhoneOrder(fake.client, state(), "webhook")).resolves.toBe("pending");
    expect(calls.claimPendingBooking).not.toHaveBeenCalled();
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("when the call cannot be placed (daily cap) the authorization is voided: nothing charged", async () => {
    calls.claimDailyBookingCallSlot.mockResolvedValue(false);
    paypal.getOrder.mockResolvedValue(order());
    paypal.authorizeOrder.mockResolvedValue(authorizedOrder());
    write("payments");
    write("payments");
    fake.onTable("experiences", { data: { title: "Visita" } });
    const claim = write("payments");
    const closed = queueVoidClose();

    await expect(settleApprovedPhoneOrder(fake.client, state(), "return")).resolves.toBe("slot_gone");

    expectWrite(claim, "pay-p1", { status: "void_pending", confirmation_outcome: "call_failed" }, ["authorized"]);
    expectWrite(closed.payment, "pay-p1", { status: "voided", voided_at: ISO }, ["void_pending"]);
    expectWrite(closed.booking, ID, { status: "expired" }, ["pending_payment", "needs_attention"]);
    expect(closed.hold.update).toHaveBeenCalledWith({ released_at: ISO });
    expect(closed.hold.eq).toHaveBeenCalledWith("id", "hold-1");
    expect(calls.initiateCall).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[PHONE_CONFIRMATION_DAILY_CAP_REACHED]", { bookingId: ID });
  });

  it.each([
    ["voided", "slot_gone"],
    ["expired", "slot_gone"],
    ["capture_failed", "failed"],
    ["refund_pending", "compensating"],
  ])("a %s payment answers %s without asking PayPal", async (status, expected) => {
    await expect(settleApprovedPhoneOrder(fake.client, state({ payment: { status } }), "return")).resolves.toBe(expected);
    expect(paypal.getOrder).not.toHaveBeenCalled();
  });

  it("an authorized payment is settled from its recorded call outcome (still waiting: pending)", async () => {
    outcome("pending");
    const s = { ...state(), payment: authorizedPayment() };
    await expect(settleApprovedPhoneOrder(fake.client, s, "return")).resolves.toBe("pending");
    expect(paypal.getOrder).not.toHaveBeenCalled();
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });
});

describe("settlePhonePayment: no capture without a recorded confirmation", () => {
  it("a recorded 'confirmed' re-acquires the slot, claims the capture, captures the authorization once and confirms", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    const claim = write("payments");
    paypal.captureAuthorization.mockResolvedValue(capture());
    const captured = write("payments");
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });

    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("confirmed");

    expectWrite(claim, "pay-p1", { status: "capture_pending", confirmation_outcome: "confirmed" }, ["authorized"]);
    expect(paypal.captureAuthorization).toHaveBeenCalledTimes(1);
    expect(paypal.captureAuthorization).toHaveBeenCalledWith(AUTH_ID, 4000, KEY);
    expectWrite(captured, "pay-p1", { status: "captured", capture_id: CAPTURE_ID, captured_at: ISO }, ["capture_pending"]);
    expect(fake.rpc).toHaveBeenCalledWith("consume_hold_and_confirm", { p_booking_id: ID, p_capture_id: CAPTURE_ID });
    expect(rpcs()).toEqual(["reacquire_hold", "consume_hold_and_confirm"]);
    expect(logger.info).toHaveBeenCalledWith("[PHONE_CONFIRMATION_CAPTURED]", expect.objectContaining({ bookingId: ID }));
  });

  it.each(["initiating", "pending"])("a call still %s captures nothing and voids nothing", async (status) => {
    outcome(status);
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("waiting");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
    expect(paypal.voidAuthorization).not.toHaveBeenCalled();
    expect(touched()).toEqual(["pending_bookings"]);
  });

  it("an unknown call row captures nothing (the link points nowhere)", async () => {
    outcome(null);
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("waiting");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });

  it("the database's refusal of the capture claim (no recorded confirmation) stops before PayPal", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    fake.onTable("payments", { error: { message: "confirmation_not_recorded" } });
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).rejects.toThrow("confirmation_not_recorded");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });

  it("a lost claim (another caller is capturing or voiding) changes nothing and never calls PayPal", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments", false);
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("unchanged");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });

  it("confirmed but the slot is gone: the authorization is voided, never captured", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: false });
    const claim = write("payments");
    queueVoidClose();
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("voided");
    expectWrite(claim, "pay-p1", { status: "void_pending", confirmation_outcome: "slot_gone" }, ["authorized"]);
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });

  it("a failed re-acquire is an error before any capture", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { error: { message: "invalid_state" } });
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).rejects.toThrow("invalid_state");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });

  it("a capture with an unknown outcome stays capture_pending", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    paypal.captureAuthorization.mockRejectedValue(new PaypalError("timed out"));
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("capture_pending");
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_CAPTURE_PENDING]", expect.objectContaining({ phone: true, error: "timed out" }));
  });

  it("a DECLINED capture fails the payment and needs attention", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    paypal.captureAuthorization.mockResolvedValue(capture({ status: "DECLINED" }));
    const failed = write("payments");
    const flagged = write("bookings");
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("capture_failed");
    expectWrite(failed, "pay-p1", { status: "capture_failed", capture_id: CAPTURE_ID }, ["capture_pending"]);
    expectWrite(flagged, ID, { status: "needs_attention" }, ["pending_payment", "expired"]);
  });

  it("a PENDING capture keeps capture_pending with its capture id", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    paypal.captureAuthorization.mockResolvedValue(capture({ status: "PENDING" }));
    const recorded = write("payments");
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("capture_pending");
    expectWrite(recorded, "pay-p1", { capture_id: CAPTURE_ID }, ["capture_pending"]);
  });

  it("a captured payment whose confirmation RPC fails is left for reconciliation's finalize step", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    paypal.captureAuthorization.mockResolvedValue(capture());
    write("payments");
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("captured");
    expect(logger.warn).toHaveBeenCalledWith("[PHONE_CONFIRMATION_FINALIZE_DEFERRED]", expect.objectContaining({ error: "hold_not_live" }));
  });

  it.each(["denied", "no_answer", "failed", "orphaned"])("a recorded '%s' voids the authorization and frees the slot", async (status) => {
    outcome(status);
    const claim = write("payments");
    const closed = queueVoidClose();
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("voided");
    expectWrite(claim, "pay-p1", { status: "void_pending", confirmation_outcome: status }, ["authorized"]);
    expect(paypal.voidAuthorization).toHaveBeenCalledWith(AUTH_ID, KEY);
    expectWrite(closed.payment, "pay-p1", { status: "voided", voided_at: ISO }, ["void_pending"]);
    expect(closed.hold.is).toHaveBeenCalledWith("consumed_at", null);
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("[PHONE_CONFIRMATION_VOIDED]", expect.objectContaining({ bookingId: ID, reason: status }));
  });

  it("no outcome after the 3-day honor period: the authorization is voided (capture no longer guaranteed)", async () => {
    outcome("pending");
    const claim = write("payments");
    queueVoidClose();
    const old = authorizedPayment({ authorized_at: new Date(Date.now() - 3 * DAY - 1_000).toISOString() });
    await expect(settlePhonePayment(fake.client, booking(), old)).resolves.toBe("voided");
    expectWrite(claim, "pay-p1", { status: "void_pending", confirmation_outcome: "honor_period_elapsed" }, ["authorized"]);
  });

  it("a recorded 'confirmed' after the honor period still tries the capture (PayPal may still honour it)", async () => {
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    paypal.captureAuthorization.mockResolvedValue(capture({ status: "DECLINED" }));
    write("payments");
    write("bookings");
    const old = authorizedPayment({ authorized_at: new Date(Date.now() - 4 * DAY).toISOString() });
    await expect(settlePhonePayment(fake.client, booking(), old)).resolves.toBe("capture_failed");
    expect(paypal.captureAuthorization).toHaveBeenCalledTimes(1);
  });

  it("an authorized payment without a call link places the call (recovery after a crash)", async () => {
    queueCall();
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("waiting");
    expect(calls.initiateCall).toHaveBeenCalledTimes(1);
  });

  it.each(["created", "captured", "voided", "refunded"])("a %s payment is not this flow's to settle", async (status) => {
    await expect(settlePhonePayment(fake.client, booking(), payment({ status }))).resolves.toBe("unchanged");
    expect(touched()).toEqual([]);
  });

  it("a void claim lost to a concurrent capture changes nothing", async () => {
    outcome("denied");
    write("payments", false);
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment())).resolves.toBe("unchanged");
    expect(paypal.voidAuthorization).not.toHaveBeenCalled();
  });
});

describe("voids: unknown outcomes and authoritative answers", () => {
  const voidPending = (overrides: Record<string, unknown> = {}) => authorizedPayment({ status: "void_pending", confirmation_outcome: "denied", ...overrides });

  it("a void_pending payment is voided again with the same key, without a new claim", async () => {
    const closed = queueVoidClose();
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).resolves.toBe("voided");
    expect(paypal.voidAuthorization).toHaveBeenCalledWith(AUTH_ID, KEY);
    expect(closed.payment.update).toHaveBeenCalledWith({ status: "voided", voided_at: ISO });
  });

  it("a void with no answer from PayPal stays void_pending", async () => {
    paypal.voidAuthorization.mockRejectedValue(new PaypalError("timed out"));
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).resolves.toBe("void_pending");
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_VOID_PENDING]", expect.objectContaining({ error: "timed out" }));
  });

  it("a non-PayPal failure of the void is not swallowed", async () => {
    paypal.voidAuthorization.mockRejectedValue(new Error("bug"));
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).rejects.toThrow("bug");
  });

  it("an authorization that expired at PayPal (void refused 422) ends as expired: nothing was charged", async () => {
    paypal.voidAuthorization.mockRejectedValue(new PaypalError("refused", { status: 422, issue: "AUTHORIZATION_EXPIRED" }));
    paypal.getAuthorization.mockResolvedValue(authorization({ status: "EXPIRED" }));
    const closed = queueVoidClose();
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).resolves.toBe("voided");
    expectWrite(closed.payment, "pay-p1", { status: "expired" }, ["void_pending"]);
  });

  it("an authorization captured outside this flow is compensated: capture and refund intent in one write", async () => {
    paypal.voidAuthorization.mockRejectedValue(new PaypalError("refused", { status: 422, issue: "PREVIOUSLY_CAPTURED" }));
    paypal.getAuthorization.mockResolvedValue(authorization({ status: "CAPTURED" }));
    paypal.getOrder.mockResolvedValue(order({ status: "COMPLETED", capture: capture(), authorization: authorization({ status: "CAPTURED" }) }));
    const compensation = write("payments");
    const flagged = write("bookings");
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).resolves.toBe("compensating");
    expectWrite(compensation, "pay-p1", { status: "refund_pending", capture_id: CAPTURE_ID, compensation_reason: "unconfirmed_capture" }, ["void_pending"]);
    expectWrite(flagged, ID, { status: "needs_attention" }, ["pending_payment", "expired", "needs_attention"]);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_COMPENSATING]", expect.objectContaining({ reason: "unconfirmed_capture" }));
  });

  it("a captured authorization whose capture PayPal does not list yet stays void_pending", async () => {
    paypal.voidAuthorization.mockRejectedValue(new PaypalError("refused", { status: 422, issue: "PREVIOUSLY_CAPTURED" }));
    paypal.getAuthorization.mockResolvedValue(authorization({ status: "CAPTURED" }));
    paypal.getOrder.mockResolvedValue(order({ status: "COMPLETED" }));
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).resolves.toBe("void_pending");
    expect(touched()).toEqual([]);
  });

  it("an authorization still CREATED after the void call stays void_pending", async () => {
    paypal.voidAuthorization.mockResolvedValue(authorization({ status: "PENDING" }));
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).resolves.toBe("void_pending");
  });

  it("a failed hold release is reported", async () => {
    write("payments");
    write("bookings");
    fake.onTable("holds", { error: { message: "boom" } });
    await expect(settlePhonePayment(fake.client, booking(), voidPending())).rejects.toThrow("release");
  });
});

describe("capture_pending: only PayPal's answer ends it, and never a second capture", () => {
  const pendingCapture = (overrides: Record<string, unknown> = {}) =>
    authorizedPayment({ status: "capture_pending", confirmation_outcome: "confirmed", ...overrides });

  it("a capture PayPal lists on the order is recorded and confirmed without capturing again", async () => {
    paypal.getOrder.mockResolvedValue(order({ status: "COMPLETED", capture: capture(), authorization: authorization({ status: "CAPTURED" }) }));
    write("payments");
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    await expect(settlePhonePayment(fake.client, booking(), pendingCapture())).resolves.toBe("confirmed");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });

  it.each(["VOIDED", "EXPIRED", "DENIED"])("an authorization %s at PayPal is capture_failed (authoritative) and needs attention", async (status) => {
    paypal.getOrder.mockResolvedValue(order({ status: "COMPLETED", authorization: authorization({ status }) }));
    paypal.getAuthorization.mockResolvedValue(authorization({ status }));
    const failed = write("payments");
    write("bookings");
    await expect(settlePhonePayment(fake.client, booking(), pendingCapture())).resolves.toBe("capture_failed");
    expectWrite(failed, "pay-p1", { status: "capture_failed" }, ["capture_pending"]);
    expect(logger.error).toHaveBeenCalledWith("[PHONE_CONFIRMATION_CAPTURE_FAILED]", expect.objectContaining({ authorizationStatus: status }));
  });

  it("a never-captured authorization with a recorded confirmation is captured with the SAME request key", async () => {
    paypal.getOrder.mockResolvedValue(authorizedOrder());
    paypal.getAuthorization.mockResolvedValue(authorization());
    outcome("confirmed");
    paypal.captureAuthorization.mockResolvedValue(capture());
    write("payments");
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    await expect(settlePhonePayment(fake.client, booking(), pendingCapture())).resolves.toBe("confirmed");
    expect(paypal.captureAuthorization).toHaveBeenCalledWith(AUTH_ID, 4000, KEY);
  });

  it("without a recorded confirmation the retry never captures", async () => {
    paypal.getOrder.mockResolvedValue(authorizedOrder());
    paypal.getAuthorization.mockResolvedValue(authorization());
    outcome("pending");
    await expect(settlePhonePayment(fake.client, booking(), pendingCapture())).resolves.toBe("capture_pending");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[PHONE_CONFIRMATION_UNCONFIRMED_CAPTURE_PENDING]", expect.objectContaining({ paymentId: "pay-p1" }));
  });

  it("a retry whose answer is lost again stays capture_pending", async () => {
    paypal.getOrder.mockResolvedValue(authorizedOrder());
    paypal.getAuthorization.mockResolvedValue(authorization());
    outcome("confirmed");
    paypal.captureAuthorization.mockRejectedValue(new PaypalError("timed out"));
    await expect(settlePhonePayment(fake.client, booking(), pendingCapture())).resolves.toBe("capture_pending");
  });

  it("any other authorization status (PENDING) waits", async () => {
    paypal.getOrder.mockResolvedValue(authorizedOrder({ status: "PENDING" }));
    paypal.getAuthorization.mockResolvedValue(authorization({ status: "PENDING" }));
    await expect(settlePhonePayment(fake.client, booking(), pendingCapture())).resolves.toBe("capture_pending");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
  });
});

describe("placeConfirmationCall: the existing voice-booking path, against the test number only", () => {
  it("an already linked payment never places a second call", async () => {
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment())).resolves.toBe("already_placed");
    expect(calls.claimDailyBookingCallSlot).not.toHaveBeenCalled();
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("without PHONE_CONFIRMATION_TEST_NUMBER it is not_configured: no cap slot, no claim, no call", async () => {
    vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", undefined);
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("not_configured");
    expect(calls.claimDailyBookingCallSlot).not.toHaveBeenCalled();
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("with booking_system off it is booking_disabled", async () => {
    flags.isFeatureFlagEnabled.mockResolvedValue(false);
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("booking_disabled");
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("a claim that already exists (crash after claiming) is linked and not called again", async () => {
    calls.claimPendingBooking.mockResolvedValue({ kind: "duplicate", priorBooking: null });
    fake.onTable("experiences", { data: { title: "Visita" } });
    const existing = fake.onTable("pending_bookings", { data: { id: CALL_ID } });
    const link = fake.onTable("payments", CHANGED);
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("already_placed");
    expect(existing.eq).toHaveBeenCalledWith("idempotency_key", "phone-confirmation:pay-p1");
    expect(link.update).toHaveBeenCalledWith({ phone_call_id: CALL_ID });
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("a duplicate claim whose row cannot be found links nothing", async () => {
    calls.claimPendingBooking.mockResolvedValue({ kind: "duplicate", priorBooking: null });
    fake.onTable("experiences", { data: null });
    fake.onTable("pending_bookings", { data: null });
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("already_placed");
    expect(touched()).toEqual(["experiences", "pending_bookings"]);
  });

  it("a claim that cannot be persisted is an error (reconciliation retries)", async () => {
    calls.claimPendingBooking.mockResolvedValue({ kind: "persistence_failed" });
    fake.onTable("experiences", { data: { title: "Visita" } });
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).rejects.toThrow("confirmation call");
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("a failed link write is an error before any call", async () => {
    fake.onTable("experiences", { data: { title: "Visita" } });
    fake.onTable("payments", { error: { message: "boom" } });
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).rejects.toThrow("link");
    expect(calls.initiateCall).not.toHaveBeenCalled();
  });

  it("an accepted call without an id is marked failed", async () => {
    calls.initiateCall.mockResolvedValue({ success: true });
    queueCall();
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("failed");
    expect(calls.markPendingBookingFailed).toHaveBeenCalledWith(CALL_ID, "phone-confirmation:pay-p1", expect.stringContaining("missing"));
  });

  it("a call whose conversation id cannot be stored is still placed (the webhook falls back to booking_id)", async () => {
    calls.initiateCall.mockResolvedValue({ success: true, callSid: "CA-1" });
    calls.persistBookingConversationId.mockResolvedValue(false);
    queueCall();
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("placed");
    expect(calls.persistBookingConversationId).toHaveBeenCalledWith(CALL_ID, "CA-1", "phone-confirmation:pay-p1");
    expect(logger.warn).toHaveBeenCalledWith("[PHONE_CONFIRMATION_CALL_UNTRACKED]", expect.objectContaining({ callId: CALL_ID }));
  });

  it("a timed-out call is left for the webhook or the stale-bookings cron (never voided at once)", async () => {
    calls.initiateCall.mockResolvedValue({ success: false, timedOut: true, error: "ElevenLabs request timed out" });
    queueCall();
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("waiting");
    expect(calls.markPendingBookingFailed).not.toHaveBeenCalled();
    expect(paypal.voidAuthorization).not.toHaveBeenCalled();
  });

  it("a refused call is marked failed and the authorization voided", async () => {
    calls.initiateCall.mockResolvedValue({ success: false, error: "ElevenLabs API error: 500" });
    queueCall();
    write("payments");
    queueVoidClose();
    await expect(settlePhonePayment(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("voided");
    expect(calls.markPendingBookingFailed).toHaveBeenCalledWith(CALL_ID, "phone-confirmation:pay-p1", "Call initiation failed: ElevenLabs API error: 500");
  });

  it("a refused call without an error message is still marked failed", async () => {
    calls.initiateCall.mockResolvedValue({ success: false });
    queueCall();
    await expect(placeConfirmationCall(fake.client, booking(), authorizedPayment({ phone_call_id: null }))).resolves.toBe("failed");
    expect(calls.markPendingBookingFailed).toHaveBeenCalledWith(CALL_ID, "phone-confirmation:pay-p1", "Call initiation failed: unknown error");
  });
});

describe("settlePhoneConfirmationCall: the ElevenLabs webhook's hook", () => {
  it("a call no payment links to is not_linked", async () => {
    fake.onTable("payments", { data: null });
    await expect(settlePhoneConfirmationCall(fake.client, CALL_ID)).resolves.toBe("not_linked");
  });

  it("settles the payment linked to the call", async () => {
    const lookup = fake.onTable("payments", { data: { ...authorizedPayment(), booking: booking() } });
    outcome("no_answer");
    write("payments");
    queueVoidClose();
    await expect(settlePhoneConfirmationCall(fake.client, CALL_ID)).resolves.toBe("voided");
    expect(lookup.eq).toHaveBeenCalledWith("phone_call_id", CALL_ID);
  });

  it("a failed lookup is an error", async () => {
    fake.onTable("payments", { error: { message: "boom" } });
    await expect(settlePhoneConfirmationCall(fake.client, CALL_ID)).rejects.toThrow("boom");
  });
});

describe("reconcilePhoneAuthorizations: stale and unsettled authorizations", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({ ...authorizedPayment(overrides), bookings: booking() });

  it("settles every open authorization in scope and counts what changed", async () => {
    const select = fake.onTable("payments", {
      data: [
        row({ id: "pay-a" }),
        row({ id: "pay-b", phone_call_id: "b0090000-0000-4000-8000-0000000000c2" }),
        row({ id: "pay-c", phone_call_id: "b0090000-0000-4000-8000-0000000000c3" }),
      ],
    });
    // pay-a: confirmed and captured
    outcome("confirmed");
    fake.onRpc("reacquire_hold", { data: true });
    write("payments");
    paypal.captureAuthorization.mockResolvedValueOnce(capture());
    write("payments");
    fake.onRpc("consume_hold_and_confirm", { data: "confirmed" });
    // pay-b: denied and voided
    outcome("denied");
    write("payments");
    queueVoidClose();
    // pay-c: lookup fails, counted by the caller
    fake.onTable("pending_bookings", { error: { message: "boom" } });
    const onError = vi.fn();

    await expect(reconcilePhoneAuthorizations(fake.client, ["b1"], onError)).resolves.toEqual({ confirmed: 1, voided: 1 });

    expect(select.in).toHaveBeenCalledWith("status", ["authorized", "void_pending"]);
    expect(select.in).toHaveBeenCalledWith("booking_id", ["b1"]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toMatchObject({ id: "pay-c" });
  });

  it("an error the caller rethrows aborts the run", async () => {
    fake.onTable("payments", { data: [row()] });
    fake.onTable("pending_bookings", { error: { message: "boom" } });
    await expect(
      reconcilePhoneAuthorizations(fake.client, null, (error) => {
        throw error;
      })
    ).rejects.toThrow("boom");
  });

  it("a failed selection is an error", async () => {
    fake.onTable("payments", { error: { message: "down" } });
    await expect(reconcilePhoneAuthorizations(fake.client, null, vi.fn())).rejects.toThrow("down");
  });

  it("nothing open: nothing counted", async () => {
    const select = fake.onTable("payments", { data: null });
    await expect(reconcilePhoneAuthorizations(fake.client, null, vi.fn())).resolves.toEqual({ confirmed: 0, voided: 0 });
    expect(select.in).toHaveBeenCalledTimes(1);
  });
});
