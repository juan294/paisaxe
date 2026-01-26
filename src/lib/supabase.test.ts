import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/supabase-js before importing the module
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: vi.fn(),
  })),
}));

describe("supabase", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("supabase client", () => {
    it("should export a supabase client", async () => {
      const { supabase } = await import("./supabase");
      expect(supabase).toBeDefined();
      expect(supabase).toHaveProperty("from");
    });

    it("should create client with correct config", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      await import("./supabase");

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
    });
  });

  describe("createAdminClient", () => {
    it("should throw error if SUPABASE_SERVICE_KEY is not set", async () => {
      const originalKey = process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;

      const { createAdminClient } = await import("./supabase");

      expect(() => createAdminClient()).toThrow(
        "SUPABASE_SERVICE_KEY is required for admin operations"
      );

      process.env.SUPABASE_SERVICE_KEY = originalKey;
    });

    it("should create admin client when service key is set", async () => {
      process.env.SUPABASE_SERVICE_KEY = "test-service-key";
      vi.resetModules();

      const { createAdminClient } = await import("./supabase");
      const { createClient } = await import("@supabase/supabase-js");

      const client = createAdminClient();

      expect(client).toBeDefined();
      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-key"
      );
    });
  });
});
