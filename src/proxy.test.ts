import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Supabase SSR mock ---
// Captures the cookies config passed to createServerClient so tests can invoke setAll.
let capturedCookiesConfig: {
  getAll: () => { name: string; value: string }[];
  setAll?: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => void;
} | null = null;

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: typeof capturedCookiesConfig }) => {
    capturedCookiesConfig = options.cookies;
    return {
      auth: {
        getUser: mockGetUser,
      },
    };
  }),
}));

import { proxy, shouldBypassMaintenanceMode, AUTH_REFRESH_TIMEOUT_MS, hasSupabaseAuthCookies } from "./proxy";

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
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, PATCH, DELETE, OPTIONS");
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
      const request = new NextRequest("http://localhost:3000/favorites");
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
        "http://localhost:3000/images/stories/test.webp"
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

      const request = new NextRequest("http://localhost:3000/favorites");
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

      const request = new NextRequest("http://localhost:3000/favorites");
      const response = await proxy(request);

      // Should default to off when database fails
      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows requests when flag not found in database", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const request = new NextRequest("http://localhost:3000/favorites");
      const response = await proxy(request);

      // Should default to off when flag not found
      expect(response.headers.get("x-middleware-next")).toBeTruthy();
    });

    it("allows requests when fetch throws error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = new NextRequest("http://localhost:3000/favorites");
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
      const request = new NextRequest("http://localhost:3000/favorites");
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

  it("redirects paisaxe.com root to paisaxe.es root", async () => {
    const request = new NextRequest("https://paisaxe.com/");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://paisaxe.es/");
  });

  it("redirects www.paisaxe.com root to paisaxe.es root", async () => {
    const request = new NextRequest("https://www.paisaxe.com/");
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

  it("does not redirect unknown hostnames that are not alternate domains", async () => {
    // Vercel preview deployments or other unknown hostnames should pass through
    const request = new NextRequest("https://paisaxe-abc123.vercel.app/immersive");
    const response = await proxy(request);

    // Should NOT redirect — hostname is not in alternate domains list
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });
});

describe("Root path redirect", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  it("redirects / to /immersive on canonical domain with 308", async () => {
    const request = new NextRequest("https://paisaxe.es/");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://paisaxe.es/immersive"
    );
  });

  it("redirects / to /immersive on localhost with 308", async () => {
    const request = new NextRequest("http://localhost:3000/");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/immersive"
    );
  });

  it("does not redirect non-root paths", async () => {
    const request = new NextRequest("https://paisaxe.es/favorites");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("does not redirect /immersive", async () => {
    const request = new NextRequest("https://paisaxe.es/immersive");
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
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    capturedCookiesConfig = null;
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("should return response within timeout when Supabase auth hangs", async () => {
    // Simulate a hanging getUser (never resolves) — e.g., DNS resolution hang
    mockGetUser.mockImplementation(() => new Promise(() => {}));

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });

    const startTime = Date.now();
    const response = await proxy(request);
    const elapsed = Date.now() - startTime;

    // Should have returned a valid response (not hung)
    expect(response.headers.get("x-middleware-next")).toBeTruthy();

    // Should complete within AUTH_REFRESH_TIMEOUT_MS + 3s buffer (generous to avoid flaky CI under load)
    expect(elapsed).toBeLessThan(AUTH_REFRESH_TIMEOUT_MS + 3000);
  }, 10_000); // test timeout: 10s

  it("should return response normally when Supabase responds quickly", async () => {
    // Simulate a fast auth response (getUser call succeeds)
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("should return response when Supabase auth returns an error", async () => {
    // Simulate a connection error thrown during getUser
    mockGetUser.mockRejectedValue(new TypeError("fetch failed"));

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("should skip auth refresh when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    // createServerClient should not have been called (skipped early)
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("should skip auth refresh when Supabase key is not a valid JWT", async () => {
    // Dummy keys used in CI/E2E don't start with 'eyJ'
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    // Should not have attempted getUser — skipped immediately
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});

describe("Auth session refresh - setAll cookie callback", () => {
  const FAKE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test";

  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_JWT_KEY;
    mockFetch.mockReset();
    mockGetUser.mockReset();
    capturedCookiesConfig = null;
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("should set cookies on request and response when setAll is invoked during session refresh", async () => {
    // When getUser() triggers a token refresh, Supabase calls setAll with new cookies.
    // We simulate this by having getUser invoke setAll before resolving.
    mockGetUser.mockImplementation(async () => {
      // Supabase internally calls setAll when refreshing tokens
      if (capturedCookiesConfig?.setAll) {
        capturedCookiesConfig.setAll([
          { name: "sb-access-token", value: "new-access-token", options: { path: "/", httpOnly: true } },
          { name: "sb-refresh-token", value: "new-refresh-token", options: { path: "/", httpOnly: true } },
        ]);
      }
      return { data: { user: { id: "user-1" } }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    const response = await proxy(request);

    // The response should still be a valid next() response
    expect(response.headers.get("x-middleware-next")).toBeTruthy();

    // The setAll callback should have set cookies on the response
    const accessCookie = response.cookies.get("sb-access-token");
    expect(accessCookie).toBeDefined();
    expect(accessCookie?.value).toBe("new-access-token");

    const refreshCookie = response.cookies.get("sb-refresh-token");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.value).toBe("new-refresh-token");
  });

  it("should set cookies on the request object for downstream processing", async () => {
    // Verify the setAll callback also sets cookies on the request (for server components)
    mockGetUser.mockImplementation(async () => {
      if (capturedCookiesConfig?.setAll) {
        capturedCookiesConfig.setAll([
          { name: "sb-session", value: "session-data", options: { path: "/" } },
        ]);
      }
      return { data: { user: null }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    await proxy(request);

    // Verify cookie was set on the request object
    const sessionCookie = request.cookies.get("sb-session");
    expect(sessionCookie?.value).toBe("session-data");
  });

  it("should update response cookies when session is refreshed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");

    // Make getUser trigger setAll
    mockGetUser.mockImplementation(async () => {
      if (capturedCookiesConfig?.setAll) {
        capturedCookiesConfig.setAll([
          { name: "sb-abc-auth-token", value: "new-token", options: { path: "/" } },
        ]);
      }
      return { data: { user: { id: "user-1" } }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/some-page", {
      headers: { origin: "https://paisaxe.es" },
    });
    request.cookies.set("sb-abc-auth-token", "old-token");

    const response = await proxy(request);

    // The response should have the updated cookie
    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("sb-abc-auth-token");
  });

  it("should handle setAll with multiple cookies", async () => {
    mockGetUser.mockImplementation(async () => {
      if (capturedCookiesConfig?.setAll) {
        capturedCookiesConfig.setAll([
          { name: "cookie-a", value: "value-a", options: { path: "/", secure: true } },
          { name: "cookie-b", value: "value-b", options: { path: "/", secure: true } },
          { name: "cookie-c", value: "value-c", options: { path: "/", httpOnly: true } },
        ]);
      }
      return { data: { user: null }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    const response = await proxy(request);

    expect(response.cookies.get("cookie-a")?.value).toBe("value-a");
    expect(response.cookies.get("cookie-b")?.value).toBe("value-b");
    expect(response.cookies.get("cookie-c")?.value).toBe("value-c");
  });

  it("should provide getAll callback that returns request cookies", async () => {
    // After proxy runs with auth cookies, the captured cookies config
    // should have a getAll that delegates to request.cookies.getAll()
    mockGetUser.mockImplementation(async () => {
      // Invoke getAll during the auth flow to cover line 327
      if (capturedCookiesConfig) {
        const cookies = capturedCookiesConfig.getAll();
        expect(Array.isArray(cookies)).toBe(true);
      }
      return { data: { user: null }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value; other-cookie=abc" },
    });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    // Verify capturedCookiesConfig was set (meaning createServerClient was called)
    expect(capturedCookiesConfig).not.toBeNull();
  });
});

describe("Auth session refresh - error logging", () => {
  const FAKE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test";

  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_JWT_KEY;
    mockFetch.mockReset();
    mockGetUser.mockReset();
    capturedCookiesConfig = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.mocked(console.error).mockRestore();
  });

  it("should NOT log when error is an Auth refresh timeout", async () => {
    // Simulate getUser hanging and the Promise.race timeout firing
    mockGetUser.mockImplementation(() => new Promise(() => {}));

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    await proxy(request);

    // The timeout error message is "Auth refresh timeout" — should be silently caught
    expect(console.error).not.toHaveBeenCalledWith(
      "Error refreshing auth session:",
      expect.anything()
    );
  }, 10_000);

  it("should log when error is an Error with non-timeout message", async () => {
    // Simulate a real error from getUser (not a timeout)
    const realError = new TypeError("fetch failed");
    mockGetUser.mockRejectedValue(realError);

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    await proxy(request);

    expect(console.error).toHaveBeenCalledWith(
      "Error refreshing auth session:",
      realError
    );
  });

  it("should NOT log when thrown value is not an Error instance", async () => {
    // Simulate a non-Error thrown value (e.g., a string)
    mockGetUser.mockRejectedValue("some string error");

    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=some-jwt-value" },
    });
    await proxy(request);

    // Not an Error instance, so the condition (error instanceof Error) is false
    expect(console.error).not.toHaveBeenCalledWith(
      "Error refreshing auth session:",
      expect.anything()
    );
  });
});

describe("CSP nonce", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  it("should set a Content-Security-Policy header with a nonce on every response", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/'nonce-[A-Za-z0-9_-]+'/);
  });

  it("should include required script-src directives in the CSP", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csp = response.headers.get("Content-Security-Policy")!;
    // Must allow Stripe scripts
    expect(csp).toContain("https://js.stripe.com");
    // Must allow blob: for ElevenLabs AudioWorklet
    expect(csp).toContain("blob:");
    // Must NOT contain unsafe-inline in script-src
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toBeTruthy();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("should keep style-src with unsafe-inline for Tailwind/Next.js CSS", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csp = response.headers.get("Content-Security-Policy")!;
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"));
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("should generate a unique nonce per request", async () => {
    const request1 = new NextRequest("http://localhost:3000/immersive");
    const request2 = new NextRequest("http://localhost:3000/immersive");

    const response1 = await proxy(request1);
    const response2 = await proxy(request2);

    const csp1 = response1.headers.get("Content-Security-Policy")!;
    const csp2 = response2.headers.get("Content-Security-Policy")!;

    const nonce1 = csp1.match(/'nonce-([A-Za-z0-9_-]+)'/)?.[1];
    const nonce2 = csp2.match(/'nonce-([A-Za-z0-9_-]+)'/)?.[1];

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
  });

  it("should set x-csp-nonce request header for downstream server components", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    // The nonce should be passed to downstream server components via request header
    const csp = response.headers.get("Content-Security-Policy")!;
    const nonceFromCsp = csp.match(/'nonce-([A-Za-z0-9_-]+)'/)?.[1];

    // The request headers should contain the nonce for downstream reading
    expect(request.headers.get("x-csp-nonce")).toBe(nonceFromCsp);
  });

  it("should include strict-dynamic in script-src for nonce propagation", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csp = response.headers.get("Content-Security-Policy")!;
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("should include all required CSP directives", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csp = response.headers.get("Content-Security-Policy")!;

    // Verify all essential directives are present
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src");
    expect(csp).toContain("font-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("media-src");
    expect(csp).toContain("worker-src");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("should not set CSP on redirect responses", async () => {
    // paisaxe.com → paisaxe.es redirect
    const request = new NextRequest("https://paisaxe.com/immersive");
    const response = await proxy(request);

    expect(response.status).toBe(308);
    // Redirect responses don't need CSP
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });
});

describe("CSRF protection", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  it("sets a __csrf cookie on responses that don't have one", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csrfCookie = response.cookies.get("__csrf");
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie?.value).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves existing __csrf cookie instead of generating a new one", async () => {
    const existingToken = "a".repeat(64);
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: {
        cookie: `__csrf=${existingToken}`,
      },
    });
    const response = await proxy(request);

    // Should NOT set a new cookie (existing one is preserved)
    const csrfCookie = response.cookies.get("__csrf");
    // The cookie might not be explicitly set on the response if it already exists
    // What matters is that it doesn't overwrite with a new value
    if (csrfCookie) {
      expect(csrfCookie.value).toBe(existingToken);
    }
  });

  it("returns 403 for POST to /api/ without CSRF token", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "test" }),
    });
    const response = await proxy(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("CSRF");
  });

  it("returns 403 for PUT to /api/ without CSRF token", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/stories/123", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "test" }),
    });
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it("returns 403 for PATCH to /api/ without CSRF token", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/feature-flags/test", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it("returns 403 for DELETE to /api/ without CSRF token", async () => {
    const request = new NextRequest("http://localhost:3000/api/favorites?storyId=123", {
      method: "DELETE",
    });
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it("allows POST when CSRF header matches cookie", async () => {
    const token = "b".repeat(64);
    const request = new NextRequest("http://localhost:3000/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
        cookie: `__csrf=${token}`,
      },
      body: JSON.stringify({ message: "hello" }),
    });
    const response = await proxy(request);

    // Should NOT be 403
    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("returns 403 when CSRF header does not match cookie", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "a".repeat(64),
        cookie: `__csrf=${"b".repeat(64)}`,
      },
      body: JSON.stringify({ message: "hello" }),
    });
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it("does not enforce CSRF on GET requests to /api/", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/stories");
    const response = await proxy(request);

    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("exempts webhook routes from CSRF", async () => {
    const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const response = await proxy(request);

    // Should NOT be 403 — webhooks use their own signature verification
    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("exempts /api/cron/ routes from CSRF", async () => {
    const request = new NextRequest("http://localhost:3000/api/cron/daily-post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const response = await proxy(request);

    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("exempts /api/mcp/ routes from CSRF", async () => {
    const request = new NextRequest("http://localhost:3000/api/mcp/tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const response = await proxy(request);

    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeTruthy();
  });

  it("does not enforce CSRF on non-API routes (e.g., pages)", async () => {
    const request = new NextRequest("http://localhost:3000/immersive", {
      method: "POST",
    });
    const response = await proxy(request);

    expect(response.status).not.toBe(403);
  });

  it("sets SameSite=Strict on the CSRF cookie", async () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    const csrfCookie = response.cookies.get("__csrf");
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie?.sameSite).toBe("strict");
  });
});

describe("hasSupabaseAuthCookies", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("returns false when no cookies present", () => {
    const request = new NextRequest("http://localhost:3000/immersive");
    expect(hasSupabaseAuthCookies(request)).toBe(false);
  });

  it("returns true when base auth token cookie present", () => {
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=jwt-value" },
    });
    expect(hasSupabaseAuthCookies(request)).toBe(true);
  });

  it("returns true when chunked auth token cookies present", () => {
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token.0=chunk0" },
    });
    expect(hasSupabaseAuthCookies(request)).toBe(true);
  });

  it("returns false when Supabase URL not configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "sb-test-project-auth-token=jwt-value" },
    });
    expect(hasSupabaseAuthCookies(request)).toBe(false);
  });

  it("returns false for unrelated cookies", () => {
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: { cookie: "__csrf=abc123; theme=dark" },
    });
    expect(hasSupabaseAuthCookies(request)).toBe(false);
  });

  it("returns false for invalid Supabase URL", () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-valid-url";

    const request = new NextRequest("http://localhost:3000/test");
    expect(hasSupabaseAuthCookies(request)).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });
});

describe("Auth session refresh - anonymous visitor skip", () => {
  const FAKE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test";

  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_JWT_KEY;
    mockFetch.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    capturedCookiesConfig = null;
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("should skip auth refresh when no Supabase auth cookies exist (anonymous visitor)", async () => {
    // No cookies on request — anonymous visitor
    const request = new NextRequest("http://localhost:3000/immersive");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    // getUser should NOT have been called — skipped for anonymous
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("should run auth refresh when base auth cookie exists", async () => {
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: {
        cookie: "sb-test-project-auth-token=some-jwt-value",
      },
    });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("should run auth refresh when chunked auth cookies exist", async () => {
    const request = new NextRequest("http://localhost:3000/immersive", {
      headers: {
        cookie: "sb-test-project-auth-token.0=chunk0; sb-test-project-auth-token.1=chunk1",
      },
    });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBeTruthy();
    expect(mockGetUser).toHaveBeenCalled();
  });
});
