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
 * This endpoint is kept for debugging and call monitoring purposes.
 */

interface TwilioStatusCallback {
  CallSid: string;
  CallStatus:
    | "queued"
    | "ringing"
    | "in-progress"
    | "completed"
    | "busy"
    | "failed"
    | "no-answer";
  CallDuration?: string;
  AnsweredBy?: "human" | "machine" | "unknown";
  To: string;
  From: string;
  Direction: string;
  Timestamp?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Twilio sends form-urlencoded data
    const formData = await request.formData();

    const status: Partial<TwilioStatusCallback> = {
      CallSid: formData.get("CallSid") as string,
      CallStatus: formData.get("CallStatus") as TwilioStatusCallback["CallStatus"],
      CallDuration: (formData.get("CallDuration") as string) || undefined,
      AnsweredBy: formData.get("AnsweredBy") as TwilioStatusCallback["AnsweredBy"],
      To: formData.get("To") as string,
      From: formData.get("From") as string,
      Direction: formData.get("Direction") as string,
    };

    console.log("[make-booking/status] Call status update:", {
      callSid: status.CallSid,
      status: status.CallStatus,
      duration: status.CallDuration,
      answeredBy: status.AnsweredBy,
      to: status.To,
    });

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[make-booking/status] Error processing callback:", err);
    // Still return 200 to prevent Twilio retries
    return NextResponse.json({ received: true, error: "Processing error" });
  }
}
