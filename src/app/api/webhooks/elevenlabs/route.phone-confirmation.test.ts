/**
 * The ElevenLabs post-call webhook's phone-confirmation hook (PayPal hackathon
 * plan, Phase 8b). After the existing idempotent RPC records a call's outcome,
 * a call this flow placed (pending_bookings.idempotency_key
 * "phone-confirmation:<payment id>") settles its PayPal authorization: the
 * recorded 'confirmed' captures, anything else voids. Every other call
 * (Pelayo's make-booking) is processed exactly as before: the hook is never
 * reached and the response is the same. route.test.ts is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/feature-flags-server", () => ({ isFeatureFlagEnabled: vi.fn() }));
vi.mock("@/lib/twilio-sms", () => ({
  sendSMS: vi.fn(),
  buildConfirmationSMS: vi.fn(() => "Confirmation SMS"),
  buildDeniedSMS: vi.fn(() => "Denied SMS"),
  buildNoAnswerSMS: vi.fn(() => "No Answer SMS"),
  buildFailedSMS: vi.fn(() => "Failed SMS"),
}));
const phone = vi.hoisted(() => ({ settlePhoneConfirmationCall: vi.fn() }));
vi.mock("@/lib/booking/phone-confirmation", () => phone);

import { POST } from "./route";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { sendSMS } from "@/lib/twilio-sms";

const SECRET = "test-webhook-secret";
const CALL_ID = "b0090000-0000-4000-8000-0000000000c1";
const originalEnv = process.env;

const phoneCall = {
  id: CALL_ID,
  idempotency_key: "phone-confirmation:pay-1",
  conversation_id: "conv_phone",
  venue_name: "Visita a una quesería artesana",
  venue_phone: "+34612345678",
  customer_name: "Paisaxe RS-ABC123",
  customer_phone: "+34612345678",
  party_size: 4,
  booking_date: "2026-11-21",
  booking_time: "11:00",
  special_requests: null,
  status: "pending",
  outcome_message: null,
};

const pelayoCall = { ...phoneCall, id: "booking-123", idempotency_key: "mcp-key-from-elevenlabs", conversation_id: "conv_456" };

function signed(body: unknown): NextRequest {
  const payload = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", SECRET).update(`${ts}.${payload}`).digest("hex");
  return new NextRequest("http://localhost:3000/api/webhooks/elevenlabs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "elevenlabs-signature": `t=${ts},v0=${sig}` },
    body: payload,
  });
}

const confirmedCall = (conversationId: string) => ({
  type: "post_call_transcription",
  data: {
    conversation_id: conversationId,
    transcript: [{ role: "user", message: "Sí, confirmado, les esperamos" }],
    analysis: { call_successful: "success", transcript_summary: "Reserva confirmada" },
  },
});

let rpc: ReturnType<typeof vi.fn>;
let rpcStatus: string;

function stubDatabase(row: Record<string, unknown> | null) {
  rpc = vi.fn((fn: string) => {
    if (fn === "process_elevenlabs_event_idempotent") return Promise.resolve({ data: rpcStatus, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) })) })),
    update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
  }));
  const client = { from, rpc };
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv, ELEVENLABS_WEBHOOK_SECRET: SECRET };
  rpcStatus = "processed";
  vi.mocked(isFeatureFlagEnabled).mockResolvedValue(false);
  vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM1" });
  phone.settlePhoneConfirmationCall.mockResolvedValue("confirmed");
});

afterEach(() => {
  process.env = originalEnv;
});

describe("ElevenLabs webhook: phone-confirmation calls", () => {
  it("records the outcome through the existing RPC first, then settles the linked authorization", async () => {
    const client = stubDatabase(phoneCall);

    const response = await POST(signed(confirmedCall("conv_phone")));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: "processed", bookingId: CALL_ID, outcome: "confirmed", smsSent: false });
    expect(rpc).toHaveBeenCalledWith("process_elevenlabs_event_idempotent", expect.objectContaining({ p_booking_id: CALL_ID, p_outcome: "confirmed" }));
    expect(phone.settlePhoneConfirmationCall).toHaveBeenCalledWith(client, CALL_ID);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(phone.settlePhoneConfirmationCall.mock.invocationCallOrder[0]);
  });

  it("a redelivered event (duplicate) settles again: a settlement that failed before is retried, by state", async () => {
    rpcStatus = "duplicate";
    stubDatabase(phoneCall);
    const response = await POST(signed(confirmedCall("conv_phone")));
    expect(response.status).toBe(200);
    expect(phone.settlePhoneConfirmationCall).toHaveBeenCalledTimes(1);
  });

  it("a failed settlement is logged and never changes the webhook's answer (reconciliation retries)", async () => {
    stubDatabase(phoneCall);
    phone.settlePhoneConfirmationCall.mockRejectedValue(new Error("PayPal down"));
    const errorSpy = vi.spyOn(logger, "error");

    const response = await POST(signed(confirmedCall("conv_phone")));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, status: "processed", outcome: "confirmed" });
    expect(errorSpy).toHaveBeenCalledWith("[PHONE_CONFIRMATION_SETTLE_FAILED]", { callId: CALL_ID, error: "PayPal down" });
  });

  it("a non-Error failure is logged by its string form", async () => {
    stubDatabase(phoneCall);
    phone.settlePhoneConfirmationCall.mockRejectedValue("weird");
    const errorSpy = vi.spyOn(logger, "error");
    await POST(signed(confirmedCall("conv_phone")));
    expect(errorSpy).toHaveBeenCalledWith("[PHONE_CONFIRMATION_SETTLE_FAILED]", { callId: CALL_ID, error: "weird" });
  });

  it("settles before the SMS step, so an SMS failure cannot skip it", async () => {
    vi.mocked(isFeatureFlagEnabled).mockResolvedValue(true);
    stubDatabase(phoneCall);
    rpc.mockImplementation((fn: string) => {
      if (fn === "process_elevenlabs_event_idempotent") return Promise.resolve({ data: "processed", error: null });
      if (fn === "enqueue_booking_sms_job") return Promise.resolve({ data: null, error: { message: "enqueue failed" } });
      return Promise.resolve({ data: null, error: null });
    });
    const response = await POST(signed(confirmedCall("conv_phone")));
    expect(response.status).toBe(500);
    expect(phone.settlePhoneConfirmationCall).toHaveBeenCalledTimes(1);
  });

  it("a booking that disappeared at the RPC is not settled", async () => {
    rpcStatus = "booking_missing";
    stubDatabase(phoneCall);
    await POST(signed(confirmedCall("conv_phone")));
    expect(phone.settlePhoneConfirmationCall).not.toHaveBeenCalled();
  });
});

describe("ElevenLabs webhook: every other call is unchanged (regression)", () => {
  it("a make-booking call (Pelayo) never reaches the phone-confirmation hook", async () => {
    stubDatabase(pelayoCall);
    const response = await POST(signed(confirmedCall("conv_456")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: "processed", bookingId: "booking-123", outcome: "confirmed", smsSent: false });
    expect(phone.settlePhoneConfirmationCall).not.toHaveBeenCalled();
  });

  it("a row without an idempotency key (legacy) never reaches it either", async () => {
    const legacy: Record<string, unknown> = { ...pelayoCall };
    delete legacy.idempotency_key;
    stubDatabase(legacy);
    await POST(signed(confirmedCall("conv_456")));
    expect(phone.settlePhoneConfirmationCall).not.toHaveBeenCalled();
  });
});
