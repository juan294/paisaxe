// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookingRow,
  createBookingSupabaseFake,
  experienceRow,
  type BookingSupabaseFake,
} from "@/test/booking-supabase-fake";
import { acceptQuote, createQuote } from "./quotes";
import { BookingError } from "./types";

const USER = "user-1";
const QUOTE_ID = "99999999-2222-4333-8444-555555555555";
const NOW = new Date("2026-11-20T09:00:00Z");
const INPUT = {
  draftId: "draft-1",
  experienceId: "exp-1",
  slotDate: "2026-11-21",
  slotTime: "10:00",
  partySize: 4,
};
const OPEN_DRAFT = { id: "draft-1", user_id: USER, status: "open" };
const EXPERIENCE = experienceRow({ merchants: { cancellation_window_hours: 24 } });
const ROOM_AT_TEN = { data: [{ start_time: "10:00:00", available: 12 }] };

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-2",
    draft_id: "draft-1",
    experience_id: "exp-1",
    version: 2,
    slot_date: "2026-11-21",
    slot_time: "10:00:00",
    party_size: 4,
    total_cents: 12000,
    deposit_cents: 3000,
    currency: "EUR",
    cancellation_window_hours: 24,
    expires_at: "2026-11-20T09:20:00.000Z",
    ...overrides,
  };
}

/** Queues the draft and experience reads, which createQuote runs together. */
function queueReads(fake: BookingSupabaseFake, draft: unknown = OPEN_DRAFT, experience: unknown = EXPERIENCE) {
  fake.onTable("booking_drafts", { data: draft });
  return fake.onTable("experiences", { data: experience });
}

function queueHappyPath(fake: BookingSupabaseFake, latestVersion: number | null = 1) {
  queueReads(fake);
  fake.onRpc("experience_availability", ROOM_AT_TEN);
  const version = fake.onTable("quotes", { data: latestVersion === null ? null : { version: latestVersion } });
  const supersede = fake.onTable("quotes", { data: null });
  const insert = fake.onTable("quotes", { data: quoteRow({ version: (latestVersion ?? 0) + 1 }) });
  return { version, supersede, insert };
}

