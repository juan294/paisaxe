import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock environment module
vi.mock("@/lib/environment", () => ({
  getEnvironment: vi.fn(() => "production"),
}));

const mockFetch = vi.fn();

describe("isFeatureFlagEnabled", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns true when flag is enabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: true }],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(true);
  });

  it("returns false when flag is disabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: false }],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });

  it("returns false when flag doesn't exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });

  it("returns false on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Connection failed"));

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });

  it("returns false when API response is not ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });

  it("returns false when no Supabase config", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    };

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false when anon key is not a real JWT (CI/E2E)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uses correct URL with flag key and environment", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: true }],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    await isFeatureFlagEnabled("randomized_order");

    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain("flag_key=eq.randomized_order");
    expect(callUrl).toContain("environment=eq.production");
    expect(callUrl).toContain("select=enabled");
  });

  it("uses next: { revalidate: 60 } in production", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: true }],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    await isFeatureFlagEnabled("randomized_order");

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.next).toEqual({ revalidate: 60 });
  });

  it("uses cache: 'no-store' in development", async () => {
    const { getEnvironment } = await import("@/lib/environment");
    vi.mocked(getEnvironment).mockReturnValue("development");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: true }],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    await isFeatureFlagEnabled("randomized_order");

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.cache).toBe("no-store");
  });

  it("emits console.error with [FEATURE_FLAG_FAILURE] when fetch throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error("Connection failed"));

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[FEATURE_FLAG_FAILURE]",
      expect.objectContaining({
        flag: "randomized_order",
        error: "Connection failed",
      })
    );
  });

  it("emits console.error with [FEATURE_FLAG_FAILURE] on non-200 response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[FEATURE_FLAG_FAILURE]",
      expect.objectContaining({
        flag: "randomized_order",
        statusCode: 503,
      })
    );
  });

  it("returns false and emits console.error on AbortError (timeout)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mockFetch.mockRejectedValue(abortError);

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    const result = await isFeatureFlagEnabled("randomized_order");

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[FEATURE_FLAG_FAILURE]",
      expect.objectContaining({
        flag: "randomized_order",
        error: expect.stringContaining("aborted"),
      })
    );
  });

  it("passes an AbortSignal to fetch for timeout control", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ enabled: true }],
    });

    const { isFeatureFlagEnabled } = await import("./feature-flags-server");
    await isFeatureFlagEnabled("randomized_order");

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.signal).toBeDefined();
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("getAllFeatureFlagsServer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns all flags as a key→enabled map", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { flag_key: "randomized_order", enabled: true },
        { flag_key: "visitor_voice_agent", enabled: false },
      ],
    });

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    const result = await getAllFeatureFlagsServer();

    expect(result).toEqual({
      randomized_order: true,
      visitor_voice_agent: false,
    });
  });

  it("returns empty object when no Supabase URL", async () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined };

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    const result = await getAllFeatureFlagsServer();

    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty object when anon key is not a real JWT", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy_key_for_e2e",
    };

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    const result = await getAllFeatureFlagsServer();

    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty object when API response is not ok", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    const result = await getAllFeatureFlagsServer();

    expect(result).toEqual({});
    expect(consoleWarn).toHaveBeenCalledWith(
      "Failed to fetch all feature flags:",
      503
    );
  });

  it("returns empty object on fetch error", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    const result = await getAllFeatureFlagsServer();

    expect(result).toEqual({});
    expect(consoleWarn).toHaveBeenCalledWith(
      "Error fetching all feature flags:",
      expect.any(Error)
    );
  });

  it("returns empty object when rows is an empty array", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    const result = await getAllFeatureFlagsServer();

    expect(result).toEqual({});
  });

  it("uses correct URL with environment filter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    await getAllFeatureFlagsServer();

    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain("environment=eq.");
    expect(callUrl).toContain("select=flag_key,enabled");
  });

  it("uses next: { revalidate: 60 } for server-side caching", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getAllFeatureFlagsServer } = await import("./feature-flags-server");
    await getAllFeatureFlagsServer();

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.next).toEqual({ revalidate: 60 });
  });
});
