import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyVercelCron: vi.fn(),
  verifyWebhookSecret: vi.fn(),
}));

vi.mock("@/lib/twilio-sms", () => ({
  sendSMS: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { sendSMS } from "@/lib/twilio-sms";

const mockRpc = vi.fn();

describe("/api/cron/retry-booking-sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({
          data: [
            {
              booking_id: "booking-123",
              event_key: "post_call_transcription:conv_456",
              to_phone: "+34612345678",
              message: "Confirmation SMS",
              attempts: 2,
            },
          ],
          error: null,
        });
      }

      if (fn === "complete_booking_sms_job" || fn === "fail_booking_sms_job") {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });
    vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM_retry" });
  });

  it("returns 401 when Vercel Cron auth is missing", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("claims bounded retryable SMS jobs and completes successful sends", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.claimed_count).toBe(1);
    expect(data.sent_count).toBe(1);
    expect(data.failed_count).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith("claim_retryable_booking_sms_jobs", {
      p_limit: 10,
      p_lease_seconds: 900,
      p_max_attempts: 3,
    });
    expect(sendSMS).toHaveBeenCalledWith("+34612345678", "Confirmation SMS");
    expect(mockRpc).toHaveBeenCalledWith("complete_booking_sms_job", {
      p_event_key: "post_call_transcription:conv_456",
      p_provider_sid: "SM_retry",
      p_outcome_message: null,
    });
  });

  it("marks failed retry sends as failed for bounded future attempts", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    vi.mocked(sendSMS).mockResolvedValue({
      success: false,
      error: "Twilio unavailable",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith("fail_booking_sms_job", {
      p_event_key: "post_call_transcription:conv_456",
      p_error: "Twilio unavailable",
    });
  });

  it("accepts POST with a valid webhook secret without falling back to admin auth (line 136)", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(true);

    const response = await POST(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "POST",
        headers: { "x-webhook-secret": "test-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(validateAdminAuth).not.toHaveBeenCalled();
  });

  it("accepts POST with webhook secret or admin auth fallback", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "admin-1",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
  });

  it("returns 401 when POST has no webhook secret and admin auth fails (line 139)", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: authError,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 500 when claim_retryable_booking_sms_jobs RPC fails (line 43)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "DB connection lost" },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to claim retryable SMS jobs");
  });

  it("counts as failed when complete_booking_sms_job RPC errors after successful SMS (lines 73-74)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM_ok" });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({
          data: [
            {
              booking_id: "booking-123",
              event_key: "post_call_transcription:conv_456",
              to_phone: "+34612345678",
              message: "Confirmation SMS",
              attempts: 1,
            },
          ],
          error: null,
        });
      }
      if (fn === "complete_booking_sms_job") {
        return Promise.resolve({ data: null, error: { message: "write failed" } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    // SMS sent successfully but DB mark-complete failed → counts as failed
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(1);
  });

  it("logs error when fail_booking_sms_job RPC errors after failed SMS (line 101)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    vi.mocked(sendSMS).mockResolvedValue({ success: false, error: "Twilio down" });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({
          data: [
            {
              booking_id: "booking-123",
              event_key: "post_call_transcription:conv_456",
              to_phone: "+34612345678",
              message: "Confirmation SMS",
              attempts: 2,
            },
          ],
          error: null,
        });
      }
      if (fn === "fail_booking_sms_job") {
        return Promise.resolve({ data: null, error: { message: "fail mark error" } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.failed_count).toBe(1);
    expect(data.sent_count).toBe(0);
  });

  it("wraps a thrown sendSMS exception as a failed result (lines 55-59)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    vi.mocked(sendSMS).mockRejectedValue(new Error("network timeout"));

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(1);
  });

  it("wraps a thrown non-Error sendSMS rejection with a generic message (lines 47-58 else branch)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    // Reject with a non-Error value so `error instanceof Error` is false,
    // exercising the "SMS send threw unexpectedly" fallback branch.
    vi.mocked(sendSMS).mockRejectedValue("connection reset");
    let failErrorPassed: unknown = "untouched";
    mockRpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({
          data: [
            {
              booking_id: "booking-non-error",
              event_key: "post_call_transcription:conv_non_error",
              to_phone: "+34612345678",
              message: "Confirmation SMS",
              attempts: 1,
            },
          ],
          error: null,
        });
      }
      if (fn === "fail_booking_sms_job") {
        failErrorPassed = args?.p_error;
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(1);
    expect(failErrorPassed).toBe("SMS send threw unexpectedly");
  });

  it("falls back to null sid when sendSMS succeeds without a sid (line 67 branch)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    // success: true but sid is undefined → exercises `smsResult.sid ?? null` branch
    vi.mocked(sendSMS).mockResolvedValue({ success: true });
    let providerSidPassed: unknown = "untouched";
    mockRpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({
          data: [
            {
              booking_id: "booking-no-sid",
              event_key: "post_call_transcription:conv_no_sid",
              to_phone: "+34612345678",
              message: "Confirmation SMS",
              attempts: 1,
            },
          ],
          error: null,
        });
      }
      if (fn === "complete_booking_sms_job") {
        providerSidPassed = args?.p_provider_sid;
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent_count).toBe(1);
    expect(data.failed_count).toBe(0);
    expect(providerSidPassed).toBeNull();
  });

  it("falls back to default error message when sendSMS fails without an error string (line 86 branch)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    // success: false with no error field → exercises `smsResult.error ?? "SMS delivery failed"`
    vi.mocked(sendSMS).mockResolvedValue({ success: false });
    let failErrorPassed: unknown = "untouched";
    mockRpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({
          data: [
            {
              booking_id: "booking-no-err",
              event_key: "post_call_transcription:conv_no_err",
              to_phone: "+34612345678",
              message: "Confirmation SMS",
              attempts: 3,
            },
          ],
          error: null,
        });
      }
      if (fn === "fail_booking_sms_job") {
        failErrorPassed = args?.p_error;
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(1);
    expect(failErrorPassed).toBe("SMS delivery failed");
  });

  it("falls back to an empty jobs array when claimedJobs RPC data is nullish (line 47 ?? branch)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        // No error, but data is null (not an array) — exercises `claimedJobs ?? []`.
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.claimed_count).toBe(0);
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(0);
  });

  it("handles empty claimed jobs list gracefully (no iterations)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "claim_retryable_booking_sms_jobs") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/retry-booking-sms", {
        method: "GET",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.claimed_count).toBe(0);
    expect(data.sent_count).toBe(0);
    expect(data.failed_count).toBe(0);
  });
});
