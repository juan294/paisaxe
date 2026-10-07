// @vitest-environment node
/**
 * Unit tests for the guarded payment and booking transitions. The live
 * behaviour is proven by the *.postgrest-integration tests; these pin the same
 * writes against the fake client so CI (which has no local Supabase) covers them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const {
  BOOKING_REFUNDED_FROM,
  CAPTURABLE,
  COMPENSATING,
  RECORDABLE,
  applyRefundStatus,
  flagNeedsAttention,
  guardedUpdate,
  holdIsLive,
  markBookingRefunded,
} = await import("./payment-state");

const REFUND_FAILED_FLAGS = ["pending_payment", "needs_attention", "expired", "cancel_pending", "refund_pending"];
const CHANGED = { data: [{ id: "x" }] };
const LOST = { data: [] };

let fake: BookingSupabaseFake;

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
});

describe("status lists", () => {
  it("RECORDABLE is every status but the refund ones", () => {
    expect(CAPTURABLE).toEqual(["created", "approved", "capture_pending"]);
    expect(COMPENSATING).toEqual(["refund_pending", "refunded", "refund_failed"]);
    expect(RECORDABLE).toEqual(["created", "approved", "capture_pending", "captured", "expired", "capture_failed"]);
    expect(RECORDABLE.some((status) => COMPENSATING.includes(status))).toBe(false);
  });
});

describe("guardedUpdate", () => {
  it("updates by id from the listed statuses and reports a changed row", async () => {
    const query = fake.onTable("payments", CHANGED);

    expect(await guardedUpdate(fake.client, "payments", "p1", { status: "approved" }, ["created"])).toBe(true);
    expect(query.update).toHaveBeenCalledWith({ status: "approved" });
    expect(query.eq).toHaveBeenCalledWith("id", "p1");
    expect(query.in).toHaveBeenCalledWith("status", ["created"]);
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("reports a lost race (no row changed) as false, including a null data reply", async () => {
    fake.onTable("bookings", LOST);
    fake.onTable("bookings", { data: null });

    expect(await guardedUpdate(fake.client, "bookings", "b1", { status: "expired" }, ["pending_payment"])).toBe(false);
    expect(await guardedUpdate(fake.client, "bookings", "b1", { status: "expired" }, ["pending_payment"])).toBe(false);
  });

  it("throws with the table name on a database error", async () => {
    fake.onTable("payments", { error: { message: "boom" } });

    await expect(guardedUpdate(fake.client, "payments", "p1", { status: "x" }, ["created"])).rejects.toThrow(
      "Failed to update payments: boom"
    );
  });
});

describe("flagNeedsAttention", () => {
  it("defaults to pending_payment and expired bookings", async () => {
    const query = fake.onTable("bookings", CHANGED);

    expect(await flagNeedsAttention(fake.client, "b1")).toBe(true);
    expect(query.update).toHaveBeenCalledWith({ status: "needs_attention" });
    expect(query.eq).toHaveBeenCalledWith("id", "b1");
    expect(query.in).toHaveBeenCalledWith("status", ["pending_payment", "expired"]);
  });

  it("uses a caller's from-list, and returns false when the booking moved on", async () => {
    const query = fake.onTable("bookings", LOST);

    expect(await flagNeedsAttention(fake.client, "b1", ["confirmed"])).toBe(false);
    expect(query.in).toHaveBeenCalledWith("status", ["confirmed"]);
  });
});

describe("markBookingRefunded", () => {
  it("moves the booking to refunded from every refundable status", async () => {
    const query = fake.onTable("bookings", CHANGED);

    await markBookingRefunded(fake.client, { id: "p1", compensation_reason: "slot_gone" }, "b1");

    expect(query.update).toHaveBeenCalledWith({ status: "refunded" });
    expect(query.eq).toHaveBeenCalledWith("id", "b1");
    expect(query.in).toHaveBeenCalledWith("status", BOOKING_REFUNDED_FROM);
  });

  it("leaves a duplicate capture's booking confirmed by its other payment (no write)", async () => {
    await markBookingRefunded(fake.client, { id: "p1", compensation_reason: "duplicate_capture" }, "b1");

    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("applyRefundStatus", () => {
  const payment = { id: "p1", compensation_reason: null };

  it("COMPLETED -> payment refunded (with refunded_at) from refund_pending, then the booking refunded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T09:00:00Z"));
    const pay = fake.onTable("payments", CHANGED);
    const book = fake.onTable("bookings", CHANGED);

    expect(await applyRefundStatus(fake.client, payment, "b1", "COMPLETED")).toBe("refunded");
    expect(pay.update).toHaveBeenCalledWith({ status: "refunded", refunded_at: "2026-11-20T09:00:00.000Z" });
    expect(pay.in).toHaveBeenCalledWith("status", ["refund_pending"]);
    expect(book.update).toHaveBeenCalledWith({ status: "refunded" });
    expect(book.in).toHaveBeenCalledWith("status", BOOKING_REFUNDED_FROM);
  });

  it("COMPLETED but another caller got there first -> null, booking untouched", async () => {
    fake.onTable("payments", LOST);

    expect(await applyRefundStatus(fake.client, payment, "b1", "COMPLETED")).toBeNull();
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it.each(["FAILED", "CANCELLED"])("%s -> refund_failed, booking flagged, error logged", async (status) => {
    const pay = fake.onTable("payments", CHANGED);
    const book = fake.onTable("bookings", CHANGED);

    expect(await applyRefundStatus(fake.client, payment, "b1", status)).toBe("refund_failed");
    expect(pay.update).toHaveBeenCalledWith({ status: "refund_failed" });
    expect(pay.in).toHaveBeenCalledWith("status", ["refund_pending"]);
    expect(book.update).toHaveBeenCalledWith({ status: "needs_attention" });
    expect(book.in).toHaveBeenCalledWith("status", REFUND_FAILED_FLAGS);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_REFUND_FAILED]", { bookingId: "b1", paymentId: "p1", refundStatus: status });
  });

  it("FAILED but the race was lost -> null, no flag, no log", async () => {
    fake.onTable("payments", LOST);

    expect(await applyRefundStatus(fake.client, payment, "b1", "FAILED")).toBeNull();
    expect(fake.client.from).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("PENDING (or any other status) changes nothing", async () => {
    expect(await applyRefundStatus(fake.client, payment, "b1", "PENDING")).toBeNull();
    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("holdIsLive", () => {
  const future = () => new Date(Date.now() + 60_000).toISOString();
  const past = () => new Date(Date.now() - 1_000).toISOString();

  afterEach(() => vi.useRealTimers());

  it("is live while unconsumed, unreleased and unexpired", () => {
    expect(holdIsLive({ consumed_at: null, released_at: null, expires_at: future() })).toBe(true);
  });

  it("is not live once consumed, released or expired", () => {
    expect(holdIsLive({ consumed_at: "2026-11-20T09:00:00Z", released_at: null, expires_at: future() })).toBe(false);
    expect(holdIsLive({ consumed_at: null, released_at: "2026-11-20T09:00:00Z", expires_at: future() })).toBe(false);
    expect(holdIsLive({ consumed_at: null, released_at: null, expires_at: past() })).toBe(false);
  });

  it("is not live at exactly its expiry instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T09:00:00Z"));
    expect(holdIsLive({ consumed_at: null, released_at: null, expires_at: "2026-11-20T09:00:00Z" })).toBe(false);
  });
});
