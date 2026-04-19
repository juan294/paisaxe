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
});
