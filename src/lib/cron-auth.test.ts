import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyVercelCron, verifyWebhookSecret } from "./cron-auth";
import { logger } from "./logger";

describe("checkCronSecretsConfigured (DO-H3)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("logs console.error with [CRON_AUTH_MISSING] in production when both secrets are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("WEBHOOK_SECRET", "");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./cron-auth");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CRON_AUTH_MISSING]")
    );

    consoleSpy.mockRestore();
  });

  it("does not log when CRON_SECRET is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "some-secret");
    vi.stubEnv("WEBHOOK_SECRET", "");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./cron-auth");

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[CRON_AUTH_MISSING]")
    );

    consoleSpy.mockRestore();
  });

  it("does not log when WEBHOOK_SECRET is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("WEBHOOK_SECRET", "some-webhook-secret");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./cron-auth");

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[CRON_AUTH_MISSING]")
    );

    consoleSpy.mockRestore();
  });

  it("does not log in non-production environments even when both secrets are missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("WEBHOOK_SECRET", "");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./cron-auth");

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[CRON_AUTH_MISSING]")
    );

    consoleSpy.mockRestore();
  });

  it("only logs once even if module functions are called multiple times", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("WEBHOOK_SECRET", "");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("./cron-auth");

    // Call functions multiple times — warning should only have fired once (at module load)
    mod.verifyVercelCron({ headers: { get: () => null } } as never);
    mod.verifyVercelCron({ headers: { get: () => null } } as never);
    mod.verifyWebhookSecret({ headers: { get: () => null } } as never);

    const missingCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes("[CRON_AUTH_MISSING]")
    );
    expect(missingCalls).toHaveLength(1);

    consoleSpy.mockRestore();
  });
});

function makeRequest(
  url: string,
  headers: Record<string, string> = {},
  method = "GET"
): NextRequest {
  return new NextRequest(url, { method, headers });
}

describe("verifyVercelCron", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-abc123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for valid Bearer token matching CRON_SECRET", () => {
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer test-cron-secret-abc123",
    });
    expect(verifyVercelCron(req)).toBe(true);
  });

  it("returns false when authorization header is missing", () => {
    const req = makeRequest("http://localhost/api/cron/test");
    expect(verifyVercelCron(req)).toBe(false);
  });

  it("returns false when CRON_SECRET env var is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer something",
    });
    expect(verifyVercelCron(req)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer wrong-secret",
    });
    expect(verifyVercelCron(req)).toBe(false);
  });

  it("returns false for missing Bearer prefix", () => {
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "test-cron-secret-abc123",
    });
    expect(verifyVercelCron(req)).toBe(false);
  });

  it("trims CRON_SECRET env var", () => {
    vi.stubEnv("CRON_SECRET", "  test-cron-secret-abc123  ");
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer test-cron-secret-abc123",
    });
    expect(verifyVercelCron(req)).toBe(true);
  });
});

describe("verifyVercelCron — [CRON_AUTH_REJECTED] observability (BE-B1)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("logs [CRON_AUTH_REJECTED] with reason 'missing_secret' when CRON_SECRET env var is empty", () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer anything",
    });

    expect(verifyVercelCron(req)).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[CRON_AUTH_REJECTED]",
      expect.objectContaining({ reason: "missing_secret" })
    );
  });

  it("logs [CRON_AUTH_REJECTED] with reason 'header_missing' when authorization header is absent", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-abc123");
    const req = makeRequest("http://localhost/api/cron/test");

    expect(verifyVercelCron(req)).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[CRON_AUTH_REJECTED]",
      expect.objectContaining({ reason: "header_missing" })
    );
  });

  it("logs [CRON_AUTH_REJECTED] with reason 'mismatch' when the bearer token is wrong", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-abc123");
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer wrong-secret",
    });

    expect(verifyVercelCron(req)).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[CRON_AUTH_REJECTED]",
      expect.objectContaining({ reason: "mismatch" })
    );
  });

  it("logs [CRON_AUTH_REJECTED] with reason 'mismatch' when the Bearer prefix is missing", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-abc123");
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "test-cron-secret-abc123",
    });

    expect(verifyVercelCron(req)).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[CRON_AUTH_REJECTED]",
      expect.objectContaining({ reason: "mismatch" })
    );
  });

  it("does not log when authentication succeeds (no regression noise)", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-abc123");
    const req = makeRequest("http://localhost/api/cron/test", {
      authorization: "Bearer test-cron-secret-abc123",
    });

    expect(verifyVercelCron(req)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[CRON_AUTH_REJECTED]",
      expect.anything()
    );
  });
});

describe("verifyWebhookSecret", () => {
  beforeEach(() => {
    vi.stubEnv("WEBHOOK_SECRET", "test-webhook-secret-xyz789");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for valid x-webhook-secret header", () => {
    const req = makeRequest(
      "http://localhost/api/cron/test",
      { "x-webhook-secret": "test-webhook-secret-xyz789" },
      "POST"
    );
    expect(verifyWebhookSecret(req)).toBe(true);
  });

  it("returns false when header is missing", () => {
    const req = makeRequest("http://localhost/api/cron/test", {}, "POST");
    expect(verifyWebhookSecret(req)).toBe(false);
  });

  it("returns false when WEBHOOK_SECRET env var is not set", () => {
    vi.stubEnv("WEBHOOK_SECRET", "");
    const req = makeRequest(
      "http://localhost/api/cron/test",
      { "x-webhook-secret": "something" },
      "POST"
    );
    expect(verifyWebhookSecret(req)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const req = makeRequest(
      "http://localhost/api/cron/test",
      { "x-webhook-secret": "wrong-secret" },
      "POST"
    );
    expect(verifyWebhookSecret(req)).toBe(false);
  });

  it("trims WEBHOOK_SECRET env var", () => {
    vi.stubEnv("WEBHOOK_SECRET", "  test-webhook-secret-xyz789  ");
    const req = makeRequest(
      "http://localhost/api/cron/test",
      { "x-webhook-secret": "test-webhook-secret-xyz789" },
      "POST"
    );
    expect(verifyWebhookSecret(req)).toBe(true);
  });
});
