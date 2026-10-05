/**
 * Configuration of the phone-confirmation stretch (PayPal hackathon plan,
 * Phase 8b). Kept apart from phone-confirmation.ts so the catalog search and
 * the ElevenLabs webhook can ask "is this configured / is this ours" without
 * loading the PayPal and call services.
 *
 * The merchant is called only at PHONE_CONFIRMATION_TEST_NUMBER, a number the
 * owner controls. Without it, or without the ElevenLabs outbound settings the
 * existing voice-booking path needs, or with the booking_system flag off, the
 * flow is not_configured: no order is created, nothing is authorized, no call.
 */
import "server-only";

import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { isValidSpanishPhone, normalizePhoneNumber } from "@/lib/services/booking-service";

/** pending_bookings.idempotency_key of a confirmation call: this prefix + the payment id. */
export const PHONE_CONFIRMATION_KEY_PREFIX = "phone-confirmation:";

/** The owner's test number in E.164, or null when absent or not a valid Spanish number. */
export function phoneConfirmationTestNumber(): string | null {
  const raw = process.env.PHONE_CONFIRMATION_TEST_NUMBER?.trim();
  return raw && isValidSpanishPhone(raw) ? normalizePhoneNumber(raw) : null;
}

/** The test number and the ElevenLabs outbound settings are present (no flag read). */
export function phoneConfirmationConfigured(): boolean {
  return (
    phoneConfirmationTestNumber() !== null &&
    Boolean(process.env.ELEVENLABS_API_KEY?.trim()) &&
    Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim()) &&
    Boolean(process.env.ELEVENLABS_BOOKING_AGENT_ID?.trim())
  );
}

export type PhoneReadiness =
  | { ready: true; phone: string }
  | { ready: false; reason: "not_configured" | "booking_disabled" };

/** Configured, and the existing booking_system flag (the voice-booking path's switch) is on. */
export async function phoneConfirmationReadiness(): Promise<PhoneReadiness> {
  const phone = phoneConfirmationTestNumber();
  if (!phone || !phoneConfirmationConfigured()) return { ready: false, reason: "not_configured" };
  if (!(await isFeatureFlagEnabled("booking_system"))) return { ready: false, reason: "booking_disabled" };
  return { ready: true, phone };
}

/** An experience row with its merchant embedded (`merchant:merchants(confirmation_mode)`). */
export function isPhoneMerchant(experience: unknown): boolean {
  const merchant = (experience as { merchant?: { confirmation_mode?: unknown } | null } | null)?.merchant;
  return merchant?.confirmation_mode === "phone";
}

/** A pending_bookings row claimed by this flow (never one of Pelayo's make-booking calls). */
export function isPhoneConfirmationCall(row: { idempotency_key?: unknown } | null | undefined): boolean {
  return typeof row?.idempotency_key === "string" && row.idempotency_key.startsWith(PHONE_CONFIRMATION_KEY_PREFIX);
}
