import { describe, expect, it } from "vitest";
import { bookingRow, createBookingSupabaseFake } from "@/test/booking-supabase-fake";
import { getBookingForUser, listBookingsForUser } from "./bookings";

const USER = "user-1";

/** A confirmed afternoon booking for a party of two. */
function row(id: string, overrides: Record<string, unknown> = {}) {
  return bookingRow({
    id,
    user_id: USER,
    slot_time: "16:00:00",
    party_size: 2,
    total_cents: 6000,
    deposit_cents: 1500,
    status: "confirmed",
    ...overrides,
  });
}

describe("getBookingForUser", () => {
  it("reads the booking scoped to the acting user", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("bookings", { data: row("b1") });

    const booking = await getBookingForUser(fake.client, USER, "b1");

    expect(booking).toMatchObject({ id: "b1", slotTime: "16:00", balanceCents: 4500, status: "confirmed" });
    expect(query.eq).toHaveBeenCalledWith("id", "b1");
    expect(query.eq).toHaveBeenCalledWith("user_id", USER);
  });

  it("returns null for another user's booking (the query finds nothing)", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: null });

    expect(await getBookingForUser(fake.client, "someone-else", "b1")).toBeNull();
  });

  it("throws when the read fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { error: { message: "timeout" } });

    await expect(getBookingForUser(fake.client, USER, "b1")).rejects.toThrow(/timeout/);
  });
});

describe("listBookingsForUser", () => {
  it("lists the user's bookings, newest first", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("bookings", { data: [row("b2"), row("b1", { status: "expired" })] });

    const bookings = await listBookingsForUser(fake.client, USER);

    expect(bookings.map((b) => [b.id, b.status])).toEqual([
      ["b2", "confirmed"],
      ["b1", "expired"],
    ]);
    expect(query.eq).toHaveBeenCalledWith("user_id", USER);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns an empty list when the user has none", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: [] });
    expect(await listBookingsForUser(fake.client, USER)).toEqual([]);
  });
});
