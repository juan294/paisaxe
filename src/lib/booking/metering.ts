/**
 * Per-redemption metering (plan design "Access and identity" item 3): one
 * atomic UPDATE … WHERE used < limit through consume_voucher_counter
 * (migration 118), so concurrent turns never exceed the allowance.
 * tool_iterations_per_turn is enforced in code by the booking chat (Phase 3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Counter = "chat_turns" | "booking_attempts";

export async function consume(
  client: SupabaseClient,
  redemptionId: string,
  counter: Counter
): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await client.rpc("consume_voucher_counter", {
    p_redemption_id: redemptionId,
    p_counter: counter,
  });
  if (error) throw new Error(`Failed to consume ${counter}: ${error.message}`);
  return data as { allowed: boolean; remaining: number };
}
