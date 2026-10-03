// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingSupabaseFake } from "@/test/booking-supabase-fake";
import { mapBooking } from "./types";

const { loadBookingView } = await import("./view");

const booking = (status = "pending_payment") =>
  mapBooking({
    id: "11111111-2222-4333-8444-555555555555",
    reference: "RS-ABC123",
    user_id: "u1",
    quote_id: "q1",
    experience_id: "exp-1",
    slot_date: "2026-11-21",
    slot_time: "10:00:00",
    party_size: 4,
    total_cents: 12000,
    deposit_cents: 3000,
    currency: "EUR",
    cancellation_window_hours: 24,
    status,
    confirmed_at: null,
    link_version: 1,
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadBookingView", () => {
  it("joins the experience title, the latest payment and the hold's expiry while payment is pending", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: { title: "Paseo" } });
    const payments = fake.onTable("payments", {
      data: { status: "captured", order_id: "ORDER-1", capture_id: "CAP-1", refund_id: "RF-1" },
    });
    fake.onTable("bookings", { data: { hold: { expires_at: "2026-11-20T09:20:00Z" } } });

    const view = await loadBookingView(fake.client, booking());

    expect(payments.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(view).toMatchObject({
      reference: "RS-ABC123",
      experienceTitle: "Paseo",
      slotTime: "10:00",
      balanceCents: 9000,
      holdExpiresAt: "2026-11-20T09:20:00Z",
      payment: { status: "captured", orderId: "ORDER-1", captureId: "CAP-1", refundId: "RF-1" },
    });
  });

  it("has no hold expiry once the booking left pending_payment, and copes with missing rows", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: null });
    fake.onTable("payments", { data: { status: "created", order_id: null, capture_id: null, refund_id: null } });
    fake.onTable("bookings", { data: { hold: null } });

    const view = await loadBookingView(fake.client, booking("confirmed"));

    expect(view).toMatchObject({ experienceTitle: "", holdExpiresAt: null, payment: { orderId: null, captureId: null, refundId: null } });

    fake.onTable("experiences", { data: { title: "Paseo" } });
    fake.onTable("payments", { data: null });
    fake.onTable("bookings", { data: null });
    expect(await loadBookingView(fake.client, booking())).toMatchObject({ payment: null, holdExpiresAt: null });
  });

  it("throws when any read fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: { title: "Paseo" } });
    fake.onTable("payments", { error: { message: "down" } });
    fake.onTable("bookings", { data: { hold: null } });

    await expect(loadBookingView(fake.client, booking())).rejects.toThrow("Failed to load booking view: down");
  });
});
