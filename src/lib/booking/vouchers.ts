/**
 * Vouchers: the access key to the booking demo (PayPal hackathon plan,
 * design "Access and identity" items 1 to 3).
 *
 * A code is stored only as its SHA-256 hash. Redemption is one RPC
 * (redeem_voucher, migration 118) that serves an existing redemption even at
 * the cap, enforces max_redemptions for new identities, and grants or renews
 * the 24-hour voice pass in the same transaction.
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Hours of voice access granted (and renewable) per redemption. */
const VOICE_PASS_HOURS = 24;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const voucherCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{8,64}$/);

interface Allowance {
  used: number;
  limit: number;
}

export interface VoucherLimits {
  chatTurns: Allowance;
  bookingAttempts: Allowance;
}

type RedeemResult =
  | { status: "ok"; redemptionId: string; voicePassUntil: string | null; limits: VoucherLimits }
  | { status: "invalid" | "expired" | "exhausted" };

export interface ActiveRedemption {
  id: string;
  voucherId: string;
  limits: VoucherLimits;
}

/** The canonical form of a typed code, or null when it cannot be a code. */
export function normalizeVoucherCode(raw: unknown): string | null {
  const parsed = voucherCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** SHA-256 (hex) of a canonical code (from normalizeVoucherCode or generateVoucherCode). */
export function hashVoucherCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** 32 random bytes as 52 RFC 4648 base32 characters (no padding). */
export function generateVoucherCode(): string {
  let bits = 0;
  let value = 0;
  let code = "";
  for (const byte of randomBytes(32)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      code += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) code += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return code;
}

function toLimits(row: {
  chatTurnsUsed: number;
  chatTurnsLimit: number;
  bookingAttemptsUsed: number;
  bookingAttemptsLimit: number;
}): VoucherLimits {
  return {
    chatTurns: { used: row.chatTurnsUsed, limit: row.chatTurnsLimit },
    bookingAttempts: { used: row.bookingAttemptsUsed, limit: row.bookingAttemptsLimit },
  };
}

export async function redeemVoucher(
  client: SupabaseClient,
  userId: string,
  rawCode: unknown,
  now: Date = new Date()
): Promise<RedeemResult> {
  const code = normalizeVoucherCode(rawCode);
  if (!code) return { status: "invalid" };

  const { data, error } = await client.rpc("redeem_voucher", {
    p_code_hash: hashVoucherCode(code),
    p_user_id: userId,
    p_now: now.toISOString(),
    p_pass_until: new Date(now.getTime() + VOICE_PASS_HOURS * 3_600_000).toISOString(),
  });
  if (error) throw new Error(`Failed to redeem voucher: ${error.message}`);

  const row = data as Record<string, unknown>;
  if (row.status === "invalid" || row.status === "expired" || row.status === "exhausted") {
    return { status: row.status };
  }
  const passUntil = row.voice_pass_until as string | null;
  return {
    status: "ok",
    redemptionId: row.redemption_id as string,
    voicePassUntil: passUntil ? new Date(passUntil).toISOString() : null,
    limits: toLimits({
      chatTurnsUsed: row.chat_turns_used as number,
      chatTurnsLimit: row.chat_turns_limit as number,
      bookingAttemptsUsed: row.booking_attempts_used as number,
      bookingAttemptsLimit: row.booking_attempts_limit as number,
    }),
  };
}

/** The user's redemption of an unexpired, unrevoked voucher, or null. */
export async function findActiveRedemption(
  client: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<ActiveRedemption | null> {
  const { data, error } = await client
    .from("voucher_redemptions")
    .select(
      "id, voucher_id, chat_turns_used, booking_attempts_used, vouchers!inner(chat_turns_limit, booking_attempts_limit)"
    )
    .eq("user_id", userId)
    .gt("vouchers.expires_at", now.toISOString())
    .is("vouchers.revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load voucher redemption: ${error.message}`);
  if (!data) return null;

  const voucher = data.vouchers as unknown as { chat_turns_limit: number; booking_attempts_limit: number };
  return {
    id: data.id as string,
    voucherId: data.voucher_id as string,
    limits: toLimits({
      chatTurnsUsed: data.chat_turns_used as number,
      chatTurnsLimit: voucher.chat_turns_limit,
      bookingAttemptsUsed: data.booking_attempts_used as number,
      bookingAttemptsLimit: voucher.booking_attempts_limit,
    }),
  };
}
