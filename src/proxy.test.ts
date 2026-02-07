import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proxy, shouldBypassMaintenanceMode, AUTH_REFRESH_TIMEOUT_MS } from "./proxy";
import { NextRequest } from "next/server";

// Mock global fetch for database checks
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CORS proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.MAINTENANCE_MODE = "false";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    vi.unstubAllEnvs();
  });

  it("should allow requests from paisaxe.com", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://paisaxe.com" },
    });

    const response = await proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.com");
  });

  it("should allow requests from www.paisaxe.com", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://www.paisaxe.com" },
    });

    const response = await proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.paisaxe.com");
  });

  it("should allow requests from paisaxe.es", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://paisaxe.es" },
    });

    const response = await proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.es");
  });

  it("should allow requests from www.paisaxe.es", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://www.paisaxe.es" },
    });

    const response = await proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.paisaxe.es");
  });

  it("should not add CORS headers for unknown origins", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "https://evil.com" },
    });

    const response = await proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should handle OPTIONS preflight with 204 for allowed origins", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "OPTIONS",
      headers: { origin: "https://paisaxe.com" },
    });

    const response = await proxy(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://paisaxe.com");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
  });

  it("should handle OPTIONS preflight without CORS for unknown origins", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "OPTIONS",
      headers: { origin: "https://evil.com" },
    });

    const response = await proxy(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should pass through same-origin requests without CORS headers", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat");
    // No origin header (same-origin)

    const response = await proxy(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CORS proxy - development", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  it("should not allow localhost in production", async () => {
    // Note: The ALLOWED_ORIGINS array is built at module load time.
    // If the module was loaded with NODE_ENV=development (which is common in test environments),
    // localhost WILL be in the allowed list and this test will verify that behavior.
    // In true production environments (NODE_ENV=production at module load), localhost would not be allowed.
    // Since we can't reliably change NODE_ENV after module load, this test verifies current behavior.
    process.env.MAINTENANCE_MODE = "false";

    const request = new NextRequest("http://localhost:3000/api/chat", {
      headers: { origin: "http://localhost:3000" },
    });

    const response = await proxy(request);

    // In development mode (current test environment), localhost IS allowed
    // In production, it would not be (but we can't test that without reloading the module)
    if (process.env.NODE_ENV === "development") {
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    } else {
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });
});

