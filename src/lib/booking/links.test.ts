// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingRow, createBookingSupabaseFake } from "@/test/booking-supabase-fake";
import {
  bookingLink,
  operatorLink,
  verifyBookingCapability,
  verifyOperatorCapability,
} from "./links";

const SECRET = "unit-test-secret-that-is-at-least-32-bytes-long";
const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const OPERATOR_ID = "a7e5c0de-0000-4000-8000-000000000001";

function capabilityOf(link: string, prefix: string): string {
  return link.slice(prefix.length);
}

/** The capability part of the booking link for BOOKING_ID at a link version. */
const bookingCapability = (linkVersion = 1) => capabilityOf(bookingLink({ id: BOOKING_ID, linkVersion }), "/booking/");

beforeEach(() => {
  vi.stubEnv("BOOKING_LINK_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("booking capability links (F05)", () => {
  it("derives the token as base64url(HMAC-SHA256(secret, 'booking:<id>:<version>'))", () => {
    const expected = createHmac("sha256", SECRET).update(`booking:${BOOKING_ID}:1`).digest("base64url");
    expect(bookingLink({ id: BOOKING_ID, linkVersion: 1 })).toBe(`/booking/${BOOKING_ID}.${expected}`);
  });

  it("can be rebuilt from the booking id alone: the same input always yields the same link", () => {
    expect(bookingLink({ id: BOOKING_ID, linkVersion: 3 })).toBe(bookingLink({ id: BOOKING_ID, linkVersion: 3 }));
  });

  it("verifies a capability against the stored link_version", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("bookings", { data: bookingRow({ id: BOOKING_ID, link_version: 1 }) });
    const capability = bookingCapability();

    const booking = await verifyBookingCapability(fake.client, capability);

    expect(booking?.id).toBe(BOOKING_ID);
    expect(booking?.balanceCents).toBe(9000);
    expect(query.eq).toHaveBeenCalledWith("id", BOOKING_ID);
  });

  it("rejects a wrong token", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: bookingRow({ id: BOOKING_ID, link_version: 1 }) });
    const capability = `${BOOKING_ID}.${"A".repeat(43)}`;

    expect(await verifyBookingCapability(fake.client, capability)).toBeNull();
  });

  it("an incremented link_version invalidates the old link", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: bookingRow({ id: BOOKING_ID, link_version: 2 }) });
    const oldCapability = bookingCapability();

    expect(await verifyBookingCapability(fake.client, oldCapability)).toBeNull();
  });

  it("a booking token does not open the operator surface (purpose separation)", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("operator_access", {
      data: { id: BOOKING_ID, merchant_id: "m1", label: "x", link_version: 1, expires_at: "2099-01-01T00:00:00Z" },
    });
    expect(await verifyOperatorCapability(fake.client, bookingCapability())).toBeNull();
  });

  it.each([
    "",
    "no-dot-here",
    `not-a-uuid.${"A".repeat(43)}`,
    `${BOOKING_ID}.`,
    `${BOOKING_ID}.short`,
    `${BOOKING_ID}.${"A".repeat(42)}!`,
  ])("rejects the malformed capability %j without querying the database", async (capability) => {
    const fake = createBookingSupabaseFake();
    expect(await verifyBookingCapability(fake.client, capability)).toBeNull();
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("returns null for an unknown booking id", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("bookings", { data: null });
    const capability = bookingCapability();

    expect(await verifyBookingCapability(fake.client, capability)).toBeNull();
  });

  it("refuses to derive a link without a secret of at least 32 bytes", () => {
    vi.stubEnv("BOOKING_LINK_SECRET", "too-short");
    expect(() => bookingLink({ id: BOOKING_ID, linkVersion: 1 })).toThrow(/BOOKING_LINK_SECRET/);
    vi.stubEnv("BOOKING_LINK_SECRET", "");
    expect(() => bookingLink({ id: BOOKING_ID, linkVersion: 1 })).toThrow(/BOOKING_LINK_SECRET/);
  });
});

describe("operator capability links", () => {
  const accessRow = (expiresAt: string, linkVersion = 1) => ({
    id: OPERATOR_ID,
    merchant_id: "m1",
    label: "Operador demo",
    link_version: linkVersion,
    expires_at: expiresAt,
  });

  it("uses the 'operator:' purpose and verifies until expires_at", async () => {
    const expected = createHmac("sha256", SECRET).update(`operator:${OPERATOR_ID}:1`).digest("base64url");
    const link = operatorLink({ id: OPERATOR_ID, linkVersion: 1 });
    expect(link).toBe(`/operator/${OPERATOR_ID}.${expected}`);

    const fake = createBookingSupabaseFake();
    fake.onTable("operator_access", { data: accessRow("2026-12-31T00:00:00Z") });
    const access = await verifyOperatorCapability(
      fake.client,
      capabilityOf(link, "/operator/"),
      new Date("2026-12-01T00:00:00Z")
    );
    expect(access).toEqual({
      id: OPERATOR_ID,
      merchantId: "m1",
      label: "Operador demo",
      linkVersion: 1,
      expiresAt: "2026-12-31T00:00:00Z",
    });
  });

  it("rejects an expired operator link", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("operator_access", { data: accessRow("2026-11-01T00:00:00Z") });
    const capability = capabilityOf(operatorLink({ id: OPERATOR_ID, linkVersion: 1 }), "/operator/");

    expect(
      await verifyOperatorCapability(fake.client, capability, new Date("2026-12-01T00:00:00Z"))
    ).toBeNull();
  });

  it("rejects an operator link after its link_version is incremented", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("operator_access", { data: accessRow("2099-01-01T00:00:00Z", 2) });
    const capability = capabilityOf(operatorLink({ id: OPERATOR_ID, linkVersion: 1 }), "/operator/");

    expect(await verifyOperatorCapability(fake.client, capability)).toBeNull();
  });
});
