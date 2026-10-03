// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingSupabaseFake } from "@/test/booking-supabase-fake";

const deps = vi.hoisted(() => ({ allowed: true, admin: { tag: "admin" } as unknown }));

vi.mock("./availability", () => ({ listAvailability: vi.fn() }));
vi.mock("./links", () => ({
  bookingLink: vi.fn(({ id, linkVersion }: { id: string; linkVersion: number }) => `/booking/${id}.v${linkVersion}`),
  verifyOperatorCapability: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: deps.allowed,
    limit: 30,
    remaining: deps.allowed ? 29 : 0,
    resetAt: Date.now() + 60_000,
    retryAfter: 60,
  })),
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn(() => deps.admin) }));

const { listAvailability } = await import("./availability");
const { verifyOperatorCapability } = await import("./links");
const {
  guardOperatorRoute,
  isOperatorException,
  loadOperatorView,
  reissueBookingLink,
  releaseOperatorHold,
  summarizeOperatorBookings,
} = await import("./operator");
type OperatorBooking = import("./operator").OperatorBooking;

function booking(overrides: Partial<OperatorBooking> = {}): OperatorBooking {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    reference: "RS-ABC123",
    experienceTitle: "Paseo por la senda costera",
    slotDate: "2026-11-21",
    slotTime: "10:00",
    partySize: 4,
    status: "confirmed",
    depositCents: 3000,
    balanceCents: 9000,
    currency: "EUR",
    payment: { status: "captured", orderId: "ORDER-1", captureId: "CAP-1", refundId: null },
    exception: false,
    ...overrides,
  };
}

describe("isOperatorException", () => {
  it.each(["needs_attention", "refund_pending", "cancel_pending"])("flags a %s booking", (status) => {
    expect(isOperatorException(status, null)).toBe(true);
  });

  it("flags a failed refund whatever the booking says", () => {
    expect(isOperatorException("refunded", "refund_failed")).toBe(true);
  });

  it.each([
    ["confirmed", "captured"],
    ["pending_payment", "created"],
    ["pending_payment", null],
    ["expired", "expired"],
    ["cancelled", "captured"],
    ["refunded", "refunded"],
  ])("does not flag a %s booking with a %s payment", (status, payment) => {
    expect(isOperatorException(status, payment)).toBe(false);
  });
});

describe("summarizeOperatorBookings", () => {
  const today = "2026-11-20";

  it("counts upcoming confirmed bookings, captured deposits, balance due and exceptions", () => {
    const summary = summarizeOperatorBookings(
      [
        booking({ slotDate: "2026-11-20" }),
        booking({ slotDate: "2026-11-25", balanceCents: 5000 }),
        // In the past: its deposit was collected, its balance is not due any more.
        booking({ slotDate: "2026-11-18" }),
        booking({ status: "pending_payment", payment: { status: "created", orderId: "O", captureId: null, refundId: null } }),
        booking({ status: "needs_attention", exception: true, payment: null }),
        booking({
          status: "refund_pending",
          exception: true,
          payment: { status: "refund_pending", orderId: "O", captureId: "C", refundId: "R" },
        }),
      ],
      today
    );

    expect(summary).toEqual({ upcoming: 2, depositsCollectedCents: 9000, balanceDueCents: 14000, exceptions: 2 });
  });

  it("is all zeros for no bookings", () => {
    expect(summarizeOperatorBookings([], today)).toEqual({
      upcoming: 0,
      depositsCollectedCents: 0,
      balanceDueCents: 0,
      exceptions: 0,
    });
  });
});

const MERCHANT = "m0000000-0000-4000-8000-000000000001";
const HOLD = "a0000000-0000-4000-8000-000000000001";
const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const access = { id: "op-1", merchantId: MERCHANT, label: "Operador", linkVersion: 1, expiresAt: "2026-12-16T22:59:59Z" };
const NOW = new Date("2026-11-20T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  deps.allowed = true;
  vi.mocked(listAvailability).mockResolvedValue([{ date: "2026-11-20", startTime: "10:00", available: 8 }]);
});

