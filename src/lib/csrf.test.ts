import { describe, it, expect } from "vitest";
import {
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  validateCsrfToken,
  isExemptFromCsrf,
  csrfCookieOptions,
} from "./csrf";

describe("generateCsrfToken", () => {
  it("returns a 64-character hex string (32 bytes)", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(10);
  });
});

describe("CSRF constants", () => {
  it("uses __csrf as cookie name", () => {
    expect(CSRF_COOKIE_NAME).toBe("__csrf");
  });

  it("uses x-csrf-token as header name", () => {
    expect(CSRF_HEADER_NAME).toBe("x-csrf-token");
  });
});

describe("validateCsrfToken", () => {
  it("returns true when header and cookie tokens match", () => {
    const token = "abc123def456";
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrfToken(request)).toBe(true);
  });

  it("returns false when header token is missing", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=some-token`,
      },
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when cookie token is missing", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: "some-token",
      },
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when cookies exist but __csrf cookie is not among them", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: "some-token",
        cookie: "session=abc123; theme=dark",
      },
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when tokens don't match", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: "token-a",
        cookie: `${CSRF_COOKIE_NAME}=token-b`,
      },
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when tokens have different lengths", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: "short",
        cookie: `${CSRF_COOKIE_NAME}=much-longer-token`,
      },
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when both tokens are empty strings", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: "",
        cookie: `${CSRF_COOKIE_NAME}=`,
      },
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("handles multiple cookies correctly", () => {
    const token = "valid-csrf-token";
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: token,
        cookie: `session=abc; ${CSRF_COOKIE_NAME}=${token}; other=xyz`,
      },
    });
    expect(validateCsrfToken(request)).toBe(true);
  });

  it("validates with a real generated token", () => {
    const token = generateCsrfToken();
    const request = new Request("http://localhost/api/test", {
      headers: {
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrfToken(request)).toBe(true);
  });
});

describe("isExemptFromCsrf", () => {
  it("exempts webhook routes", () => {
    expect(isExemptFromCsrf("/api/webhooks/stripe")).toBe(true);
    expect(isExemptFromCsrf("/api/webhooks/elevenlabs")).toBe(true);
    expect(isExemptFromCsrf("/api/webhooks/supabase")).toBe(true);
  });

  it("exempts MCP routes", () => {
    expect(isExemptFromCsrf("/api/mcp/tools")).toBe(true);
    expect(isExemptFromCsrf("/api/mcp/anything")).toBe(true);
  });

  it("exempts cron routes", () => {
    expect(isExemptFromCsrf("/api/cron/daily")).toBe(true);
    expect(isExemptFromCsrf("/api/cron/weekly")).toBe(true);
  });

  it("exempts health routes", () => {
    expect(isExemptFromCsrf("/api/health")).toBe(true);
    expect(isExemptFromCsrf("/api/health/deep")).toBe(true);
  });

  it("does not exempt regular API routes", () => {
    expect(isExemptFromCsrf("/api/chat/stream")).toBe(false);
    expect(isExemptFromCsrf("/api/admin/feature-flags")).toBe(false);
    expect(isExemptFromCsrf("/api/favorites")).toBe(false);
    expect(isExemptFromCsrf("/api/checkout/embedded")).toBe(false);
  });
});

describe("csrfCookieOptions", () => {
  it("sets httpOnly to false (JS must read it)", () => {
    expect(csrfCookieOptions(true).httpOnly).toBe(false);
    expect(csrfCookieOptions(false).httpOnly).toBe(false);
  });

  it("sets sameSite to strict", () => {
    expect(csrfCookieOptions(true).sameSite).toBe("strict");
  });

  it("sets secure based on production flag", () => {
    expect(csrfCookieOptions(true).secure).toBe(true);
    expect(csrfCookieOptions(false).secure).toBe(false);
  });

  it("sets path to /", () => {
    expect(csrfCookieOptions(true).path).toBe("/");
  });
});
