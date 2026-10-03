// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBookingSupabaseFake } from "@/test/booking-supabase-fake";
import {
  findActiveRedemption,
  generateVoucherCode,
  hashVoucherCode,
  normalizeVoucherCode,
  redeemVoucher,
} from "./vouchers";

const USER = "user-1";
const NOW = new Date("2026-12-01T10:00:00Z");

const redeemedRow = {
  status: "new",
  redemption_id: "r1",
  voice_pass: "granted",
  voice_pass_until: "2026-12-02T10:00:00+00:00",
  chat_turns_used: 0,
  chat_turns_limit: 60,
  booking_attempts_used: 0,
  booking_attempts_limit: 10,
};

describe("normalizeVoucherCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeVoucherCode("  abcd-2345-efgh  ")).toBe("ABCD-2345-EFGH");
  });

  it.each(["", "SHORT", "A".repeat(65), "HAS SPACE IN IT", "ÑANDUÑANDU", 42, null])(
    "rejects %j",
    (raw) => {
      expect(normalizeVoucherCode(raw)).toBeNull();
    }
  );
});

describe("hashVoucherCode / generateVoucherCode", () => {
  it("hashes the canonical code with SHA-256 (hex)", () => {
    expect(hashVoucherCode("ITCODE2026")).toBe(createHash("sha256").update("ITCODE2026").digest("hex"));
  });

  it("generates 32 random bytes as 52 base32 characters that normalize to themselves", () => {
    const a = generateVoucherCode();
    const b = generateVoucherCode();
    expect(a).toMatch(/^[A-Z2-7]{52}$/);
    expect(a).not.toBe(b);
    expect(normalizeVoucherCode(a)).toBe(a);
  });
});

describe("redeemVoucher", () => {
  it("redeems by code hash with the server clock and a 24-hour pass", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("redeem_voucher", { data: redeemedRow });

    const result = await redeemVoucher(fake.client, USER, "itcode2026", NOW);

    expect(fake.rpc).toHaveBeenCalledWith("redeem_voucher", {
      p_code_hash: hashVoucherCode("ITCODE2026"),
      p_user_id: USER,
      p_now: "2026-12-01T10:00:00.000Z",
      p_pass_until: "2026-12-02T10:00:00.000Z",
    });
    expect(result).toEqual({
      status: "ok",
      redemptionId: "r1",
      voicePassUntil: "2026-12-02T10:00:00.000Z",
      limits: { chatTurns: { used: 0, limit: 60 }, bookingAttempts: { used: 0, limit: 10 } },
    });
  });

  it("serves an existing redemption as ok", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("redeem_voucher", { data: { ...redeemedRow, status: "existing", voice_pass: "duplicate", chat_turns_used: 7 } });

    expect(await redeemVoucher(fake.client, USER, "itcode2026", NOW)).toMatchObject({
      status: "ok",
      limits: { chatTurns: { used: 7, limit: 60 } },
    });
  });

  it("reports no pass for a voucher without one", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("redeem_voucher", { data: { ...redeemedRow, voice_pass: "not_included", voice_pass_until: null } });

    expect(await redeemVoucher(fake.client, USER, "itcode2026", NOW)).toMatchObject({ status: "ok", voicePassUntil: null });
  });

  it.each(["invalid", "expired", "exhausted"] as const)("passes through %s", async (status) => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("redeem_voucher", { data: { status } });

    expect(await redeemVoucher(fake.client, USER, "itcode2026", NOW)).toEqual({ status });
  });

  it("treats a malformed code as invalid without calling the database", async () => {
    const fake = createBookingSupabaseFake();
    expect(await redeemVoucher(fake.client, USER, "bad", NOW)).toEqual({ status: "invalid" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("redeem_voucher", { error: { message: "insert or update violates foreign key", code: "23503" } });

    await expect(redeemVoucher(fake.client, USER, "itcode2026", NOW)).rejects.toThrow(/foreign key/);
  });
});

describe("findActiveRedemption", () => {
  it("returns the user's redemption of an unexpired, unrevoked voucher, with its limits", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("voucher_redemptions", {
      data: {
        id: "r1",
        voucher_id: "v1",
        chat_turns_used: 3,
        booking_attempts_used: 1,
        vouchers: { chat_turns_limit: 60, booking_attempts_limit: 10 },
      },
    });

    expect(await findActiveRedemption(fake.client, USER, NOW)).toEqual({
      id: "r1",
      voucherId: "v1",
      limits: { chatTurns: { used: 3, limit: 60 }, bookingAttempts: { used: 1, limit: 10 } },
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", USER);
    expect(query.gt).toHaveBeenCalledWith("vouchers.expires_at", NOW.toISOString());
    expect(query.is).toHaveBeenCalledWith("vouchers.revoked_at", null);
  });

  it("returns null when there is none", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("voucher_redemptions", { data: null });
    expect(await findActiveRedemption(fake.client, USER, NOW)).toBeNull();
  });

  it("throws when the read fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("voucher_redemptions", { error: { message: "timeout" } });
    await expect(findActiveRedemption(fake.client, USER, NOW)).rejects.toThrow(/timeout/);
  });
});
