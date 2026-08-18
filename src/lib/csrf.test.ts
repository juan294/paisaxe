import { describe, it, expect, afterEach, vi } from "vitest";
import {
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  validateCsrfToken,
  isExemptFromCsrf,
  csrfCookieOptions,
  validateOrigin,
  isSecureRuntime,
  validateCsrfForAdminFallback,
} from "./csrf";

const ALLOWED_ORIGINS = ["https://paisaxe.es", "https://www.paisaxe.es"];

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

describe("validateOrigin", () => {
  const allowedOrigins = ["https://paisaxe.es", "https://www.paisaxe.es", "https://paisaxe.com"];

  it("returns true when Origin header matches allowed origin", () => {
    const req = new Request("https://paisaxe.es/api/chat", {
      headers: { origin: "https://paisaxe.es" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(true);
  });

  it("returns true when Origin header is www subdomain of allowed origin", () => {
    const req = new Request("https://paisaxe.es/api/chat", {
      headers: { origin: "https://www.paisaxe.es" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(true);
  });

  it("returns false when Origin header is a different domain", () => {
    const req = new Request("https://paisaxe.es/api/chat", {
      headers: { origin: "https://evil.com" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("returns false when Origin header is a subdomain attack", () => {
    const req = new Request("https://paisaxe.es/api/chat", {
      headers: { origin: "https://evil.paisaxe.es" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("returns true when Origin header is absent on GET (non-browser clients)", () => {
    const req = new Request("https://paisaxe.es/api/chat", { method: "GET" });
    expect(validateOrigin(req, allowedOrigins)).toBe(true);
  });

  it("returns true when Origin header is absent on HEAD (non-browser clients)", () => {
    const req = new Request("https://paisaxe.es/api/chat", { method: "HEAD" });
    expect(validateOrigin(req, allowedOrigins)).toBe(true);
  });

  // SE-M2: state-changing methods must have Origin header
  it("returns false when Origin header is absent on POST (SE-M2)", () => {
    const req = new Request("https://paisaxe.es/api/chat", { method: "POST" });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("returns false when Origin header is absent on PUT (SE-M2)", () => {
    const req = new Request("https://paisaxe.es/api/chat", { method: "PUT" });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("returns false when Origin header is absent on PATCH (SE-M2)", () => {
    const req = new Request("https://paisaxe.es/api/chat", { method: "PATCH" });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("returns false when Origin header is absent on DELETE (SE-M2)", () => {
    const req = new Request("https://paisaxe.es/api/chat", { method: "DELETE" });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("uses Referer as fallback when Origin is absent on GET but Referer is present", () => {
    const req = new Request("https://paisaxe.es/api/chat", {
      method: "GET",
      headers: { referer: "https://evil.com/page" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });

  it("returns true when Referer fallback matches allowed origin on GET", () => {
    const req = new Request("https://paisaxe.es/api/chat", {
      method: "GET",
      headers: { referer: "https://paisaxe.es/immersive" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(true);
  });

  it("returns false when Referer header is a malformed URL", () => {
    // Exercises the `new URL(referer)` catch branch (csrf.ts:91)
    const req = new Request("https://paisaxe.es/api/chat", {
      method: "GET",
      headers: { referer: "not a valid url" },
    });
    expect(validateOrigin(req, allowedOrigins)).toBe(false);
  });
});

// SE-M5: isSecureRuntime() helper
describe("isSecureRuntime", () => {
  afterEach(() => {
    // Restore all stubbed env vars after each test
    vi.unstubAllEnvs();
  });

  it("returns true when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    expect(isSecureRuntime()).toBe(true);
  });

  it("returns true when VERCEL_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isSecureRuntime()).toBe(true);
  });

  it("returns true when VERCEL_ENV is preview (SE-M5)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isSecureRuntime()).toBe(true);
  });

  it("returns false in local development (NODE_ENV=development, no VERCEL_ENV)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    expect(isSecureRuntime()).toBe(false);
  });

  it("returns false in test environment (NODE_ENV=test, no VERCEL_ENV)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    expect(isSecureRuntime()).toBe(false);
  });
});

// BE-H5 / SE-M1: cron admin-cookie fallback must require CSRF + Origin
describe("validateCsrfForAdminFallback", () => {
  it("returns true when Origin is allowed and CSRF token matches the cookie", () => {
    const token = "matching-token-123";
    const request = new Request("https://paisaxe.es/api/cron/subscription-optimizer", {
      method: "POST",
      headers: {
        origin: "https://paisaxe.es",
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)).toBe(true);
  });

  it("returns false when Origin and CSRF are both absent (the BE-H5/SE-M1 attack request)", () => {
    // Simulates a hostile cross-site page riding an admin's session cookie:
    // no Origin header (browsers omit it inconsistently), no CSRF token.
    const request = new Request("https://paisaxe.es/api/cron/subscription-optimizer", {
      method: "POST",
      headers: {},
    });
    expect(validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)).toBe(false);
  });

  it("returns false when Origin is disallowed even with a matching CSRF token", () => {
    const token = "matching-token-123";
    const request = new Request("https://paisaxe.es/api/cron/subscription-optimizer", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)).toBe(false);
  });

  it("returns false when Origin is allowed but the CSRF token is missing", () => {
    const request = new Request("https://paisaxe.es/api/cron/subscription-optimizer", {
      method: "POST",
      headers: { origin: "https://paisaxe.es" },
    });
    expect(validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)).toBe(false);
  });

  it("returns false when Origin is allowed but the CSRF token doesn't match the cookie", () => {
    const request = new Request("https://paisaxe.es/api/cron/subscription-optimizer", {
      method: "POST",
      headers: {
        origin: "https://paisaxe.es",
        [CSRF_HEADER_NAME]: "attacker-guess",
        cookie: `${CSRF_COOKIE_NAME}=real-token`,
      },
    });
    expect(validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)).toBe(false);
  });
});
