// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BookingError } from "./types";

vi.mock("./availability", () => ({ searchExperiences: vi.fn() }));
vi.mock("./drafts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./drafts")>()),
  getOrCreateOpenDraft: vi.fn(),
  updateDraft: vi.fn(),
}));
vi.mock("./quotes", () => ({ createQuote: vi.fn() }));
vi.mock("./bookings", () => ({ getBookingForUser: vi.fn(), listBookingsForUser: vi.fn() }));
vi.mock("./capture", () => ({ ensurePaymentOrder: vi.fn() }));

const { searchExperiences } = await import("./availability");
const { getOrCreateOpenDraft, updateDraft } = await import("./drafts");
const { createQuote } = await import("./quotes");
const { getBookingForUser, listBookingsForUser } = await import("./bookings");
const { ensurePaymentOrder } = await import("./capture");
const { executeBookingTool, bookingToolDefinitions } = await import("./tools");
const { buildBookingInstructions } = await import("@/lib/chat-config");

const USER = "user-1";
const EXPERIENCE_ID = "6f1d9c1e-1111-4222-8333-444444444444";
const BOOKING_ID = "11111111-2222-4333-8444-555555555555";

const experienceTitleQuery = {
  select: vi.fn(() => experienceTitleQuery),
  eq: vi.fn(() => experienceTitleQuery),
  maybeSingle: vi.fn(async () => ({ data: { title: "Paseo por la senda costera" }, error: null })),
};
const client = { from: vi.fn(() => experienceTitleQuery) } as unknown as SupabaseClient;
const ctx = { userId: USER, redemptionId: "r1", client };

