import { describe, expect, it } from "vitest";
import { createBookingSupabaseFake } from "@/test/booking-supabase-fake";
import { abandonStaleDrafts, getOrCreateOpenDraft, updateDraft } from "./drafts";
import { BookingError } from "./types";

const USER = "user-1";
const NOW = new Date("2026-11-20T09:00:00Z");

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    user_id: USER,
    status: "open",
    party_size: null,
    slot_date: null,
    slot_time: null,
    budget_cents: null,
    constraints: {},
    ...overrides,
  };
}

describe("getOrCreateOpenDraft", () => {
  it("returns the user's open draft when one exists", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("booking_drafts", { data: draftRow() });

    const draft = await getOrCreateOpenDraft(fake.client, USER);

    expect(draft).toMatchObject({ id: "draft-1", userId: USER, status: "open", constraints: {} });
    expect(query.eq).toHaveBeenCalledWith("user_id", USER);
    expect(query.eq).toHaveBeenCalledWith("status", "open");
  });

  it("creates one when none exists", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("booking_drafts", { data: null });
    const insert = fake.onTable("booking_drafts", { data: draftRow({ id: "draft-new" }) });

    const draft = await getOrCreateOpenDraft(fake.client, USER);

    expect(draft.id).toBe("draft-new");
    expect(insert.insert).toHaveBeenCalledWith({ user_id: USER });
  });

  it("re-reads after losing the one-open-draft race (unique violation)", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("booking_drafts", { data: null });
    fake.onTable("booking_drafts", { error: { message: "duplicate key", code: "23505" } });
    fake.onTable("booking_drafts", { data: draftRow({ id: "draft-winner" }) });

    expect((await getOrCreateOpenDraft(fake.client, USER)).id).toBe("draft-winner");
  });
});

describe("updateDraft", () => {
  it("writes only the fields in the patch, mapped to columns", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("booking_drafts", { data: draftRow() });
    const update = fake.onTable("booking_drafts", {
      data: draftRow({ party_size: 4, slot_date: "2026-11-21", slot_time: "10:00:00", budget_cents: 12000, constraints: { step_free: true } }),
    });

    const draft = await updateDraft(
      fake.client,
      USER,
      { partySize: 4, date: "2026-11-21", time: "10:00", budgetCents: 12000, constraints: { step_free: true } },
      NOW
    );

    expect(update.update).toHaveBeenCalledWith({
      party_size: 4,
      slot_date: "2026-11-21",
      slot_time: "10:00",
      budget_cents: 12000,
      constraints: { step_free: true },
    });
    expect(update.eq).toHaveBeenCalledWith("id", "draft-1");
    expect(draft).toMatchObject({ partySize: 4, slotDate: "2026-11-21", slotTime: "10:00", budgetCents: 12000 });
  });

  it("changes the party size alone without touching the rest (mid-conversation change)", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("booking_drafts", { data: draftRow({ party_size: 4 }) });
    const update = fake.onTable("booking_drafts", { data: draftRow({ party_size: 3 }) });

    await updateDraft(fake.client, USER, { partySize: 3 }, NOW);

    expect(update.update).toHaveBeenCalledWith({ party_size: 3 });
  });

  it.each([
    [{ partySize: 0 }],
    [{ partySize: 13 }],
    [{ partySize: 2.5 }],
    [{ date: "2026-11-19" }],
    [{ date: "2027-02-19" }],
    [{ date: "2026-02-30" }],
    [{ date: "21/11/2026" }],
    [{ time: "25:00" }],
    [{ budgetCents: -1 }],
    [{ constraints: { wheelchair: true } }],
    [{ priceCents: 1 }],
  ])("rejects the invalid patch %j before touching the database", async (patch) => {
    const fake = createBookingSupabaseFake();

    await expect(updateDraft(fake.client, USER, patch as never, NOW)).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("returns the draft unchanged for an empty patch, without an empty update", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("booking_drafts", { data: draftRow({ party_size: 2 }) });

    expect(await updateDraft(fake.client, USER, {}, NOW)).toMatchObject({ id: "draft-1", partySize: 2 });
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it("accepts today and the 90th day ahead in Madrid", async () => {
    for (const date of ["2026-11-20", "2027-02-18"]) {
      const fake = createBookingSupabaseFake();
      fake.onTable("booking_drafts", { data: draftRow() });
      fake.onTable("booking_drafts", { data: draftRow({ slot_date: date }) });
      await expect(updateDraft(fake.client, USER, { date }, NOW)).resolves.toMatchObject({ slotDate: date });
    }
  });

  it("surfaces a database failure as an ordinary error, not a visitor-facing BookingError", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("booking_drafts", { data: draftRow() });
    fake.onTable("booking_drafts", { error: { message: "boom" } });

    await expect(updateDraft(fake.client, USER, { partySize: 2 }, NOW)).rejects.not.toBeInstanceOf(BookingError);
  });
});

describe("abandonStaleDrafts", () => {
  it("abandons open drafts untouched for 24 hours and returns how many", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("booking_drafts", { data: [{ id: "a" }, { id: "b" }] });

    expect(await abandonStaleDrafts(fake.client, NOW)).toBe(2);
    expect(query.update).toHaveBeenCalledWith({ status: "abandoned" });
    expect(query.eq).toHaveBeenCalledWith("status", "open");
    expect(query.lt).toHaveBeenCalledWith("updated_at", "2026-11-19T09:00:00.000Z");
  });
});
