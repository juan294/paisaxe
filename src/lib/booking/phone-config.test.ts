// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ isFeatureFlagEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags-server", () => flags);

const {
  PHONE_CONFIRMATION_KEY_PREFIX,
  isPhoneConfirmationCall,
  isPhoneMerchant,
  phoneConfirmationConfigured,
  phoneConfirmationReadiness,
  phoneConfirmationTestNumber,
} = await import("./phone-config");

function configure(phone: string | undefined = "+34 612 345 678") {
  vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", phone);
  vi.stubEnv("ELEVENLABS_API_KEY", "sk-test");
  vi.stubEnv("ELEVENLABS_PHONE_NUMBER_ID", "phnum-test");
  vi.stubEnv("ELEVENLABS_BOOKING_AGENT_ID", "agent-test");
}

beforeEach(() => {
  vi.clearAllMocks();
  flags.isFeatureFlagEnabled.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("phoneConfirmationTestNumber", () => {
  it("is the owner's test number in E.164, or null when absent, blank or not a valid Spanish number", () => {
    configure("612 345 678");
    expect(phoneConfirmationTestNumber()).toBe("+34612345678");
    vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "  ");
    expect(phoneConfirmationTestNumber()).toBeNull();
    vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "+33612345678");
    expect(phoneConfirmationTestNumber()).toBeNull();
    // Premium-rate numbers are refused like in make-booking.
    vi.stubEnv("PHONE_CONFIRMATION_TEST_NUMBER", "806123456");
    expect(phoneConfirmationTestNumber()).toBeNull();
  });
});

describe("phoneConfirmationConfigured / phoneConfirmationReadiness", () => {
  it("is ready only with the test number, the ElevenLabs outbound settings and booking_system on", async () => {
    configure();
    expect(phoneConfirmationConfigured()).toBe(true);
    expect(await phoneConfirmationReadiness()).toEqual({ ready: true, phone: "+34612345678" });
    expect(flags.isFeatureFlagEnabled).toHaveBeenCalledWith("booking_system");
  });

  it.each(["PHONE_CONFIRMATION_TEST_NUMBER", "ELEVENLABS_API_KEY", "ELEVENLABS_PHONE_NUMBER_ID", "ELEVENLABS_BOOKING_AGENT_ID"])(
    "without %s it is not_configured and the flag is not even read",
    async (name) => {
      configure();
      vi.stubEnv(name, "");
      expect(phoneConfirmationConfigured()).toBe(false);
      expect(await phoneConfirmationReadiness()).toEqual({ ready: false, reason: "not_configured" });
      expect(flags.isFeatureFlagEnabled).not.toHaveBeenCalled();
    }
  );

  it("with booking_system off it is booking_disabled", async () => {
    configure();
    flags.isFeatureFlagEnabled.mockResolvedValue(false);
    expect(await phoneConfirmationReadiness()).toEqual({ ready: false, reason: "booking_disabled" });
  });
});

describe("isPhoneMerchant", () => {
  it("reads the embedded merchant's confirmation_mode", () => {
    expect(isPhoneMerchant({ title: "x", merchant: { confirmation_mode: "phone" } })).toBe(true);
    expect(isPhoneMerchant({ merchant: { confirmation_mode: "instant" } })).toBe(false);
    expect(isPhoneMerchant({ title: "x" })).toBe(false);
    expect(isPhoneMerchant({ merchant: null })).toBe(false);
    expect(isPhoneMerchant(null)).toBe(false);
  });
});

describe("isPhoneConfirmationCall", () => {
  it("recognizes the pending_bookings rows this flow claims, by idempotency key", () => {
    expect(isPhoneConfirmationCall({ idempotency_key: `${PHONE_CONFIRMATION_KEY_PREFIX}pay-1` })).toBe(true);
    expect(isPhoneConfirmationCall({ idempotency_key: "mcp-idempotency-key" })).toBe(false);
    expect(isPhoneConfirmationCall({ idempotency_key: null })).toBe(false);
    expect(isPhoneConfirmationCall({})).toBe(false);
    expect(isPhoneConfirmationCall(null)).toBe(false);
  });
});