describe("loadOperatorView", () => {
  it("reads only the merchant's experiences, bookings and live holds, and builds the view", async () => {
    const fake = createBookingSupabaseFake();
    const merchants = fake.onTable("merchants", { data: { name: "Rutas del Sella (demo, ficticio)", is_fixture: true } });
    fake.onTable("experiences", {
      data: [
        { id: "exp-1", title: "Paseo", capacity_per_slot: 12, active: true },
        { id: "exp-2", title: "Canoa", capacity_per_slot: 12, active: false },
      ],
    });
    const bookings = fake.onTable("bookings", {
      data: [
        {
          id: BOOKING_ID,
          reference: "RS-ABC123",
          experience_id: "exp-1",
          slot_date: "2026-11-21",
          slot_time: "10:00:00",
          party_size: 4,
          status: "confirmed",
          total_cents: 12000,
          deposit_cents: 3000,
          currency: "EUR",
          payments: [
            { status: "expired", order_id: "OLD", capture_id: null, refund_id: null, created_at: "2026-11-01T00:00:00Z" },
            { status: "refund_failed", order_id: "NEW", capture_id: "CAP", refund_id: "RF", created_at: "2026-11-02T00:00:00Z" },
          ],
        },
        {
          id: "b2", reference: "RS-B2", experience_id: "exp-9", slot_date: "2026-11-22", slot_time: "16:00:00", party_size: 2,
          status: "pending_payment", total_cents: 6000, deposit_cents: 1500, currency: "EUR", payments: null,
        },
      ],
    });
    const holds = fake.onTable("holds", {
      data: [
        { id: HOLD, experience_id: "exp-1", slot_date: "2026-11-21", slot_time: "10:00:00", party_size: 2, expires_at: "2026-11-20T09:10:00Z", bookings: [{ reference: "RS-H" }] },
        { id: "h2", experience_id: "exp-1", slot_date: "2026-11-21", slot_time: "16:00:00", party_size: 1, expires_at: "2026-11-20T09:12:00Z", bookings: null },
      ],
    });

    const view = await loadOperatorView(fake.client, access, NOW);

    expect(merchants.eq).toHaveBeenCalledWith("id", MERCHANT);
    expect(bookings.in).toHaveBeenCalledWith("experience_id", ["exp-1", "exp-2"]);
    expect(bookings.gte).toHaveBeenCalledWith("slot_date", "2026-11-13");
    expect(holds.in).toHaveBeenCalledWith("experience_id", ["exp-1", "exp-2"]);
    expect(holds.is).toHaveBeenCalledWith("consumed_at", null);
    expect(holds.is).toHaveBeenCalledWith("released_at", null);
    expect(holds.gt).toHaveBeenCalledWith("expires_at", NOW.toISOString());
    // Capacity only for active experiences.
    expect(listAvailability).toHaveBeenCalledTimes(1);
    expect(listAvailability).toHaveBeenCalledWith(fake.client, "exp-1", "2026-11-20", 14);

    expect(view.merchant).toEqual({ name: "Rutas del Sella (demo, ficticio)", isFixture: true });
    expect(view.today).toBe("2026-11-20");
    expect(view.bookings[0]).toMatchObject({
      experienceTitle: "Paseo",
      slotTime: "10:00",
      balanceCents: 9000,
      payment: { status: "refund_failed", orderId: "NEW", captureId: "CAP", refundId: "RF" },
      exception: true,
    });
    expect(view.bookings[1]).toMatchObject({ experienceTitle: "", payment: null, exception: false });
    expect(view.holds).toEqual([
      { id: HOLD, reference: "RS-H", experienceTitle: "Paseo", slotDate: "2026-11-21", slotTime: "10:00", partySize: 2, expiresAt: "2026-11-20T09:10:00Z" },
      { id: "h2", reference: null, experienceTitle: "Paseo", slotDate: "2026-11-21", slotTime: "16:00", partySize: 1, expiresAt: "2026-11-20T09:12:00Z" },
    ]);
    expect(view.capacity).toEqual([{ id: "exp-1", title: "Paseo", capacity: 12, slots: [{ date: "2026-11-20", startTime: "10:00", available: 8 }] }]);
    expect(view.summary).toEqual({ upcoming: 1, depositsCollectedCents: 0, balanceDueCents: 9000, exceptions: 1 });
  });

  it("a merchant that is not a fixture has no demo label, and empty reads give an empty view", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("merchants", { data: { name: "Real", is_fixture: false } });
    fake.onTable("experiences", { data: null });
    fake.onTable("bookings", { data: null });
    fake.onTable("holds", { data: null });

    const view = await loadOperatorView(fake.client, access, NOW);

    expect(view.merchant.isFixture).toBe(false);
    expect(view).toMatchObject({ bookings: [], holds: [], capacity: [] });
  });

  it.each([
    ["merchants", "merchant"],
    ["experiences", "experiences"],
    ["bookings", "bookings"],
    ["holds", "holds"],
  ])("a failed %s read throws", async (failing, what) => {
    const fake = createBookingSupabaseFake();
    const result = (table: string, data: unknown) => (table === failing ? { error: { message: "down" } } : { data });
    fake.onTable("merchants", result("merchants", { name: "M", is_fixture: true }));
    fake.onTable("experiences", result("experiences", []));
    fake.onTable("bookings", result("bookings", []));
    fake.onTable("holds", result("holds", []));

    await expect(loadOperatorView(fake.client, access, NOW)).rejects.toThrow(`Failed to load ${what}: down`);
  });
});

