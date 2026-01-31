import { describe, it, expect, beforeEach, vi } from "vitest";

describe("environment detection", () => {
  beforeEach(() => {
    // Reset modules before each test to get fresh imports
    vi.resetModules();
    // Unstub all env vars
    vi.unstubAllEnvs();
  });

  describe("getEnvironment", () => {
    it("returns development when NEXT_PUBLIC_SITE_URL is localhost", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
      vi.stubEnv("NODE_ENV", "production"); // Even if NODE_ENV says production

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("development");
    });

    it("returns development when NEXT_PUBLIC_SITE_URL is 127.0.0.1", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("development");
    });

    it("returns production when NEXT_PUBLIC_SITE_URL is a production domain", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
      vi.stubEnv("NODE_ENV", "production");

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("production");
    });

    it("returns development when NODE_ENV is development (no SITE_URL)", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.stubEnv("NODE_ENV", "development");

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("development");
    });

    it("returns production when NODE_ENV is production (no SITE_URL)", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.stubEnv("NODE_ENV", "production");

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("production");
    });

    it("returns production by default when no env vars set", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.stubEnv("NODE_ENV", "");

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("production");
    });

    it("handles invalid SITE_URL gracefully", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-valid-url");
      vi.stubEnv("NODE_ENV", "production");

      const { getEnvironment } = await import("./environment");
      expect(getEnvironment()).toBe("production");
    });
  });

  describe("isDevelopment", () => {
    it("returns true when environment is development", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

      const { isDevelopment } = await import("./environment");
      expect(isDevelopment()).toBe(true);
    });

    it("returns false when environment is production", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
      vi.stubEnv("NODE_ENV", "production");

      const { isDevelopment } = await import("./environment");
      expect(isDevelopment()).toBe(false);
    });
  });

  describe("isProduction", () => {
    it("returns true when environment is production", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
      vi.stubEnv("NODE_ENV", "production");

      const { isProduction } = await import("./environment");
      expect(isProduction()).toBe(true);
    });

    it("returns false when environment is development", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

      const { isProduction } = await import("./environment");
      expect(isProduction()).toBe(false);
    });
  });
});
