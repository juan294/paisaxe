import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("exported methods", () => {
    it("exports info, warn, and error methods", async () => {
      const { logger } = await import("./logger");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });
  });

  describe("in test/development environment", () => {
    it("emits structured JSON output on logger.info", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.info("[TEST_KEY]", { foo: "bar" });

      const written = spy.mock.calls
        .flatMap((args) => args)
        .join("");
      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({ level: "info", msg: "[TEST_KEY]", foo: "bar" });
    });

    it("emits structured JSON output on logger.warn", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.warn("[FEATURE_FLAG_FAILURE]", { flag: "visitor_voice_agent" });

      const written = spy.mock.calls
        .flatMap((args) => args)
        .join("");
      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({ level: "warn", msg: "[FEATURE_FLAG_FAILURE]", flag: "visitor_voice_agent" });
    });

    it("emits structured JSON output on logger.error", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.error("[CHAT_STREAM_FAILURE]", { duration_ms: 500, error: "timeout" });

      const written = spy.mock.calls
        .flatMap((args) => args)
        .join("");
      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({
        level: "error",
        msg: "[CHAT_STREAM_FAILURE]",
        duration_ms: 500,
        error: "timeout",
      });
    });

    it("includes a timestamp in the output", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.info("[TABLE_FALLBACK]", { table: "chunks" });

      const written = spy.mock.calls
        .flatMap((args) => args)
        .join("");
      const parsed = JSON.parse(written);
      expect(parsed).toHaveProperty("time");
    });

    it("works with no metadata (message only)", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.info("[STARTUP]");

      const written = spy.mock.calls
        .flatMap((args) => args)
        .join("");
      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({ level: "info", msg: "[STARTUP]" });
    });

    it("merges child bindings into emitted log lines", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.child({ request_id: "req-child-1234" }).info("[STARTUP]");

      const written = spy.mock.calls.flatMap((args) => args).join("");
      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({
        level: "info",
        msg: "[STARTUP]",
        request_id: "req-child-1234",
      });
    });

    it("includes request context bindings automatically", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { logger } = await import("./logger");
      const { runWithRequestContext } = await import("./request-context");

      runWithRequestContext({ requestId: "req-context-1234" }, () => {
        logger.info("[STARTUP]");
      });

      const written = spy.mock.calls.flatMap((args) => args).join("");
      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({
        level: "info",
        msg: "[STARTUP]",
        request_id: "req-context-1234",
      });
    });

    it("redacts email, phone, token, and user identifiers in structured metadata", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.error("[PII_TEST]", {
        email: "traveler@example.com",
        phone: "+34 612 34 56 78",
        token: "sk_live_secret_123",
        user_id: "user-123",
      });

      const written = spy.mock.calls.flatMap((args) => args).join("");
      expect(written).not.toContain("traveler@example.com");
      expect(written).not.toContain("+34 612 34 56 78");
      expect(written).not.toContain("sk_live_secret_123");
      expect(written).not.toContain("user-123");

      const parsed = JSON.parse(written);
      expect(parsed).toMatchObject({
        email: "[REDACTED]",
        phone: "[REDACTED]",
        token: "[REDACTED]",
        user_id: "[REDACTED]",
      });
    });

    it("redacts deeply nested request headers and JSON payload strings", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { logger } = await import("./logger");
      logger.info("[REQUEST_TEST]", {
        req: {
          headers: {
            cookie: "sb-access=secret-cookie",
            authorization: "Bearer secret-token",
          },
        },
        rawBody: JSON.stringify({
          customer_email: "booking@example.com",
          customer_phone: "+34 699 00 11 22",
        }),
      });

      const written = spy.mock.calls.flatMap((args) => args).join("");
      expect(written).not.toContain("sb-access=secret-cookie");
      expect(written).not.toContain("secret-token");
      expect(written).not.toContain("booking@example.com");
      expect(written).not.toContain("+34 699 00 11 22");

      const parsed = JSON.parse(written);
      expect(parsed.req.headers.cookie).toBe("[REDACTED]");
      expect(parsed.req.headers.authorization).toBe("[REDACTED]");
      expect(parsed.rawBody).toContain("[REDACTED]");
    });
  });

  describe("in production environment (makePinoLogger)", () => {
    it("routes info, warn, error, and child calls through pino instance", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const mockChild = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      };
      const mockPinoInstance = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnValue(mockChild),
      };
      vi.doMock("pino", () => ({ default: vi.fn().mockReturnValue(mockPinoInstance) }));

      const { logger } = await import("./logger");

      // info with meta → hits the "meta keys present" branch (line 118)
      logger.info("[TEST_META]", { key: "value" });
      expect(mockPinoInstance.info).toHaveBeenCalledTimes(1);

      // info without meta → hits the no-meta branch (line 122)
      logger.info("[TEST_NO_META]");
      expect(mockPinoInstance.info).toHaveBeenCalledTimes(2);

      // warn (line 127)
      logger.warn("[WARN]");
      expect(mockPinoInstance.warn).toHaveBeenCalledTimes(1);

      // error (line 128)
      logger.error("[ERROR]");
      expect(mockPinoInstance.error).toHaveBeenCalledTimes(1);

      // child (line 129)
      const child = logger.child({ service: "test" });
      expect(mockPinoInstance.child).toHaveBeenCalledWith(expect.objectContaining({ service: "test" }));
      expect(typeof child.info).toBe("function");
    });
  });
});
