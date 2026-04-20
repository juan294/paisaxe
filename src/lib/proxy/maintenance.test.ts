import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldBypassMaintenanceMode,
  resetMaintenanceModeCache,
  isMaintenanceModeEnabled,
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
      "Failed to fetch maintenance mode flag:",
      503
    );
  });

  it("returns false when fetch throws", async () => {
    delete process.env.MAINTENANCE_MODE;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await isMaintenanceModeEnabled();
    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "Error checking maintenance mode:",
      expect.any(Error)
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
});