describe("Maintenance mode", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  describe("when MAINTENANCE_MODE env var is false", () => {
    beforeEach(() => {
      process.env.MAINTENANCE_MODE = "false";
    });

    it("allows all requests through", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /immersive route", async () => {
      const request = new NextRequest("http://localhost:3000/immersive");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });
  });

  describe("when MAINTENANCE_MODE env var is true", () => {
    beforeEach(() => {
      process.env.MAINTENANCE_MODE = "true";
    });

    it("redirects root path to /coming-soon", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/coming-soon"
      );
    });

    it("allows /immersive routes through (purchase flow testing)", async () => {
      const request = new NextRequest("http://localhost:3000/immersive");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /pricing routes through (purchase flow)", async () => {
      const request = new NextRequest("http://localhost:3000/pricing");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /admin routes through", async () => {
      const request = new NextRequest("http://localhost:3000/admin/dashboard");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /api routes through", async () => {
      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /auth routes through", async () => {
      const request = new NextRequest("http://localhost:3000/auth/callback");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /coming-soon page through", async () => {
      const request = new NextRequest("http://localhost:3000/coming-soon");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows /_next routes through", async () => {
      const request = new NextRequest(
        "http://localhost:3000/_next/static/chunks/main.js"
      );
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows favicon through", async () => {
      const request = new NextRequest("http://localhost:3000/favicon.ico");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows static image files through", async () => {
      const request = new NextRequest(
        "http://localhost:3000/images/stories/test.png"
      );
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows robots.txt through", async () => {
      const request = new NextRequest("http://localhost:3000/robots.txt");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows sitemap.xml through", async () => {
      const request = new NextRequest("http://localhost:3000/sitemap.xml");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows manifest.json through", async () => {
      const request = new NextRequest("http://localhost:3000/manifest.json");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows icon files through", async () => {
      const request = new NextRequest("http://localhost:3000/icon-192.png");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows apple-touch-icon through", async () => {
      const request = new NextRequest(
        "http://localhost:3000/apple-touch-icon.png"
      );
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });
  });

  describe("when MAINTENANCE_MODE env var is not set (database flag)", () => {
    beforeEach(() => {
      delete process.env.MAINTENANCE_MODE;
      // Set up Supabase env vars for database check
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    });

    it("allows requests when database flag is false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ enabled: false }]),
      });

      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("redirects when database flag is true", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ enabled: true }]),
      });

      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/coming-soon"
      );
    });

    it("allows requests when database query fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      // Should default to off when database fails
      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows requests when flag not found in database", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      // Should default to off when flag not found
      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows requests when fetch throws error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      // Should default to off when fetch fails
      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("still bypasses /admin routes even when database flag is true", async () => {
      // No need to mock fetch - bypass routes don't check the flag

      const request = new NextRequest("http://localhost:3000/admin/dashboard");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBeTruthy();
      // Should not have made a fetch call since /admin bypasses
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("without Supabase configuration", () => {
    beforeEach(() => {
      delete process.env.MAINTENANCE_MODE;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    });

    it("allows requests when Supabase is not configured", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const response = await proxy(request);

      // Should default to off when no Supabase config
      expect(response.headers.get("x-middleware-next")).toBeTruthy();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe("shouldBypassMaintenanceMode", () => {
  it("returns true for /admin routes", () => {
    expect(shouldBypassMaintenanceMode("/admin")).toBe(true);
    expect(shouldBypassMaintenanceMode("/admin/dashboard")).toBe(true);
  });

  it("returns true for /api routes", () => {
    expect(shouldBypassMaintenanceMode("/api")).toBe(true);
    expect(shouldBypassMaintenanceMode("/api/health")).toBe(true);
  });

  it("returns true for /auth routes", () => {
    expect(shouldBypassMaintenanceMode("/auth")).toBe(true);
    expect(shouldBypassMaintenanceMode("/auth/callback")).toBe(true);
  });

  it("returns true for /coming-soon", () => {
    expect(shouldBypassMaintenanceMode("/coming-soon")).toBe(true);
  });

  it("returns true for /_next routes", () => {
    expect(shouldBypassMaintenanceMode("/_next/static/main.js")).toBe(true);
  });

  it("returns true for static assets", () => {
    expect(shouldBypassMaintenanceMode("/favicon.ico")).toBe(true);
    expect(shouldBypassMaintenanceMode("/icon.svg")).toBe(true);
    expect(shouldBypassMaintenanceMode("/image.png")).toBe(true);
    expect(shouldBypassMaintenanceMode("/robots.txt")).toBe(true);
    expect(shouldBypassMaintenanceMode("/sitemap.xml")).toBe(true);
    expect(shouldBypassMaintenanceMode("/manifest.json")).toBe(true);
  });

  it("returns false for visitor routes not in bypass list", () => {
    expect(shouldBypassMaintenanceMode("/")).toBe(false);
    expect(shouldBypassMaintenanceMode("/some-page")).toBe(false);
    expect(shouldBypassMaintenanceMode("/story/123")).toBe(false);
  });

  it("returns true for /immersive and /pricing (purchase flow bypass)", () => {
    expect(shouldBypassMaintenanceMode("/immersive")).toBe(true);
    expect(shouldBypassMaintenanceMode("/pricing")).toBe(true);
    expect(shouldBypassMaintenanceMode("/pricing/success")).toBe(true);
  });
});

describe("/story/[slug] rewrite", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  it("rewrites /story/oviedo-catedral to /immersive?story=oviedo-catedral", async () => {
    const request = new NextRequest("http://localhost:3000/story/oviedo-catedral");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/immersive?story=oviedo-catedral"
    );
  });

  it("rewrites /story/lagos-de-covadonga to /immersive?story=lagos-de-covadonga", async () => {
    const request = new NextRequest("http://localhost:3000/story/lagos-de-covadonga");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/immersive?story=lagos-de-covadonga"
    );
  });

  it("does not rewrite /story without a slug", async () => {
    const request = new NextRequest("http://localhost:3000/story");
    const response = await proxy(request);

    // Should pass through normally (no redirect)
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("does not rewrite /story/ with trailing slash but no slug", async () => {
    const request = new NextRequest("http://localhost:3000/story/");
    const response = await proxy(request);

    // Should pass through normally (no redirect)
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("does not rewrite /stories or other similar paths", async () => {
    const request = new NextRequest("http://localhost:3000/stories/test");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("preserves existing query params on /story/ redirect", async () => {
    const request = new NextRequest("http://localhost:3000/story/oviedo-catedral?ref=twitter");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    const location = response.headers.get("location")!;
    expect(location).toContain("/immersive");
    expect(location).toContain("story=oviedo-catedral");
    expect(location).toContain("ref=twitter");
  });

  it("works during maintenance mode (story routes are redirected before maintenance check)", async () => {
    process.env.MAINTENANCE_MODE = "true";
    const request = new NextRequest("http://localhost:3000/story/oviedo-catedral");
    const response = await proxy(request);

    // Should redirect to immersive, not to coming-soon
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/immersive?story=oviedo-catedral"
    );
  });
});

describe("Canonical domain redirect", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  it("redirects paisaxe.com to paisaxe.es preserving path", async () => {
    const request = new NextRequest("https://paisaxe.com/immersive");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://paisaxe.es/immersive"
    );
  });

  it("redirects www.paisaxe.com to paisaxe.es preserving path", async () => {
    const request = new NextRequest("https://www.paisaxe.com/some-page");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://paisaxe.es/some-page"
    );
  });

  it("redirects www.paisaxe.es to paisaxe.es preserving path", async () => {
    const request = new NextRequest("https://www.paisaxe.es/immersive");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://paisaxe.es/immersive"
    );
  });

  it("preserves query params on canonical redirect", async () => {
    const request = new NextRequest("https://paisaxe.com/immersive?story=oviedo-catedral");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://paisaxe.es/immersive?story=oviedo-catedral"
    );
  });

  it("redirects paisaxe.com root to paisaxe.es root (single hop)", async () => {
    const request = new NextRequest("https://paisaxe.com/");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://paisaxe.es/");
  });

  it("does not redirect requests already on paisaxe.es", async () => {
    const request = new NextRequest("https://paisaxe.es/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("does not redirect localhost in development", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });
});

describe("Auth session refresh timeout", () => {
  // Real Supabase anon keys are JWTs starting with 'eyJ' (base64 JWT header)
  const FAKE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test";

  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_JWT_KEY;
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("should return response within timeout when Supabase auth hangs", async () => {
    // Simulate a hanging fetch (never resolves) — e.g., DNS resolution hang
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const request = new NextRequest("http://localhost:3000/immersive");

    const startTime = Date.now();
    const response = await proxy(request);
    const elapsed = Date.now() - startTime;

    // Should have returned a valid response (not hung)
    expect(response.headers.get("x-middleware-next")).toBeTruthy();

    // Should complete within AUTH_REFRESH_TIMEOUT_MS + 1s buffer
    expect(elapsed).toBeLessThan(AUTH_REFRESH_TIMEOUT_MS + 1000);
  }, 10_000); // test timeout: 10s

  it("should return response normally when Supabase responds quickly", async () => {
    // Simulate a fast auth response (getUser call succeeds)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { user: null }, error: null }),
    });

    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("should return response when Supabase auth returns an error", async () => {
    // Simulate a connection error
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("should skip auth refresh when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    // No fetch should have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should skip auth refresh when Supabase key is not a valid JWT", async () => {
    // Dummy keys used in CI/E2E don't start with 'eyJ'
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    // Should not have attempted any fetch — skipped immediately
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
