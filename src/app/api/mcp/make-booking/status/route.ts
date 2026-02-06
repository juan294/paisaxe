import { NextResponse } from "next/server";

/**
 * Twilio Status Callback endpoint for booking calls.
 *
 * Twilio sends a POST request to this endpoint when a call's status changes.
 * This provides low-level call state (ringing, answered, busy, etc.) but NOT
 * the conversation content.
 *
 * NOTE: Booking outcomes (confirmed/denied/no-answer) are handled by the
 * ElevenLabs post-call webhook at /api/webhooks/elevenlabs, which receives
 * the full transcript and can determine the actual booking result.
 *
 * This endpoint acknowledges receipt to prevent Twilio retries.
 */

export async function POST(_request: Request): Promise<NextResponse> {
  return NextResponse.json({ received: true });
}