describe("createQuote", () => {
  it("prices from the experience, never from input, and returns the balance", async () => {
    const fake = createBookingSupabaseFake();
    const { insert } = queueHappyPath(fake);

    const quote = await createQuote(fake.client, USER, { ...INPUT, priceCents: 1 } as never, NOW);

    expect(insert.insert).toHaveBeenCalledWith({
      draft_id: "draft-1",
      user_id: USER,
      experience_id: "exp-1",
      version: 2,
      slot_date: "2026-11-21",
      slot_time: "10:00",
      party_size: 4,
      total_cents: 12000,
      deposit_cents: 3000,
      currency: "EUR",
      cancellation_window_hours: 24,
      expires_at: "2026-11-20T09:20:00.000Z",
    });
    expect(quote).toMatchObject({ totalCents: 12000, depositCents: 3000, balanceCents: 9000, version: 2, slotTime: "10:00" });
  });

  it("supersedes the draft's open quotes before inserting the next version", async () => {
    const fake = createBookingSupabaseFake();
    const { supersede } = queueHappyPath(fake);

    await createQuote(fake.client, USER, INPUT, NOW);

    expect(supersede.update).toHaveBeenCalledWith({ superseded_at: NOW.toISOString() });
    expect(supersede.eq).toHaveBeenCalledWith("draft_id", "draft-1");
    expect(supersede.is).toHaveBeenCalledWith("superseded_at", null);
    expect(supersede.is).toHaveBeenCalledWith("accepted_at", null);
  });

  it("starts at version 1 for a draft without quotes", async () => {
    const fake = createBookingSupabaseFake();
    const { insert } = queueHappyPath(fake, null);

    await createQuote(fake.client, USER, INPUT, NOW);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }));
  });

  it("retries once with the next version when a concurrent request took the same version", async () => {
    const fake = createBookingSupabaseFake();
    queueReads(fake);
    fake.onRpc("experience_availability", ROOM_AT_TEN);
    fake.onTable("quotes", { data: { version: 1 } });
    fake.onTable("quotes", { data: null });
    fake.onTable("quotes", { error: { message: "duplicate key", code: "23505" } });
    fake.onTable("quotes", { data: { version: 2 } });
    fake.onTable("quotes", { data: null });
    const retry = fake.onTable("quotes", { data: quoteRow({ version: 3 }) });

    const quote = await createQuote(fake.client, USER, INPUT, NOW);

    expect(retry.insert).toHaveBeenCalledWith(expect.objectContaining({ version: 3 }));
    expect(quote.version).toBe(3);
  });

  it("refuses a draft owned by another user", async () => {
    const fake = createBookingSupabaseFake();
    queueReads(fake, { ...OPEN_DRAFT, user_id: "someone-else" });

    await expect(createQuote(fake.client, USER, INPUT, NOW)).rejects.toMatchObject({ code: "not_owned" });
  });

  it.each([
    ["a missing draft", null],
    ["a closed draft", { ...OPEN_DRAFT, status: "accepted" }],
  ])("refuses %s", async (_label, draft) => {
    const fake = createBookingSupabaseFake();
    queueReads(fake, draft);

    await expect(createQuote(fake.client, USER, INPUT, NOW)).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses an inactive or unknown experience", async () => {
    const fake = createBookingSupabaseFake();
    const query = queueReads(fake, OPEN_DRAFT, null);

    await expect(createQuote(fake.client, USER, INPUT, NOW)).rejects.toMatchObject({ code: "not_found" });
    expect(query.eq).toHaveBeenCalledWith("active", true);
  });

  it("refuses a party larger than the experience allows", async () => {
    const fake = createBookingSupabaseFake();
    queueReads(fake, OPEN_DRAFT, { ...EXPERIENCE, max_party: 3 });

    await expect(createQuote(fake.client, USER, INPUT, NOW)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("refuses a start time that is not in the slot rule", async () => {
    const fake = createBookingSupabaseFake();
    queueReads(fake);
    fake.onRpc("experience_availability", ROOM_AT_TEN);

    await expect(
      createQuote(fake.client, USER, { ...INPUT, slotTime: "12:00" }, NOW)
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("refuses a slot without room for the party", async () => {
    const fake = createBookingSupabaseFake();
    queueReads(fake);
    fake.onRpc("experience_availability", { data: [{ start_time: "10:00:00", available: 3 }] });

    await expect(createQuote(fake.client, USER, INPUT, NOW)).rejects.toMatchObject({ code: "no_capacity" });
  });

  it.each([
    [{ partySize: 0 }],
    [{ slotDate: "tomorrow" }],
    [{ slotDate: "2026-02-30" }],
    [{ slotTime: "10" }],
  ])("rejects malformed input %j before touching the database", async (override) => {
    const fake = createBookingSupabaseFake();
    await expect(createQuote(fake.client, USER, { ...INPUT, ...override }, NOW)).rejects.toBeInstanceOf(BookingError);
    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("acceptQuote", () => {
  beforeEach(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "unit-test-secret-that-is-at-least-32-bytes-long");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the booking and its capability link", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("accept_quote", { data: bookingRow({ user_id: USER, quote_id: QUOTE_ID }) });

    const { booking, link } = await acceptQuote(fake.client, USER, QUOTE_ID);

    expect(fake.rpc).toHaveBeenCalledWith("accept_quote", { p_quote_id: QUOTE_ID, p_user_id: USER });
    expect(booking).toMatchObject({ reference: "RS-ABC123", balanceCents: 9000, status: "pending_payment" });
    expect(link).toMatch(/^\/booking\/11111111-2222-4333-8444-555555555555\.[A-Za-z0-9_-]{43}$/);
  });

  it.each(["no_capacity", "quote_expired", "not_found"] as const)("maps the RPC error %s to a BookingError", async (code) => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("accept_quote", { error: { message: code } });

    const error = await acceptQuote(fake.client, USER, QUOTE_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BookingError);
    expect((error as BookingError).code).toBe(code);
  });

  it("treats a malformed quote id as not_found without calling the database", async () => {
    const fake = createBookingSupabaseFake();
    await expect(acceptQuote(fake.client, USER, "not-a-uuid")).rejects.toMatchObject({ code: "not_found" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("surfaces any other failure as an ordinary error", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("accept_quote", { error: { message: "connection reset" } });

    const error = await acceptQuote(fake.client, USER, QUOTE_ID).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(BookingError);
    expect((error as Error).message).toMatch(/connection reset/);
  });
});
