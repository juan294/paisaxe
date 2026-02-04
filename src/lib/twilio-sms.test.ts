import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendSMS,
  buildConfirmationSMS,
  buildDeniedSMS,
  buildNoAnswerSMS,
  buildFailedSMS,
  type PendingBooking,
} from "./twilio-sms";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const originalEnv = process.env;

const mockBooking: PendingBooking = {
  id: "booking-123",
  conversation_id: "conv_456",
  venue_name: "Casa Gerardo",
  venue_phone: "+34 985 88 77 97",
  customer_name: "Juan García",
  customer_phone: "+34612345678",
  party_size: 4,
  booking_date: "Hoy",
  booking_time: "21:00",
  special_requests: null,
  status: "pending",
  outcome_message: null,
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-01T10:00:00Z",
};

describe("twilio-sms", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: "ACtest123",
      TWILIO_AUTH_TOKEN: "test-auth-token",
      TWILIO_PHONE_NUMBER: "+15551234567",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("sendSMS", () => {
    it("should return error when Twilio credentials are missing", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await sendSMS("+34612345678", "Test message");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Twilio not configured");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should send SMS successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sid: "SM123456789",
            status: "queued",
          }),
      });

      const result = await sendSMS("+34612345678", "Test message");

      expect(result.success).toBe(true);
      expect(result.sid).toBe("SM123456789");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("api.twilio.com");
      expect(url).toContain("ACtest123");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toContain("Basic");
      expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    });

    it("should handle Twilio API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            message: "Invalid phone number",
          }),
      });

      const result = await sendSMS("+invalid", "Test message");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid phone number");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await sendSMS("+34612345678", "Test message");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("buildConfirmationSMS", () => {
    it("should build confirmation message with correct format", () => {
      const message = buildConfirmationSMS(mockBooking);

      expect(message).toContain("✓ Reserva confirmada");
      expect(message).toContain("Casa Gerardo");
      expect(message).toContain("Hoy, 21:00");
      expect(message).toContain("4 personas");
      expect(message).toContain("+34 985 88 77 97");
      expect(message).toContain("Pelayo (paisaxe.es)");
    });

    it("should use singular 'persona' for party of 1", () => {
      const singleBooking = { ...mockBooking, party_size: 1 };
      const message = buildConfirmationSMS(singleBooking);

      expect(message).toContain("1 persona");
    });
  });

  describe("buildDeniedSMS", () => {
    it("should build denied message with default reason", () => {
      const message = buildDeniedSMS(mockBooking);

      expect(message).toContain("✗ No disponible");
      expect(message).toContain("Casa Gerardo no tiene mesa");
      expect(message).toContain("4 personas");
      expect(message).toContain("Puedes llamarles directamente");
      expect(message).toContain("+34 985 88 77 97");
    });

    it("should build denied message with custom reason", () => {
      const message = buildDeniedSMS(mockBooking, "está cerrado los lunes");

      expect(message).toContain("Casa Gerardo está cerrado los lunes");
    });

    it("should use singular 'persona' for party of 1", () => {
      const singleBooking = { ...mockBooking, party_size: 1 };
      const message = buildDeniedSMS(singleBooking);

      expect(message).toContain("1 persona");
    });
  });

  describe("buildNoAnswerSMS", () => {
    it("should build no answer message", () => {
      const message = buildNoAnswerSMS(mockBooking);

      expect(message).toContain("📞 Sin respuesta");
      expect(message).toContain("No pudimos contactar con Casa Gerardo");
      expect(message).toContain("Prueba a llamar directamente");
      expect(message).toContain("+34 985 88 77 97");
    });
  });

  describe("buildFailedSMS", () => {
    it("should build failed message", () => {
      const message = buildFailedSMS(mockBooking);

      expect(message).toContain("⚠️ Error en la llamada");
      expect(message).toContain("No pudimos completar la llamada a Casa Gerardo");
      expect(message).toContain("Puedes llamarles directamente");
      expect(message).toContain("+34 985 88 77 97");
    });
  });
});
