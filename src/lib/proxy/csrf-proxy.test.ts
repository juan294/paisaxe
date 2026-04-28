import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { handleCsrfValidation, setCsrfCookie } from "./csrf-proxy";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken } from "@/lib/csrf";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method = "GET",
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, { method, headers });
}

// ── handleCsrfValidation ───────────────────────────────────────────────────────

describe("handleCsrfValidation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for non-API GET requests", () => {
    const req = makeRequest("https://paisaxe.es/immersive", "GET");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null for API GET requests (read-only)", () => {
    const req = makeRequest("https://paisaxe.es/api/chat", "GET");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null for OPTIONS requests", () => {
    const req = makeRequest("https://paisaxe.es/api/chat", "OPTIONS");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null for exempt POST paths (/api/webhooks/)", () => {
    const req = makeRequest("https://paisaxe.es/api/webhooks/stripe", "POST");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null for exempt POST paths (/api/health)", () => {
    const req = makeRequest("https://paisaxe.es/api/health", "POST");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null for exempt /api/mcp/ paths", () => {
    const req = makeRequest("https://paisaxe.es/api/mcp/query", "POST");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null for exempt /api/cron/ paths", () => {
    const req = makeRequest("https://paisaxe.es/api/cron/job", "POST");
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("rejects POST from a disallowed origin with 403", () => {
    const req = new NextRequest("https://paisaxe.es/api/chat", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        [CSRF_HEADER_NAME]: "sometoken",
      },
    });
    req.cookies.set(CSRF_COOKIE_NAME, "sometoken");
    const res = handleCsrfValidation(req);
    expect(res?.status).toBe(403);
  });

  it("rejects POST with mismatched CSRF token with 403", () => {
    const req = new NextRequest("https://paisaxe.es/api/chat", {
      method: "POST",
      headers: {
        origin: "https://paisaxe.es",
        [CSRF_HEADER_NAME]: "token-a",
      },
    });
    req.cookies.set(CSRF_COOKIE_NAME, "token-b");
    const res = handleCsrfValidation(req);
    expect(res?.status).toBe(403);
  });

  it("rejects POST with no CSRF header token with 403", () => {
    const req = new NextRequest("https://paisaxe.es/api/chat", {
      method: "POST",
      headers: { origin: "https://paisaxe.es" },
    });
    req.cookies.set(CSRF_COOKIE_NAME, "sometoken");
    const res = handleCsrfValidation(req);
    expect(res?.status).toBe(403);
  });

  it("returns null (passes) for POST from paisaxe.es with valid matching CSRF token", () => {
    const token = generateCsrfToken();
    const req = new NextRequest("https://paisaxe.es/api/chat", {
      method: "POST",
      headers: {
        origin: "https://paisaxe.es",
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    req.cookies.set(CSRF_COOKIE_NAME, token);
    const res = handleCsrfValidation(req);
    expect(res).toBeNull();
  });

  it("returns null (passes) for PUT with valid CSRF token", () => {
    const token = generateCsrfToken();
    const req = new NextRequest("https://paisaxe.es/api/resource/1", {
      method: "PUT",
      headers: {
        origin: "https://paisaxe.es",
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    req.cookies.set(CSRF_COOKIE_NAME, token);
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns null (passes) for DELETE with valid CSRF token", () => {
    const token = generateCsrfToken();
    const req = new NextRequest("https://paisaxe.es/api/resource/1", {
      method: "DELETE",
      headers: {
        origin: "https://paisaxe.es",
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    req.cookies.set(CSRF_COOKIE_NAME, token);
    expect(handleCsrfValidation(req)).toBeNull();
  });

  it("returns 403 for POST with no Origin (SE-M2: origin required for state-changing requests)", () => {
    const token = generateCsrfToken();
    const req = new NextRequest("https://paisaxe.es/api/chat", {
      method: "POST",
      headers: {
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    req.cookies.set(CSRF_COOKIE_NAME, token);
    const result = handleCsrfValidation(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});

// ── setCsrfCookie ──────────────────────────────────────────────────────────────

describe("setCsrfCookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets CSRF cookie on page requests that don't have one", () => {
    const req = makeRequest("https://paisaxe.es/immersive", "GET");
    const res = NextResponse.next();
    setCsrfCookie(req, res);
    expect(res.cookies.get(CSRF_COOKIE_NAME)?.value).toBeDefined();
  });

  it("does not overwrite an existing CSRF cookie", () => {
    const req = makeRequest("https://paisaxe.es/immersive", "GET");
    req.cookies.set(CSRF_COOKIE_NAME, "existing-token");
    const res = NextResponse.next();
    setCsrfCookie(req, res);
    // No new cookie should be set on the response
    expect(res.cookies.get(CSRF_COOKIE_NAME)).toBeUndefined();
  });

  it("does not set CSRF cookie on API routes", () => {
    const req = makeRequest("https://paisaxe.es/api/chat", "GET");
    const res = NextResponse.next();
    setCsrfCookie(req, res);
    expect(res.cookies.get(CSRF_COOKIE_NAME)).toBeUndefined();
  });

  it("generates a non-empty token string", () => {
    const req = makeRequest("https://paisaxe.es/", "GET");
    const res = NextResponse.next();
    setCsrfCookie(req, res);
    const cookie = res.cookies.get(CSRF_COOKIE_NAME);
    expect(cookie?.value).toBeTruthy();
    expect(typeof cookie?.value).toBe("string");
  });
});
