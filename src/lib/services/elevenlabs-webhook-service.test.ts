import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/twilio-sms", () => ({
  sendSMS: vi.fn(),
  buildConfirmationSMS: vi.fn(() => "Confirmation SMS"),
  buildDeniedSMS: vi.fn(() => "Denied SMS"),
  buildNoAnswerSMS: vi.fn(() => "No Answer SMS"),
  buildFailedSMS: vi.fn(() => "Failed SMS"),
}));

import {
  analyzeOutcome,
  buildElevenLabsEventKey,
  extractTranscriptText,
  getSMSMessage,
  parseSignatureHeader,
  verifySignature,
} from "./elevenlabs-webhook-service";
import type { PendingBooking } from "@/lib/twilio-sms";

const WEBHOOK_SECRET = "test-webhook-secret";
const originalEnv = process.env;

function sign(payload: string, ts?: number): string {
  const t = ts ?? Math.floor(Date.now() / 1000);
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(`${t}.${payload}`);
  return `t=${t},v0=${hmac.digest("hex")}`;
}

describe("elevenlabs-webhook-service", () => {
  describe("parseSignatureHeader", () => {
    it("parses t and v0 parts", () => {
      expect(parseSignatureHeader("t=1700000000,v0=abc123")).toEqual({
        timestamp: 1700000000,
        signature: "abc123",
      });
    });

    it("returns null for malformed headers", () => {
      expect(parseSignatureHeader("garbage")).toBeNull();
      expect(parseSignatureHeader("t=notanumber,v0=abc")).toBeNull();
      expect(parseSignatureHeader("t=123")).toBeNull();
    });
  });

  describe("verifySignature", () => {
    beforeEach(() => {
      process.env = { ...originalEnv, ELEVENLABS_WEBHOOK_SECRET: WEBHOOK_SECRET };
    });
    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns missing_secret when the env var is absent", () => {
      delete process.env.ELEVENLABS_WEBHOOK_SECRET;
      expect(verifySignature("{}", sign("{}"))).toBe("missing_secret");
    });

    it("returns valid for a correctly signed payload", () => {
      const payload = JSON.stringify({ conversation_id: "c1" });
      expect(verifySignature(payload, sign(payload))).toBe("valid");
    });

    it("returns invalid for a tampered payload", () => {
      const payload = JSON.stringify({ conversation_id: "c1" });
      const header = sign(payload);
      expect(verifySignature(JSON.stringify({ conversation_id: "x" }), header)).toBe(
        "invalid"
      );
    });

    it("returns invalid for a malformed header", () => {
      expect(verifySignature("{}", "not-a-header")).toBe("invalid");
    });

    it("returns expired for stale timestamps (> 30 min)", () => {
      const payload = "{}";
      const stale = Math.floor(Date.now() / 1000) - 31 * 60;
      expect(verifySignature(payload, sign(payload, stale))).toBe("expired");
    });

    it("returns invalid when signature length differs", () => {
      const payload = "{}";
      const ts = Math.floor(Date.now() / 1000);
      // valid hex but wrong length
      expect(verifySignature(payload, `t=${ts},v0=abcd`)).toBe("invalid");
    });
  });

  describe("extractTranscriptText", () => {
    it("returns empty string for undefined", () => {
      expect(extractTranscriptText(undefined)).toBe("");
    });

    it("returns string transcripts as-is (legacy)", () => {
      expect(extractTranscriptText("hola que tal")).toBe("hola que tal");
    });

    it("joins messages from array transcripts", () => {
      expect(
        extractTranscriptText([
          { role: "agent", message: "Buenas" },
          { role: "user", message: "Confirmado" },
        ])
      ).toBe("Buenas Confirmado");
    });
  });

  describe("analyzeOutcome", () => {
    it("maps explicit failure to no_answer", () => {
      expect(
        analyzeOutcome({ analysis: { call_successful: "failure" } })
      ).toBe("no_answer");
    });

    it("maps missing call_successful to no_answer", () => {
      expect(analyzeOutcome({ analysis: {} })).toBe("no_answer");
    });

    it("detects no_answer patterns first", () => {
      expect(
        analyzeOutcome({
          analysis: { call_successful: "success" },
          transcript: [{ role: "agent", message: "Ha saltado el buzón de voz" }],
        })
      ).toBe("no_answer");
    });

    it("detects denied patterns", () => {
      expect(
        analyzeOutcome({
          analysis: { call_successful: "success" },
          transcript: [{ role: "agent", message: "Lo siento, estamos completo" }],
        })
      ).toBe("denied");
    });

    it("detects confirmed patterns", () => {
      expect(
        analyzeOutcome({
          analysis: { call_successful: "success" },
          transcript: [{ role: "agent", message: "Perfecto, reserva confirmada" }],
        })
      ).toBe("confirmed");
    });

    it("defaults to failed when nothing matches", () => {
      expect(
        analyzeOutcome({
          analysis: { call_successful: "success", transcript_summary: "neutral chat" },
          transcript: [{ role: "agent", message: "blah" }],
        })
      ).toBe("failed");
    });
  });

  describe("getSMSMessage", () => {
    const booking = { id: "b1" } as unknown as PendingBooking;

    it("selects the message builder by outcome", () => {
      expect(getSMSMessage(booking, "confirmed")).toBe("Confirmation SMS");
      expect(getSMSMessage(booking, "denied")).toBe("Denied SMS");
      expect(getSMSMessage(booking, "no_answer")).toBe("No Answer SMS");
      expect(getSMSMessage(booking, "failed")).toBe("Failed SMS");
    });
  });

  describe("buildElevenLabsEventKey", () => {
    it("namespaces the conversation id", () => {
      expect(buildElevenLabsEventKey("conv_42")).toBe(
        "post_call_transcription:conv_42"
      );
    });
  });
});