const booking = {
  id: BOOKING_ID,
  reference: "RS-ABC123",
  userId: USER,
  quoteId: "q1",
  experienceId: EXPERIENCE_ID,
  slotDate: "2026-11-21",
  slotTime: "10:00",
  partySize: 4,
  totalCents: 12000,
  depositCents: 3000,
  balanceCents: 9000,
  currency: "EUR",
  cancellationWindowHours: 24,
  status: "pending_payment" as const,
  confirmedAt: null,
  linkVersion: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BOOKING_LINK_SECRET", "unit-test-secret-that-is-at-least-32-bytes-long");
  vi.mocked(getOrCreateOpenDraft).mockResolvedValue({
    id: "draft-1",
    userId: USER,
    status: "open",
    partySize: 4,
    slotDate: "2026-11-21",
    slotTime: null,
    budgetCents: 12000,
    constraints: { step_free: true },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** No tool result the model sees may contain a capability link or any URL (F05). */
function expectNoLinks(result: unknown) {
  const text = JSON.stringify(result);
  expect(text).not.toMatch(/\/booking\//);
  expect(text).not.toMatch(/https?:\/\//);
}

describe("tool definitions", () => {
  it("registers the Phase 3 and 4 tools with JSON schemas derived from their zod schemas", () => {
    expect(bookingToolDefinitions().map((tool) => tool.name)).toEqual([
      "search_experiences",
      "update_booking_draft",
      "get_quote",
      "get_booking_status",
      "create_payment_order",
    ]);
    for (const definition of bookingToolDefinitions()) {
      expect(definition.input_schema.type).toBe("object");
      expect(definition.description?.length).toBeGreaterThan(20);
      expect(definition.input_schema).not.toHaveProperty("$schema");
    }
  });

  it("every tool the booking rules name is registered", () => {
    const registered = new Set(bookingToolDefinitions().map((tool) => tool.name));
    const named = buildBookingInstructions().match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [];
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(registered).toContain(name);
  });

  it("no tool accepts a price or an amount (tools take ids and constraint values only)", () => {
    const schemas = JSON.stringify(bookingToolDefinitions().map((definition) => definition.input_schema));
    expect(schemas).not.toMatch(/price|amount|totalCents|depositCents/i);
  });
});

describe("executeBookingTool", () => {
  it("returns is_error for an unknown tool", async () => {
    const outcome = await executeBookingTool(ctx, "make_me_a_sandwich", {});
    expect(outcome).toMatchObject({ isError: true, result: { error: "unknown_tool" } });
  });

  it("returns is_error with the validation message for invalid input, without touching the database", async () => {
    const outcome = await executeBookingTool(ctx, "get_quote", { experienceId: "not-a-uuid", partySize: 0 });
    expect(outcome.isError).toBe(true);
    expect(outcome.result).toMatchObject({ error: "invalid_input" });
    expect(createQuote).not.toHaveBeenCalled();
  });

  it("maps a BookingError to its code and never throws", async () => {
    vi.mocked(createQuote).mockRejectedValue(new BookingError("no_capacity", "Not enough places left"));
    const outcome = await executeBookingTool(ctx, "get_quote", {
      experienceId: EXPERIENCE_ID,
      date: "2026-11-21",
      time: "10:00",
      partySize: 4,
    });
    expect(outcome).toMatchObject({ isError: true, result: { error: "no_capacity" } });
  });

  it("turns an unexpected failure into internal_error without leaking its message", async () => {
    vi.mocked(createQuote).mockRejectedValue(new Error("connection reset by peer at 10.0.0.1"));
    const outcome = await executeBookingTool(ctx, "get_quote", {
      experienceId: EXPERIENCE_ID,
      date: "2026-11-21",
      time: "10:00",
      partySize: 4,
    });
    expect(outcome).toEqual({ isError: true, result: { error: "internal_error" } });
  });

  it("times out a slow tool after its budget with is_error timeout", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(searchExperiences).mockReturnValue(new Promise(() => {}));
      const pending = executeBookingTool(ctx, "search_experiences", {});
      await vi.advanceTimersByTimeAsync(8_000);
      expect(await pending).toEqual({ isError: true, result: { error: "timeout" } });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("search_experiences", () => {
  it("fills missing criteria from the draft and returns every option with its verdicts and an offer card", async () => {
    vi.mocked(searchExperiences).mockResolvedValue([
      {
        experience: {
          id: EXPERIENCE_ID,
          merchantId: "m1",
          slug: "paseo-senda-costera",
          title: "Paseo por la senda costera",
          description: null,
          currency: "EUR",
          priceCents: 12000,
          depositCents: 3000,
          maxParty: 6,
          capacityPerSlot: 12,
          slotRule: { weekdays: [1], startTimes: ["10:00"] },
          durationMinutes: 150,
          facts: [],
        },
        verdicts: [{ key: "step_free", verdict: "supported", detail: "Sendero llano", confirmedByProvider: true }],
        suitability: "suitable",
        reasons: [],
        slots: [{ date: "2026-11-21", startTime: "10:00", available: 12 }],
        alternatives: [],
      },
    ]);

    const outcome = await executeBookingTool(ctx, "search_experiences", { date: "2026-11-21" });

    expect(searchExperiences).toHaveBeenCalledWith(client, {
      partySize: 4,
      date: "2026-11-21",
      budgetCents: 12000,
      constraints: { step_free: true },
    });
    expect(outcome.isError).toBe(false);
    expect(outcome.result).toMatchObject({
      options: [
        {
          experienceId: EXPERIENCE_ID,
          title: "Paseo por la senda costera",
          priceEuros: "120.00",
          depositEuros: "30.00",
          suitability: "suitable",
          verdicts: [{ key: "step_free", verdict: "supported", detail: "Sendero llano", confirmedByProvider: true }],
        },
      ],
    });
    expect(outcome.card).toMatchObject({ kind: "offer", options: [{ experienceId: EXPERIENCE_ID, priceCents: 12000 }] });
    expectNoLinks(outcome.result);
  });
});

describe("update_booking_draft", () => {
  it("writes the patch for the acting user and returns the draft state", async () => {
    vi.mocked(updateDraft).mockResolvedValue({
      id: "draft-1",
      userId: USER,
      status: "open",
      partySize: 6,
      slotDate: "2026-11-21",
      slotTime: "10:00",
      budgetCents: 12000,
      constraints: {},
    });

    const outcome = await executeBookingTool(ctx, "update_booking_draft", { partySize: 6 });

    expect(updateDraft).toHaveBeenCalledWith(client, USER, { partySize: 6 });
    expect(outcome.result).toMatchObject({ draft: { partySize: 6, date: "2026-11-21", time: "10:00" } });
  });
});

describe("get_quote", () => {
  it("quotes on the user's open draft and returns a quote card with ids and totals, no link", async () => {
    vi.mocked(createQuote).mockResolvedValue({
      id: "quote-9",
      draftId: "draft-1",
      experienceId: EXPERIENCE_ID,
      version: 3,
      slotDate: "2026-11-21",
      slotTime: "10:00",
      partySize: 4,
      totalCents: 12000,
      depositCents: 3000,
      balanceCents: 9000,
      currency: "EUR",
      cancellationWindowHours: 24,
      expiresAt: "2026-11-20T09:20:00.000Z",
    });

    const outcome = await executeBookingTool(ctx, "get_quote", {
      experienceId: EXPERIENCE_ID,
      date: "2026-11-21",
      time: "10:00",
      partySize: 4,
    });

    expect(createQuote).toHaveBeenCalledWith(client, USER, {
      draftId: "draft-1",
      experienceId: EXPERIENCE_ID,
      slotDate: "2026-11-21",
      slotTime: "10:00",
      partySize: 4,
    });
    expect(outcome.card).toEqual({
      kind: "quote",
      quoteId: "quote-9",
      version: 3,
      experienceTitle: "Paseo por la senda costera",
      slotDate: "2026-11-21",
      slotTime: "10:00",
      partySize: 4,
      totalCents: 12000,
      depositCents: 3000,
      balanceCents: 9000,
      currency: "EUR",
      cancellationWindowHours: 24,
      expiresAt: "2026-11-20T09:20:00.000Z",
      accepted: false,
    });
    expect(outcome.result).toMatchObject({ quoteId: "quote-9", totalEuros: "120.00", depositEuros: "30.00" });
    expectNoLinks(outcome.result);
  });
});

describe("get_booking_status", () => {
  it("returns the user's booking with the capability link only in the card", async () => {
    vi.mocked(getBookingForUser).mockResolvedValue(booking);

    const outcome = await executeBookingTool(ctx, "get_booking_status", { bookingId: BOOKING_ID });

    expect(getBookingForUser).toHaveBeenCalledWith(client, USER, BOOKING_ID);
    expect(outcome.result).toMatchObject({ bookings: [{ bookingId: BOOKING_ID, reference: "RS-ABC123", status: "pending_payment" }] });
    expect(outcome.card).toMatchObject({ kind: "booking", bookingId: BOOKING_ID });
    expect((outcome.card as { link: string }).link).toMatch(new RegExp(`^/booking/${BOOKING_ID}\\.`));
    expectNoLinks(outcome.result);
  });

  it("refuses a booking of another user (the scoped read finds nothing)", async () => {
    vi.mocked(getBookingForUser).mockResolvedValue(null);
    const outcome = await executeBookingTool(ctx, "get_booking_status", { bookingId: BOOKING_ID });
    expect(outcome).toMatchObject({ isError: true, result: { error: "not_found" } });
  });

  it("without an id, lists only the acting user's bookings", async () => {
    vi.mocked(listBookingsForUser).mockResolvedValue([booking]);
    const outcome = await executeBookingTool(ctx, "get_booking_status", {});
    expect(listBookingsForUser).toHaveBeenCalledWith(client, USER);
    expect((outcome.result as { bookings: unknown[] }).bookings).toHaveLength(1);
    expectNoLinks(outcome.result);
  });
});

describe("create_payment_order", () => {
  const APPROVE_URL = "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T";

  it("returns only the reference to the model; the approval link goes in the payment card", async () => {
    vi.mocked(getBookingForUser).mockResolvedValue(booking);
    vi.mocked(ensurePaymentOrder).mockResolvedValue({
      approveUrl: APPROVE_URL,
      amountCents: 3000,
      currency: "EUR",
      expiresAt: "2026-11-20T09:20:00.000Z",
    });

    const outcome = await executeBookingTool(ctx, "create_payment_order", { bookingId: BOOKING_ID });

    expect(outcome.isError).toBe(false);
    expect(outcome.result).toEqual({ payment: "order_created", reference: "RS-ABC123" });
    expectNoLinks(outcome.result);
    expect(JSON.stringify(outcome.result)).not.toContain("5O190127TN364715T");
    expect(getBookingForUser).toHaveBeenCalledWith(client, USER, BOOKING_ID);
    expect(ensurePaymentOrder).toHaveBeenCalledWith(client, BOOKING_ID);
    expect(outcome.card).toEqual({
      kind: "payment",
      bookingId: BOOKING_ID,
      approvalUrl: APPROVE_URL,
      amountCents: 3000,
      currency: "EUR",
      expiresAt: "2026-11-20T09:20:00.000Z",
    });
  });

  it("refuses a booking of another user without creating an order", async () => {
    vi.mocked(getBookingForUser).mockResolvedValue(null);

    const outcome = await executeBookingTool(ctx, "create_payment_order", { bookingId: BOOKING_ID });

    expect(outcome).toMatchObject({ isError: true, result: { error: "not_found" } });
    expect(ensurePaymentOrder).not.toHaveBeenCalled();
  });

  it.each(["hold_expired", "invalid_state", "payment_unavailable", "payment_in_progress"] as const)("reports %s as an error result", async (code) => {
    vi.mocked(getBookingForUser).mockResolvedValue(booking);
    vi.mocked(ensurePaymentOrder).mockRejectedValue(new BookingError(code));

    const outcome = await executeBookingTool(ctx, "create_payment_order", { bookingId: BOOKING_ID });

    expect(outcome).toMatchObject({ isError: true, result: { error: code } });
    expect(outcome.card).toBeUndefined();
  });
});
