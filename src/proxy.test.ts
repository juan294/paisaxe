import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "./proxy";
import { NextRequest } from "next/server";

describe("CORS proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  it("should allow requests from paisaxe.com", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://paisaxe.com" },
    });

    const response = proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.com");
  });

  it("should allow requests from www.paisaxe.com", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://www.paisaxe.com" },
    });

    const response = proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.paisaxe.com");
  });

  it("should allow requests from paisaxe.es", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://paisaxe.es" },
    });

    const response = proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.es");
  });

  it("should allow requests from www.paisaxe.es", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://www.paisaxe.es" },
    });

    const response = proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.paisaxe.es");
  });

  it("should not add CORS headers for unknown origins", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://evil.com" },
    });

    const response = proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should handle OPTIONS preflight with 204 for allowed origins", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "OPTIONS",
      headers: { origin: "https://paisaxe.com" },
    });

    const response = proxy(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.com");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
  });

  it("should handle OPTIONS preflight without CORS for unknown origins", () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "OPTIONS",
      headers: { origin: "https://evil.com" },
    });

    const response = proxy(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should pass through same-origin requests without CORS headers", () => {
    const request = new NextRequest("http://localhost:3000/api/chat");
    // No origin header (same-origin)

    const response = proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CORS proxy - development", () => {
  it("should not allow localhost in production", () => {
    // Note: The ALLOWED_ORIGINS array is built at module load time.
    // Since NODE_ENV defaults to "test" in vitest (not "development"),
    // localhost won't be in the list. This test verifies the production behavior
    // by testing that localhost is NOT allowed when not in development.
    vi.stubEnv("NODE_ENV", "production");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "http://localhost:3000" },
    });

    const response = proxy(request);
    // In production, localhost should not be allowed
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
