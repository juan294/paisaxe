import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyVercelCron, verifyWebhookSecret } from "./cron-auth";

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
