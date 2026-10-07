import { describe, expect, it } from "vitest";
import { createBookingSupabaseFake } from "@/test/booking-supabase-fake";
import { consume } from "./metering";

describe("consume", () => {
  it("spends one unit and reports what remains", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("consume_voucher_counter", { data: { allowed: true, remaining: 4 } });

    expect(await consume(fake.client, "r1", "chat_turns")).toEqual({ allowed: true, remaining: 4 });
    expect(fake.rpc).toHaveBeenCalledWith("consume_voucher_counter", {
      p_redemption_id: "r1",
      p_counter: "chat_turns",
    });
  });

  it("reports a counter at its limit as not allowed", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("consume_voucher_counter", { data: { allowed: false, remaining: 0 } });

    expect(await consume(fake.client, "r1", "booking_attempts")).toEqual({ allowed: false, remaining: 0 });
  });

  it("throws when the RPC fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("consume_voucher_counter", { error: { message: "not_found" } });

    await expect(consume(fake.client, "r1", "chat_turns")).rejects.toThrow(/not_found/);
  });
});
