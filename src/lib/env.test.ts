import { describe, it, expect, afterEach } from "vitest";

describe("env module", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore env after each test
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) {
        delete process.env[key];
      } else {
        process.env[key] = origEnv[key];
      }
    }
  });

  describe("getEnv", () => {
    it("returns trimmed value when variable is set", async () => {
      process.env.TEST_ENV_VAR_XYZ = "  hello  ";
      const { getEnv } = await import("./env");
      expect(getEnv("TEST_ENV_VAR_XYZ")).toBe("hello");
    });

    it("returns undefined when variable is not set and no default provided", async () => {
      delete process.env.TEST_ENV_VAR_XYZ;
      const { getEnv } = await import("./env");
      expect(getEnv("TEST_ENV_VAR_XYZ")).toBeUndefined();
    });

    it("returns default when variable is not set", async () => {
      delete process.env.TEST_ENV_VAR_XYZ;
      const { getEnv } = await import("./env");
      expect(getEnv("TEST_ENV_VAR_XYZ", "default-value")).toBe("default-value");
    });

    it("trims whitespace including invisible chars", async () => {
      process.env.TEST_ENV_VAR_XYZ = "value\n";
      const { getEnv } = await import("./env");
      expect(getEnv("TEST_ENV_VAR_XYZ")).toBe("value");
    });
  });

  describe("requireEnv", () => {
    it("returns trimmed value when variable is set", async () => {
      process.env.TEST_REQUIRED_VAR = "  required-value  ";
      const { requireEnv } = await import("./env");
      expect(requireEnv("TEST_REQUIRED_VAR")).toBe("required-value");
    });

    it("throws when variable is not set", async () => {
      delete process.env.TEST_REQUIRED_VAR;
      const { requireEnv } = await import("./env");
      expect(() => requireEnv("TEST_REQUIRED_VAR")).toThrow(
        "Missing required environment variable: TEST_REQUIRED_VAR"
      );
    });

    it("throws when variable is empty after trim", async () => {
      process.env.TEST_REQUIRED_VAR = "   ";
      const { requireEnv } = await import("./env");
      expect(() => requireEnv("TEST_REQUIRED_VAR")).toThrow(
        "Missing required environment variable: TEST_REQUIRED_VAR"
      );
    });
  });

  describe("typed constant helpers", () => {
    it("getPostHogHost returns the default when env var is unset", async () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
      const { getPostHogHost } = await import("./env");
      expect(getPostHogHost()).toBe("https://eu.i.posthog.com");
    });

    it("getPostHogHost returns trimmed env var when set", async () => {
      process.env.NEXT_PUBLIC_POSTHOG_HOST = "  https://us.i.posthog.com  ";
      const { getPostHogHost } = await import("./env");
      expect(getPostHogHost()).toBe("https://us.i.posthog.com");
    });

    it("getSupabaseUrl returns trimmed SUPABASE_URL", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
      const { getSupabaseUrl } = await import("./env");
      expect(getSupabaseUrl()).toBe("https://abc.supabase.co");
    });

    it("getSupabaseUrl returns undefined when SUPABASE_URL is unset", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { getSupabaseUrl } = await import("./env");
      expect(getSupabaseUrl()).toBeUndefined();
    });

    it("getSupabaseAnonKey returns trimmed SUPABASE_ANON_KEY", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJtest";
      const { getSupabaseAnonKey } = await import("./env");
      expect(getSupabaseAnonKey()).toBe("eyJtest");
    });

    it("getSupabaseAnonKey returns undefined when SUPABASE_ANON_KEY is unset", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const { getSupabaseAnonKey } = await import("./env");
      expect(getSupabaseAnonKey()).toBeUndefined();
    });

    it("getStripeSecretKey returns trimmed STRIPE_SECRET_KEY", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { getStripeSecretKey } = await import("./env");
      expect(getStripeSecretKey()).toBe("sk_test_123");
    });

    it("getStripeDayPassPriceId returns trimmed STRIPE_DAY_PASS_PRICE_ID", async () => {
      process.env.STRIPE_DAY_PASS_PRICE_ID = "price_abc";
      const { getStripeDayPassPriceId } = await import("./env");
      expect(getStripeDayPassPriceId()).toBe("price_abc");
    });

    it("getStripeWebhookSecret returns trimmed STRIPE_WEBHOOK_SECRET", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      const { getStripeWebhookSecret } = await import("./env");
      expect(getStripeWebhookSecret()).toBe("whsec_test");
    });

    it("getSiteUrl returns trimmed SITE_URL", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://paisaxe.es";
      const { getSiteUrl } = await import("./env");
      expect(getSiteUrl()).toBe("https://paisaxe.es");
    });

    it("getSiteUrl returns undefined when SITE_URL is unset", async () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      const { getSiteUrl } = await import("./env");
      expect(getSiteUrl()).toBeUndefined();
    });

    it("getPostHogKey returns trimmed POSTHOG_KEY", async () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_testkey";
      const { getPostHogKey } = await import("./env");
      expect(getPostHogKey()).toBe("phc_testkey");
    });

    it("getPostHogKey returns undefined when POSTHOG_KEY is unset", async () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      const { getPostHogKey } = await import("./env");
      expect(getPostHogKey()).toBeUndefined();
    });
  });

  // #556: NEXT_PUBLIC getters must use STATIC process.env.NAME access so
  // Next.js / Turbopack inlines them into the client bundle. Dynamic
  // process.env[key] access works server-side but resolves to undefined in
  // the browser polyfill, which silently breaks the Supabase client and
  // makes auth-dependent UI (e.g. the bookmark sign-in flow) a dead button.
  describe("static NEXT_PUBLIC access (regression for #556)", () => {
    it("source uses literal process.env.NEXT_PUBLIC_* access, not dynamic getEnv", async () => {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const source = await readFile(
        path.join(process.cwd(), "src/lib/env.ts"),
        "utf8",
      );
      const publicVars = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SITE_URL",
        "NEXT_PUBLIC_POSTHOG_KEY",
        "NEXT_PUBLIC_POSTHOG_HOST",
      ];
      for (const name of publicVars) {
        expect(
          source,
          `${name} must be accessed as process.env.${name} for client-side inlining`,
        ).toContain(`process.env.${name}`);
      }
    });
  });
});
