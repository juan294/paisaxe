import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

vi.mock("@/lib/supabase", () => ({
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

import { createAdminClient } from "@/lib/supabase";
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
});
