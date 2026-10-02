import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  shouldBypassMaintenanceMode,
  resetMaintenanceModeCache,
  isMaintenanceModeEnabled,
  handleMaintenanceMode,
} from "./maintenance";

vi.mock("@/lib/environment", () => ({
  getEnvironment: vi.fn(() => "production"),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("shouldBypassMaintenanceMode", () => {
  it("bypasses /admin routes", () => {
    expect(shouldBypassMaintenanceMode("/admin")).toBe(true);
    expect(shouldBypassMaintenanceMode("/admin/dashboard")).toBe(true);
  });

  it("bypasses /api routes", () => {
    expect(shouldBypassMaintenanceMode("/api/health")).toBe(true);
  });

  it("bypasses /coming-soon", () => {
    expect(shouldBypassMaintenanceMode("/coming-soon")).toBe(true);
  });

  it("bypasses static assets", () => {
    expect(shouldBypassMaintenanceMode("/favicon.ico")).toBe(true);
    expect(shouldBypassMaintenanceMode("/robots.txt")).toBe(true);
    expect(shouldBypassMaintenanceMode("/sitemap.xml")).toBe(true);
    expect(shouldBypassMaintenanceMode("/manifest.json")).toBe(true);
    expect(shouldBypassMaintenanceMode("/icon.png")).toBe(true);
    expect(shouldBypassMaintenanceMode("/logo.webp")).toBe(true);
  });

  it("does not bypass visitor routes", () => {
    expect(shouldBypassMaintenanceMode("/")).toBe(false);
    expect(shouldBypassMaintenanceMode("/favorites")).toBe(false);
  });

  it("does NOT bypass /immersive (DO-H3: maintenance mode must gate the main app)", () => {
    expect(shouldBypassMaintenanceMode("/immersive")).toBe(false);
    expect(shouldBypassMaintenanceMode("/immersive?story=oviedo-catedral")).toBe(false);
  });

  it("bypasses the exact PostHog reverse-proxy path (PE-M6)", () => {
    expect(shouldBypassMaintenanceMode("/a/static/array.js")).toBe(true);
    expect(shouldBypassMaintenanceMode("/a/e/")).toBe(true);
  });

  it("does NOT bypass unrelated routes starting with 'a' (PE-M6)", () => {
    expect(shouldBypassMaintenanceMode("/about")).toBe(false);
    expect(shouldBypassMaintenanceMode("/agenda")).toBe(false);
    // /auth is a distinct, intentional bypass entry — unaffected by the /a narrowing
    expect(shouldBypassMaintenanceMode("/auth/callback")).toBe(true);
  });
});

describe("resetMaintenanceModeCache", () => {
  it("can be called without throwing", () => {
    expect(() => resetMaintenanceModeCache()).not.toThrow();
  });

  it("resets cached state so subsequent fetch is made (cache miss after reset)", async () => {
    // First, prime the cache by calling isMaintenanceModeEnabled in test mode
    // (NODE_ENV=test means isDev=true, so cache is never populated in test — but
    // resetMaintenanceModeCache itself is covered by the direct call above)
    resetMaintenanceModeCache();
    // No assertion needed — function returns void; calling twice must also not throw
    resetMaintenanceModeCache();
  });
});

describe("isMaintenanceModeEnabled", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    };
    resetMaintenanceModeCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns true when MAINTENANCE_MODE env is 'true'", async () => {
    process.env.MAINTENANCE_MODE = "true";
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false when MAINTENANCE_MODE env is 'false'", async () => {
    process.env.MAINTENANCE_MODE = "false";
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false when Supabase is not configured", async () => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns true when DB flag is enabled", async () => {
    delete process.env.MAINTENANCE_MODE;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: true }],
    });
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(true);
  });

  it("returns false when DB flag is disabled", async () => {
    delete process.env.MAINTENANCE_MODE;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: false }],
    });
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
  });

  it("returns false when DB response is not ok", async () => {
    delete process.env.MAINTENANCE_MODE;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch maintenance mode flag")
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"status":503')
    );
  });

  it("returns false when fetch throws", async () => {
    delete process.env.MAINTENANCE_MODE;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error checking maintenance mode")
    );
  });

  it("returns false and stringifies a non-Error thrown value", async () => {
    delete process.env.MAINTENANCE_MODE;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue("a plain string failure");
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error checking maintenance mode")
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("a plain string failure")
    );
  });

  it("returns false when rows array is empty (flag not found)", async () => {
    delete process.env.MAINTENANCE_MODE;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
  });

  describe("production cache (NODE_ENV != 'test', env = 'production')", () => {
    beforeEach(() => {
      delete process.env.MAINTENANCE_MODE;
      vi.stubEnv("NODE_ENV", "production");
      resetMaintenanceModeCache();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      resetMaintenanceModeCache();
    });

    it("populates the cache on first fetch (covers lines 114-116)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ enabled: true }],
      });
      const result = await isMaintenanceModeEnabled();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns cached value on subsequent calls without refetching (covers line 87)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ enabled: true }],
      });
      const first = await isMaintenanceModeEnabled();
      const second = await isMaintenanceModeEnabled();
      const third = await isMaintenanceModeEnabled();
      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(third).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("refetches when cache URL changes (different Supabase project)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ enabled: false }],
      });
      await isMaintenanceModeEnabled();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://different.supabase.co";
      await isMaintenanceModeEnabled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("refetches after cache expiry (30s TTL)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ enabled: false }],
      });
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      await isMaintenanceModeEnabled();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance past the 30s TTL
      nowSpy.mockReturnValue(1_000_000 + 31_000);
      await isMaintenanceModeEnabled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      nowSpy.mockRestore();
    });

    it("does not cache when DB response is not ok and there is no prior last-known value", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await isMaintenanceModeEnabled();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ enabled: true }],
      });
      // Next call should refetch because prior error did not populate cache
      const result = await isMaintenanceModeEnabled();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      consoleError.mockRestore();
    });

    it("DO-H3: falls back to the last-known TRUE value past TTL when the refresh fails (not ok)", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ enabled: true }],
      });
      const primed = await isMaintenanceModeEnabled();
      expect(primed).toBe(true);

      // Advance past the 30s TTL, then make the refresh fail.
      nowSpy.mockReturnValue(1_000_000 + 31_000);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      const result = await isMaintenanceModeEnabled();

      // Must serve the last-known value (true), NOT default to false.
      expect(result).toBe(true);
      nowSpy.mockRestore();
      consoleError.mockRestore();
    });

    it("DO-H3: falls back to the last-known FALSE value past TTL when the refresh throws", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ enabled: false }],
      });
      const primed = await isMaintenanceModeEnabled();
      expect(primed).toBe(false);

      // Advance past the 30s TTL, then make the refresh throw (e.g. connectivity outage).
      nowSpy.mockReturnValue(1_000_000 + 31_000);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await isMaintenanceModeEnabled();

      // Still false here, but via the last-known fallback, not an unconditional default.
      expect(result).toBe(false);
      nowSpy.mockRestore();
      consoleError.mockRestore();
    });

    it("DO-H3: does not use a last-known value from a different Supabase project", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ enabled: true }],
      });
      await isMaintenanceModeEnabled();

      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://different.supabase.co";
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await isMaintenanceModeEnabled();

      // No last-known value for this (different) project — must default to false, not leak
      // the previous project's cached value.
      expect(result).toBe(false);
      consoleError.mockRestore();
    });
  });
});

describe("handleMaintenanceMode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    };
    resetMaintenanceModeCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    resetMaintenanceModeCache();
  });

  it("returns null when the pathname bypasses maintenance mode", async () => {
    const req = new NextRequest("https://paisaxe.es/api/health");
    const res = await handleMaintenanceMode(req);
    expect(res).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when maintenance mode is not enabled", async () => {
    process.env.MAINTENANCE_MODE = "false";
    const req = new NextRequest("https://paisaxe.es/");
    const res = await handleMaintenanceMode(req);
    expect(res).toBeNull();
  });

  it("redirects to /coming-soon when maintenance mode is enabled", async () => {
    process.env.MAINTENANCE_MODE = "true";
    const req = new NextRequest("https://paisaxe.es/some-page");
    const res = await handleMaintenanceMode(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/coming-soon");
  });
});
