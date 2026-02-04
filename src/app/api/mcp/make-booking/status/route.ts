import { NextResponse } from "next/server";

/**
 * Twilio Status Callback endpoint for booking calls.
 *
 * Twilio sends a POST request to this endpoint when a call's status changes.
 * This allows us to track whether the business answered, went to voicemail, etc.
 *
 * In a production implementation, this could:
 * - Store call results in a database
 * - Trigger notifications to the user
 * - Update booking status in a CRM
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

    // Track different outcomes
    switch (status.CallStatus) {
      case "completed":
        if (status.AnsweredBy === "human") {
          console.log(
            `[make-booking/status] Restaurant answered (${status.To}), call duration: ${status.CallDuration}s`
          );
          // TODO: In production, mark booking as "pending confirmation"
        } else if (status.AnsweredBy === "machine") {
          console.log(
            `[make-booking/status] Reached voicemail at ${status.To}`
          );
          // TODO: In production, mark booking as "voicemail left"
        }
        break;

      case "busy":
        console.log(
          `[make-booking/status] Restaurant busy: ${status.To}`
        );
        // TODO: In production, schedule retry or notify user
        break;

      case "no-answer":
        console.log(
          `[make-booking/status] No answer from ${status.To}`
        );
        // TODO: In production, schedule retry or notify user
        break;

      case "failed":
        console.log(
          `[make-booking/status] Call failed to ${status.To}`
        );
        // TODO: In production, notify user and suggest manual booking
        break;

      default:
        // queued, ringing, in-progress are intermediate states
        break;
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[make-booking/status] Error processing callback:", err);
    // Still return 200 to prevent Twilio retries
    return NextResponse.json({ received: true, error: "Processing error" });
  }
}
