// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPaypalConfig } from "./env";
import { PaypalNotConfigured } from "./types";

beforeEach(() => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPaypalConfig", () => {
  it("reads the trimmed sandbox configuration", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "  client-id \n");
    expect(getPaypalConfig()).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      baseUrl: "https://api-m.sandbox.paypal.com",
      webhookId: "WH-123",
    });
  });

  it("drops a trailing slash from the base URL", () => {
    vi.stubEnv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com/");
    expect(getPaypalConfig().baseUrl).toBe("https://api-m.sandbox.paypal.com");
  });

  it("returns a null webhook id when PAYPAL_WEBHOOK_ID is unset", () => {
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    expect(getPaypalConfig().webhookId).toBeNull();
  });

  it.each(["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_API_BASE"])(
    "throws PaypalNotConfigured when %s is missing",
    (name) => {
      vi.stubEnv(name, "   ");
      expect(() => getPaypalConfig()).toThrow(PaypalNotConfigured);
    },
  );

  describe("sandbox host guard", () => {
    it.each([
      "https://api-m.paypal.com",
      "https://api.paypal.com",
      "https://sandbox.evil.example",
      "https://api-m.sandbox.paypal.com.evil.com",
      "https://evil.com/api-m.sandbox.paypal.com",
      "https://user:pass@api-m.sandbox.paypal.com",
      "https://api-m.sandbox.paypal.com:8443",
      "https://api-m.sandbox.paypal.com/v2",
      "http://api-m.sandbox.paypal.com",
      "https://api-m.sandbox.paypal.com.",
      "http://127.0.0.2:4000",
      "http://0.0.0.0:4000",
      "https://localhost:4000",
      "not a url",
    ])("rejects %s", (base) => {
      vi.stubEnv("PAYPAL_API_BASE", base);
      expect(() => getPaypalConfig()).toThrow(PaypalNotConfigured);
    });

    it.each(["http://127.0.0.1:4010", "http://localhost:4010", "http://127.0.0.1"])(
      "accepts the loopback mock %s outside production",
      (base) => {
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("PAYPAL_API_BASE", base);
        expect(getPaypalConfig().baseUrl).toBe(base);
      },
    );

    it("rejects a loopback base URL in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("PAYPAL_API_BASE", "http://127.0.0.1:4010");
      expect(() => getPaypalConfig()).toThrow(PaypalNotConfigured);
    });

    it("accepts the sandbox host in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(getPaypalConfig().baseUrl).toBe("https://api-m.sandbox.paypal.com");
    });
  });
});