describe("loadOperatorView null fields", () => {
  it("maps missing payment ids, a hold booking without a reference and a null update reply", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("merchants", { data: { name: "M", is_fixture: true } });
    fake.onTable("experiences", { data: [{ id: "exp-1", title: "Paseo", capacity_per_slot: 12, active: false }] });
    fake.onTable("bookings", {
      data: [
        {
          id: BOOKING_ID, reference: "RS-1", experience_id: "exp-1", slot_date: "2026-11-21", slot_time: "10:00:00", party_size: 2,
          status: "pending_payment", total_cents: 12000, deposit_cents: 3000, currency: "EUR",
          payments: [{ status: "created", created_at: "2026-11-01T00:00:00Z" }],
        },
      ],
    });
    fake.onTable("holds", {
      data: [{ id: HOLD, experience_id: "exp-9", slot_date: "2026-11-21", slot_time: "10:00:00", party_size: 2, expires_at: "x", bookings: {} }],
    });

    const view = await loadOperatorView(fake.client, access, NOW);

    expect(view.bookings[0].payment).toEqual({ status: "created", orderId: null, captureId: null, refundId: null });
    expect(view.holds[0]).toMatchObject({ reference: null, experienceTitle: "" });
  });

  it("a release or re-issue whose update returns no rows array is treated as not applied", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("holds", { data: { id: HOLD, experience: { merchant_id: MERCHANT } } });
    fake.onTable("holds", { data: null });
    expect(await releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).toBe("not_live");

    for (let attempt = 0; attempt < 3; attempt++) {
      fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 1, experience: { merchant_id: MERCHANT } } });
      fake.onTable("bookings", { data: null });
    }
    await expect(reissueBookingLink(fake.client, MERCHANT, BOOKING_ID)).rejects.toThrow("link_version kept changing");
  });
});

describe("releaseOperatorHold", () => {
  it("releases a live hold of the merchant with one guarded update", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("holds", { data: { id: HOLD, experience: { merchant_id: MERCHANT } } });
    const update = fake.onTable("holds", { data: [{ id: HOLD }] });

    expect(await releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).toBe("released");
    expect(update.update).toHaveBeenCalledWith({ released_at: NOW.toISOString() });
    expect(update.is).toHaveBeenCalledWith("consumed_at", null);
    expect(update.is).toHaveBeenCalledWith("released_at", null);
    expect(update.gt).toHaveBeenCalledWith("expires_at", NOW.toISOString());
  });

  it("a hold that is no longer live (expired, consumed, released or raced) is not_live", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("holds", { data: { id: HOLD, experience: [{ merchant_id: MERCHANT }] } });
    fake.onTable("holds", { data: [] });

    expect(await releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).toBe("not_live");
  });

  it("another merchant's hold, an unknown hold or a malformed id is not_found, untouched", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("holds", { data: { id: HOLD, experience: { merchant_id: "someone-else" } } });
    fake.onTable("holds", { data: null });

    expect(await releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).toBe("not_found");
    expect(await releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).toBe("not_found");
    expect(await releaseOperatorHold(fake.client, MERCHANT, "not-a-uuid", NOW)).toBe("not_found");
    expect(fake.client.from).toHaveBeenCalledTimes(2);
  });

  it("throws when the lookup or the update fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("holds", { error: { message: "down" } });
    await expect(releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).rejects.toThrow("Failed to load holds: down");

    fake.onTable("holds", { data: { id: HOLD, experience: { merchant_id: MERCHANT } } });
    fake.onTable("holds", { error: { message: "down" } });
    await expect(releaseOperatorHold(fake.client, MERCHANT, HOLD, NOW)).rejects.toThrow("Failed to release hold: down");
  });
});

