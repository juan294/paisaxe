import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/supabase-js before importing the module
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: vi.fn(),
    // Non-function property to exercise the proxy's non-function branch
    storageKey: "test-storage-key",
  })),
}));

describe("supabase", () => {
  beforeEach(() => {
    vi.resetModules();
    // Restore default env vars that setup.ts provides
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  describe("supabase client", () => {
    it("should export a supabase client", async () => {
      const { supabase } = await import("./supabase");
      expect(supabase).toBeDefined();
      expect(typeof supabase.from).toBe("function");
    });

    it("should create client with correct config", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const { supabase } = await import("./supabase");
      void supabase.from;

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_URL is missing when the client is accessed", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_URL is required"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_URL is empty string when the client is accessed", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "   ";

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_URL is required"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing when the client is accessed", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_ANON_KEY is empty string when the client is accessed", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  ";

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
      );
    });

    it("should memoize the client across proxy accesses (createClient called once)", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const { supabase } = await import("./supabase");

      // The createClient mock accumulates calls across tests — count from zero
      vi.mocked(createClient).mockClear();

      // First access creates the client; second access reuses the memoized one
      void supabase.from;
      void supabase.auth;

      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it("should return non-function properties as-is without binding", async () => {
      const { supabase } = await import("./supabase");

      const value = (supabase as unknown as { storageKey: string }).storageKey;

      expect(value).toBe("test-storage-key");
    });

    it("should trim whitespace from NEXT_PUBLIC_SUPABASE_URL before use", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://test.supabase.co  ";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  test-anon-key  ";

      const { createClient } = await import("@supabase/supabase-js");
      const { supabase } = await import("./supabase");
      void supabase.from;

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
    });
  });

});
