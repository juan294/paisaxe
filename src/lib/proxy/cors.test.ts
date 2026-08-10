import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { handleCORS, addCORSHeaders } from "./cors";

describe("cors — ALLOWED_ORIGINS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("includes production paisaxe.es domains", async () => {
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).toContain("https://paisaxe.es");
    expect(ALLOWED_ORIGINS).toContain("https://www.paisaxe.es");
  });

  it("includes PLAYWRIGHT_TEST_ORIGIN when env var is set", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST_ORIGIN", "http://localhost:3100");
    vi.resetModules();
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).toContain("http://localhost:3100");
  });

  it("does not include test origin when PLAYWRIGHT_TEST_ORIGIN is absent", async () => {
    vi.resetModules();
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).not.toContain("http://localhost:3100");
  });

  it("includes localhost:3006 when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).toContain("http://localhost:3006");
  });

  it("does not include the alternate-domain origins when alternateDomain is falsy", async () => {
    vi.doMock("@/config/location", () => ({
      LOCATION_CONFIG: {
        domain: "paisaxe.es",
        alternateDomain: "",
      },
    }));
    vi.resetModules();
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).toEqual(["https://paisaxe.es", "https://www.paisaxe.es"]);
    vi.doUnmock("@/config/location");
  });
});

function makeRequest(
  url: string,
  init: { method?: string; origin?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {};
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(url, { method: init.method ?? "GET", headers });
}

describe("handleCORS", () => {
  it("returns null for non-API routes regardless of method", () => {
    const req = makeRequest("https://paisaxe.es/immersive", {
      method: "OPTIONS",
      origin: "https://paisaxe.es",
    });
    expect(handleCORS(req)).toBeNull();
  });

  it("returns null for non-OPTIONS API requests", () => {
    const req = makeRequest("https://paisaxe.es/api/health", {
      method: "GET",
      origin: "https://paisaxe.es",
    });
    expect(handleCORS(req)).toBeNull();
  });

  it("returns a 204 preflight response with CORS headers for an allowed origin", () => {
    const req = makeRequest("https://paisaxe.es/api/health", {
      method: "OPTIONS",
      origin: "https://paisaxe.es",
    });
    const res = handleCORS(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.es");
    expect(res?.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res?.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(res?.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("returns a bare 204 preflight response (no CORS headers) for a disallowed origin", () => {
    const req = makeRequest("https://paisaxe.es/api/health", {
      method: "OPTIONS",
      origin: "https://evil.example.com",
    });
    const res = handleCORS(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns a bare 204 preflight response when no origin header is present", () => {
    const req = makeRequest("https://paisaxe.es/api/health", {
      method: "OPTIONS",
    });
    const res = handleCORS(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("addCORSHeaders", () => {
  it("sets CORS headers on the response for an allowed origin on an API route", () => {
    const req = makeRequest("https://paisaxe.es/api/health", {
      origin: "https://paisaxe.es",
    });
    const res = NextResponse.json({ ok: true });
    addCORSHeaders(req, res);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.es");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("x-csrf-token");
  });

  it("does not set CORS headers for a disallowed origin", () => {
    const req = makeRequest("https://paisaxe.es/api/health", {
      origin: "https://evil.example.com",
    });
    const res = NextResponse.json({ ok: true });
    addCORSHeaders(req, res);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not set CORS headers for non-API routes even with an allowed origin", () => {
    const req = makeRequest("https://paisaxe.es/immersive", {
      origin: "https://paisaxe.es",
    });
    const res = NextResponse.json({ ok: true });
    addCORSHeaders(req, res);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not set CORS headers when no origin header is present", () => {
    const req = makeRequest("https://paisaxe.es/api/health");
    const res = NextResponse.json({ ok: true });
    addCORSHeaders(req, res);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