describe("reissueBookingLink", () => {
  it("increments link_version with a compare-and-set and returns the new link", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 1, experience: { merchant_id: MERCHANT } } });
    const update = fake.onTable("bookings", { data: [{ id: BOOKING_ID }] });

    expect(await reissueBookingLink(fake.client, MERCHANT, BOOKING_ID)).toBe(`/booking/${BOOKING_ID}.v2`);
    expect(update.update).toHaveBeenCalledWith({ link_version: 2 });
    expect(update.eq).toHaveBeenCalledWith("link_version", 1);
  });

  it("retries when another re-issue won the race, and gives up after three tries", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 1, experience: { merchant_id: MERCHANT } } });
    fake.onTable("bookings", { data: [] });
    fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 2, experience: { merchant_id: MERCHANT } } });
    fake.onTable("bookings", { data: [{ id: BOOKING_ID }] });
    expect(await reissueBookingLink(fake.client, MERCHANT, BOOKING_ID)).toBe(`/booking/${BOOKING_ID}.v3`);

    for (let attempt = 0; attempt < 3; attempt++) {
      fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 5, experience: { merchant_id: MERCHANT } } });
      fake.onTable("bookings", { data: [] });
    }
    await expect(reissueBookingLink(fake.client, MERCHANT, BOOKING_ID)).rejects.toThrow("link_version kept changing");
  });

  it("another merchant's booking or a malformed id gives null; an update error throws", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 1, experience: { merchant_id: "other" } } });
    expect(await reissueBookingLink(fake.client, MERCHANT, BOOKING_ID)).toBeNull();
    expect(await reissueBookingLink(fake.client, MERCHANT, "nope")).toBeNull();

    fake.onTable("bookings", { data: { id: BOOKING_ID, link_version: 1, experience: { merchant_id: MERCHANT } } });
    fake.onTable("bookings", { error: { message: "down" } });
    await expect(reissueBookingLink(fake.client, MERCHANT, BOOKING_ID)).rejects.toThrow("Failed to re-issue booking link: down");
  });
});

describe("guardOperatorRoute", () => {
  const request = () => new NextRequest("http://localhost/api/operator/x", { headers: { "x-forwarded-for": "203.0.113.7" } });

  it("returns the access for a valid capability", async () => {
    vi.mocked(verifyOperatorCapability).mockResolvedValue(access);
    expect(await guardOperatorRoute(request(), "cap")).toEqual({ admin: deps.admin, access });
    expect(verifyOperatorCapability).toHaveBeenCalledWith(deps.admin, "cap");
  });

  it("404s a bad capability with no-store, and every capability on a Preview without reading it", async () => {
    vi.mocked(verifyOperatorCapability).mockResolvedValue(null);
    const bad = (await guardOperatorRoute(request(), "cap")) as NextResponse;
    expect(bad.status).toBe(404);
    expect(bad.headers.get("Cache-Control")).toBe("private, no-store");

    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(((await guardOperatorRoute(request(), "cap")) as NextResponse).status).toBe(404);
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
  });

  it("429s over the per-IP limit before any database read", async () => {
    deps.allowed = false;
    const limited = (await guardOperatorRoute(request(), "cap")) as NextResponse;
    expect(limited.status).toBe(429);
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
  });
});
